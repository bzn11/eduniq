import {
  ACTIVE_GRADE_SCALE,
  formatCourseGradeMeta,
  formatGpaTargetLabel,
  getGradeInfo,
  letterToMinPercent,
} from "@/lib/grading";
import {
  calculateCourseAverage,
  isAssignmentGraded,
  type Assignment,
} from "@/lib/assignments";

export type TargetType = "letter" | "gpa" | "percentage";

export type CourseStatus = "On track" | "Stretch" | "At risk" | "Unlikely";

export type CourseInsight = {
  gradedPercent: number;
  remainingPercent: number;
  needOnRemaining: string;
  summary: string;
};

export type CourseMetrics = {
  currentGrade: number;
  targetGrade: number | null;
  gradeLabel: string | null;
  gpaValue: number | null;
  gradeSecondary: string | null;
  context: string;
  projection: string | null;
  projectedFinalGrade: number;
  status: CourseStatus | null;
  statusColorClass: string;
  insight: CourseInsight;
  hasTarget: boolean;
};

export type TermMetrics = {
  hasCourses: boolean;
  termGpa: number | null;
  termGpaDisplay: string;
  subtitle: string | null;
  cumulativeDisplay: string;
  targetGpaDisplay: string;
  status: CourseStatus | null;
  statusColorClass: string;
  remaining: string | null;
  showTermComparison: boolean;
};

export function hasCourseTarget(course: {
  targetGpa: number | null;
  targetLetter: string | null;
  targetPercentage?: number | null;
}): boolean {
  return course.targetGpa !== null && course.targetLetter !== null;
}

export function getStatusColorClass(status: CourseStatus | null): string {
  if (!status) return "text-zinc-500";
  if (status === "On track") return "text-emerald-700";
  if (status === "Stretch") return "text-amber-700";
  return "text-rose-700";
}

function resolveGradeFromPercent(percent: number) {
  if (percent === 0) {
    return { letterGrade: null, gpaValue: null };
  }
  const info = getGradeInfo(percent, ACTIVE_GRADE_SCALE);
  return {
    letterGrade: info.letterGrade,
    gpaValue: info.gpaValue,
  };
}

export function resolveTargetPercent(course: {
  targetType: TargetType;
  targetLetter: string | null;
  targetGpa: number | null;
  targetPercentage: number | null;
}): number | null {
  if (!hasCourseTarget(course)) return null;
  if (course.targetLetter) {
    return letterToMinPercent(course.targetLetter);
  }
  if (course.targetType === "percentage" && course.targetPercentage !== null) {
    return course.targetPercentage;
  }
  if (course.targetGpa !== null) {
    const band = ACTIVE_GRADE_SCALE.bands.find(
      (entry) => entry.gpa === course.targetGpa,
    );
    return band?.min ?? null;
  }
  return null;
}

function getAssignmentWeights(assignments: Assignment[]) {
  const totalWeight = assignments.reduce((sum, a) => sum + a.weight, 0);
  const gradedWeight = assignments
    .filter(isAssignmentGraded)
    .reduce((sum, a) => sum + a.weight, 0);
  const hasAssignments = assignments.length > 0;
  const hasGraded = gradedWeight > 0;
  const allWeightsGraded =
    totalWeight > 0 && Math.abs(gradedWeight - totalWeight) < 0.001;

  return {
    totalWeight,
    gradedWeight,
    hasAssignments,
    hasGraded,
    allWeightsGraded,
    remainingPercent:
      totalWeight === 0 ? 100 : Math.max(0, 100 - gradedWeight),
    gradedPercent: gradedWeight,
  };
}

function getContextLine(assignments: Assignment[]): string {
  if (assignments.length === 0) return "No assignments yet";
  const next = assignments.find((assignment) => !isAssignmentGraded(assignment));
  if (next) return `Next: ${next.name}`;
  return "Stable";
}

function formatTargetPhrase(
  targetGpa: number | null,
  targetLetter: string | null,
): string {
  if (targetGpa !== null && targetLetter) {
    return formatGpaTargetLabel(targetGpa, targetLetter);
  }
  if (targetLetter) return targetLetter;
  return "your target";
}

