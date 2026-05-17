import {
  enrichCourse,
  isValidCourseCredits,
  isValidTermTargetGpa,
  resolveCourseCredits,
  type Assignment,
  type Course,
} from "@/lib/courses";
import type { GradeScale } from "@/lib/grading";
import { getDefaultScale } from "@/lib/grading";
import {
  ACADEMIC_CACHE_KEY,
  createInitialTerms,
  createTermId,
  DEFAULT_TERM_NAME,
  ensureSingleActiveTerm,
  LEGACY_COURSES_STORAGE_KEY,
  LEGACY_TERM_TARGET_STORAGE_KEY,
  normalizeTerms,
  TERMS_STORAGE_KEY,
  type Term,
} from "@/lib/terms";

export function getAcademicCacheStorageKey(userId: string | null | undefined): string {
  if (userId) return `${ACADEMIC_CACHE_KEY}_${userId}`;
  return `${ACADEMIC_CACHE_KEY}_guest`;
}

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

function readStoredCredits(course: Record<string, unknown>): number | undefined {
  if (typeof course.credits === "number") return course.credits;
  if (typeof course.creditWeight === "number") return course.creditWeight;
  return undefined;
}

function isValidStoredCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object") return false;
  const course = value as Record<string, unknown>;
  const storedCredits = readStoredCredits(course);
  const assignments = course.assignments;
  return (
    typeof course.id === "string" &&
    course.id.length > 0 &&
    typeof course.name === "string" &&
    course.name.trim().length > 0 &&
    (storedCredits === undefined || isValidCourseCredits(storedCredits)) &&
    Array.isArray(assignments) &&
    assignments.every(isValidStoredAssignment)
  );
}

export function enrichStoredCourse(raw: unknown, scale: GradeScale): Course | null {
  if (!isValidStoredCourse(raw)) return null;
  const record = raw as Course & { creditWeight?: number };
  return enrichCourse(
    {
      id: record.id,
      name: record.name,
      credits: resolveCourseCredits(readStoredCredits(record)),
      targetType: record.targetType ?? "gpa",
      targetLetter: record.targetLetter ?? null,
      targetGpa: record.targetGpa ?? null,
      targetPercentage: record.targetPercentage ?? null,
      assignments: record.assignments,
      code: record.code,
      trend: record.trend,
    },
    scale,
  );
}

function parseStoredTerm(raw: unknown, scale: GradeScale): Term | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  if (typeof record.name !== "string" || !record.name.trim()) return null;
  if (!Array.isArray(record.courses)) return null;

  const courses = record.courses
    .map((entry) => enrichStoredCourse(entry, scale))
    .filter((course): course is Course => course !== null);

  let termTargetGpa: number | null = null;
  if (typeof record.termTargetGpa === "number" && isValidTermTargetGpa(record.termTargetGpa)) {
    termTargetGpa = record.termTargetGpa;
  }

  return {
    id: record.id,
    name: record.name.trim(),
    isActive: record.isActive === true,
    courses,
    termTargetGpa,
  };
}

function parseTermsPayload(raw: string | null, scale: GradeScale): Term[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const terms = parsed
      .map((entry) => parseStoredTerm(entry, scale))
      .filter((term): term is Term => term !== null);
    if (terms.length === 0) return null;
    return normalizeTerms(terms);
  } catch {
    return null;
  }
}

