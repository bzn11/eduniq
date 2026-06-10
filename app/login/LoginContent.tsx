"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { getPostAuthPath, fetchUserProfile } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth: "Sign-in failed. Please try again.",
  config: "Authentication is not configured. Contact support if this persists.",
  expired: "Your sign-in link has expired. Please sign in again or request a new link.",
};

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const authError = searchParams.get("error");
  const passwordReset = searchParams.get("reset") === "success";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add environment variables to enable sign-in.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
      router.replace("/verify-email");
      return;
    }

    const profile = await fetchUserProfile(supabase, data.user!.id);
    const destination = getPostAuthPath(profile, searchParams.get("next"));
    router.replace(destination);
    router.refresh();
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Track your GPA across every term."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
            Get started
          </Link>
        </>
      }
    >
      {passwordReset && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Your password was updated. Sign in with your new password.
        </p>
      )}

      {authError && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {AUTH_ERROR_MESSAGES[authError] ?? AUTH_ERROR_MESSAGES.auth}
        </p>
      )}

      <GoogleAuthButton />

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-400">or</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-xs font-medium text-zinc-500">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassName}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium text-zinc-500">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClassName}
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