function computeCourseStatus(
  currentGrade: number,
  gpaValue: number | null,
  targetGpa: number | null,
  targetLetter: string | null,
  targetGrade: number | null,
  weights: ReturnType<typeof getAssignmentWeights>,
): CourseStatus | null {
  if (!hasCourseTarget({ targetGpa, targetLetter, targetPercentage: null })) {
    return null;
  }

  if (!weights.hasAssignments || !weights.hasGraded || currentGrade === 0) {
    return null;
  }

  if (targetGpa !== null && gpaValue !== null) {
    if (gpaValue >= targetGpa) return "On track";
    if (targetGpa - gpaValue <= 0.3) return "Stretch";
    return "Unlikely";
  }

  if (targetGrade !== null) {
    if (currentGrade >= targetGrade) return "On track";
    if (targetGrade - currentGrade <= 5) return "Stretch";
    return "At risk";
  }

  return null;
}

function computeInsight(
  assignments: Assignment[],
  targetGpa: number | null,
  targetLetter: string | null,
  targetGrade: number | null,
  currentGrade: number,
  gpaValue: number | null,
  weights: ReturnType<typeof getAssignmentWeights>,
): CourseInsight {
  const targetSet = hasCourseTarget({
    targetGpa,
    targetLetter,
    targetPercentage: null,
  });
  const trackingLetter = resolveGradeFromPercent(currentGrade).letterGrade;

  if (!weights.hasAssignments) {
    return {
      gradedPercent: 0,
      remainingPercent: 100,
      needOnRemaining: "—",
      summary: "Add assignments to track performance.",
    };
  }

  if (weights.totalWeight === 0) {
    return {
      gradedPercent: 0,
      remainingPercent: 100,
      needOnRemaining: "—",
      summary: "Assign weights to begin tracking.",
    };
  }

  if (!weights.hasGraded) {
    return {
      gradedPercent: 0,
      remainingPercent: weights.remainingPercent,
      needOnRemaining: "—",
      summary: "Add grades to begin tracking.",
    };
  }

  if (!targetSet) {
    return {
      gradedPercent: weights.gradedPercent,
      remainingPercent: weights.remainingPercent,
      needOnRemaining: "—",
      summary: trackingLetter
        ? `Currently at ${currentGrade.toFixed(1)}% (${trackingLetter}).`
        : `Currently at ${currentGrade.toFixed(1)}%.`,
    };
  }

  const targetPhrase = formatTargetPhrase(targetGpa, targetLetter);
  const onTarget =
    (targetGpa !== null && gpaValue !== null && gpaValue >= targetGpa) ||
    (targetGrade !== null && currentGrade >= targetGrade);

  let needOnRemaining: string;
  if (!onTarget && weights.remainingPercent > 0) {
    needOnRemaining = `Need ${targetPhrase} to stay on track`;
  } else if (weights.allWeightsGraded && onTarget) {
    needOnRemaining = "Target met for graded work";
  } else if (weights.remainingPercent > 0) {
    needOnRemaining = `${weights.remainingPercent}% of course weight still open`;
  } else {
    needOnRemaining = "—";
  }

  const summary =
    onTarget && trackingLetter
      ? `Currently tracking toward ${trackingLetter}`
      : onTarget
        ? `You are on track at ${currentGrade.toFixed(1)}%.`
        : `Working toward ${targetPhrase}`;

  return {
    gradedPercent: weights.gradedPercent,
    remainingPercent: weights.remainingPercent,
    needOnRemaining,
    summary,
  };
}

export function computeCourseMetrics(course: {
  assignments: Assignment[];
  targetType: TargetType;
  targetLetter: string | null;
  targetGpa: number | null;
  targetPercentage: number | null;
}): CourseMetrics {
  const currentGrade = calculateCourseAverage(course.assignments);
  const targetGrade = resolveTargetPercent(course);
  const { letterGrade, gpaValue } = resolveGradeFromPercent(currentGrade);
  const weights = getAssignmentWeights(course.assignments);
  const hasTarget = hasCourseTarget(course);
  const status = computeCourseStatus(
    currentGrade,
    gpaValue,
    course.targetGpa,
    course.targetLetter,
    targetGrade,
    weights,
  );
  const projectedInfo = getGradeInfo(currentGrade, ACTIVE_GRADE_SCALE);

  const projection = hasTarget
    ? projectedInfo.letterGrade
      ? `proj. ${projectedInfo.letterGrade}`
      : `proj. ${currentGrade.toFixed(1)}%`
    : null;

  return {
    currentGrade,
    targetGrade,
    gradeLabel: letterGrade,
    gpaValue,
    gradeSecondary: formatCourseGradeMeta(letterGrade, currentGrade),
    context: getContextLine(course.assignments),
    projection,
    projectedFinalGrade: currentGrade,
    status,
    statusColorClass: getStatusColorClass(status),
    insight: computeInsight(
      course.assignments,
      course.targetGpa,
      course.targetLetter,
      targetGrade,
      currentGrade,
      gpaValue,
      weights,
    ),
    hasTarget,
  };
}

