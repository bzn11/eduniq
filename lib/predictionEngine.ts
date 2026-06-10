import {
  getAssignmentPercent,
  isAssignmentGraded,
  sumAssignmentWeightTotals,
  type Assignment,
} from "@/lib/assignments";
import {
  calculateCgpa,
  calculateTermGpa,
  courseContributesToTermGpa,
  hasCourseTarget,
  resolveTargetPercent,
} from "@/lib/courseMetrics";
import type { Course } from "@/lib/courses";
import { getGradeInfo, type GradeScale } from "@/lib/grading";
import type { Term } from "@/lib/terms";
import { calculateRequiredFinalScore } from "@/lib/whatIfEngine";

export type TrackStatus = "SAFE" | "AT_RISK" | "CRITICAL";

export type ScenarioProjection = {
  expected: number | null;
  best: number | null;
  worst: number | null;
};

type CourseScenarioProjection = {
  expected: number;
  best: number;
  worst: number;
};

export type CoursePrediction = {
  courseId: string;
  currentGrade: number;
  predictedFinalCourseGrade: number;
  scenarios: CourseScenarioProjection;
  requiredAverageOnRemainingWork: number | null;
  probabilityOfAchievingTarget: number | null;
  trackStatus: TrackStatus | null;
  requiredImprovementPerAssignment: number | null;
};

export type TermPrediction = {
  currentTermGpa: number | null;
  projectedTermGpa: ScenarioProjection;
  probabilityOfAchievingTarget: number | null;
  trackStatus: TrackStatus | null;
};

export type CgpaPrediction = {
  currentCgpa: number | null;
  projectedCgpa: ScenarioProjection;
  distanceToTargetCgpa: number | null;
  probabilityOfAchievingTarget: number | null;
  trackStatus: TrackStatus | null;
};

export type AcademicWhatIfResult = {
  termGpa: number | null;
  cgpa: number | null;
};

export type AcademicPredictionSnapshot = {
  course: CoursePrediction | null;
  term: TermPrediction;
  cgpa: CgpaPrediction;
};

type CourseForGpaCalc = {
  credits: number;
  gpaValue: number | null;
  assignments: Assignment[];
  currentGrade: number;
};

