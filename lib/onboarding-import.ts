import type { Assignment } from "@/lib/assignments";
import { createAssignmentId, createCourseId, enrichCourse, type Course } from "@/lib/courses";
import { getGradeInfo, type GradeScale } from "@/lib/grading";
import { createTermId, normalizeTerms, type Term } from "@/lib/terms";

export type OnboardingImportCourse = {
  name: string;
  credits: number;
  /** Course average 0–100; optional for ungraded courses */
  gradePercent?: number | null;
};

export type OnboardingImportTerm = {
  name: string;
  courses: OnboardingImportCourse[];
};

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

export function buildImportedCourse(
  input: OnboardingImportCourse,
  scale: GradeScale,
): Course {
  const assignments: Assignment[] = [];
  if (
    typeof input.gradePercent === "number" &&
    !Number.isNaN(input.gradePercent) &&
    input.gradePercent >= 0
  ) {
    assignments.push(assignmentFromPercent(Math.min(100, input.gradePercent)));
  }

  const seed = {
    id: createCourseId(input.name),
    name: input.name.trim(),
    credits: input.credits,
    targetType: "gpa" as const,
    targetLetter: null,
    targetGpa: null,
    targetPercentage: null,
    assignments,
  };

  const course = enrichCourse(seed, scale);
  if (assignments.length > 0) {
    const { letterGrade, gpaValue } = getGradeInfo(course.currentGrade, scale);
    if (letterGrade && gpaValue !== null) {
      return enrichCourse(
        {
          ...seed,
          targetType: "gpa",
          targetLetter: letterGrade,
          targetGpa: gpaValue,
        },
        scale,
      );
    }
  }

  return course;
}

export function buildImportedTerms(
  imports: OnboardingImportTerm[],
  scale: GradeScale,
): Term[] {
  const terms = imports
    .map((entry) => {
      const name = entry.name.trim();
      if (!name) return null;
      const term: Term = {
        id: createTermId(name),
        name,
        isActive: false,
        courses: entry.courses
          .filter((course) => course.name.trim())
          .map((course) => buildImportedCourse(course, scale)),
        termTargetGpa: null,
      };
      return term;
    })
    .filter((term): term is Term => term !== null);

  if (terms.length === 0) return [];
  terms[terms.length - 1]!.isActive = true;
  return normalizeTerms(terms);
}
