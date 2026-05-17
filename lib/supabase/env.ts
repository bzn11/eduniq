const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

let warnedMissingEnv = false;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseEnv():
  | { url: string; anonKey: string }
  | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (!warnedMissingEnv && typeof window === "undefined") {
      warnedMissingEnv = true;
      console.warn(
        `[eduniq] Missing ${URL_KEY} or ${ANON_KEY}. Supabase auth is disabled; academic data still uses localStorage.`,
      );
    }
    return null;
  }

  return { url, anonKey };
}

export function warnMissingSupabaseClientEnv(): void {
  if (isSupabaseConfigured()) return;
  if (warnedMissingEnv) return;
  warnedMissingEnv = true;
  console.warn(
    `[eduniq] Missing ${URL_KEY} or ${ANON_KEY}. Auth features are unavailable.`,
  );
}