function parseLegacyTermTarget(): number | null {
  try {
    const raw = localStorage.getItem(LEGACY_TERM_TARGET_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "number" && isValidTermTargetGpa(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function loadLegacyCourses(scale: GradeScale): Course[] {
  try {
    const raw = localStorage.getItem(LEGACY_COURSES_STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => enrichStoredCourse(entry, scale))
      .filter((course): course is Course => course !== null);
  } catch {
    return [];
  }
}

function migrateLegacyStorage(scale: GradeScale): Term[] {
  const legacyCourses = loadLegacyCourses(scale);
  const legacyTarget = parseLegacyTermTarget();
  const courses = legacyCourses.length > 0 ? legacyCourses : [];

  return [
    {
      id: createTermId(DEFAULT_TERM_NAME),
      name: DEFAULT_TERM_NAME,
      isActive: true,
      courses,
      termTargetGpa: legacyTarget,
    },
  ];
}

function dedupeAssignments(assignments: Assignment[]): Assignment[] {
  const seen = new Set<string>();
  const next: Assignment[] = [];
  for (const assignment of assignments) {
    if (seen.has(assignment.id)) continue;
    seen.add(assignment.id);
    next.push(assignment);
  }
  return next;
}

function dedupeCourses(courses: Course[]): Course[] {
  const seen = new Set<string>();
  const next: Course[] = [];
  for (const course of courses) {
    if (seen.has(course.id)) continue;
    seen.add(course.id);
    next.push({
      ...course,
      assignments: dedupeAssignments(course.assignments),
    });
  }
  return next;
}

/** Deep clone terms for hydration display lock (avoids mixed cache/cloud UI). */
export function cloneTermsSnapshot(terms: Term[]): Term[] {
  return JSON.parse(JSON.stringify(terms)) as Term[];
}

/**
 * Validates, dedupes, and re-enriches a full academic dataset.
 * Returns null if the dataset is structurally unusable.
 */
export function sanitizeTermsDataset(
  terms: Term[],
  scale: GradeScale = getDefaultScale(),
): Term[] | null {
  if (!Array.isArray(terms)) return null;

  try {
    const sanitized: Term[] = [];
    const seenTermIds = new Set<string>();

    for (const term of terms) {
      if (!term || typeof term.id !== "string" || !term.id.trim()) continue;
      if (typeof term.name !== "string" || !term.name.trim()) continue;
      if (seenTermIds.has(term.id)) continue;
      seenTermIds.add(term.id);

      const courses = dedupeCourses(term.courses ?? [])
        .map((course) =>
          enrichCourse(
            {
              id: course.id,
              name: course.name,
              credits: course.credits,
              targetType: course.targetType ?? "gpa",
              targetLetter: course.targetLetter ?? null,
              targetGpa: course.targetGpa ?? null,
              targetPercentage: course.targetPercentage ?? null,
              assignments: course.assignments ?? [],
              code: course.code,
              trend: course.trend,
            },
            scale,
          ),
        )
        .filter((course) => course.id && course.name.trim());

      let termTargetGpa: number | null = null;
      if (
        typeof term.termTargetGpa === "number" &&
        isValidTermTargetGpa(term.termTargetGpa)
      ) {
        termTargetGpa = term.termTargetGpa;
      }

      sanitized.push({
        id: term.id,
        name: term.name.trim(),
        isActive: term.isActive === true,
        courses,
        termTargetGpa,
      });
    }

    if (sanitized.length === 0) return null;
    return normalizeTerms(sanitized);
  } catch {
    return null;
  }
}

/** One active term with no courses — canonical empty cloud state for signed-in users. */
export function createEmptyAcademicTerms(
  scale: GradeScale = getDefaultScale(),
): Term[] {
  return normalizeTerms([
    {
      id: createTermId(DEFAULT_TERM_NAME),
      name: DEFAULT_TERM_NAME,
      isActive: true,
      courses: [],
      termTargetGpa: null,
    },
  ]);
}

/** Read offline cache only — never treated as source of truth when Supabase is available. */
export function loadAcademicCache(
  scale: GradeScale = getDefaultScale(),
  userId?: string | null,
): Term[] {
  return loadAcademicFallback(scale, userId);
}

/** Offline fallback: user-scoped cache → (guest only) legacy keys → seed data. */
export function loadAcademicFallback(
  scale: GradeScale = getDefaultScale(),
  userId?: string | null,
): Term[] {
  if (typeof window === "undefined") {
    return normalizeTerms(createInitialTerms());
  }

  try {
    const scopedKey = getAcademicCacheStorageKey(userId ?? null);
    const fromScopedCache = parseTermsPayload(localStorage.getItem(scopedKey), scale);
    if (fromScopedCache) return fromScopedCache;

    if (!userId) {
      const fromLegacyCache = parseTermsPayload(
        localStorage.getItem(ACADEMIC_CACHE_KEY),
        scale,
      );
      if (fromLegacyCache) return fromLegacyCache;

      const fromTermsKey = parseTermsPayload(localStorage.getItem(TERMS_STORAGE_KEY), scale);
      if (fromTermsKey) return fromTermsKey;

      const legacyCourses = localStorage.getItem(LEGACY_COURSES_STORAGE_KEY);
      const legacyTarget = localStorage.getItem(LEGACY_TERM_TARGET_STORAGE_KEY);
      if (legacyCourses !== null || legacyTarget !== null) {
        return normalizeTerms(migrateLegacyStorage(scale));
      }
    }

    return normalizeTerms(createInitialTerms());
  } catch {
    return normalizeTerms(createInitialTerms());
  }
}

export function saveAcademicCache(terms: Term[], userId?: string | null): void {
  if (typeof window === "undefined") return;

  const sanitized = sanitizeTermsDataset(terms);
  if (!sanitized) return;

  try {
    const payload = JSON.stringify(sanitized);
    const scopedKey = getAcademicCacheStorageKey(userId ?? null);
    localStorage.setItem(scopedKey, payload);

    if (!userId) {
      localStorage.setItem(ACADEMIC_CACHE_KEY, payload);
      localStorage.setItem(TERMS_STORAGE_KEY, payload);
      localStorage.removeItem(LEGACY_COURSES_STORAGE_KEY);
      localStorage.removeItem(LEGACY_TERM_TARGET_STORAGE_KEY);
    }
  } catch {
    // Ignore quota / private-mode errors.
  }
}

export function reEnrichAllTerms(terms: Term[], scale: GradeScale): Term[] {
  return normalizeTerms(
    terms.map((term) => ({
      ...term,
      courses: term.courses.map((course) =>
        enrichCourse(
          {
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
          },
          scale,
        ),
      ),
    })),
  );
}
