"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import {
  computeAcademicHistorySummary,
  getTermCardSummary,
} from "@/lib/courses";

export default function HistoryPageContent() {
  const {
    terms,
    activeTerm,
    setActiveTerm,
    addTerm,
    renameTerm,
    deleteTerm,
    cgpaBaseline,
  } = useCourses();
  const [showImportModal, setShowImportModal] = useState(false);

  const history = useMemo(
    () => computeAcademicHistorySummary(terms, cgpaBaseline),
    [terms, cgpaBaseline],
  );
  const termCards = useMemo(
    () => terms.map((term) => getTermCardSummary(term)),
    [terms],
  );

  const hasAnyCourses = terms.some((term) => term.courses.length > 0);
  const hasCgpa = hasAnyCourses || cgpaBaseline !== null;
  const vsLastTermLabel =
    history.vsLastTerm !== null ? history.vsLastTermDisplay : "—";

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

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Grade history
        </h1>
        <p className="text-sm text-zinc-500">
          Cumulative record across all terms
        </p>
      </header>

      <section
        aria-label="Cumulative GPA"
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white px-5 py-8 shadow-sm sm:px-8 sm:py-10"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Cumulative GPA (CGPA)
        </p>
        <p className="mt-3 text-5xl font-bold tabular-nums tracking-tight text-zinc-900 sm:text-6xl">
          {hasCgpa ? history.cgpaDisplay : "—"}
        </p>
        <p className="mt-3 max-w-lg text-sm text-zinc-600">
          {cgpaBaseline && !hasAnyCourses
            ? `Imported baseline across ${cgpaBaseline.completedCredits} completed credits. Add terms to track new courses.`
            : hasAnyCourses
              ? "Credit-weighted average across every graded course in your history."
              : "Import a CGPA baseline or add terms with courses to calculate cumulative GPA."}
        </p>

        {hasCgpa && (
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
                Cumulative average
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
      </section>

      <section aria-label="Import grades">
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          className="w-full rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50/80 sm:px-5"
        >
          <p className="text-sm font-medium text-zinc-900">Import past grades</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            CGPA-only or full term history (also available during onboarding)
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
          {terms.length > 0 ? (
            <select
              id="active-term-select"
              value={activeTerm?.id ?? ""}
              onChange={(event) => setActiveTerm(event.target.value)}
              className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            >
              {terms.map((term) => (
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
            No terms yet. Add a term to build your transcript.
          </div>
        ) : (
          termCards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-zinc-200 bg-white px-5 py-4 sm:px-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/history/${card.id}`}
                      className="text-lg font-semibold tracking-tight text-zinc-900 hover:underline"
                    >
                      {card.name}
                    </Link>
                    {card.isActive && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Current
                      </span>
                    )}
                  </div>

                  {card.previewCourses.length > 0 ? (
                    <p className="mt-3 truncate text-sm text-zinc-600">
                      {card.previewCourses.join(" · ")}
                      {card.moreCount > 0 && (
                        <span className="text-zinc-400"> · +{card.moreCount} more</span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">No courses in this term</p>
                  )}

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
          ))
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
              Import past grades
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Use onboarding from your profile settings, or add terms manually with the
              buttons above.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
