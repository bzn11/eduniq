import type { Assignment } from "@/lib/assignments";
import {
  calculateCourseAverage,
  getAssignmentPercent,
  isAssignmentGraded,
} from "@/lib/assignments";
import {
  computeCourseMetrics,
  formatCourseTargetLabel,
  hasCourseTarget,
  resolveTargetPercent,
  type CourseStatus,
  type TargetType,
} from "@/lib/courseMetrics";

export type { Assignment } from "@/lib/assignments";
export type { CourseStatus, TargetType } from "@/lib/courseMetrics";
export {
  calculateTermGpa,
  computeTermMetrics,
  courseContributesToTermGpa,
  formatCourseTargetLabel,
  getStatusColorClass,
  hasCourseTarget,
} from "@/lib/courseMetrics";

export { calculateCourseAverage, getAssignmentPercent, isAssignmentGraded };

export type Course = {
  id: string;
  name: string;
  creditWeight: number;
  currentGrade: number;
  targetType: TargetType;
  targetLetter: string | null;
  targetGpa: number | null;
  targetPercentage: number | null;
  targetGrade: number | null;
  assignments: Assignment[];
  code: string;
  gradeLabel: string | null;
  gpaValue: number | null;
  gradeSecondary: string | null;
  trend: "↑" | "→" | "↓";
  context: string;
  projection: string | null;
  projectedFinalGrade: number;
  status: CourseStatus | null;
  insight: {
    gradedPercent: number;
    remainingPercent: number;
    needOnRemaining: string;
    summary: string;
  };
};

export type AssignmentInput = {
  name: string;
  weight: number;
  earnedPoints?: number;
  totalPoints?: number;
};

export type AssignmentFieldErrors = Partial<
  Record<"name" | "weight" | "earned" | "total", string>
>;

export type ParseAssignmentResult =
  | { ok: true; value: AssignmentInput }
  | { ok: false; errors: AssignmentFieldErrors };

export { resolveTargetPercent };

