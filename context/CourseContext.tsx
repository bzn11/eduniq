"use client";

import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import {
  type CgpaBaseline,
  loadCgpaBaseline,
  saveCgpaBaseline,
} from "@/lib/cgpa-baseline";
import {
  cloneTermsSnapshot,
  loadAcademicCache,
  reEnrichAllTerms,
  sanitizeTermsDataset,
  saveAcademicCache,
} from "@/lib/academic-storage";
import {
  applyGpaTarget,
  clearCourseTarget,
  createAssignmentId,
  createCourseId,
  enrichCourse,
  isValidCourseCredits,
  isValidTermTargetGpa,
  type Assignment,
  type AssignmentInput,
  type Course,
  type TargetType,
} from "@/lib/courses";
import { fetchFullAcademicState } from "@/lib/supabase/academic-fetch";
import {
  canPersistAcademicData,
  deleteAssignment as deleteAssignmentRecord,
  deleteCourse as deleteCourseRecord,
  deleteTerm as deleteTermRecord,
  persistAllTerms,
  persistAssignment,
  persistCourse,
  persistFullAcademicState,
  persistTerm,
} from "@/lib/supabase/academic-write";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getDefaultScale, type GradeScale } from "@/lib/grading";
import {
  createTermId,
  deleteTermById,
  ensureSingleActiveTerm,
  getActiveTerm,
  renameTermById,
  setActiveTermById,
  type Term,
} from "@/lib/terms";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type CourseUpdates = {
  credits?: number;
  targetType?: TargetType;
  targetLetter?: string | null;
  targetGpa?: number | null;
  targetPercentage?: number | null;
  clearTarget?: boolean;
};

type CourseContextValue = {
  terms: Term[];
  activeTerm: Term | undefined;
  courses: Course[];
  termTargetGpa: number | null;
  isHydratingFromCloud: boolean;
  cgpaBaseline: CgpaBaseline | null;
  setTermTargetGpa: (value: number | null) => void;
  addTerm: (name: string) => void;
  renameTerm: (termId: string, name: string) => void;
  setActiveTerm: (termId: string) => void;
  deleteTerm: (termId: string) => void;
  setCgpaBaseline: (baseline: CgpaBaseline | null) => void;
  replaceAcademicState: (
    terms: Term[],
    baseline?: CgpaBaseline | null,
  ) => Promise<boolean>;
  addCourse: (
    name: string,
    credits: number,
    target: { gpa: number; letter: string } | null,
  ) => void;
  updateCourse: (courseId: string, updates: CourseUpdates) => void;
  deleteCourse: (courseId: string) => void;
  addAssignment: (courseId: string, input: AssignmentInput) => void;
  updateAssignment: (
    courseId: string,
    assignmentId: string,
    input: AssignmentInput,
  ) => void;
  deleteAssignment: (courseId: string, assignmentId: string) => void;
  getCourseById: (id: string) => Course | undefined;
  getTermById: (termId: string) => Term | undefined;
  getTermForCourse: (courseId: string) => Term | undefined;
  isCourseInActiveTerm: (courseId: string) => boolean;
};

const CourseContext = createContext<CourseContextValue | null>(null);

function mapCourseInTerms(
  terms: Term[],
  courseId: string,
  updater: (course: Course) => Course,
): Term[] {
  return terms.map((term) => ({
    ...term,
    courses: term.courses.map((course) =>
      course.id === courseId ? updater(course) : course,
    ),
  }));
}

function updateActiveTerm(
  terms: Term[],
  updater: (term: Term) => Term,
): Term[] {
  const activeId = getActiveTerm(terms)?.id;
  if (!activeId) return ensureSingleActiveTerm(terms);

  return terms.map((term) => (term.id === activeId ? updater(term) : term));
}

