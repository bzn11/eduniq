import {
  calculateCourseAverage,
  getAssignmentPercent,
  isAssignmentGraded,
  type Assignment,
} from "@/lib/assignments";
import { enrichCourse, type Course } from "@/lib/courses";
import { hasCourseTarget, resolveTargetPercent } from "@/lib/courseMetrics";
import { getGradeInfo, type GradeScale } from "@/lib/grading";

export type SimulatedAssignmentValue =
  | { earnedPoints: number; totalPoints: number }
  | { percent: number };

export type RequiredFinalScore = number | "impossible" | "already achieved";

export type WhatIfComparison = {
  gradeDelta: number;
  gpaDelta: number | null;
};

function cloneAssignment(assignment: Assignment): Assignment {
  return { ...assignment };
}

/** Deep-clone course shell and assignments without touching CourseContext. */
export function cloneCourse(course: Course): Course {
  return {
    ...course,
    assignments: course.assignments.map(cloneAssignment),
    insight: { ...course.insight },
  };
}

function pointsFromPercent(percent: number, totalPoints = 100): {
  earnedPoints: number;
  totalPoints: number;
} {
  const earnedPoints = Math.round((percent / 100) * totalPoints * 10) / 10;
  return { earnedPoints, totalPoints };
}

function applyPointsToAssignment(
  assignment: Assignment,
  earnedPoints: number,
  totalPoints: number,
): Assignment {
  return {
    ...assignment,
    earnedPoints,
    totalPoints,
  };
}

/** Mutates only the cloned course's assignment grades (in memory). */
export function applySimulatedAssignmentChange(
  course: Course,
  assignmentId: string,
  newValue: SimulatedAssignmentValue,
): Course {
  const next = cloneCourse(course);
  const index = next.assignments.findIndex((entry) => entry.id === assignmentId);
  if (index < 0) return next;

  if ("percent" in newValue) {
    const clamped = Math.min(100, Math.max(0, newValue.percent));
    const points = pointsFromPercent(clamped);
    next.assignments[index] = applyPointsToAssignment(
      next.assignments[index]!,
      points.earnedPoints,
      points.totalPoints,
    );
  } else {
    next.assignments[index] = applyPointsToAssignment(
      next.assignments[index]!,
      newValue.earnedPoints,
      newValue.totalPoints,
    );
  }

  return next;
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

/** Recompute all derived metrics via the shared grading pipeline. */
export function calculateSimulatedCourse(
  course: Course,
  scale: GradeScale,
): Course {
  return enrichCourse(toCourseSeed(course), scale);
}

function isAlreadyAtTarget(course: Course, scale: GradeScale): boolean {
  const targetPercent = resolveTargetPercent(course, scale);
  if (targetPercent === null) return false;

  const currentGrade = calculateCourseAverage(course.assignments);
  if (currentGrade >= targetPercent) return true;

  if (course.targetGpa !== null) {
    const { gpaValue } = getGradeInfo(currentGrade, scale);
    if (gpaValue !== null && gpaValue >= course.targetGpa) {
      return true;
    }
  }

  return false;
}

/**
 * Minimum average score (0–100) needed on all remaining ungraded work to hit the
 * course target. Uses the same unweighted mean model as calculateCourseAverage.
 */
export function calculateRequiredFinalScore(
  course: Course,
  scale: GradeScale,
): RequiredFinalScore | null {
  if (!hasCourseTarget(course)) return null;

  const targetPercent = resolveTargetPercent(course, scale);
  if (targetPercent === null) return null;

  if (isAlreadyAtTarget(course, scale)) {
    return "already achieved";
  }

  const gradedPercents = course.assignments
    .map(getAssignmentPercent)
    .filter((percent): percent is number => percent !== null);
  const ungradedCount = course.assignments.filter(
    (assignment) => !isAssignmentGraded(assignment),
  ).length;

  if (ungradedCount === 0) {
    return "impossible";
  }

  const gradedSum = gradedPercents.reduce((sum, percent) => sum + percent, 0);
  const totalCount = gradedPercents.length + ungradedCount;
  const required = (targetPercent * totalCount - gradedSum) / ungradedCount;

  if (required > 100) {
    return "impossible";
  }

  if (required <= 0) {
    return "already achieved";
  }

  return Math.round(required * 10) / 10;
}

export function compareWhatIfToReal(
  simulated: Course,
  real: Course,
): WhatIfComparison {
  return {
    gradeDelta: simulated.currentGrade - real.currentGrade,
    gpaDelta:
      simulated.gpaValue !== null && real.gpaValue !== null
        ? simulated.gpaValue - real.gpaValue
        : null,
  };
}

export function formatRequiredFinalScore(result: RequiredFinalScore | null): string {
  if (result === null) return "Set a course target to calculate";
  if (result === "impossible") return "Not achievable";
  if (result === "already achieved") return "Already achieved";
  return `${result.toFixed(1)}%`;
}

export function formatWhatIfDelta(delta: number, suffix = "%"): string {
  if (delta === 0) return `0${suffix}`;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${suffix}`;
}
