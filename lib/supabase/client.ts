"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, warnMissingSupabaseClientEnv } from "@/lib/supabase/env";

export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    warnMissingSupabaseClientEnv();
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key",
    );
  }

  return createBrowserClient(env.url, env.anonKey);
}
