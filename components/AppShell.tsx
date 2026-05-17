"use client";

import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/verify-email"]);
const FLOW_PATHS = new Set(["/onboarding"]);

const HYDRATION_FALLBACK = (
  <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
    Loading...
  </div>
);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

function isFlowPath(pathname: string): boolean {
  return FLOW_PATHS.has(pathname);
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { isLoading: authLoading, isConfigured, isEmailVerified, user } = useAuth();
  const { isLoading: profileLoading, needsOnboarding } = useProfile();
  const isPublic = isPublicPath(pathname);
  const isFlow = isFlowPath(pathname);
  const isProtected = isProtectedPath(pathname);
  const showAppChrome = !isPublic && !isFlow;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSessionLoading =
    isConfigured && (authLoading || (user && isEmailVerified && profileLoading));

  useEffect(() => {
    if (!mounted || !isConfigured || isSessionLoading) return;

    if (isProtected && user && isEmailVerified && needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [
    mounted,
    isConfigured,
    isSessionLoading,
    isProtected,
    user,
    isEmailVerified,
    needsOnboarding,
    router,
  ]);

  if (!mounted) {
    return HYDRATION_FALLBACK;
  }

  if (isConfigured && (isProtected || isFlow) && isSessionLoading) {
    return HYDRATION_FALLBACK;
  }

  if (isPublic || isFlow) {
    return <>{children}</>;
  }

  return (
    <>
      {showAppChrome && <TopNav />}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  );
}
