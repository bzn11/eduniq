"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import {
  calculateCgpa,
  computeTermMetrics,
  formatCoursePercent,
  isValidCourseCredits,
  isValidTermTargetGpa,
} from "@/lib/courses";
import { getGpaTargetOptions, parseGpaTargetOptionId } from "@/lib/grading";
import { homeMock } from "./mock-data";

const NO_TARGET_OPTION = "none";
const defaultTargetOptionId = NO_TARGET_OPTION;

export default function HomePageContent() {
  const { gradeScale } = useProfile();
  const { courses, addCourse, termTargetGpa, setTermTargetGpa, activeTerm, terms } =
    useCourses();
  const gpaTargetOptions = useMemo(
    () => getGpaTargetOptions(gradeScale),
    [gradeScale],
  );
  const { greeting } = homeMock;
  const termName = activeTerm?.name ?? "—";
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [credits, setCredits] = useState("0.5");
  const [targetOptionId, setTargetOptionId] = useState(defaultTargetOptionId);
  const [addCourseError, setAddCourseError] = useState<string | null>(null);

  const [editingTermTarget, setEditingTermTarget] = useState(false);
  const [termTargetInput, setTermTargetInput] = useState("");

  const cgpa = useMemo(() => calculateCgpa(terms), [terms]);

  const termMetrics = useMemo(
    () => computeTermMetrics(courses, termTargetGpa, cgpa),
    [courses, termTargetGpa, cgpa],
  );

  const canEditTermTarget = courses.length > 0;
  const showStatus = termMetrics.showTermComparison && termMetrics.status;

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

    const courseCredits = Number(credits);
    let target: { gpa: number; letter: string } | null = null;

    if (targetOptionId !== NO_TARGET_OPTION) {
      const parsed = parseGpaTargetOptionId(targetOptionId);
      if (!parsed) {
        setAddCourseError("Select a valid target GPA or choose no target.");
        return;
      }
      target = parsed;
    }

    if (!isValidCourseCredits(courseCredits)) {
      setAddCourseError("Credits must be greater than 0.");
      return;
    }

    addCourse(courseName, courseCredits, target);
    setCourseName("");
    setCredits("0.5");
    setTargetOptionId(defaultTargetOptionId);
    setShowAddCourse(false);
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500">{greeting}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {termName}
        </h1>
        <p className="text-sm text-zinc-500">Current term overview</p>
      </header>

      <section
        aria-label="Term performance"
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        {termMetrics.hasCourses ? (
          <div className="px-5 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Term GPA
                </p>
                <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-zinc-900 sm:text-6xl">
                  {termMetrics.termGpaDisplay}
                </p>
                {termMetrics.termPercent !== null && (
                  <p className="mt-2 text-sm text-zinc-500">
                    {termMetrics.termPercentDisplay} course average
                  </p>
                )}
              </div>

              <div className="lg:text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Cumulative GPA
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-zinc-800 sm:text-4xl">
                  {termMetrics.cumulativeDisplay}
                </p>
                <Link
                  href="/history"
                  className="mt-2 inline-block text-sm font-medium text-zinc-500 hover:text-zinc-900"
                >
                  View full history →
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-6 border-t border-zinc-100 pt-8 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Term target
                </p>
                {canEditTermTarget && editingTermTarget ? (
                  <form
                    onSubmit={handleSaveTermTarget}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="number"
                      min={0}
                      max={4.33}
                      step={0.01}
                      value={termTargetInput}
                      onChange={(event) => setTermTargetInput(event.target.value)}
                      required
                      className="w-full max-w-[8rem] rounded-lg border border-zinc-200 px-3 py-2 text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-400"
                    />
                    <button
                      type="submit"
                      className="text-sm font-medium text-zinc-900 hover:underline"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTermTarget(false)}
                      className="text-sm font-medium text-zinc-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-xl font-semibold tabular-nums text-zinc-900">
                      {termMetrics.targetGpaDisplay}
                    </p>
                    {canEditTermTarget && (
                      <button
                        type="button"
                        onClick={handleStartEditTermTarget}
                        className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Progress
                </p>
                {showStatus ? (
                  <div className="mt-2">
                    <p
                      className={`text-xl font-semibold ${termMetrics.statusColorClass}`}
                    >
                      {termMetrics.status}
                    </p>
                    {termMetrics.remaining && (
                      <p className="mt-1 text-sm text-zinc-600">
                        {termMetrics.remaining}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    Set a term target to track on-track status.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 py-12 text-center sm:px-8">
            <p className="text-base font-medium text-zinc-900">No courses yet</p>
            <p className="mt-2 text-sm text-zinc-500">
              Add your first course to start tracking term GPA and progress.
            </p>
            <button
              type="button"
              onClick={() => setShowAddCourse(true)}
              className="mt-6 rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add course
            </button>
          </div>
        )}
      </section>

      <section aria-label="Courses">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Courses
          </h2>
          {courses.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-zinc-500">
                {courses.length} {courses.length === 1 ? "course" : "courses"}
              </p>
              <button
                type="button"
                onClick={() => setShowAddCourse(true)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                + Add course
              </button>
            </div>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500">
            Your courses for this term will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/course/${course.id}`}
                  className="flex gap-4 px-5 py-4 transition-colors hover:bg-zinc-50/80 sm:px-6"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-tight text-zinc-700"
                    aria-hidden
                  >
                    {course.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">
                          {course.name}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">{course.context}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {course.credits}{" "}
                          {course.credits === 1 ? "credit" : "credits"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold tabular-nums text-zinc-900">
                          {formatCoursePercent(course.currentGrade)}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">Course average</p>
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
                  htmlFor="course-credits"
                  className="text-xs font-medium text-zinc-500"
                >
                  Credits
                </label>
                <input
                  id="course-credits"
                  type="number"
                  min={0}
                  step="any"
                  value={credits}
                  onChange={(event) => setCredits(event.target.value)}
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
