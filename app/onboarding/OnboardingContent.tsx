"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { isValidCourseCredits } from "@/lib/courses";
import {
  getGradeScalePresetOptions,
  STANDARD_40_SCALE,
  type GradeScalePresetId,
} from "@/lib/grading";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

const scaleOptions = getGradeScalePresetOptions();
const STEP_LABELS = ["Profile", "Grading scale", "First course"] as const;
const ONBOARDING_STEP_KEY = "eduniq_onboarding_step";

type Step = 1 | 2 | 3;

export default function OnboardingContent() {
  const router = useRouter();
  const { user, isLoading: authLoading, isEmailVerified, signOut } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    needsOnboarding,
    upsertProfile,
    completeOnboarding,
  } = useProfile();
  const { addCourse } = useCourses();

  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [gradeScaleId, setGradeScaleId] = useState<GradeScalePresetId>(
    STANDARD_40_SCALE.id,
  );
  const [courseName, setCourseName] = useState("");
  const [credits, setCredits] = useState("0.5");
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
        if (stored === "2" || stored === "3") {
          setStep(Number(stored) as Step);
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

  async function finishOnboarding(addFirstCourse: boolean) {
    setError(null);

    if (addFirstCourse) {
      const trimmedCourse = courseName.trim();
      const courseCredits = Number(credits);
      if (!trimmedCourse) {
        setError("Course name is required, or skip this step.");
        return;
      }
      if (!isValidCourseCredits(courseCredits)) {
        setError("Enter valid credits greater than 0.");
        return;
      }
    }

    setIsSaving(true);
    const result = await completeOnboarding({
      firstName,
      schoolName: schoolName.trim() || null,
      gradeScaleId,
    });
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error ?? "Could not complete onboarding.");
      return;
    }

    if (addFirstCourse) {
      addCourse(courseName.trim(), Number(credits), null);
    }

    try {
      sessionStorage.removeItem(ONBOARDING_STEP_KEY);
    } catch {
      // Ignore private-mode storage errors.
    }

    router.replace("/home");
    router.refresh();
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
      subtitle="A quick setup so your GPA tracking matches how you work."
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
        <CourseStep
          courseName={courseName}
          credits={credits}
          onCourseNameChange={setCourseName}
          onCreditsChange={setCredits}
          onBack={() => setStep(2)}
          onFinish={() => finishOnboarding(true)}
          onSkip={() => finishOnboarding(false)}
          isSaving={isSaving}
        />
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
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEP_LABELS.map((label, index) => {
        const stepNumber = (index + 1) as Step;
        const isActive = currentStep === stepNumber;
        const isComplete = currentStep > stepNumber;
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

function CourseStep({
  courseName,
  credits,
  onCourseNameChange,
  onCreditsChange,
  onBack,
  onFinish,
  onSkip,
  isSaving,
}: {
  courseName: string;
  credits: string;
  onCourseNameChange: (value: string) => void;
  onCreditsChange: (value: string) => void;
  onBack: () => void;
  onFinish: () => void;
  onSkip: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-600">
        Optionally add your first course now, or skip and add courses from home.
      </p>
      <TextField
        id="courseName"
        label="Course name"
        value={courseName}
        onChange={onCourseNameChange}
        placeholder="Introduction to Biology"
      />
      <TextField
        id="credits"
        label="Credits"
        value={credits}
        onChange={onCreditsChange}
        placeholder="0.5"
      />
      <div className="flex flex-col gap-2">
        <PrimaryButton type="button" onClick={onFinish} disabled={isSaving}>
          {isSaving ? "Finishing…" : "Finish"}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onSkip} disabled={isSaving}>
          {isSaving ? "Saving…" : "Skip"}
        </SecondaryButton>
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          className="w-full px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-60"
        >
          Back
        </button>
      </div>
    </div>
  );
}
