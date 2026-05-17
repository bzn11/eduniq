"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyGpaTarget,
  clearCourseTarget,
  createAssignmentId,
  createCourseId,
  enrichCourse,
  initialCourses,
  isValidCreditWeight,
  isValidTermTargetGpa,
  type Assignment,
  type AssignmentInput,
  type Course,
  type TargetType,
} from "@/lib/courses";

type CourseUpdates = {
  creditWeight?: number;
  targetType?: TargetType;
  targetLetter?: string | null;
  targetGpa?: number | null;
  targetPercentage?: number | null;
  clearTarget?: boolean;
};

type CourseContextValue = {
  courses: Course[];
  termTargetGpa: number | null;
  setTermTargetGpa: (value: number | null) => void;
  addCourse: (
    name: string,
    creditWeight: number,
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
};

const CourseContext = createContext<CourseContextValue | null>(null);

const COURSES_STORAGE_KEY = "eduniq_courses";
const TERM_TARGET_STORAGE_KEY = "eduniq_term_target_gpa";

function isValidStoredAssignment(value: unknown): value is Assignment {
  if (!value || typeof value !== "object") return false;
  const assignment = value as Record<string, unknown>;
  const weight = assignment.weight;
  return (
    typeof assignment.id === "string" &&
    assignment.id.length > 0 &&
    typeof assignment.name === "string" &&
    assignment.name.trim().length > 0 &&
    typeof weight === "number" &&
    !Number.isNaN(weight) &&
    weight > 0 &&
    weight <= 100
  );
}

function isValidStoredCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object") return false;
  const course = value as Record<string, unknown>;
  const creditWeight = course.creditWeight;
  const assignments = course.assignments;
  return (
    typeof course.id === "string" &&
    course.id.length > 0 &&
    typeof course.name === "string" &&
    course.name.trim().length > 0 &&
    typeof creditWeight === "number" &&
    isValidCreditWeight(creditWeight) &&
    Array.isArray(assignments) &&
    assignments.every(isValidStoredAssignment)
  );
}

function loadCoursesFromStorage(): Course[] {
  try {
    const raw = localStorage.getItem(COURSES_STORAGE_KEY);
    if (raw === null) return initialCourses;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return initialCourses;
    if (parsed.length === 0) return [];

    const courses = parsed
      .filter(isValidStoredCourse)
      .map((course) => enrichCourse(toCourseSeed(course)));

    return courses.length > 0 ? courses : initialCourses;
  } catch {
    return initialCourses;
  }
}

