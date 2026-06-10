"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import { useState } from "react";

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

export default function ForgotPasswordContent() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add environment variables to enable password reset.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );

    if (resetError) {
      setError(resetError.message);
      setIsLoading(false);
      return;
    }

    setIsComplete(true);
    setIsLoading(false);
  }

  if (isComplete) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If an account exists, we sent password reset instructions."
        footer={
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-zinc-600">
          If an account is registered for{" "}
          <span className="font-medium text-zinc-900">{email.trim()}</span>, you
          will receive an email with a link to reset your password. The link
          expires after a short time for security.
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          Check your spam folder if you don&apos;t see the message within a few
          minutes.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Back to sign in
        </Link>
      }
    >
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
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isLoading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthCard>
  );
}
