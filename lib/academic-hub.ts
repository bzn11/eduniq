import type { Assignment } from "@/lib/assignments";
import { createAssignmentId, createCourseId, enrichCourse, type Course } from "@/lib/courses";
import {
  loadCgpaBaseline,
  saveCgpaBaseline,
  type CgpaBaseline,
} from "@/lib/cgpa-baseline";
import { getGradeInfo, type GradeScale } from "@/lib/grading";
import { createTermId, normalizeTerms, type Term } from "@/lib/terms";

export const SYNTHETIC_TERM_ID = "synthetic-imported-academic-history";
export const SYNTHETIC_TERM_NAME = "Imported Academic History";
export const SYNTHETIC_COURSE_ID = "synthetic-prior-academic-record";
export const SYNTHETIC_COURSE_NAME = "Prior academic record";

export type AcademicHub = {
  terms: Term[];
};

export type PriorAcademicHistoryInput = {
  cgpa: number;
  completedCredits: number;
};

export function isValidPriorAcademicHistory(
  value: unknown,
): value is PriorAcademicHistoryInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const cgpa = record.cgpa;
  const completedCredits = record.completedCredits;
  return (
    typeof cgpa === "number" &&
    !Number.isNaN(cgpa) &&
    cgpa >= 0 &&
    cgpa <= 4.33 &&
    typeof completedCredits === "number" &&
    !Number.isNaN(completedCredits) &&
    completedCredits > 0
  );
}

function assignmentFromPercent(percent: number): Assignment {
  const totalPoints = 100;
  return {
    id: createAssignmentId(),
    name: "Imported grade",
    weight: 100,
    earnedPoints: Math.round((percent / 100) * totalPoints * 10) / 10,
    totalPoints,
  };
}

/** Map imported GPA to a representative percentage on the active scale. */
export function percentForImportedGpa(cgpa: number, scale: GradeScale): number {
  if (scale.bands.length === 0) {
    return Math.min(100, Math.max(0, (cgpa / 4.33) * 100));
  }

  let bestBand = scale.bands[0]!;
  let bestDiff = Infinity;

  for (const band of scale.bands) {
    if (band.gpa === null) continue;
    const diff = Math.abs(band.gpa - cgpa);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestBand = band;
    }
  }

  return bestBand.min;
}

export function isSyntheticTerm(term: Term): boolean {
  return term.isSynthetic === true || term.id === SYNTHETIC_TERM_ID;
}

export function isSyntheticCourse(course: Course): boolean {
  return course.id === SYNTHETIC_COURSE_ID;
}

export function buildSyntheticCourse(
  cgpa: number,
  completedCredits: number,
  scale: GradeScale,
): Course {
  const percent = percentForImportedGpa(cgpa, scale);
  const course = enrichCourse(
    {
      id: SYNTHETIC_COURSE_ID,
      name: SYNTHETIC_COURSE_NAME,
      credits: completedCredits,
      targetType: "gpa",
      targetLetter: null,
      targetGpa: null,
      targetPercentage: null,
      assignments: [assignmentFromPercent(percent)],
    },
    scale,
  );

  const bandInfo = getGradeInfo(percent, scale);
  return {
    ...course,
    gpaValue: cgpa,
    gradeLabel: bandInfo.letterGrade,
    currentGrade: percent,
  };
}

export function buildSyntheticTerm(
  input: PriorAcademicHistoryInput,
  scale: GradeScale,
): Term {
  return {
    id: SYNTHETIC_TERM_ID,
    name: SYNTHETIC_TERM_NAME,
    isActive: false,
    isSynthetic: true,
    courses: [buildSyntheticCourse(input.cgpa, input.completedCredits, scale)],
    termTargetGpa: null,
  };
}

export function getRealTerms(terms: Term[]): Term[] {
  return terms.filter((term) => !isSyntheticTerm(term));
}

export function getSyntheticTerm(terms: Term[]): Term | undefined {
  return terms.find(isSyntheticTerm);
}

export function upsertPriorAcademicHistory(
  terms: Term[],
  input: PriorAcademicHistoryInput,
  scale: GradeScale,
): Term[] {
  const withoutSynthetic = terms.filter((term) => !isSyntheticTerm(term));
  const synthetic = buildSyntheticTerm(input, scale);
  return normalizeTerms([...withoutSynthetic, synthetic]);
}

export function removePriorAcademicHistory(terms: Term[]): Term[] {
  const next = terms.filter((term) => !isSyntheticTerm(term));
  if (next.length === 0) return [];
  return normalizeTerms(next);
}

export function getPriorAcademicHistory(
  terms: Term[],
): PriorAcademicHistoryInput | null {
  const synthetic = getSyntheticTerm(terms);
  const course = synthetic?.courses[0];
  if (!course || course.gpaValue === null) return null;
  return {
    cgpa: course.gpaValue,
    completedCredits: course.credits,
  };
}

export function migrateLegacyBaseline(
  terms: Term[],
  userId: string | null | undefined,
  scale: GradeScale,
): Term[] {
  if (getSyntheticTerm(terms)) {
    saveCgpaBaseline(null, userId);
    return terms;
  }

  const legacy = loadCgpaBaseline(userId);
  if (!legacy) return terms;

  const migrated = upsertPriorAcademicHistory(terms, legacy, scale);
  saveCgpaBaseline(null, userId);
  return migrated;
}

export function mergePreservedSyntheticTerm(
  primaryTerms: Term[],
  fallbackTerms: Term[],
): Term[] {
  const synthetic = getSyntheticTerm(fallbackTerms);
  if (!synthetic) return primaryTerms;
  if (getSyntheticTerm(primaryTerms)) return primaryTerms;
  return normalizeTerms([...primaryTerms.filter((t) => !isSyntheticTerm(t)), synthetic]);
}

export function createAcademicHub(terms: Term[]): AcademicHub {
  return { terms };
}

export function getUnifiedPerformanceTerms(hub: AcademicHub): Term[] {
  return hub.terms;
}