function buildAssignment(input: AssignmentInput): Assignment {
  return {
    id: createAssignmentId(),
    name: input.name,
    weight: input.weight,
    earnedPoints: input.earnedPoints,
    totalPoints: input.totalPoints,
  };
}

function toCourseSeed(course: Course) {
  return {
    id: course.id,
    name: course.name,
    credits: course.credits,
    targetType: course.targetType,
    targetLetter: course.targetLetter,
    targetGpa: course.targetGpa,
    targetPercentage: course.targetPercentage,
    assignments: course.assignments,
    code: course.code,
    trend: course.trend,
  };
}

function applyValidatedTerms(rawTerms: Term[], scale: GradeScale): Term[] | null {
  if (!Array.isArray(rawTerms)) return null;
  if (rawTerms.length === 0) return [];
  return sanitizeTermsDataset(rawTerms, scale);
}

function commitValidatedTerms(
  rawTerms: Term[],
  scale: GradeScale,
  setTerms: (value: Term[]) => void,
): Term[] | null {
  const validated = applyValidatedTerms(rawTerms, scale);
  if (!validated) return null;
  setTerms(validated);
  return validated;
}

export function CourseProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { gradeScale } = useProfile();
  const [terms, setTerms] = useState<Term[]>([]);
  const [cgpaBaseline, setCgpaBaselineState] = useState<CgpaBaseline | null>(null);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [isHydratingFromCloud, setIsHydratingFromCloud] = useState(false);
  const gradeScaleRef = useRef(gradeScale);
  const termsRef = useRef(terms);
  const cgpaBaselineRef = useRef(cgpaBaseline);
  const skipCacheWriteRef = useRef(false);
  const hydrationDisplaySnapshotRef = useRef<Term[] | null>(null);
  gradeScaleRef.current = gradeScale;
  termsRef.current = terms;
  cgpaBaselineRef.current = cgpaBaseline;

  const termsForDisplay = useMemo(() => {
    if (isHydratingFromCloud && hydrationDisplaySnapshotRef.current) {
      return hydrationDisplaySnapshotRef.current;
    }
    return terms;
  }, [terms, isHydratingFromCloud]);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const userId = user?.id ?? null;
    const scale = gradeScaleRef.current;

    async function loadAcademicData() {
      if (!userId || !isSupabaseConfigured()) {
        const guestTerms = loadAcademicCache(scale, null);
        const validated = applyValidatedTerms(guestTerms, scale) ?? guestTerms;
        const guestBaseline = loadCgpaBaseline(null);
        if (!cancelled) {
          skipCacheWriteRef.current = true;
          setTerms(validated);
          setCgpaBaselineState(guestBaseline);
          skipCacheWriteRef.current = false;
          setIsHydratingFromCloud(false);
          hydrationDisplaySnapshotRef.current = null;
          setIsStorageReady(true);
        }
        return;
      }

      const cached = loadAcademicCache(scale, userId);
      const cachedValidated = applyValidatedTerms(cached, scale) ?? cached;
      const cachedBaseline = loadCgpaBaseline(userId);

      if (!cancelled) {
        hydrationDisplaySnapshotRef.current = cloneTermsSnapshot(cachedValidated);
        skipCacheWriteRef.current = true;
        setTerms(cachedValidated);
        setCgpaBaselineState(cachedBaseline);
        skipCacheWriteRef.current = false;
        setIsStorageReady(true);
        setIsHydratingFromCloud(true);
      }

      const result = await fetchFullAcademicState(userId);
      if (cancelled) return;

      setIsHydratingFromCloud(false);
      hydrationDisplaySnapshotRef.current = null;

      if (result.ok) {
        if (result.terms.length === 0) {
          skipCacheWriteRef.current = true;
          setTerms([]);
          setCgpaBaselineState(cachedBaseline);
          skipCacheWriteRef.current = false;
          saveAcademicCache([], userId);
          return;
        }

        const hydrated = applyValidatedTerms(result.terms, scale);
        if (hydrated) {
          skipCacheWriteRef.current = true;
          setTerms(hydrated);
          skipCacheWriteRef.current = false;
          saveAcademicCache(hydrated, userId);
          return;
        }
      }

      skipCacheWriteRef.current = true;
      setTerms(cachedValidated);
      skipCacheWriteRef.current = false;
    }

    void loadAcademicData();

    return () => {
      cancelled = true;
      setIsHydratingFromCloud(false);
      hydrationDisplaySnapshotRef.current = null;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!isStorageReady || isHydratingFromCloud) return;
    setTerms((prev) => reEnrichAllTerms(prev, gradeScale));
  }, [gradeScale, isStorageReady, isHydratingFromCloud]);

  useEffect(() => {
    if (!isStorageReady || skipCacheWriteRef.current || isHydratingFromCloud) {
      return;
    }
    const validated = applyValidatedTerms(terms, gradeScaleRef.current);
    if (validated === null) return;
    saveAcademicCache(validated, user?.id ?? null);
    saveCgpaBaseline(cgpaBaseline, user?.id ?? null);
  }, [terms, cgpaBaseline, isStorageReady, isHydratingFromCloud, user?.id]);

  const activeTerm = useMemo(() => getActiveTerm(termsForDisplay), [termsForDisplay]);
  const courses = useMemo(() => activeTerm?.courses ?? [], [activeTerm]);
  const termTargetGpa = activeTerm?.termTargetGpa ?? null;

  const setTermTargetGpa = useCallback(
    (value: number | null) => {
      if (value !== null && !isValidTermTargetGpa(value)) return;

      const prev = termsRef.current;
      const next = updateActiveTerm(prev, (term) => ({
        ...term,
        termTargetGpa: value,
      }));
      const active = getActiveTerm(next);
      const userId = user?.id;

      void (async () => {
        if (canPersistAcademicData(userId) && active) {
          if (!(await persistTerm(userId!, active))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [user?.id],
  );

  const addTerm = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const prev = termsRef.current;
      const newTerm: Term = {
        id: createTermId(trimmed),
        name: trimmed,
        isActive: prev.length === 0,
        courses: [],
        termTargetGpa: null,
      };
      const next =
        prev.length === 0 ? [newTerm] : ensureSingleActiveTerm([...prev, newTerm]);
      const userId = user?.id;

      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await persistTerm(userId!, newTerm))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [user?.id],
  );

  const setActiveTerm = useCallback(
    (termId: string) => {
      const prev = termsRef.current;
      const next = ensureSingleActiveTerm(setActiveTermById(prev, termId));
      const userId = user?.id;

      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await persistAllTerms(userId!, next))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [user?.id],
  );

  const renameTerm = useCallback(
    (termId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const prev = termsRef.current;
      const next = renameTermById(prev, termId, trimmed);
      const renamed = next.find((term) => term.id === termId);
      const userId = user?.id;

      void (async () => {
        if (canPersistAcademicData(userId) && renamed) {
          if (!(await persistTerm(userId!, renamed))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [user?.id],
  );

  const deleteTerm = useCallback(
    (termId: string) => {
      const prev = termsRef.current;
      const next = deleteTermById(prev, termId);
      const userId = user?.id;

      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await deleteTermRecord(userId!, termId))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [user?.id],
  );

  const setCgpaBaseline = useCallback(
    (baseline: CgpaBaseline | null) => {
      setCgpaBaselineState(baseline);
      saveCgpaBaseline(baseline, user?.id ?? null);
    },
    [user?.id],
  );

  const replaceAcademicState = useCallback(
    async (nextTerms: Term[], baseline: CgpaBaseline | null = null) => {
      const validated =
        applyValidatedTerms(nextTerms, gradeScaleRef.current) ?? nextTerms;
      const userId = user?.id;

      if (canPersistAcademicData(userId)) {
        if (!(await persistFullAcademicState(userId!, validated))) {
          return false;
        }
      }

      skipCacheWriteRef.current = true;
      setTerms(validated);
      setCgpaBaselineState(baseline);
      skipCacheWriteRef.current = false;
      saveAcademicCache(validated, userId ?? null);
      saveCgpaBaseline(baseline, userId ?? null);
      return true;
    },
    [user?.id],
  );

  const getCourseById = useCallback(
    (id: string) => {
      for (const term of terms) {
        const course = term.courses.find((entry) => entry.id === id);
        if (course) return course;
      }
      return undefined;
    },
    [terms],
  );

  const getTermById = useCallback(
    (termId: string) => terms.find((term) => term.id === termId),
    [terms],
  );

  const getTermForCourse = useCallback(
    (courseId: string) => {
      for (const term of terms) {
        if (term.courses.some((course) => course.id === courseId)) {
          return term;
        }
      }
      return undefined;
    },
    [terms],
  );

  const isCourseInActiveTerm = useCallback(
    (courseId: string) => {
      const term = getTermForCourse(courseId);
      return term?.isActive ?? false;
    },
    [getTermForCourse],
  );

  const addCourse = useCallback(
    (
      name: string,
      credits: number,
      target: { gpa: number; letter: string } | null,
    ) => {
      const trimmed = name.trim();
      if (!trimmed || !isValidCourseCredits(credits)) return;

      const targetFields = target
        ? applyGpaTarget(target.gpa, target.letter)
        : clearCourseTarget();

      const newCourse = enrichCourse(
        {
          id: createCourseId(trimmed),
          name: trimmed,
          credits,
          assignments: [],
          ...targetFields,
        },
        gradeScale,
      );

      const prev = termsRef.current;
      const active = getActiveTerm(prev);
      if (!active) return;

      const next = updateActiveTerm(prev, (term) => ({
        ...term,
        courses: [...term.courses, newCourse],
      }));
      const userId = user?.id;

      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await persistCourse(userId!, active, newCourse))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [gradeScale, user?.id],
  );

  const updateCourse = useCallback(
    (courseId: string, updates: CourseUpdates) => {
      const prev = termsRef.current;
      let syncedCourse: Course | null = null;
      let syncedTerm: Term | null = null;

      const next = mapCourseInTerms(prev, courseId, (course) => {
        const nextSeed = {
          ...toCourseSeed(course),
          ...(updates.credits !== undefined ? { credits: updates.credits } : {}),
        };

        if (updates.credits !== undefined && !isValidCourseCredits(updates.credits)) {
          return course;
        }

        if (updates.clearTarget) {
          Object.assign(nextSeed, clearCourseTarget());
        } else {
          if (updates.targetType !== undefined) nextSeed.targetType = updates.targetType;
          if (updates.targetLetter !== undefined) {
            nextSeed.targetLetter = updates.targetLetter;
          }
          if (updates.targetGpa !== undefined) nextSeed.targetGpa = updates.targetGpa;
          if (updates.targetPercentage !== undefined) {
            nextSeed.targetPercentage = updates.targetPercentage;
          }
          if (
            updates.targetGpa !== undefined &&
            updates.targetLetter !== undefined &&
            updates.targetGpa !== null &&
            updates.targetLetter
          ) {
            Object.assign(
              nextSeed,
              applyGpaTarget(updates.targetGpa, updates.targetLetter),
            );
          }
        }

        const updated = enrichCourse(nextSeed, gradeScale);
        syncedCourse = updated;
        syncedTerm =
          prev.find((term) => term.courses.some((entry) => entry.id === courseId)) ??
          null;
        return updated;
      });

      if (!syncedCourse || !syncedTerm) return;

      const userId = user?.id;
      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await persistCourse(userId!, syncedTerm!, syncedCourse!))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [gradeScale, user?.id],
  );

  const deleteCourse = useCallback(
    (courseId: string) => {
      const prev = termsRef.current;
      const next = prev.map((term) => ({
        ...term,
        courses: term.courses.filter((course) => course.id !== courseId),
      }));
      const userId = user?.id;

      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await deleteCourseRecord(userId!, courseId))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [user?.id],
  );

  const addAssignment = useCallback(
    (courseId: string, input: AssignmentInput) => {
      const assignment = buildAssignment(input);
      const prev = termsRef.current;
      let syncedCourse: Course | null = null;

      const next = mapCourseInTerms(prev, courseId, (course) => {
        const updated = enrichCourse(
          {
            ...toCourseSeed(course),
            assignments: [...course.assignments, assignment],
          },
          gradeScale,
        );
        syncedCourse = updated;
        return updated;
      });

      if (!syncedCourse) return;

      const userId = user?.id;
      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await persistAssignment(userId!, syncedCourse!, assignment))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [gradeScale, user?.id],
  );

  const updateAssignment = useCallback(
    (courseId: string, assignmentId: string, input: AssignmentInput) => {
      const updatedAssignment: Assignment = {
        id: assignmentId,
        name: input.name,
        weight: input.weight,
        earnedPoints: input.earnedPoints,
        totalPoints: input.totalPoints,
      };

      const prev = termsRef.current;
      let syncedCourse: Course | null = null;

      const next = mapCourseInTerms(prev, courseId, (course) => {
        const updated = enrichCourse(
          {
            ...toCourseSeed(course),
            assignments: course.assignments.map((entry) =>
              entry.id === assignmentId ? updatedAssignment : entry,
            ),
          },
          gradeScale,
        );
        syncedCourse = updated;
        return updated;
      });

      if (!syncedCourse) return;

      const userId = user?.id;
      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await persistAssignment(userId!, syncedCourse!, updatedAssignment))) {
            return;
          }
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [gradeScale, user?.id],
  );

  const deleteAssignment = useCallback(
    (courseId: string, assignmentId: string) => {
      const prev = termsRef.current;
      let syncedCourse: Course | null = null;

      const next = mapCourseInTerms(prev, courseId, (course) => {
        const updated = enrichCourse(
          {
            ...toCourseSeed(course),
            assignments: course.assignments.filter(
              (assignment) => assignment.id !== assignmentId,
            ),
          },
          gradeScale,
        );
        syncedCourse = updated;
        return updated;
      });

      const userId = user?.id;
      void (async () => {
        if (canPersistAcademicData(userId)) {
          if (!(await deleteAssignmentRecord(userId!, assignmentId))) return;
        }
        commitValidatedTerms(next, gradeScaleRef.current, setTerms);
      })();
    },
    [gradeScale, user?.id],
  );

  const value = useMemo(
    () => ({
      terms: termsForDisplay,
      activeTerm,
      courses,
      termTargetGpa,
      isHydratingFromCloud,
      cgpaBaseline,
      setTermTargetGpa,
      addTerm,
      renameTerm,
      setActiveTerm,
      deleteTerm,
      setCgpaBaseline,
      replaceAcademicState,
      addCourse,
      updateCourse,
      deleteCourse,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      getCourseById,
      getTermById,
      getTermForCourse,
      isCourseInActiveTerm,
    }),
    [
      termsForDisplay,
      activeTerm,
      courses,
      termTargetGpa,
      isHydratingFromCloud,
      cgpaBaseline,
      setTermTargetGpa,
      addTerm,
      renameTerm,
      setActiveTerm,
      deleteTerm,
      setCgpaBaseline,
      replaceAcademicState,
      addCourse,
      updateCourse,
      deleteCourse,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      getCourseById,
      getTermById,
      getTermForCourse,
      isCourseInActiveTerm,
    ],
  );

  if (!isStorageReady) {
    return null;
  }

  return (
    <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error("useCourses must be used within a CourseProvider");
  }
  return context;
}
