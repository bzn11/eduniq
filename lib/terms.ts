import {
  enrichCourse,
  initialCourses,
  isValidTermTargetGpa,
  type Course,
} from "@/lib/courses";
import { calculateTermGpa, formatGpaDisplay } from "@/lib/courseMetrics";

export type Term = {
  id: string;
  name: string;
  isActive: boolean;
  courses: Course[];
  termTargetGpa: number | null;
  /** Prior imported CGPA packaged as a normal term for unified calculations. */
  isSynthetic?: boolean;
};

export const DEFAULT_TERM_NAME = "Fall 2025";
export const ACADEMIC_CACHE_KEY = "eduniq_academic_cache";
export const TERMS_STORAGE_KEY = "eduniq_terms";
export const LEGACY_COURSES_STORAGE_KEY = "eduniq_courses";
export const LEGACY_TERM_TARGET_STORAGE_KEY = "eduniq_term_target_gpa";

export function createTermId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "term"}-${Date.now().toString(36)}`;
}

export function createInitialTerms(): Term[] {
  return [
    {
      id: createTermId(DEFAULT_TERM_NAME),
      name: DEFAULT_TERM_NAME,
      isActive: true,
      courses: initialCourses,
      termTargetGpa: null,
    },
  ];
}

export function getActiveTerm(terms: Term[]): Term | undefined {
  return terms.find((term) => term.isActive && !term.isSynthetic);
}

export function ensureSingleActiveTerm(terms: Term[]): Term[] {
  if (terms.length === 0) return [];

  const eligibleIndices = terms
    .map((term, index) => (!term.isSynthetic && term.isActive ? index : -1))
    .filter((index) => index >= 0);

  const fallbackIndex = terms.findIndex((term) => !term.isSynthetic);
  const activeIndex =
    eligibleIndices.length > 0
      ? eligibleIndices[0]
      : fallbackIndex >= 0
        ? fallbackIndex
        : -1;

  return terms.map((term, index) => ({
    ...term,
    isActive: term.isSynthetic ? false : index === activeIndex,
  }));
}

export function setActiveTermById(terms: Term[], termId: string): Term[] {
  if (!terms.some((term) => term.id === termId)) return terms;
  return terms.map((term) => ({
    ...term,
    isActive: term.id === termId,
  }));
}

export function deleteTermById(terms: Term[], termId: string): Term[] {
  const next = terms.filter((term) => term.id !== termId);
  if (next.length === 0) return [];
  if (!next.some((term) => term.isActive)) {
    return ensureSingleActiveTerm(next);
  }
  return next;
}

export function renameTermById(terms: Term[], termId: string, name: string): Term[] {
  const trimmed = name.trim();
  if (!trimmed) return terms;
  return terms.map((term) =>
    term.id === termId ? { ...term, name: trimmed } : term,
  );
}

export function getTermGpaDisplay(term: Term): string {
  return formatGpaDisplay(calculateTermGpa(term.courses));
}

export function normalizeTerms(terms: Term[]): Term[] {
  const enriched = terms.map((term) => ({
    ...term,
    name: term.name.trim() || "Untitled term",
    isSynthetic: term.isSynthetic === true,
    termTargetGpa:
      term.termTargetGpa !== null && isValidTermTargetGpa(term.termTargetGpa)
        ? term.termTargetGpa
        : null,
    courses: term.courses.map((course) =>
      enrichCourse({
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
      }),
    ),
  }));

  return ensureSingleActiveTerm(enriched);
}