function saveCoursesToStorage(courses: Course[]) {
  try {
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

function loadTermTargetFromStorage(): number | null {
  try {
    const raw = localStorage.getItem(TERM_TARGET_STORAGE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (parsed === null) return null;
    if (typeof parsed === "number" && isValidTermTargetGpa(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveTermTargetToStorage(termTargetGpa: number | null) {
  try {
    if (termTargetGpa === null) {
      localStorage.removeItem(TERM_TARGET_STORAGE_KEY);
      return;
    }
    localStorage.setItem(TERM_TARGET_STORAGE_KEY, JSON.stringify(termTargetGpa));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

function mapCourse(
  courses: Course[],
  courseId: string,
  updater: (course: Course) => Course,
): Course[] {
  return courses.map((course) =>
    course.id === courseId ? updater(course) : course,
  );
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
    creditWeight: course.creditWeight,
    targetType: course.targetType,
    targetLetter: course.targetLetter,
    targetGpa: course.targetGpa,
    targetPercentage: course.targetPercentage,
    assignments: course.assignments,
    code: course.code,
    trend: course.trend,
  };
}

export function CourseProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [termTargetGpa, setTermTargetGpaState] = useState<number | null>(null);

  useEffect(() => {
    setCourses(loadCoursesFromStorage());
    setTermTargetGpaState(loadTermTargetFromStorage());
    setIsStorageReady(true);
  }, []);

  useEffect(() => {
    if (!isStorageReady) return;
    saveCoursesToStorage(courses);
  }, [courses, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) return;
    saveTermTargetToStorage(termTargetGpa);
  }, [termTargetGpa, isStorageReady]);

  const setTermTargetGpa = useCallback((value: number | null) => {
    if (value !== null && !isValidTermTargetGpa(value)) return;
    setTermTargetGpaState(value);
  }, []);

  const getCourseById = useCallback(
    (id: string) => courses.find((course) => course.id === id),
    [courses],
  );

  const addCourse = useCallback(
    (
      name: string,
      creditWeight: number,
      target: { gpa: number; letter: string } | null,
    ) => {
      const trimmed = name.trim();
      if (!trimmed || !isValidCreditWeight(creditWeight)) return;

      const targetFields = target
        ? applyGpaTarget(target.gpa, target.letter)
        : clearCourseTarget();

      const newCourse = enrichCourse({
        id: createCourseId(trimmed),
        name: trimmed,
        creditWeight,
        assignments: [],
        ...targetFields,
      });

      setCourses((prev) => [...prev, newCourse]);
    },
    [],
  );

  const updateCourse = useCallback((courseId: string, updates: CourseUpdates) => {
    setCourses((prev) =>
      mapCourse(prev, courseId, (course) => {
        const next = {
          ...toCourseSeed(course),
          ...(updates.creditWeight !== undefined
            ? { creditWeight: updates.creditWeight }
            : {}),
        };

        if (updates.creditWeight !== undefined && !isValidCreditWeight(updates.creditWeight)) {
          return course;
        }

        if (updates.clearTarget) {
          Object.assign(next, clearCourseTarget());
        } else {
          if (updates.targetType !== undefined) next.targetType = updates.targetType;
          if (updates.targetLetter !== undefined) next.targetLetter = updates.targetLetter;
          if (updates.targetGpa !== undefined) next.targetGpa = updates.targetGpa;
          if (updates.targetPercentage !== undefined) {
            next.targetPercentage = updates.targetPercentage;
          }
          if (
            updates.targetGpa !== undefined &&
            updates.targetLetter !== undefined &&
            updates.targetGpa !== null &&
            updates.targetLetter
          ) {
            Object.assign(next, applyGpaTarget(updates.targetGpa, updates.targetLetter));
          }
        }

        return enrichCourse(next);
      }),
    );
  }, []);

  const deleteCourse = useCallback((courseId: string) => {
    setCourses((prev) => prev.filter((course) => course.id !== courseId));
  }, []);

  const addAssignment = useCallback(
    (courseId: string, input: AssignmentInput) => {
      const assignment = buildAssignment(input);

      setCourses((prev) =>
        mapCourse(prev, courseId, (course) =>
          enrichCourse({
            ...toCourseSeed(course),
            assignments: [...course.assignments, assignment],
          }),
        ),
      );
    },
    [],
  );

  const updateAssignment = useCallback(
    (courseId: string, assignmentId: string, input: AssignmentInput) => {
      setCourses((prev) =>
        mapCourse(prev, courseId, (course) =>
          enrichCourse({
            ...toCourseSeed(course),
            assignments: course.assignments.map((assignment) =>
              assignment.id === assignmentId
                ? {
                    ...assignment,
                    name: input.name,
                    weight: input.weight,
                    earnedPoints: input.earnedPoints,
                    totalPoints: input.totalPoints,
                  }
                : assignment,
            ),
          }),
        ),
      );
    },
    [],
  );

  const deleteAssignment = useCallback(
    (courseId: string, assignmentId: string) => {
      setCourses((prev) =>
        mapCourse(prev, courseId, (course) =>
          enrichCourse({
            ...toCourseSeed(course),
            assignments: course.assignments.filter(
              (assignment) => assignment.id !== assignmentId,
            ),
          }),
        ),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      courses,
      termTargetGpa,
      setTermTargetGpa,
      addCourse,
      updateCourse,
      deleteCourse,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      getCourseById,
    }),
    [
      courses,
      termTargetGpa,
      setTermTargetGpa,
      addCourse,
      updateCourse,
      deleteCourse,
      addAssignment,
      updateAssignment,
      deleteAssignment,
      getCourseById,
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
