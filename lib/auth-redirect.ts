import { needsOnboarding, type UserProfile } from "@/lib/profile";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserProfile;
}

export function getPostAuthPath(
  profile: UserProfile | null,
  next?: string | null,
): string {
  if (needsOnboarding(profile)) {
    return "/onboarding";
  }
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    next !== "/onboarding"
  ) {
    return next;
  }
  return "/home";
}
