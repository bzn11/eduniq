export type Assignment = {
  id: string;
  name: string;
  weight: number;
  earnedPoints?: number;
  totalPoints?: number;
};

export function isAssignmentGraded(assignment: Assignment): boolean {
  return (
    assignment.earnedPoints !== undefined &&
    assignment.totalPoints !== undefined &&
    assignment.totalPoints > 0
  );
}

export function getAssignmentPercent(assignment: Assignment): number | null {
  if (!isAssignmentGraded(assignment)) return null;
  return ((assignment.earnedPoints ?? 0) / (assignment.totalPoints ?? 1)) * 100;
}

function isValidAssignmentWeight(weight: number): boolean {
  return typeof weight === "number" && !Number.isNaN(weight) && weight > 0;
}

export type AssignmentWeightTotals = {
  weightedPercentSum: number;
  gradedWeightTotal: number;
  ungradedWeightTotal: number;
};

/** Sums graded (percent × weight) and weight totals; ignores invalid weights. */
export function sumAssignmentWeightTotals(
  assignments: Assignment[],
): AssignmentWeightTotals {
  let weightedPercentSum = 0;
  let gradedWeightTotal = 0;
  let ungradedWeightTotal = 0;

  for (const assignment of assignments) {
    const weight = assignment.weight;
    if (!isValidAssignmentWeight(weight)) continue;

    const percent = getAssignmentPercent(assignment);
    if (percent !== null) {
      weightedPercentSum += percent * weight;
      gradedWeightTotal += weight;
    } else {
      ungradedWeightTotal += weight;
    }
  }

  return { weightedPercentSum, gradedWeightTotal, ungradedWeightTotal };
}

export function calculateCourseAverage(assignments: Assignment[]): number {
  const { weightedPercentSum, gradedWeightTotal } =
    sumAssignmentWeightTotals(assignments);

  if (gradedWeightTotal === 0) return 0;

  return weightedPercentSum / gradedWeightTotal;
}
