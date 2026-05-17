"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useState } from "react";

type GoogleAuthButtonProps = {
  label?: string;
};

export function GoogleAuthButton({
  label = "Continue with Google",
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add environment variables to enable sign-in.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setError(oauthError.message);
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="flex w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      >
        {isLoading ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
