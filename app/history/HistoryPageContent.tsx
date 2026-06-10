"use client";

import { PriorAcademicHistoryForm } from "@/components/academic/PriorAcademicHistoryForm";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import {
  getPriorAcademicHistory,
  isSyntheticTerm,
} from "@/lib/academic-hub";
import {
  buildAcademicCoachSnapshot,
  generateAcademicCoachInsights,
} from "@/lib/academic-coach";
import {
  computeAcademicHistorySummary,
  formatGpaDisplay,
  getTermCardSummary,
} from "@/lib/courses";
import {
  computeCgpaPrediction,
  formatProbability,
  formatTrackStatus,
  getTrackStatusColorClass,
} from "@/lib/predictionEngine";

export default function HistoryPageContent() {
  const { gradeScale } = useProfile();
  const {
    terms,
    activeTerm,
    setActiveTerm,
    addTerm,
    renameTerm,
    deleteTerm,
    upsertPriorAcademicHistory,
    removePriorAcademicHistory,
  } = useCourses();
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const priorHistory = useMemo(() => getPriorAcademicHistory(terms), [terms]);

  const history = useMemo(
    () => computeAcademicHistorySummary(terms),
    [terms],
  );
  const termCards = useMemo(
    () => terms.map((term) => getTermCardSummary(term)),
    [terms],
  );

  const cgpaPrediction = useMemo(
    () =>
      computeCgpaPrediction(
        terms,
        gradeScale,
        activeTerm?.termTargetGpa ?? null,
        activeTerm?.id,
      ),
    [terms, gradeScale, activeTerm?.termTargetGpa, activeTerm?.id],
  );

  const coach = useMemo(() => {
    const snapshot = buildAcademicCoachSnapshot(terms, gradeScale, {
      termTargetGpa: activeTerm?.termTargetGpa ?? null,
      activeTermId: activeTerm?.id,
    });
    return { snapshot, insights: generateAcademicCoachInsights(snapshot) };
  }, [terms, gradeScale, activeTerm?.termTargetGpa, activeTerm?.id]);

  const hasAnyCourses = terms.some((term) => term.courses.length > 0);
  const hasPerformance = history.cgpa !== null;
  const vsLastTermLabel =
    history.vsLastTerm !== null ? history.vsLastTermDisplay : "—";

  const selectableTerms = terms.filter((term) => !isSyntheticTerm(term));

  function handleAddTerm() {
    const name = window.prompt("Term name", "Fall 2025");
    if (!name?.trim()) return;
    addTerm(name.trim());
  }

  function handleRenameTerm(termId: string, currentName: string) {
    const name = window.prompt("Rename term", currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    renameTerm(termId, name.trim());
  }

  function handleDeleteTerm(termId: string, termName: string) {
    const confirmed = window.confirm(
      `Delete "${termName}" and all courses inside it? This cannot be undone.`,
    );
    if (!confirmed) return;
    deleteTerm(termId);
  }

  async function handleSavePriorHistory(input: {
    cgpa: number;
    completedCredits: number;
  }) {
    setIsSaving(true);
    upsertPriorAcademicHistory(input);
    setIsSaving(false);
    setShowImportModal(false);
  }

  async function handleClearPriorHistory() {
    const confirmed = window.confirm(
      "Remove your prior academic history? Cumulative GPA will only reflect courses tracked in Eduniq.",
    );
    if (!confirmed) return;
    setIsSaving(true);
    removePriorAcademicHistory();
    setIsSaving(false);
    setShowImportModal(false);
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Academic overview
        </h1>
        <p className="text-sm text-zinc-500">
          Unified record across all terms and prior history
        </p>
      </header>

      <section
        aria-label="Academic performance"
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Cumulative GPA
        </p>
        <p className="mt-3 text-5xl font-bold tabular-nums tracking-tight text-zinc-900 sm:text-6xl">
          {hasPerformance ? history.cgpaDisplay : "—"}
        </p>
        <p className="mt-3 max-w-lg text-sm text-zinc-600">
          {hasPerformance
            ? "Credit-weighted across every course in your academic record."
            : "Add prior academic history or create terms with courses to begin."}
        </p>

        {hasPerformance && (
          <div className="mt-8 grid gap-6 border-t border-zinc-100 pt-8 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Terms tracked
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
                {history.termCount}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Course average
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
                {history.cumulativePercentDisplay}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Change vs prior term
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
                {vsLastTermLabel}
              </p>
              <p className="mt-1 text-xs text-zinc-500">GPA delta only</p>
            </div>
          </div>
        )}

        {cgpaPrediction.projectedCgpa.expected !== null && (
          <div className="mt-6 rounded-lg border border-zinc-100 bg-zinc-50/80 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Projected cumulative GPA
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Expected{" "}
              <span className="font-semibold tabular-nums text-zinc-900">
                {formatGpaDisplay(cgpaPrediction.projectedCgpa.expected)}
              </span>
              <span className="text-zinc-400">
                {" "}
                (best {formatGpaDisplay(cgpaPrediction.projectedCgpa.best)} · worst{" "}
                {formatGpaDisplay(cgpaPrediction.projectedCgpa.worst)})
              </span>
            </p>
            {cgpaPrediction.trackStatus && (
              <p
                className={`mt-2 text-sm font-medium ${getTrackStatusColorClass(cgpaPrediction.trackStatus)}`}
              >
                {formatTrackStatus(cgpaPrediction.trackStatus)}
                {cgpaPrediction.probabilityOfAchievingTarget !== null && (
                  <span className="ml-2 font-normal text-zinc-500">
                    ({formatProbability(cgpaPrediction.probabilityOfAchievingTarget)}{" "}
                    likelihood)
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      <section
        aria-label="Academic coach"
        className="rounded-xl border border-zinc-200 bg-white px-5 py-6 shadow-sm sm:px-6"
      >
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Academic coach
        </h2>
        <p className="mt-2 text-sm text-zinc-600">{coach.insights.statusSummary}</p>
        <p className="mt-3 text-sm text-zinc-600">{coach.insights.trackExplanation}</p>
        <p className="mt-3 text-sm text-zinc-600">{coach.insights.targetGuidance}</p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-600">
          {coach.insights.focusAreas.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Add prior history">
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          className="w-full rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50/80 sm:px-5"
        >
          <p className="text-sm font-medium text-zinc-900">
            {priorHistory ? "Update prior academic history" : "Add prior academic history"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Import cumulative GPA and completed credits from before Eduniq
          </p>
        </button>
      </section>

      <section aria-label="Active term">
        <label
          htmlFor="active-term-select"
          className="text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Active term
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {selectableTerms.length > 0 ? (
            <select
              id="active-term-select"
              value={activeTerm?.id ?? ""}
              onChange={(event) => setActiveTerm(event.target.value)}
              className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            >
              {selectableTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-zinc-500">No terms yet — add one to set an active term.</p>
          )}
          <button
            type="button"
            onClick={handleAddTerm}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            + Add term
          </button>
        </div>
      </section>

      <section aria-label="Term history" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Terms</h2>
        {termCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-10 text-center text-sm text-zinc-500">
            No terms yet. Add a term or import prior academic history.
          </div>
        ) : (
          termCards.map((card) => {
            const term = terms.find((entry) => entry.id === card.id);
            const synthetic = term ? isSyntheticTerm(term) : false;
            return (
              <div
                key={card.id}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-4 sm:px-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {synthetic ? (
                        <span className="text-lg font-semibold tracking-tight text-zinc-900">
                          {card.name}
                        </span>
                      ) : (
                        <Link
                          href={`/history/${card.id}`}
                          className="text-lg font-semibold tracking-tight text-zinc-900 hover:underline"
                        >
                          {card.name}
                        </Link>
                      )}
                      {card.isActive && (
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Current
                        </span>
                      )}
                      {synthetic && (
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          Prior history
                        </span>
                      )}
                    </div>

                    {card.previewCourses.length > 0 ? (
                      <p className="mt-3 truncate text-sm text-zinc-600">
                        {card.previewCourses.join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-500">No courses in this term</p>
                    )}

                    {!synthetic && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleRenameTerm(card.id, card.name)}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTerm(card.id, card.name)}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {synthetic && (
                      <button
                        type="button"
                        onClick={handleClearPriorHistory}
                        className="mt-3 text-xs font-medium text-rose-600 hover:text-rose-700"
                      >
                        Remove prior history
                      </button>
                    )}
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Term GPA
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-zinc-900">
                      {card.gpaDisplay}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{card.creditsDisplay}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
          role="presentation"
          onClick={() => setShowImportModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-grades-title"
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="import-grades-title"
              className="text-lg font-semibold tracking-tight text-zinc-900"
            >
              {priorHistory ? "Update prior academic history" : "Add prior academic history"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Enter your cumulative GPA and total completed credits from before you
              started tracking courses in Eduniq.
            </p>
            <div className="mt-4">
              <PriorAcademicHistoryForm
                initialCgpa={priorHistory ? String(priorHistory.cgpa) : ""}
                initialCredits={
                  priorHistory ? String(priorHistory.completedCredits) : ""
                }
                onSave={handleSavePriorHistory}
                onClear={handleClearPriorHistory}
                showClear={priorHistory !== null}
                isSaving={isSaving}
                submitLabel={
                  priorHistory ? "Update history" : "Add prior history"
                }
              />
            </div>
            <button
              type="button"
              onClick={() => setShowImportModal(false)}
              className="mt-4 w-full text-center text-sm font-medium text-zinc-500 hover:text-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
