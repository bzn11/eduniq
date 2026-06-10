"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { useAuth } from "@/context/AuthContext";
import { fetchUserProfile, getPostAuthPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser, signOut } = useAuth();
  const emailFromQuery = searchParams.get("email");
  const linkError = searchParams.get("error");
  const resendEmail = user?.email ?? emailFromQuery;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleResend() {
    if (!resendEmail || !isSupabaseConfigured()) return;

    setIsResending(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail,
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setMessage("Verification email sent. Check your inbox and spam folder.");
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

  if (linkError === "expired") {
    return (
      <AuthCard
        title="Verification link expired"
        subtitle="This link is no longer valid."
        footer={
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-zinc-600">
          Email verification links expire after a short time for security. Sign in
          to request a new verification email, or create an account if you
          haven&apos;t yet.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/login"
            className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Create account
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (linkError === "invalid") {
    return (
      <AuthCard
        title="Verification link invalid"
        subtitle="We could not verify your email with this link."
        footer={
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-zinc-600">
          The verification link may have already been used or is malformed. Sign in
          to request a new verification email.
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
      title="Verify your email"
      subtitle={
        resendEmail
          ? `We sent a verification link to ${resendEmail}.`
          : "A verified email is required to use Eduniq."
      }
      footer={
        !user ? (
          <>
            Already verified?{" "}
            <Link href="/login" className="font-medium text-zinc-900 hover:underline">
              Sign in
            </Link>
          </>
        ) : undefined
      }
    >
      <p className="text-sm text-zinc-600">
        Please verify your email before accessing your dashboard. Open the link in
        the email we sent, then return here and refresh your status.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Check your spam folder if you don&apos;t see the message within a few
        minutes.
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
          disabled={isResending || !resendEmail}
          className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isResending ? "Sending…" : "Resend verification email"}
        </button>
        {user && (
          <>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
            >
              {isRefreshing ? "Checking…" : "I've verified — refresh status"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900"
            >
              Sign out
            </button>
          </>
        )}
        {!user && resendEmail && (
          <p className="pt-2 text-center text-xs text-zinc-500">
            After verifying,{" "}
            <Link href="/login" className="font-medium text-zinc-900 hover:underline">
              sign in
            </Link>{" "}
            to continue.
          </p>
        )}
      </div>
    </AuthCard>
  );
}