export function formatCourseTargetLabel(course: {
  targetGpa: number | null;
  targetLetter: string | null;
}): string {
  if (!hasCourseTarget(course)) return "No target set";
  if (course.targetGpa !== null && course.targetLetter) {
    return formatGpaTargetLabel(course.targetGpa, course.targetLetter);
  }
  if (course.targetLetter) return course.targetLetter;
  return "No target set";
}

export function courseContributesToTermGpa(course: {
  assignments: Assignment[];
  currentGrade: number;
  gpaValue: number | null;
}): boolean {
  const hasGraded = course.assignments.some(isAssignmentGraded);
  return hasGraded && course.currentGrade > 0 && course.gpaValue !== null;
}

export function calculateTermGpa(
  courses: Array<{ creditWeight: number; gpaValue: number | null; assignments: Assignment[]; currentGrade: number }>,
): number | null {
  const eligible = courses.filter(courseContributesToTermGpa);
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, course) => sum + course.creditWeight, 0);
  if (totalWeight <= 0) return null;

  const weighted = eligible.reduce(
    (sum, course) => sum + (course.gpaValue ?? 0) * course.creditWeight,
    0,
  );

  return weighted / totalWeight;
}

function formatGpa(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

function formatTermTargetDisplay(termTargetGpa: number | null): string {
  if (termTargetGpa === null) return "No target set";
  return formatGpa(termTargetGpa);
}

export function computeTermMetrics(
  courses: Array<{
    creditWeight: number;
    gpaValue: number | null;
    assignments: Assignment[];
    currentGrade: number;
  }>,
  termTargetGpa: number | null,
): TermMetrics {
  if (courses.length === 0) {
    return {
      hasCourses: false,
      termGpa: null,
      termGpaDisplay: "—",
      subtitle: null,
      cumulativeDisplay: "—",
      targetGpaDisplay: "—",
      status: null,
      statusColorClass: "text-zinc-500",
      remaining: null,
      showTermComparison: false,
    };
  }

  const termGpa = calculateTermGpa(courses);
  const gradedCount = courses.filter(courseContributesToTermGpa).length;
  const targetDisplay = formatTermTargetDisplay(termTargetGpa);

  if (termGpa === null) {
    return {
      hasCourses: true,
      termGpa: null,
      termGpaDisplay: "—",
      subtitle: "Add grades to courses to calculate term GPA",
      cumulativeDisplay: "—",
      targetGpaDisplay: targetDisplay,
      status: null,
      statusColorClass: "text-zinc-500",
      remaining: null,
      showTermComparison: false,
    };
  }

  if (termTargetGpa === null) {
    return {
      hasCourses: true,
      termGpa,
      termGpaDisplay: formatGpa(termGpa),
      subtitle: `Weighted across ${gradedCount} graded courses`,
      cumulativeDisplay: formatGpa(termGpa),
      targetGpaDisplay: targetDisplay,
      status: null,
      statusColorClass: "text-zinc-500",
      remaining: null,
      showTermComparison: false,
    };
  }

  let status: CourseStatus | null = null;
  let remaining: string | null = null;

  if (termGpa >= termTargetGpa) {
    status = "On track";
    remaining = "Target met for current term";
  } else if (termTargetGpa - termGpa <= 0.3) {
    status = "Stretch";
    remaining = `Need ${(termTargetGpa - termGpa).toFixed(2)} to reach term target`;
  } else {
    status = "Unlikely";
    remaining = `Need ${(termTargetGpa - termGpa).toFixed(2)} to reach term target`;
  }

  return {
    hasCourses: true,
    termGpa,
    termGpaDisplay: formatGpa(termGpa),
    subtitle: `Weighted across ${gradedCount} graded courses`,
    cumulativeDisplay: formatGpa(termGpa),
    targetGpaDisplay: targetDisplay,
    status,
    statusColorClass: getStatusColorClass(status),
    remaining,
    showTermComparison: true,
  };
}
