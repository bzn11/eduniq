"use client";

import {
  type PriorAcademicHistoryInput,
  isValidPriorAcademicHistory,
} from "@/lib/academic-hub";
import { useState } from "react";

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

type PriorAcademicHistoryFormProps = {
  initialCgpa?: string;
  initialCredits?: string;
  onSave: (input: PriorAcademicHistoryInput) => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  submitLabel?: string;
  showClear?: boolean;
  isSaving?: boolean;
};

export function PriorAcademicHistoryForm({
  initialCgpa = "",
  initialCredits = "",
  onSave,
  onClear,
  submitLabel = "Save prior history",
  showClear = false,
  isSaving = false,
}: PriorAcademicHistoryFormProps) {
  const [cgpa, setCgpa] = useState(initialCgpa);
  const [credits, setCredits] = useState(initialCredits);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const input = {
      cgpa: Number(cgpa),
      completedCredits: Number(credits),
    };

    if (!isValidPriorAcademicHistory(input)) {
      setError("Enter a valid CGPA (0–4.33) and completed credits greater than 0.");
      return;
    }

    await onSave(input);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="prior-cgpa" className="text-xs font-medium text-zinc-500">
          Cumulative GPA (CGPA)
        </label>
        <input
          id="prior-cgpa"
          type="number"
          step="0.01"
          min="0"
          max="4.33"
          required
          value={cgpa}
          onChange={(event) => setCgpa(event.target.value)}
          placeholder="3.7"
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="prior-credits" className="text-xs font-medium text-zinc-500">
          Total credits completed
        </label>
        <input
          id="prior-credits"
          type="number"
          step="0.5"
          min="0.5"
          required
          value={credits}
          onChange={(event) => setCredits(event.target.value)}
          placeholder="20"
          className={inputClassName}
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isSaving ? "Saving…" : submitLabel}
        </button>
        {showClear && onClear && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onClear()}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
    </form>
  );
}
