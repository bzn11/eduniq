"use client";

import { useAuth } from "@/context/AuthContext";
import { fetchUserProfile } from "@/lib/auth-redirect";
import { needsOnboarding, type ProfileUpsert, type UserProfile } from "@/lib/profile";
import {
  getDefaultScale,
  getGradeScaleById,
  type GradeScale,
  type GradeScalePresetId,
} from "@/lib/grading";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ProfileContextValue = {
  profile: UserProfile | null;
  gradeScale: GradeScale;
  isLoading: boolean;
  isConfigured: boolean;
  needsOnboarding: boolean;
  error: string | null;
  refreshProfile: () => Promise<UserProfile | null>;
  upsertProfile: (updates: ProfileUpsert) => Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }>;
  updateGradeScale: (scaleId: GradeScalePresetId) => Promise<{ ok: boolean; error?: string }>;
  completeOnboarding: (data: {
    firstName: string;
    schoolName?: string | null;
    gradeScaleId: GradeScalePresetId;
  }) => Promise<{ ok: boolean; error?: string }>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading, isConfigured, isEmailVerified } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!isConfigured || !user?.id || !isEmailVerified) {
      setProfile(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const nextProfile = await fetchUserProfile(supabase, user.id);
    setProfile(nextProfile);
    setIsLoading(false);
    return nextProfile;
  }, [isConfigured, user?.id, isEmailVerified]);

  useEffect(() => {
    if (authLoading) return;

    if (!isConfigured || !user?.id || !isEmailVerified) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    void refreshProfile();
  }, [authLoading, isConfigured, user?.id, isEmailVerified, refreshProfile]);

  const upsertProfile = useCallback(
    async (updates: ProfileUpsert) => {
      if (!isConfigured || !user?.id) {
        return { ok: false as const, error: "Sign in to save your profile." };
      }

      setError(null);
      const supabase = createClient();
      const payload = {
        id: user.id,
        ...updates,
      };

      const { data, error: upsertError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();

      if (upsertError || !data) {
        const message = upsertError?.message ?? "Could not save profile.";
        setError(message);
        return { ok: false as const, error: message };
      }

      const saved = data as UserProfile;
      setProfile(saved);
      return { ok: true as const, profile: saved };
    },
    [isConfigured, user?.id],
  );

  const updateGradeScale = useCallback(
    async (scaleId: GradeScalePresetId) => {
      return upsertProfile({ grade_scale: scaleId }).then((result) =>
        result.ok ? { ok: true } : { ok: false, error: result.error },
      );
    },
    [upsertProfile],
  );

  const completeOnboarding = useCallback(
    async (data: {
      firstName: string;
      schoolName?: string | null;
      gradeScaleId: GradeScalePresetId;
    }) => {
      const trimmedName = data.firstName.trim();
      if (!trimmedName) {
        return { ok: false, error: "First name is required." };
      }

      return upsertProfile({
        first_name: trimmedName,
        school_name: data.schoolName?.trim() || null,
        grade_scale: data.gradeScaleId,
        onboarding_completed: true,
      }).then((result) =>
        result.ok ? { ok: true } : { ok: false, error: result.error },
      );
    },
    [upsertProfile],
  );

  const gradeScale = useMemo(
    () => (isConfigured && profile ? getGradeScaleById(profile.grade_scale) : getDefaultScale()),
    [isConfigured, profile],
  );

  const value = useMemo(
    () => ({
      profile,
      gradeScale,
      isLoading: isConfigured ? authLoading || isLoading : false,
      isConfigured,
      needsOnboarding: isConfigured ? needsOnboarding(profile) : false,
      error,
      refreshProfile,
      upsertProfile,
      updateGradeScale,
      completeOnboarding,
    }),
    [
      profile,
      gradeScale,
      isConfigured,
      authLoading,
      isLoading,
      error,
      refreshProfile,
      upsertProfile,
      updateGradeScale,
      completeOnboarding,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
