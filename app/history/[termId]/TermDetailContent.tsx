"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCourses } from "@/context/CourseContext";
import {
  calculateTermGpa,
  calculateTermPercentage,
  formatCoursePercent,
  formatGpaDisplay,
  formatPercentageDisplay,
} from "@/lib/courses";

export default function TermDetailContent() {
  const params = useParams();
  const termId = typeof params.termId === "string" ? params.termId : "";
  const { getTermById } = useCourses();
  const term = getTermById(termId);

  if (!term) {
    return <p className="text-sm text-zinc-600">Term not found.</p>;
  }

  const termGpa = calculateTermGpa(term.courses);
  const termPercent = calculateTermPercentage(term.courses);
  const isReadOnly = !term.isActive;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/history"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          ← Back to history
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            {term.name}
          </h1>
          {term.isActive && (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Current
            </span>
          )}
          {isReadOnly && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Read-only
            </span>
          )}
        </div>
      </header>

      <section
        aria-label="Term performance"
        className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80"
      >
        <div className="grid gap-px bg-zinc-200 sm:grid-cols-2">
          <div className="bg-white px-4 py-5 sm:px-6">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
              {formatGpaDisplay(termGpa)}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Term GPA
            </p>
          </div>
          <div className="bg-white px-4 py-5 sm:px-6">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
              {formatPercentageDisplay(termPercent)}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Term average
            </p>
          </div>
        </div>
      </section>

      {isReadOnly && (
        <p className="text-sm text-zinc-500">
          This is a past term. Courses and assignments cannot be edited.
        </p>
      )}

      <section aria-label="Courses">
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900">
          Courses
        </h2>
        {term.courses.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
            No courses in this term
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {term.courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/course/${course.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-zinc-50/80 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{course.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {course.credits} credits
                    </p>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
