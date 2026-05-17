import type { GradeScalePresetId } from "@/lib/grading";
import { getDefaultScale, getGradeScaleById, STANDARD_40_SCALE } from "@/lib/grading";
import type { GradeScale } from "@/lib/grading";

export type UserProfile = {
  id: string;
  first_name: string | null;
  school_name: string | null;
  grade_scale: string;
  onboarding_completed: boolean;
  created_at: string;
};

export type ProfileUpsert = {
  first_name?: string | null;
  school_name?: string | null;
  grade_scale?: GradeScalePresetId | string;
  onboarding_completed?: boolean;
};

export function profileToGradeScale(profile: UserProfile | null): GradeScale {
  if (!profile) return getDefaultScale();
  return getGradeScaleById(profile.grade_scale);
}

export function defaultProfileFields(userId: string): ProfileUpsert & { id: string } {
  return {
    id: userId,
    first_name: null,
    school_name: null,
    grade_scale: STANDARD_40_SCALE.id,
    onboarding_completed: false,
  };
}

export function needsOnboarding(profile: UserProfile | null | undefined): boolean {
  if (!profile) return true;
  return !profile.onboarding_completed;
}
