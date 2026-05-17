"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import {
  computeAcademicHistorySummary,
  getTermCardSummary,
} from "@/lib/courses";

export default function HistoryPageContent() {
  const { terms, activeTerm, setActiveTerm, addTerm } = useCourses();
  const [showImportModal, setShowImportModal] = useState(false);

  const history = useMemo(() => computeAcademicHistorySummary(terms), [terms]);
  const termCards = useMemo(
    () => terms.map((term) => getTermCardSummary(term)),
    [terms],
  );

  const hasAnyCourses = terms.some((term) => term.courses.length > 0);
  const vsLastTermLabel =
    history.vsLastTerm !== null
      ? history.vsLastTermDisplay
      : "—";

  function handleAddTerm() {
    const name = window.prompt("Term name", "Winter 2026");
    if (!name?.trim()) return;
    addTerm(name.trim());
  }

  function handleImportClick() {
    setShowImportModal(true);
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
          {hasAnyCourses ? history.cgpaDisplay : "—"}
        </p>
        <p className="mt-3 max-w-lg text-sm text-zinc-600">
          {hasAnyCourses
            ? "Credit-weighted average across every graded course in your history."
            : "Add courses to terms to calculate your cumulative GPA."}
        </p>

        {hasAnyCourses && (
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
          onClick={handleImportClick}
          className="w-full rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50/80 sm:px-5"
        >
          <p className="text-sm font-medium text-zinc-900">Import past grades</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Bring in courses from previous terms
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
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Terms
        </h2>
        {termCards.map((card) => (
          <Link
            key={card.id}
            href={`/history/${card.id}`}
            className="block rounded-xl border border-zinc-200 bg-white px-5 py-4 transition-colors hover:bg-zinc-50/80 sm:px-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
                    {card.name}
                  </h3>
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
                      <span className="text-zinc-400">
                        {" "}
                        · +{card.moreCount} more
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">No courses in this term</p>
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
          </Link>
        ))}
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
            <p className="mt-2 text-sm text-zinc-600">Grade import coming soon.</p>
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
