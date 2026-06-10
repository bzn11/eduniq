import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import { needsOnboarding } from "@/lib/profile";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

const ONBOARDING_PATH = "/onboarding";

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

function isOnboardingPath(pathname: string): boolean {
  return pathname === ONBOARDING_PATH;
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/home" ||
    pathname === "/history" ||
    pathname === "/profile" ||
    pathname.startsWith("/history/") ||
    pathname.startsWith("/course/")
  );
}

async function userNeedsOnboarding(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (error) return true;
  return needsOnboarding(
    data
      ? {
          id: userId,
          first_name: null,
          school_name: null,
          grade_scale: "standard-40",
          onboarding_completed: data.onboarding_completed,
          created_at: "",
        }
      : null,
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const env = getSupabaseEnv();
  if (!env) return supabaseResponse;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const isProtected = isProtectedPath(pathname);
  const isOnboarding = isOnboardingPath(pathname);
  const isVerified = Boolean(user?.email_confirmed_at);

  if (!user && (isProtected || isOnboarding)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && !isVerified && (isProtected || isOnboarding)) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    return NextResponse.redirect(url);
  }

  let mustOnboard = false;
  if (user && isVerified) {
    mustOnboard = await userNeedsOnboarding(supabase, user.id);
  }

  if (user && isVerified && mustOnboard && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = ONBOARDING_PATH;
    return NextResponse.redirect(url);
  }

  if (user && isVerified && !mustOnboard && isOnboarding) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  if (user && isVerified && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = mustOnboard ? ONBOARDING_PATH : "/home";
    return NextResponse.redirect(url);
  }

  if (user && isVerified && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = mustOnboard ? ONBOARDING_PATH : "/home";
    return NextResponse.redirect(url);
  }

  if (user && !isVerified && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
