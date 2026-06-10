import { fetchUserProfile, getPostAuthPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { NextResponse } from "next/server";

function getAuthErrorRedirect(origin: string, errorCode: string | null): string {
  if (errorCode === "otp_expired") {
    return `${origin}/verify-email?error=expired`;
  }
  if (errorCode === "access_denied") {
    return `${origin}/verify-email?error=invalid`;
  }
  return `${origin}/login?error=auth`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/home";
  const origin = requestUrl.origin;
  const authError = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  if (authError) {
    if (next === "/reset-password") {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    return NextResponse.redirect(getAuthErrorRedirect(origin, errorCode));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (next === "/reset-password") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      if (user && !user.email_confirmed_at) {
        return NextResponse.redirect(`${origin}/verify-email`);
      }

      const profile = user ? await fetchUserProfile(supabase, user.id) : null;
      const destination = getPostAuthPath(profile, next);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
