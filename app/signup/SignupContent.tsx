"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { isPasswordValid } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClassName =
  "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400";

type SignupState = "form" | "verify" | "existing";

export default function SignupContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signupState, setSignupState] = useState<SignupState>("form");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add environment variables to enable sign-up.");
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
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    const isExistingAccount =
      data.user !== null &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0;

    if (isExistingAccount) {
      setSignupState("existing");
      setIsLoading(false);
      return;
    }

    if (data.session) {
      router.replace(`/verify-email?email=${encodeURIComponent(email.trim())}`);
      return;
    }

    setSignupState("verify");
    setIsLoading(false);
  }

  if (signupState === "existing") {
    return (
      <AuthCard
        title="Account may already exist"
        subtitle="We could not create a new account with this email."
        footer={
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-zinc-600">
          An account with this email may already be registered. Try signing in, or
          reset your password if you no longer remember it.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/login"
            className="w-full rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <Link
            href="/forgot-password"
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Forgot password
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (signupState === "verify") {
    return (
      <AuthCard
        title="Check your email"
        subtitle="We sent a verification link to complete your account."
        footer={
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-zinc-600">
          We sent a verification link to{" "}
          <span className="font-medium text-zinc-900">{email.trim()}</span>. Open
          the link to verify your account, then sign in to start tracking your
          grades.
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          Didn&apos;t receive it? Check your spam folder, or{" "}
          <Link
            href={`/verify-email?email=${encodeURIComponent(email.trim())}`}
            className="font-medium text-zinc-900 hover:underline"
          >
            resend the verification email
          </Link>
          .
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start tracking your academic progress."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleAuthButton label="Sign up with Google" />

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
          <label htmlFor="password" className="text-xs font-medium text-zinc-500">
            Password
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
            Confirm password
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
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
