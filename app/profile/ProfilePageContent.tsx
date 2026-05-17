"use client";

import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import {
  getGradeScalePresetOptions,
  type GradeScalePresetId,
} from "@/lib/grading";
import { useMemo, useState } from "react";

const scaleOptions = getGradeScalePresetOptions();

export default function ProfilePageContent() {
  const { user } = useAuth();
  const { profile, gradeScale, updateGradeScale, isLoading } = useProfile();
  const [isEditingScale, setIsEditingScale] = useState(false);
  const [selectedScaleId, setSelectedScaleId] = useState<GradeScalePresetId>(
    gradeScale.id as GradeScalePresetId,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayName = profile?.first_name?.trim() || "—";
  const school = profile?.school_name?.trim() || "—";
  const email = user?.email ?? "—";

  const currentScaleMeta = useMemo(
    () => scaleOptions.find((option) => option.scale.id === gradeScale.id),
    [gradeScale.id],
  );

  async function handleSaveScale() {
    setError(null);
    setIsSaving(true);
    const result = await updateGradeScale(selectedScaleId);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? "Could not update grading scale.");
      return;
    }

    setIsEditingScale(false);
  }

  function handleStartEditScale() {
    setSelectedScaleId(gradeScale.id as GradeScalePresetId);
    setError(null);
    setIsEditingScale(true);
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading profile…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your account details and grading preferences.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-zinc-900">Account</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-zinc-500">First name</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{displayName}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">School</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{school}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-900">Grading scale</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {currentScaleMeta?.scale.name ?? gradeScale.name}
            </p>
            {currentScaleMeta && (
              <p className="mt-0.5 text-xs text-zinc-400">
                {currentScaleMeta.example}
              </p>
            )}
          </div>
          {!isEditingScale && (
            <button
              type="button"
              onClick={handleStartEditScale}
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Edit grading scale
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {isEditingScale && (
          <div className="mt-4 space-y-3">
            <ul className="space-y-2">
              {scaleOptions.map(({ scale, description, example }) => {
                const selected = selectedScaleId === scale.id;
                return (
                  <li key={scale.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedScaleId(scale.id as GradeScalePresetId)
                      }
                      className={`w-full rounded-lg border px-4 py-3 text-left ${
                        selected
                          ? "border-zinc-900 bg-zinc-50"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <p className="text-sm font-medium text-zinc-900">
                        {scale.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
                      <p className="mt-1 text-xs text-zinc-400">{example}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingScale(false)}
                disabled={isSaving}
                className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScale}
                disabled={isSaving}
                className="flex-1 rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
