"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import {
  computeTermMetrics,
  formatCoursePercent,
  isValidCreditWeight,
  isValidTermTargetGpa,
} from "@/lib/courses";
import { getGpaTargetOptions, parseGpaTargetOptionId } from "@/lib/grading";
import { homeMock } from "./mock-data";

const gpaTargetOptions = getGpaTargetOptions();
const NO_TARGET_OPTION = "none";
const defaultTargetOptionId = NO_TARGET_OPTION;

export default function HomePageContent() {
  const { courses, addCourse, termTargetGpa, setTermTargetGpa } = useCourses();
  const { greeting, term, currentTermGpaLabel } = homeMock;
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [creditWeight, setCreditWeight] = useState("0.5");
  const [targetOptionId, setTargetOptionId] = useState(defaultTargetOptionId);
  const [addCourseError, setAddCourseError] = useState<string | null>(null);

  const [editingTermTarget, setEditingTermTarget] = useState(false);
  const [termTargetInput, setTermTargetInput] = useState("");

  const termMetrics = useMemo(
    () => computeTermMetrics(courses, termTargetGpa),
    [courses, termTargetGpa],
  );

  const canEditTermTarget = courses.length > 0;

  useEffect(() => {
    if (!canEditTermTarget) {
      setEditingTermTarget(false);
    }
  }, [canEditTermTarget]);

  function handleSaveTermTarget(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(termTargetInput);
    if (!isValidTermTargetGpa(value)) return;
    setTermTargetGpa(value);
    setEditingTermTarget(false);
  }

  function handleStartEditTermTarget() {
    if (!canEditTermTarget) return;
    setTermTargetInput(
      termTargetGpa !== null ? termTargetGpa.toFixed(2) : "",
    );
    setEditingTermTarget(true);
  }

  function handleAddCourse(event: React.FormEvent) {
    event.preventDefault();
    setAddCourseError(null);

    const weight = Number(creditWeight);
    let target: { gpa: number; letter: string } | null = null;

    if (targetOptionId !== NO_TARGET_OPTION) {
      const parsed = parseGpaTargetOptionId(targetOptionId);
      if (!parsed) {
        setAddCourseError("Select a valid target GPA or choose no target.");
        return;
      }
      target = parsed;
    }

    if (!isValidCreditWeight(weight)) {
      setAddCourseError("Credit weight must be greater than 0.");
      return;
    }

    addCourse(courseName, weight, target);
    setCourseName("");
    setCreditWeight("0.5");
    setTargetOptionId(defaultTargetOptionId);
    setShowAddCourse(false);
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500">{greeting}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {term}
        </h1>
      </header>

      <section
        aria-label="GPA overview"
        className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80"
      >
        {termMetrics.hasCourses ? (
          <>
          <div className="border-b border-zinc-200 bg-white px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {currentTermGpaLabel}
                </p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-zinc-900 sm:text-5xl">
                  {termMetrics.termGpaDisplay}
                </p>
              </div>
              {termMetrics.subtitle && (
                <p className="text-sm font-medium text-zinc-700 sm:max-w-[12rem] sm:text-right">
                  {termMetrics.subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white px-4 py-4 sm:px-6">
              <p className="text-xs text-zinc-500">Cumulative GPA</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                {termMetrics.cumulativeDisplay}
              </p>
            </div>
            <div className="bg-white px-4 py-4 sm:px-6">
              <p className="text-xs text-zinc-500">Target GPA</p>
              {canEditTermTarget && editingTermTarget ? (
                <form onSubmit={handleSaveTermTarget} className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={4.33}
                    step={0.01}
                    value={termTargetInput}
                    onChange={(event) => setTermTargetInput(event.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400"
                  />
                  <button
                    type="submit"
                    className="shrink-0 text-xs font-medium text-zinc-900 hover:underline"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTermTarget(false)}
                    className="shrink-0 text-xs font-medium text-zinc-500 hover:underline"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-lg font-semibold tabular-nums text-zinc-900">
                    {termMetrics.targetGpaDisplay}
                  </p>
                  {canEditTermTarget && (
                    <button
                      type="button"
                      onClick={handleStartEditTermTarget}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
            {termMetrics.showTermComparison && (
              <>
                <div className="bg-white px-4 py-4 sm:px-6">
                  <p className="text-xs text-zinc-500">Status</p>
                  <p
                    className={`mt-1 text-lg font-semibold ${termMetrics.statusColorClass}`}
                  >
                    {termMetrics.status ?? "—"}
                  </p>
                </div>
                <div className="bg-white px-4 py-4 sm:px-6">
                  <p className="text-xs text-zinc-500">To reach target</p>
                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {termMetrics.remaining ?? "—"}
                  </p>
                </div>
              </>
            )}
          </div>
          </>
        ) : (
          <div className="grid gap-px bg-zinc-200 sm:grid-cols-2">
            <div className="bg-white px-4 py-5 sm:px-6">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {currentTermGpaLabel}
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-zinc-900 sm:text-5xl">
                —
              </p>
            </div>
            <div className="bg-white px-4 py-5 sm:px-6">
              <p className="text-xs text-zinc-500">Target GPA</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                —
              </p>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Courses">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Courses
          </h2>
          <div className="flex items-center gap-3">
            {termMetrics.hasCourses && (
              <p className="text-sm text-zinc-500">
                {courses.length} / {courses.length} courses
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowAddCourse(true)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
            >
              + Add Course
            </button>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
            No courses yet
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/course/${course.id}`}
                  className="flex gap-3 px-4 py-4 transition-colors hover:bg-zinc-50/80 sm:gap-4 sm:px-5"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-tight text-zinc-700"
                    aria-hidden
                  >
                    {course.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">
                          {course.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Credit: {course.creditWeight}
                        </p>
                        <p className="mt-0.5 text-sm text-zinc-500">{course.context}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold tabular-nums text-zinc-900">
                          {formatCoursePercent(course.currentGrade)}
                        </p>
                        {course.gradeSecondary && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {course.gradeSecondary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showAddCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
          role="presentation"
          onClick={() => setShowAddCourse(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-course-title"
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="add-course-title"
              className="text-lg font-semibold tracking-tight text-zinc-900"
            >
              Add course
            </h3>
            <form onSubmit={handleAddCourse} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="course-name"
                  className="text-xs font-medium text-zinc-500"
                >
                  Course name
                </label>
                <input
                  id="course-name"
                  type="text"
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  placeholder="e.g. Organic Chemistry"
                />
              </div>
              <div>
                <label
                  htmlFor="credit-weight"
                  className="text-xs font-medium text-zinc-500"
                >
                  Credit weight
                </label>
                <input
                  id="credit-weight"
                  type="number"
                  min={0}
                  step="any"
                  value={creditWeight}
                  onChange={(event) => setCreditWeight(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label
                  htmlFor="target-gpa"
                  className="text-xs font-medium text-zinc-500"
                >
                  Target GPA (optional)
                </label>
                <select
                  id="target-gpa"
                  value={targetOptionId}
                  onChange={(event) => setTargetOptionId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value={NO_TARGET_OPTION}>No target</option>
                  {gpaTargetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {addCourseError && (
                <p className="text-xs text-rose-600">{addCourseError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourse(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Add course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
