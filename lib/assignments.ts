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

export function calculateCourseAverage(assignments: Assignment[]): number {
  const graded = assignments
    .map(getAssignmentPercent)
    .filter((percent): percent is number => percent !== null);

  if (graded.length === 0) return 0;

  const total = graded.reduce((sum, percent) => sum + percent, 0);
  return total / graded.length;
}
