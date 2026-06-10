import { createAcademicHub, getPriorAcademicHistory } from "@/lib/academic-hub";
import {
  calculateCgpa,
  calculateTermGpa,
  computeAcademicHistorySummary,
} from "@/lib/courseMetrics";
import type { Course } from "@/lib/courses";
import type { GradeScale } from "@/lib/grading";
import {
  computeAcademicPredictionSnapshot,
  formatProbability,
  formatTrackStatus,
  type AcademicPredictionSnapshot,
} from "@/lib/predictionEngine";
import type { Term } from "@/lib/terms";

export type AcademicCoachSnapshot = {
  cgpa: number | null;
  termGpa: number | null;
  cumulativePercent: number | null;
  termCount: number;
  priorHistory: { cgpa: number; completedCredits: number } | null;
  predictions: AcademicPredictionSnapshot;
  whatIf: {
    termGpa: number | null;
    cgpa: number | null;
  } | null;
};

export type AcademicCoachInsight = {
  statusSummary: string;
  trackExplanation: string;
  targetGuidance: string;
  focusAreas: string[];
  whatIfInterpretation: string | null;
  insufficientData: string[];
};

export function buildAcademicCoachSnapshot(
  terms: Term[],
  scale: GradeScale,
  options?: {
    course?: Course | null;
    termTargetGpa?: number | null;
    activeTermId?: string;
    simulatedCourses?: Map<string, Course>;
    whatIfResult?: { termGpa: number | null; cgpa: number | null } | null;
  },
): AcademicCoachSnapshot {
  const hub = createAcademicHub(terms);
  const activeTerm = options?.activeTermId
    ? terms.find((term) => term.id === options.activeTermId)
    : terms.find((term) => term.isActive && !term.isSynthetic);

  const history = computeAcademicHistorySummary(hub.terms);
  const predictions = computeAcademicPredictionSnapshot(
    options?.course ?? null,
    hub.terms,
    scale,
    {
      termTargetGpa: options?.termTargetGpa ?? activeTerm?.termTargetGpa ?? null,
      cgpaTarget: options?.termTargetGpa ?? activeTerm?.termTargetGpa ?? null,
      activeTermId: activeTerm?.id,
      simulatedCourses: options?.simulatedCourses,
    },
  );

  return {
    cgpa: history.cgpa,
    termGpa: activeTerm ? calculateTermGpa(activeTerm.courses) : null,
    cumulativePercent: history.cumulativePercent,
    termCount: history.termCount,
    priorHistory: getPriorAcademicHistory(hub.terms),
    predictions,
    whatIf: options?.whatIfResult ?? null,
  };
}

function formatGpa(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "insufficient data";
  return value.toFixed(2);
}

export function generateAcademicCoachInsights(
  snapshot: AcademicCoachSnapshot,
): AcademicCoachInsight {
  const insufficientData: string[] = [];
  const { predictions, cgpa, termGpa, priorHistory } = snapshot;

  if (cgpa === null) insufficientData.push("cumulative GPA");
  if (termGpa === null) insufficientData.push("term GPA");

  const termTrack = predictions.term.trackStatus;
  const cgpaTrack = predictions.cgpa.trackStatus;
  const courseTrack = predictions.course?.trackStatus ?? null;

  const statusSummary =
    cgpa !== null && termGpa !== null
      ? `Your cumulative GPA is ${formatGpa(cgpa)} and your current term GPA is ${formatGpa(termGpa)}.${
          priorHistory
            ? ` This includes prior academic history (${formatGpa(priorHistory.cgpa)} across ${priorHistory.completedCredits} credits).`
            : ""
        }`
      : "Insufficient data to summarize your full academic standing.";

  let trackExplanation = "Track status is not available yet.";
  if (termTrack || cgpaTrack || courseTrack) {
    const parts: string[] = [];
    if (courseTrack) {
      parts.push(
        `Course outlook: ${formatTrackStatus(courseTrack)} (${formatProbability(predictions.course?.probabilityOfAchievingTarget ?? null)} likelihood of hitting your course target).`,
      );
    }
    if (termTrack) {
      parts.push(
        `Term outlook: ${formatTrackStatus(termTrack)} (${formatProbability(predictions.term.probabilityOfAchievingTarget)} likelihood of hitting your term target).`,
      );
    }
    if (cgpaTrack) {
      parts.push(
        `Cumulative outlook: ${formatTrackStatus(cgpaTrack)} (${formatProbability(predictions.cgpa.probabilityOfAchievingTarget)} likelihood of reaching your cumulative target).`,
      );
    }
    trackExplanation = parts.join(" ");
  }

  let targetGuidance = "Set a GPA target to receive specific guidance.";
  const coursePrediction = predictions.course;
  if (coursePrediction?.requiredAverageOnRemainingWork != null) {
    targetGuidance = `To reach your course target, you need about ${coursePrediction.requiredAverageOnRemainingWork.toFixed(0)}% on remaining work.`;
  } else if (predictions.cgpa.distanceToTargetCgpa !== null) {
    const distance = predictions.cgpa.distanceToTargetCgpa;
    targetGuidance =
      distance <= 0
        ? "You are at or above your cumulative GPA target based on current projections."
        : `You need roughly ${distance.toFixed(2)} more cumulative GPA points to reach your target trajectory.`;
  }

  const focusAreas: string[] = [];
  if (predictions.course) {
    const course = predictions.course;
    if (course.trackStatus === "CRITICAL" || course.trackStatus === "AT_RISK") {
      focusAreas.push(
        `Prioritize this course — projected final ${course.predictedFinalCourseGrade.toFixed(0)}% with ${formatProbability(course.probabilityOfAchievingTarget)} target likelihood.`,
      );
    }
    if (course.requiredImprovementPerAssignment !== null && course.requiredImprovementPerAssignment > 0) {
      focusAreas.push(
        `Aim for about +${course.requiredImprovementPerAssignment.toFixed(0)}% above your current pace on each remaining assignment.`,
      );
    }
  }
  if (predictions.term.trackStatus === "CRITICAL") {
    focusAreas.push("Term GPA is at critical risk — focus on highest-credit courses first.");
  }
  if (focusAreas.length === 0) {
    focusAreas.push("Maintain current performance across your active courses.");
  }

  let whatIfInterpretation: string | null = null;
  if (snapshot.whatIf) {
    whatIfInterpretation = `With your simulated grades, term GPA would be ${formatGpa(snapshot.whatIf.termGpa)} and cumulative GPA would be ${formatGpa(snapshot.whatIf.cgpa)}.`;
  }

  return {
    statusSummary,
    trackExplanation,
    targetGuidance,
    focusAreas,
    whatIfInterpretation,
    insufficientData,
  };
}
