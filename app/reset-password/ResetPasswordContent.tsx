"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { useAuth } from "@/context/AuthContext";
import { isPasswordValid } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

export default function ResetPasswordContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (!isPasswordValid(password)) {
      setError("Please meet all password requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setIsComplete(true);
    setIsLoading(false);
    router.refresh();
  }

  if (authLoading) {
    return (
      <AuthCard title="Reset your password" subtitle="Loading…">
        <p className="text-sm text-zinc-500">Verifying your reset link…</p>
      </AuthCard>
    );
  }

  if (!user) {
    return (
      <AuthCard
        title="Reset link invalid or expired"
        subtitle="This password reset link is no longer valid."
        footer={
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-zinc-600">
          Password reset links expire after a short time and can only be used once.
          Request a new link to reset your password.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 block w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
        >
          Request new reset link
        </Link>
      </AuthCard>
    );
  }

  if (isComplete) {
    return (
      <AuthCard
        title="Password updated"
        subtitle="Your password has been changed successfully."
        footer={
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Sign in with your new password
          </Link>
        }
      >
        <p className="text-sm text-zinc-600">
          You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="mt-6 block w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
        >
          Sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Enter a strong password for your account."
      footer={
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="text-xs font-medium text-zinc-500">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClassName}
          />
          <PasswordRequirements password={password} />
        </div>
        <div>
          <label
            htmlFor="confirm-password"
            className="text-xs font-medium text-zinc-500"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={inputClassName}
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isLoading || !isPasswordValid(password)}
          className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isLoading ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}
