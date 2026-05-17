"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useCourses } from "@/context/CourseContext";
import {
  formatAssignmentScore,
  formatCoursePercent,
  formatCourseTargetLabel,
  getStatusColorClass,
  hasCourseTarget,
  parseAssignmentInput,
  type Assignment,
  type AssignmentFieldErrors,
} from "@/lib/courses";
import {
  getGpaTargetOptions,
  parseGpaTargetOptionId,
} from "@/lib/grading";

function formatPercent(value: number) {
  if (value === 0) return "—";
  return `${value.toFixed(1)}%`;
}

const gpaTargetOptions = getGpaTargetOptions();
const NO_TARGET_OPTION = "none";

function getTargetOptionId(
  targetGpa: number | null,
  targetLetter: string | null,
): string {
  if (targetGpa === null || !targetLetter) {
    return NO_TARGET_OPTION;
  }
  const match = gpaTargetOptions.find(
    (option) => option.gpa === targetGpa && option.letter === targetLetter,
  );
  return match?.id ?? NO_TARGET_OPTION;
}

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

const actionButtonClassName =
  "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50";

type AssignmentFormProps = {
  name: string;
  weight: string;
  earned: string;
  total: string;
  errors: AssignmentFieldErrors;
  submitLabel: string;
  onNameChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onEarnedChange: (value: string) => void;
  onTotalChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-600">{message}</p>;
}