type ProbabilityInputs = {
  currentGpa: number | null;
  targetGpa: number | null;
  remainingWeightFraction: number;
  gradeVariance: number;
  creditLoad: number;
  requiredOnRemaining: number | "impossible" | "already achieved" | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getTrackStatus(probability: number | null): TrackStatus | null {
  if (probability === null) return null;
  if (probability >= 0.75) return "SAFE";
  if (probability >= 0.4) return "AT_RISK";
  return "CRITICAL";
}

export function getTrackStatusColorClass(status: TrackStatus | null): string {
  if (!status) return "text-zinc-500";
  if (status === "SAFE") return "text-emerald-700";
  if (status === "AT_RISK") return "text-amber-700";
  return "text-rose-700";
}

/** Projected final when all remaining work scores `remainingScorePercent`. */
export function projectCourseFinalGrade(
  assignments: Assignment[],
  remainingScorePercent: number,
): number {
  const { weightedPercentSum, gradedWeightTotal, ungradedWeightTotal } =
    sumAssignmentWeightTotals(assignments);

  const totalWeight = gradedWeightTotal + ungradedWeightTotal;
  if (totalWeight === 0) return 0;

  if (ungradedWeightTotal === 0) {
    return gradedWeightTotal > 0 ? weightedPercentSum / gradedWeightTotal : 0;
  }

  const clamped = clamp(remainingScorePercent, 0, 100);
  return (weightedPercentSum + clamped * ungradedWeightTotal) / totalWeight;
}

/** Current performance on graded work only (trend baseline). */
export function getGradedPerformanceAverage(assignments: Assignment[]): number | null {
  const { weightedPercentSum, gradedWeightTotal } =
    sumAssignmentWeightTotals(assignments);
  if (gradedWeightTotal === 0) return null;
  return weightedPercentSum / gradedWeightTotal;
}

function assignmentGradeVariance(assignments: Assignment[]): number {
  const percents = assignments
    .map(getAssignmentPercent)
    .filter((percent): percent is number => percent !== null);

  if (percents.length < 2) return 50;

  const mean = percents.reduce((sum, percent) => sum + percent, 0) / percents.length;
  return percents.reduce((sum, percent) => sum + (percent - mean) ** 2, 0) / percents.length;
}

function remainingWeightFraction(assignments: Assignment[]): number {
  const { gradedWeightTotal, ungradedWeightTotal } =
    sumAssignmentWeightTotals(assignments);
  const total = gradedWeightTotal + ungradedWeightTotal;
  if (total === 0) return 0;
  return ungradedWeightTotal / total;
}

function ungradedAssignmentCount(assignments: Assignment[]): number {
  return assignments.filter((assignment) => !isAssignmentGraded(assignment)).length;
}

function toRequiredAverage(
  result: ReturnType<typeof calculateRequiredFinalScore>,
): number | null {
  if (result === null || result === "impossible" || result === "already achieved") {
    return null;
  }
  return result;
}

function courseToGpaInput(
  course: Course,
  projectedPercent: number,
  scale: GradeScale,
): CourseForGpaCalc | null {
  const hasGraded = course.assignments.some(isAssignmentGraded);
  const grade = projectedPercent;

  if (!hasGraded && grade <= 0) return null;
  if (grade <= 0) return null;

  const { gpaValue } = getGradeInfo(grade, scale);
  if (gpaValue === null) return null;

  return {
    credits: course.credits,
    gpaValue,
    assignments: course.assignments,
    currentGrade: grade,
  };
}

function projectCourseScenarios(
  course: Course,
  scenarioRemainingPercent?: number,
): CourseScenarioProjection {
  const trend = getGradedPerformanceAverage(course.assignments);
  const expectedRemaining = scenarioRemainingPercent ?? trend ?? 0;

  return {
    expected: projectCourseFinalGrade(course.assignments, expectedRemaining),
    best: projectCourseFinalGrade(course.assignments, 100),
    worst: projectCourseFinalGrade(course.assignments, 0),
  };
}

/** Heuristic probability — not ML. */
export function computeTargetProbability(inputs: ProbabilityInputs): number | null {
  const { currentGpa, targetGpa, remainingWeightFraction, gradeVariance, creditLoad } =
    inputs;

  if (targetGpa === null || currentGpa === null) return null;

  if (inputs.requiredOnRemaining === "already achieved") return 1;
  if (inputs.requiredOnRemaining === "impossible") return 0.05;

  const gap = Math.max(0, targetGpa - currentGpa);
  const gapFactor = Math.exp(-gap * 3);

  const stabilityFactor = 1 / (1 + gradeVariance / 80);
  const opportunityFactor = clamp(remainingWeightFraction * 1.5, 0, 1);
  const creditFactor = clamp(creditLoad / 2.5, 0.3, 1);

  if (gap > 0.4 && remainingWeightFraction < 0.15) {
    return clamp(0.05 + opportunityFactor * 0.1, 0, 1);
  }

  let probability =
    gapFactor * 0.45 + stabilityFactor * 0.3 + opportunityFactor * 0.25;
  probability *= creditFactor;

  if (inputs.requiredOnRemaining !== null && typeof inputs.requiredOnRemaining === "number") {
    if (inputs.requiredOnRemaining > 95) probability *= 0.2;
    else if (inputs.requiredOnRemaining > 85) probability *= 0.5;
  }

  return clamp(probability, 0, 1);
}

export function computeCoursePrediction(
  course: Course,
  scale: GradeScale,
  scenarioRemainingPercent?: number,
): CoursePrediction {
  const scenarios = projectCourseScenarios(course, scenarioRemainingPercent);
  const requiredResult = calculateRequiredFinalScore(course, scale);
  const requiredAverage = toRequiredAverage(requiredResult);
  const trend = getGradedPerformanceAverage(course.assignments);
  const ungradedCount = ungradedAssignmentCount(course.assignments);

  let requiredImprovementPerAssignment: number | null = null;
  if (requiredAverage !== null && trend !== null && ungradedCount > 0) {
    requiredImprovementPerAssignment =
      Math.round(Math.max(0, requiredAverage - trend) * 10) / 10;
  }

  const probability = hasCourseTarget(course)
    ? computeTargetProbability({
        currentGpa: course.gpaValue,
        targetGpa: course.targetGpa,
        remainingWeightFraction: remainingWeightFraction(course.assignments),
        gradeVariance: assignmentGradeVariance(course.assignments),
        creditLoad: course.credits,
        requiredOnRemaining: requiredResult,
      })
    : null;

  return {
    courseId: course.id,
    currentGrade: Math.round(course.currentGrade * 10) / 10,
    predictedFinalCourseGrade: Math.round(scenarios.expected * 10) / 10,
    scenarios: {
      expected: Math.round(scenarios.expected * 10) / 10,
      best: Math.round(scenarios.best * 10) / 10,
      worst: Math.round(scenarios.worst * 10) / 10,
    },
    requiredAverageOnRemainingWork:
      requiredAverage !== null ? Math.round(requiredAverage * 10) / 10 : null,
    probabilityOfAchievingTarget:
      probability !== null ? Math.round(probability * 100) / 100 : null,
    trackStatus: getTrackStatus(probability),
    requiredImprovementPerAssignment,
  };
}

function buildTermGpaInputs(
  courses: Course[],
  scenario: keyof CourseScenarioProjection,
  scale: GradeScale,
  overrides?: Map<string, Course>,
): CourseForGpaCalc[] {
  const inputs: CourseForGpaCalc[] = [];

  for (const course of courses) {
    const source = overrides?.get(course.id) ?? course;
    const projected = projectCourseScenarios(source)[scenario];
    const input = courseToGpaInput(source, projected, scale);
    if (input) inputs.push(input);
  }

  return inputs;
}

export function computeTermPrediction(
  courses: Course[],
  termTargetGpa: number | null,
  scale: GradeScale,
  overrides?: Map<string, Course>,
): TermPrediction {
  const currentInputs = courses.filter(courseContributesToTermGpa);
  const currentTermGpa = calculateTermGpa(currentInputs);

  const projectedTermGpa: ScenarioProjection = {
    expected: calculateTermGpa(buildTermGpaInputs(courses, "expected", scale, overrides)),
    best: calculateTermGpa(buildTermGpaInputs(courses, "best", scale, overrides)),
    worst: calculateTermGpa(buildTermGpaInputs(courses, "worst", scale, overrides)),
  };

  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
  const avgRemainingWeight =
    courses.length > 0
      ? courses.reduce((sum, c) => sum + remainingWeightFraction(c.assignments), 0) /
        courses.length
      : 0;
  const avgVariance =
    courses.length > 0
      ? courses.reduce((sum, c) => sum + assignmentGradeVariance(c.assignments), 0) /
        courses.length
      : 50;

  const probability =
    termTargetGpa !== null
      ? computeTargetProbability({
          currentGpa: currentTermGpa,
          targetGpa: termTargetGpa,
          remainingWeightFraction: avgRemainingWeight,
          gradeVariance: avgVariance,
          creditLoad: totalCredits,
          requiredOnRemaining:
            currentTermGpa !== null && termTargetGpa > currentTermGpa
              ? (termTargetGpa - currentTermGpa) * 25
              : "already achieved",
        })
      : null;

  return {
    currentTermGpa,
    projectedTermGpa,
    probabilityOfAchievingTarget: probability,
    trackStatus: getTrackStatus(probability),
  };
}

function buildTermsForCgpaProjection(
  terms: Term[],
  activeTermId: string | undefined,
  scenario: keyof CourseScenarioProjection,
  scale: GradeScale,
  overrides?: Map<string, Course>,
): Array<{ courses: CourseForGpaCalc[] }> {
  return terms.map((term) => ({
    courses: term.courses
      .map((course) => {
        const isActive = activeTermId ? term.id === activeTermId : term.isActive;
        const source = overrides?.get(course.id) ?? course;

        if (!isActive) {
          if (!courseContributesToTermGpa(source)) return null;
          return {
            credits: source.credits,
            gpaValue: source.gpaValue,
            assignments: source.assignments,
            currentGrade: source.currentGrade,
          };
        }

        const projected = projectCourseScenarios(source)[scenario];
        return courseToGpaInput(source, projected, scale);
      })
      .filter((entry): entry is CourseForGpaCalc => entry !== null),
  }));
}

export function computeCgpaPrediction(
  terms: Term[],
  scale: GradeScale,
  targetCgpa?: number | null,
  activeTermId?: string,
  overrides?: Map<string, Course>,
): CgpaPrediction {
  const currentCgpa = calculateCgpa(terms);

  const projectedCgpa: ScenarioProjection = {
    expected: calculateCgpa(
      buildTermsForCgpaProjection(terms, activeTermId, "expected", scale, overrides),
    ),
    best: calculateCgpa(
      buildTermsForCgpaProjection(terms, activeTermId, "best", scale, overrides),
    ),
    worst: calculateCgpa(
      buildTermsForCgpaProjection(terms, activeTermId, "worst", scale, overrides),
    ),
  };

  const activeTerm = activeTermId
    ? terms.find((term) => term.id === activeTermId)
    : terms.find((term) => term.isActive);
  const activeCourses = activeTerm?.courses ?? [];
  const avgRemainingWeight =
    activeCourses.length > 0
      ? activeCourses.reduce(
          (sum, c) => sum + remainingWeightFraction(c.assignments),
          0,
        ) / activeCourses.length
      : 0;

  const distanceToTargetCgpa =
    targetCgpa != null && projectedCgpa.expected !== null
      ? Math.round((targetCgpa - projectedCgpa.expected) * 100) / 100
      : null;

  const probability =
    targetCgpa != null
      ? computeTargetProbability({
          currentGpa: currentCgpa,
          targetGpa: targetCgpa,
          remainingWeightFraction: avgRemainingWeight,
          gradeVariance:
            activeCourses.length > 0
              ? activeCourses.reduce(
                  (sum, c) => sum + assignmentGradeVariance(c.assignments),
                  0,
                ) / activeCourses.length
              : 50,
          creditLoad: activeCourses.reduce((sum, c) => sum + c.credits, 0),
          requiredOnRemaining:
            distanceToTargetCgpa !== null && distanceToTargetCgpa > 0
              ? distanceToTargetCgpa * 25
              : "already achieved",
        })
      : null;

  return {
    currentCgpa,
    projectedCgpa,
    distanceToTargetCgpa,
    probabilityOfAchievingTarget: probability,
    trackStatus: getTrackStatus(probability),
  };
}

function courseToGpaInputFromSimulatedOrProjected(
  course: Course,
  scale: GradeScale,
  scenario: keyof CourseScenarioProjection,
  useLiveGrade: boolean,
): CourseForGpaCalc | null {
  if (useLiveGrade) {
    return courseToGpaInput(course, course.currentGrade, scale);
  }
  const projected = projectCourseScenarios(course)[scenario];
  return courseToGpaInput(course, projected, scale);
}

/** What-if: substitute simulated courses and recalculate term + CGPA via existing formulas. */
export function simulateAcademicWhatIf(
  terms: Term[],
  activeTermId: string,
  simulatedCourses: Map<string, Course>,
  scale: GradeScale,
): AcademicWhatIfResult {
  const activeTerm = terms.find((term) => term.id === activeTermId);
  if (!activeTerm) {
    return { termGpa: null, cgpa: null };
  }

  const termInputs = activeTerm.courses
    .map((course) => {
      const source = simulatedCourses.get(course.id) ?? course;
      const useLive = simulatedCourses.has(course.id);
      return courseToGpaInputFromSimulatedOrProjected(
        source,
        scale,
        "expected",
        useLive,
      );
    })
    .filter((entry): entry is CourseForGpaCalc => entry !== null);

  const termGpa = calculateTermGpa(termInputs);

  const cgpaTerms = terms.map((term) => ({
    courses: term.courses
      .map((course) => {
        const source = simulatedCourses.get(course.id) ?? course;
        const useLive = simulatedCourses.has(course.id);
        const isActive = term.id === activeTermId;

        if (useLive || isActive) {
          return courseToGpaInputFromSimulatedOrProjected(
            source,
            scale,
            "expected",
            useLive,
          );
        }

        if (!courseContributesToTermGpa(source)) return null;
        return {
          credits: source.credits,
          gpaValue: source.gpaValue,
          assignments: source.assignments,
          currentGrade: source.currentGrade,
        };
      })
      .filter((entry): entry is CourseForGpaCalc => entry !== null),
  }));

  const cgpa = calculateCgpa(cgpaTerms);

  return { termGpa, cgpa };
}

export function computeAcademicPredictionSnapshot(
  course: Course | null,
  terms: Term[],
  scale: GradeScale,
  options?: {
    termTargetGpa?: number | null;
    cgpaTarget?: number | null;
    activeTermId?: string;
    scenarioRemainingPercent?: number;
    simulatedCourses?: Map<string, Course>;
  },
): AcademicPredictionSnapshot {
  const activeTermId =
    options?.activeTermId ?? terms.find((term) => term.isActive)?.id;
  const activeTerm = activeTermId
    ? terms.find((term) => term.id === activeTermId)
    : undefined;

  return {
    course: course
      ? computeCoursePrediction(course, scale, options?.scenarioRemainingPercent)
      : null,
    term: computeTermPrediction(
      activeTerm?.courses ?? [],
      options?.termTargetGpa ?? activeTerm?.termTargetGpa ?? null,
      scale,
      options?.simulatedCourses,
    ),
    cgpa: computeCgpaPrediction(
      terms,
      scale,
      options?.cgpaTarget ?? null,
      activeTermId,
      options?.simulatedCourses,
    ),
  };
}

export function formatProbability(probability: number | null): string {
  if (probability === null) return "—";
  return `${Math.round(probability * 100)}%`;
}

export function formatTrackStatus(status: TrackStatus | null): string {
  if (!status) return "—";
  if (status === "SAFE") return "On track";
  if (status === "AT_RISK") return "At risk";
  return "Critical";
}
