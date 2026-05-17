"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { useAuth } from "@/context/AuthContext";
import { fetchUserProfile, getPostAuthPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyEmailContent() {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleResend() {
    if (!user?.email || !isSupabaseConfigured()) return;

    setIsResending(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setMessage("Verification email sent. Check your inbox.");
    }
    setIsResending(false);
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    setError(null);
    await refreshUser();

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();

    if (data.user?.email_confirmed_at) {
      const profile = await fetchUserProfile(supabase, data.user.id);
      router.replace(getPostAuthPath(profile));
      router.refresh();
    } else {
      setMessage("Email not verified yet. Check your inbox and try again.");
    }
    setIsRefreshing(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <AuthCard
      title="Verify your email"
      subtitle={
        user?.email
          ? `We sent a verification link to ${user.email}.`
          : "A verified email is required to use Eduniq."
      }
    >
      <p className="text-sm text-zinc-600">
        Please verify your email before accessing your dashboard. Check your spam
        folder if you do not see the message.
      </p>

      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || !user?.email}
          className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isResending ? "Sending…" : "Resend verification email"}
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {isRefreshing ? "Checking…" : "Refresh status"}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          Sign out
        </button>
      </div>
    </AuthCard>
  );
}