export function parseAssignmentInput(
  name: string,
  weightValue: string,
  earnedValue: string,
  totalValue: string,
): ParseAssignmentResult {
  const errors: AssignmentFieldErrors = {};
  const trimmedName = name.trim();
  const weight = Number(weightValue);

  if (!trimmedName) {
    errors.name = "Assignment name is required.";
  }

  if (Number.isNaN(weight) || weight <= 0 || weight > 100) {
    errors.weight = "Weight must be between 0 and 100.";
  }

  const earnedTrimmed = earnedValue.trim();
  const totalTrimmed = totalValue.trim();
  const hasEarned = earnedTrimmed !== "";
  const hasTotal = totalTrimmed !== "";

  let earnedPoints: number | undefined;
  let totalPoints: number | undefined;

  if (hasEarned || hasTotal) {
    if (!hasEarned || !hasTotal) {
      errors.earned = "Enter both earned and total points, or leave both empty.";
      errors.total = "Enter both earned and total points, or leave both empty.";
    } else {
      earnedPoints = Number(earnedTrimmed);
      totalPoints = Number(totalTrimmed);

      if (Number.isNaN(earnedPoints) || Number.isNaN(totalPoints)) {
        errors.earned = "Points must be valid numbers.";
        errors.total = "Points must be valid numbers.";
      } else if (totalPoints <= 0) {
        errors.total = "Total points must be greater than 0.";
      } else if (earnedPoints < 0) {
        errors.earned = "Earned points cannot be negative.";
      } else if (earnedPoints > totalPoints) {
        errors.earned = "Earned points cannot exceed total points.";
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name: trimmedName,
      weight,
      earnedPoints,
      totalPoints,
    },
  };
}

export function deriveCourseCode(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function createCourseId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "course"}-${Date.now().toString(36)}`;
}

export function createAssignmentId(): string {
  return `assignment-${Date.now().toString(36)}`;
}

export function clearCourseTarget(): Pick<
  Course,
  "targetType" | "targetGpa" | "targetLetter" | "targetPercentage"
> {
  return {
    targetType: "gpa",
    targetGpa: null,
    targetLetter: null,
    targetPercentage: null,
  };
}

export function applyGpaTarget(
  targetGpa: number,
  targetLetter: string,
): Pick<Course, "targetType" | "targetGpa" | "targetLetter" | "targetPercentage"> {
  return {
    targetType: "gpa",
    targetGpa,
    targetLetter,
    targetPercentage: null,
  };
}

type CourseSeed = Omit<
  Course,
  | "insight"
  | "context"
  | "projection"
  | "gradeLabel"
  | "gpaValue"
  | "gradeSecondary"
  | "projectedFinalGrade"
  | "status"
  | "code"
  | "trend"
  | "currentGrade"
  | "targetGrade"
> &
  Partial<Pick<Course, "code" | "trend">>;

export function enrichCourse(course: CourseSeed): Course {
  const {
    hasTarget: _hasTarget,
    statusColorClass: _statusColorClass,
    ...metrics
  } = computeCourseMetrics(course);

  return {
    ...course,
    code: course.code ?? deriveCourseCode(course.name),
    trend: course.trend ?? "→",
    ...metrics,
  };
}

function pointsFromPercent(percent: number, total = 100): {
  earnedPoints: number;
  totalPoints: number;
} {
  return {
    earnedPoints: Math.round((percent / 100) * total * 10) / 10,
    totalPoints: total,
  };
}

function target(gpa: number, letter: string) {
  return applyGpaTarget(gpa, letter);
}

const seedCourses: CourseSeed[] = [
  {
    id: "data-structures",
    name: "Data Structures",
    code: "Cs",
    creditWeight: 0.5,
    ...target(3.7, "A-"),
    trend: "↑",
    assignments: [
      { id: "ds-a1", name: "Assignment 1", weight: 30, ...pointsFromPercent(92) },
      { id: "ds-mid", name: "Midterm", weight: 30, ...pointsFromPercent(76) },
      { id: "ds-final", name: "Final project", weight: 40 },
    ],
  },
  {
    id: "calculus-ii",
    name: "Calculus II",
    code: "Ma",
    creditWeight: 0.5,
    ...target(4.0, "A"),
    trend: "→",
    assignments: [
      { id: "calc-h1", name: "Homework 1", weight: 25, ...pointsFromPercent(88) },
      { id: "calc-h2", name: "Homework 2", weight: 25, ...pointsFromPercent(84) },
      { id: "calc-mid", name: "Midterm", weight: 50 },
    ],
  },
  {
    id: "technical-writing",
    name: "Technical Writing",
    code: "En",
    creditWeight: 0.5,
    ...target(4.0, "A"),
    trend: "↑",
    assignments: [
      { id: "tw-d1", name: "Draft 1", weight: 35, ...pointsFromPercent(95) },
      { id: "tw-pr", name: "Peer review", weight: 35, ...pointsFromPercent(91) },
      { id: "tw-fe", name: "Final essay", weight: 30 },
    ],
  },
  {
    id: "physics-i",
    name: "Physics I",
    code: "Ph",
    creditWeight: 1.0,
    ...target(3.3, "B+"),
    trend: "→",
    assignments: [
      { id: "ph-l1", name: "Lab 1", weight: 30, ...pointsFromPercent(82) },
      { id: "ph-q1", name: "Quiz 1", weight: 30, ...pointsFromPercent(79) },
      { id: "ph-lr", name: "Lab report", weight: 40 },
    ],
  },
  {
    id: "intro-to-psychology",
    name: "Intro to Psychology",
    code: "Ps",
    creditWeight: 0.5,
    ...target(4.0, "A"),
    trend: "↓",
    assignments: [
      { id: "ps-q1", name: "Quiz 1", weight: 30, ...pointsFromPercent(90) },
      { id: "ps-rr", name: "Reading response", weight: 30, ...pointsFromPercent(88) },
      { id: "ps-q2", name: "Quiz 2", weight: 40 },
    ],
  },
];

export const initialCourses: Course[] = seedCourses.map((course) => enrichCourse(course));

export function formatAssignmentScore(assignment: Assignment): string {
  const percent = getAssignmentPercent(assignment);
  if (percent === null) return "—";
  return `${percent.toFixed(1)}%`;
}

export function formatCoursePercent(percent: number): string {
  if (percent === 0) return "—";
  return `${percent.toFixed(1)}%`;
}

export function isValidTermTargetGpa(value: number): boolean {
  return !Number.isNaN(value) && value >= 0 && value <= 4.33;
}

export function isValidCreditWeight(value: number): boolean {
  return !Number.isNaN(value) && value > 0;
}
