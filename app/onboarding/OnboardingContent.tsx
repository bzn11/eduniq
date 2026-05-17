"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { isValidCgpaBaseline } from "@/lib/cgpa-baseline";
import { isValidCourseCredits } from "@/lib/courses";
import {
  getGradeScalePresetOptions,
  STANDARD_40_SCALE,
  type GradeScalePresetId,
} from "@/lib/grading";
import {
  buildImportedTerms,
  type OnboardingImportCourse,
  type OnboardingImportTerm,
} from "@/lib/onboarding-import";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

const scaleOptions = getGradeScalePresetOptions();
const ONBOARDING_STEP_KEY = "eduniq_onboarding_step";

type Step = 1 | 2 | 3 | "cgpa" | "full";

type DraftCourse = {
  id: string;
  name: string;
  credits: string;
  gradePercent: string;
};

type DraftTerm = {
  id: string;
  name: string;
  courses: DraftCourse[];
};

function createDraftCourse(): DraftCourse {
  return {
    id: `draft-course-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    credits: "0.5",
    gradePercent: "",
  };
}

function createDraftTerm(): DraftTerm {
  return {
    id: `draft-term-${Date.now().toString(36)}`,
    name: "",
    courses: [createDraftCourse()],
  };
}

export default function OnboardingContent() {
  const router = useRouter();
  const { user, isLoading: authLoading, isEmailVerified, signOut } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    needsOnboarding,
    upsertProfile,
    completeOnboarding,
    gradeScale,
  } = useProfile();
  const { replaceAcademicState } = useCourses();

  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [gradeScaleId, setGradeScaleId] = useState<GradeScalePresetId>(
    STANDARD_40_SCALE.id,
  );
  const [importCgpa, setImportCgpa] = useState("");
  const [importCredits, setImportCredits] = useState("");
  const [draftTerms, setDraftTerms] = useState<DraftTerm[]>([createDraftTerm()]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasRestoredStep = useRef(false);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!isSupabaseConfigured() || !user) {
      router.replace("/login?next=/onboarding");
      return;
    }

    if (!isEmailVerified) {
      router.replace("/verify-email");
      return;
    }

    if (!needsOnboarding) {
      router.replace("/home");
    }
  }, [
    authLoading,
    profileLoading,
    user,
    isEmailVerified,
    needsOnboarding,
    router,
  ]);

  useEffect(() => {
    if (!profile) return;
    if (profile.first_name) setFirstName(profile.first_name);
    if (profile.school_name) setSchoolName(profile.school_name);
    if (profile.grade_scale) {
      setGradeScaleId(profile.grade_scale as GradeScalePresetId);
    }

    if (!hasRestoredStep.current) {
      hasRestoredStep.current = true;
      try {
        const stored = sessionStorage.getItem(ONBOARDING_STEP_KEY);
        if (stored === "2" || stored === "3" || stored === "cgpa" || stored === "full") {
          setStep(stored === "2" ? 2 : stored === "3" ? 3 : (stored as Step));
          return;
        }
      } catch {
        // Ignore private-mode storage errors.
      }
      if (profile.first_name?.trim()) {
        setStep(2);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!hasRestoredStep.current) return;
    try {
      sessionStorage.setItem(ONBOARDING_STEP_KEY, String(step));
    } catch {
      // Ignore private-mode storage errors.
    }
  }, [step]);

  async function finishOnboardingFlow(
    terms: OnboardingImportTerm[],
    baseline: { cgpa: number; completedCredits: number } | null,
  ) {
    setError(null);
    setIsSaving(true);

    const result = await completeOnboarding({
      firstName,
      schoolName: schoolName.trim() || null,
      gradeScaleId,
    });

    if (!result.ok) {
      setIsSaving(false);
      setError(result.error ?? "Could not complete onboarding.");
      return;
    }

    const imported =
      terms.length > 0
        ? buildImportedTerms(terms, gradeScale)
        : [];
    const replaceOk = await replaceAcademicState(imported, baseline);
    if (!replaceOk) {
      setIsSaving(false);
      setError("Could not save your academic data. Try again.");
      return;
    }

    try {
      sessionStorage.removeItem(ONBOARDING_STEP_KEY);
    } catch {
      // Ignore private-mode storage errors.
    }

    setIsSaving(false);
    router.replace("/home");
    router.refresh();
  }

  async function handleContinueStep1(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = firstName.trim();
    if (!trimmed) {
      setError("First name is required.");
      return;
    }

    setIsSaving(true);
    const result = await upsertProfile({
      first_name: trimmed,
      school_name: schoolName.trim() || null,
    });
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStep(2);
  }

  async function handleContinueStep2() {
    setError(null);
    setIsSaving(true);
    const result = await upsertProfile({ grade_scale: gradeScaleId });
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStep(3);
  }

  async function handleStartFresh() {
    await finishOnboardingFlow([], null);
  }

  async function handleFinishCgpaImport(event: React.FormEvent) {
    event.preventDefault();
    const cgpa = Number(importCgpa);
    const completedCredits = Number(importCredits);
    const baseline = { cgpa, completedCredits };

    if (!isValidCgpaBaseline(baseline)) {
      setError("Enter a valid CGPA (0–4.33) and completed credits greater than 0.");
      return;
    }

    await finishOnboardingFlow([], baseline);
  }

  async function handleFinishFullImport() {
    const imports: OnboardingImportTerm[] = [];

    for (const draft of draftTerms) {
      const termName = draft.name.trim();
      if (!termName) continue;

      const courses: OnboardingImportCourse[] = [];
      for (const course of draft.courses) {
        const name = course.name.trim();
        if (!name) continue;
        const credits = Number(course.credits);
        if (!isValidCourseCredits(credits)) {
          setError(`"${name}" needs valid credits greater than 0.`);
          return;
        }
        const gradeTrimmed = course.gradePercent.trim();
        const gradePercent =
          gradeTrimmed === "" ? null : Number(gradeTrimmed);
        if (
          gradePercent !== null &&
          (Number.isNaN(gradePercent) || gradePercent < 0 || gradePercent > 100)
        ) {
          setError(`"${name}" grade must be between 0 and 100, or left blank.`);
          return;
        }
        courses.push({ name, credits, gradePercent });
      }

      if (courses.length > 0) {
        imports.push({ name: termName, courses });
      }
    }

    if (imports.length === 0) {
      setError("Add at least one term with one course, or choose Start fresh.");
      return;
    }

    await finishOnboardingFlow(imports, null);
  }

  function updateDraftTerm(termId: string, patch: Partial<DraftTerm>) {
    setDraftTerms((prev) =>
      prev.map((term) => (term.id === termId ? { ...term, ...patch } : term)),
    );
  }

  function updateDraftCourse(
    termId: string,
    courseId: string,
    patch: Partial<DraftCourse>,
  ) {
    setDraftTerms((prev) =>
      prev.map((term) =>
        term.id === termId
          ? {
              ...term,
              courses: term.courses.map((course) =>
                course.id === courseId ? { ...course, ...patch } : course,
              ),
            }
          : term,
      ),
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <AuthCard
      title="Welcome to Eduniq"
      subtitle="Set up your transcript the way that matches your academic history."
    >
      <StepIndicator currentStep={step} />

      {error && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {step === 1 && (
        <form onSubmit={handleContinueStep1} className="space-y-5">
          <TextField
            id="firstName"
            label="First name"
            required
            value={firstName}
            onChange={setFirstName}
            placeholder="Alex"
          />
          <TextField
            id="schoolName"
            label="School (optional)"
            value={schoolName}
            onChange={setSchoolName}
            placeholder="University of Toronto"
          />
          <PrimaryButton type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Continue"}
          </PrimaryButton>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <ul className="space-y-2">
            {scaleOptions.map(({ scale, description, example }) => {
              const selected = gradeScaleId === scale.id;
              return (
                <li key={scale.id}>
                  <button
                    type="button"
                    onClick={() => setGradeScaleId(scale.id as GradeScalePresetId)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-900">{scale.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
                    <p className="mt-1 text-xs text-zinc-400">{example}</p>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setStep(1)}>
              Back
            </SecondaryButton>
            <PrimaryButton type="button" onClick={handleContinueStep2} disabled={isSaving}>
              {isSaving ? "Saving…" : "Continue"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600">
            How would you like to set up your academic record?
          </p>
          <ImportOption
            title="Import CGPA only"
            description="Enter your current cumulative GPA and completed credits. No courses or terms are created."
            onClick={() => setStep("cgpa")}
          />
          <ImportOption
            title="Import full academic history"
            description="Add past terms with courses and optional grades."
            onClick={() => setStep("full")}
          />
          <ImportOption
            title="Start fresh"
            description="Begin with an empty dashboard. Add terms when you are ready."
            onClick={handleStartFresh}
            disabled={isSaving}
          />
          <SecondaryButton type="button" onClick={() => setStep(2)} disabled={isSaving}>
            Back
          </SecondaryButton>
        </div>
      )}

      {step === "cgpa" && (
        <form onSubmit={handleFinishCgpaImport} className="space-y-5">
          <p className="text-sm text-zinc-600">
            This baseline counts toward cumulative GPA without creating placeholder
            courses.
          </p>
          <TextField
            id="importCgpa"
            label="Current CGPA"
            value={importCgpa}
            onChange={setImportCgpa}
            placeholder="3.7"
            required
          />
          <TextField
            id="importCredits"
            label="Total credits completed"
            value={importCredits}
            onChange={setImportCredits}
            placeholder="20"
            required
          />
          <PrimaryButton type="submit" disabled={isSaving}>
            {isSaving ? "Finishing…" : "Finish setup"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => setStep(3)} disabled={isSaving}>
            Back
          </SecondaryButton>
        </form>
      )}

      {step === "full" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            Add each term and its courses. Grades are optional percentages (0–100).
          </p>
          {draftTerms.map((term, termIndex) => (
            <div
              key={term.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 space-y-3"
            >
              <TextField
                id={`term-${term.id}`}
                label={`Term ${termIndex + 1} name`}
                value={term.name}
                onChange={(value) => updateDraftTerm(term.id, { name: value })}
                placeholder="Fall 2024"
                required
              />
              {term.courses.map((course, courseIndex) => (
                <div
                  key={course.id}
                  className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-3"
                >
                  <TextField
                    id={`course-name-${course.id}`}
                    label={`Course ${courseIndex + 1}`}
                    value={course.name}
                    onChange={(value) =>
                      updateDraftCourse(term.id, course.id, { name: value })
                    }
                    placeholder="Calculus I"
                  />
                  <TextField
                    id={`course-credits-${course.id}`}
                    label="Credits"
                    value={course.credits}
                    onChange={(value) =>
                      updateDraftCourse(term.id, course.id, { credits: value })
                    }
                    placeholder="0.5"
                  />
                  <TextField
                    id={`course-grade-${course.id}`}
                    label="Grade % (optional)"
                    value={course.gradePercent}
                    onChange={(value) =>
                      updateDraftCourse(term.id, course.id, { gradePercent: value })
                    }
                    placeholder="85"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateDraftTerm(term.id, {
                    courses: [...term.courses, createDraftCourse()],
                  })
                }
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                + Add course to this term
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraftTerms((prev) => [...prev, createDraftTerm()])}
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            + Add another term
          </button>
          <PrimaryButton type="button" onClick={handleFinishFullImport} disabled={isSaving}>
            {isSaving ? "Finishing…" : "Finish import"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => setStep(3)} disabled={isSaving}>
            Back
          </SecondaryButton>
        </div>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-6 w-full px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900"
      >
        Sign out
      </button>
    </AuthCard>
  );
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const labels =
    currentStep === "cgpa" || currentStep === "full"
      ? ["Profile", "Scale", "Import", "Details"]
      : ["Profile", "Scale", "Import"];

  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {labels.map((label, index) => {
        const order =
          currentStep === 1
            ? 1
            : currentStep === 2
              ? 2
              : currentStep === 3
                ? 3
                : 4;
        const stepNumber = index + 1;
        const isActive = order === stepNumber;
        const isComplete = order > stepNumber;
        return (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={`h-2 w-2 rounded-full ${
                isActive || isComplete ? "bg-zinc-900" : "bg-zinc-200"
              }`}
            />
            <span
              className={`text-[10px] font-medium uppercase tracking-wide ${
                isActive ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ImportOption({
  title,
  description,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50/80 disabled:opacity-60"
    >
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
    </button>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-zinc-500">
        {label}
      </label>
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  type,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  type,
  onClick,
  disabled,
}: {
  children: ReactNode;
  type?: "button";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