function AssignmentForm({
  name,
  weight,
  earned,
  total,
  errors,
  submitLabel,
  onNameChange,
  onWeightChange,
  onEarnedChange,
  onTotalChange,
  onSubmit,
  onCancel,
}: AssignmentFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-medium text-zinc-500">Assignment name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            required
            className={inputClassName}
          />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500">Weight %</label>
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={weight}
            onChange={(event) => onWeightChange(event.target.value)}
            required
            className={inputClassName}
          />
          <FieldError message={errors.weight} />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500">Earned points</label>
          <input
            type="number"
            min={0}
            step="any"
            value={earned}
            onChange={(event) => onEarnedChange(event.target.value)}
            className={inputClassName}
            placeholder="e.g. 37"
          />
          <FieldError message={errors.earned} />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500">Total points</label>
          <input
            type="number"
            min={0}
            step="any"
            value={total}
            onChange={(event) => onTotalChange(event.target.value)}
            className={inputClassName}
            placeholder="e.g. 52"
          />
          <FieldError message={errors.total} />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function assignmentToFormValues(assignment: Assignment) {
  return {
    name: assignment.name,
    weight: String(assignment.weight),
    earned:
      assignment.earnedPoints !== undefined ? String(assignment.earnedPoints) : "",
    total:
      assignment.totalPoints !== undefined ? String(assignment.totalPoints) : "",
  };
}

const emptyErrors: AssignmentFieldErrors = {};

export default function CourseDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const {
    getCourseById,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    updateCourse,
    deleteCourse,
  } = useCourses();
  const course = getCourseById(id);

  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [assignmentName, setAssignmentName] = useState("");
  const [assignmentWeight, setAssignmentWeight] = useState("");
  const [assignmentEarned, setAssignmentEarned] = useState("");
  const [assignmentTotal, setAssignmentTotal] = useState("");
  const [addErrors, setAddErrors] = useState<AssignmentFieldErrors>(emptyErrors);

  const [editingTarget, setEditingTarget] = useState(false);
  const [targetOptionId, setTargetOptionId] = useState("");

  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(
    null,
  );
  const [editAssignmentName, setEditAssignmentName] = useState("");
  const [editAssignmentWeight, setEditAssignmentWeight] = useState("");
  const [editAssignmentEarned, setEditAssignmentEarned] = useState("");
  const [editAssignmentTotal, setEditAssignmentTotal] = useState("");
  const [editErrors, setEditErrors] = useState<AssignmentFieldErrors>(emptyErrors);

  if (!course) {
    return <p className="text-sm text-zinc-600">Course not found</p>;
  }

  const activeCourse = course;
  const courseId = activeCourse.id;

  function resetAddAssignmentForm() {
    setAssignmentName("");
    setAssignmentWeight("");
    setAssignmentEarned("");
    setAssignmentTotal("");
    setAddErrors(emptyErrors);
    setShowAddAssignment(false);
  }

  function resetEditAssignmentForm() {
    setEditingAssignmentId(null);
    setEditAssignmentName("");
    setEditAssignmentWeight("");
    setEditAssignmentEarned("");
    setEditAssignmentTotal("");
    setEditErrors(emptyErrors);
  }

  function startEditAssignment(assignment: Assignment) {
    setShowAddAssignment(false);
    setEditingAssignmentId(assignment.id);
    const values = assignmentToFormValues(assignment);
    setEditAssignmentName(values.name);
    setEditAssignmentWeight(values.weight);
    setEditAssignmentEarned(values.earned);
    setEditAssignmentTotal(values.total);
    setEditErrors(emptyErrors);
  }

  function handleAddAssignment(event: React.FormEvent) {
    event.preventDefault();
    const result = parseAssignmentInput(
      assignmentName,
      assignmentWeight,
      assignmentEarned,
      assignmentTotal,
    );

    if (!result.ok) {
      setAddErrors(result.errors);
      return;
    }

    addAssignment(courseId, result.value);
    resetAddAssignmentForm();
  }

  function handleUpdateAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!editingAssignmentId) return;

    const result = parseAssignmentInput(
      editAssignmentName,
      editAssignmentWeight,
      editAssignmentEarned,
      editAssignmentTotal,
    );

    if (!result.ok) {
      setEditErrors(result.errors);
      return;
    }

    updateAssignment(courseId, editingAssignmentId, result.value);
    resetEditAssignmentForm();
  }

  function handleDeleteAssignment(assignment: Assignment) {
    const confirmed = window.confirm(
      `Delete "${assignment.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    deleteAssignment(courseId, assignment.id);
    if (editingAssignmentId === assignment.id) {
      resetEditAssignmentForm();
    }
  }

  function handleSaveTarget(event: React.FormEvent) {
    event.preventDefault();
    if (targetOptionId === NO_TARGET_OPTION) {
      updateCourse(courseId, { clearTarget: true });
    } else {
      const target = parseGpaTargetOptionId(targetOptionId);
      if (!target) return;
      updateCourse(courseId, {
        targetGpa: target.gpa,
        targetLetter: target.letter,
      });
    }
    setEditingTarget(false);
  }

  function handleStartEditTarget() {
    setTargetOptionId(
      getTargetOptionId(activeCourse.targetGpa, activeCourse.targetLetter),
    );
    setEditingTarget(true);
  }

  function handleDeleteCourse() {
    const confirmed = window.confirm(
      `Delete "${activeCourse.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    deleteCourse(courseId);
    router.push("/home");
  }

  const targetDisplay = formatCourseTargetLabel(activeCourse);
  const courseHasTarget = hasCourseTarget(activeCourse);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            {activeCourse.name}
          </h1>
        </div>
        <div className="flex items-baseline gap-3 sm:text-right">
          <p className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
            {formatCoursePercent(course.currentGrade)}
          </p>
          {course.gradeLabel && (
            <p className="text-lg font-semibold text-zinc-600">{course.gradeLabel}</p>
          )}
        </div>
      </header>

      <section
        aria-label="Prediction summary"
        className="rounded-xl border border-zinc-200 bg-white px-4 py-5 sm:px-6"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Prediction summary
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500">Current grade</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {formatPercent(course.currentGrade)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Target</p>
            {editingTarget ? (
              <form onSubmit={handleSaveTarget} className="mt-1 space-y-2">
                <select
                  value={targetOptionId}
                  onChange={(event) => setTargetOptionId(event.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value={NO_TARGET_OPTION}>No target</option>
                  {gpaTargetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="text-xs font-medium text-zinc-900 hover:underline"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTarget(false)}
                    className="text-xs font-medium text-zinc-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">
                  {targetDisplay}
                </p>
                <button
                  type="button"
                  onClick={handleStartEditTarget}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-zinc-500">Projected final grade</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {courseHasTarget
                ? formatPercent(course.projectedFinalGrade)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Status</p>
            <p
              className={`mt-1 text-lg font-semibold ${getStatusColorClass(course.status)}`}
            >
              {course.status ?? "—"}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Course insight"
        className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-5 sm:px-6"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Course insight
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-700">
          <p>
            <span className="text-zinc-500">Graded:</span>{" "}
            <span className="font-medium text-zinc-900">
              {course.insight.gradedPercent}%
            </span>
          </p>
          <p>
            <span className="text-zinc-500">Remaining:</span>{" "}
            <span className="font-medium text-zinc-900">
              {course.insight.remainingPercent}%
            </span>
          </p>
        </div>
        {courseHasTarget && course.insight.needOnRemaining !== "—" && (
          <p className="mt-3 text-sm font-medium text-zinc-800">
            {course.insight.needOnRemaining}
          </p>
        )}
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          {course.insight.summary}
        </p>
      </section>

      <section aria-label="Assignments">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Assignments
          </h2>
          <button
            type="button"
            onClick={() => {
              resetEditAssignmentForm();
              setShowAddAssignment((open) => !open);
            }}
            className={actionButtonClassName}
          >
            + Add Assignment
          </button>
        </div>

        {showAddAssignment && (
          <div className="mb-3">
            <AssignmentForm
              name={assignmentName}
              weight={assignmentWeight}
              earned={assignmentEarned}
              total={assignmentTotal}
              errors={addErrors}
              submitLabel="Add assignment"
              onNameChange={setAssignmentName}
              onWeightChange={setAssignmentWeight}
              onEarnedChange={setAssignmentEarned}
              onTotalChange={setAssignmentTotal}
              onSubmit={handleAddAssignment}
              onCancel={resetAddAssignmentForm}
            />
          </div>
        )}

        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {course.assignments.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500 sm:px-5">
              No assignments yet
            </li>
          ) : (
            course.assignments.map((assignment) =>
              editingAssignmentId === assignment.id ? (
                <li key={assignment.id} className="px-4 py-4 sm:px-5">
                  <AssignmentForm
                    name={editAssignmentName}
                    weight={editAssignmentWeight}
                    earned={editAssignmentEarned}
                    total={editAssignmentTotal}
                    errors={editErrors}
                    submitLabel="Save changes"
                    onNameChange={setEditAssignmentName}
                    onWeightChange={setEditAssignmentWeight}
                    onEarnedChange={setEditAssignmentEarned}
                    onTotalChange={setEditAssignmentTotal}
                    onSubmit={handleUpdateAssignment}
                    onCancel={resetEditAssignmentForm}
                  />
                </li>
              ) : (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{assignment.name}</p>
                    <p className="text-xs text-zinc-500">{assignment.weight}% weight</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="tabular-nums text-sm font-medium text-zinc-700">
                      {formatAssignmentScore(assignment)}
                    </p>
                    <button
                      type="button"
                      onClick={() => startEditAssignment(assignment)}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(assignment)}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ),
            )
          )}
        </ul>
      </section>

      <section aria-label="Course actions" className="flex justify-end">
        <button
          type="button"
          onClick={handleDeleteCourse}
          className="text-sm font-medium text-rose-600 hover:text-rose-700"
        >
          Delete course
        </button>
      </section>

      <section
        aria-label="What-if mode"
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-5 sm:px-6"
      >
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Simulate your final grade
        </h2>
        <p className="mt-1 text-sm text-zinc-500">What-if mode</p>
        <button
          type="button"
          disabled
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 opacity-70"
          aria-disabled="true"
        >
          Open simulation
        </button>
      </section>
    </div>
  );
}
