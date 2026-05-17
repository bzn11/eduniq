"use client";

import { AuthProvider } from "@/context/AuthContext";
import { CourseProvider } from "@/context/CourseContext";
import { ProfileProvider } from "@/context/ProfileContext";
import type { ReactNode } from "react";

/**
 * Provider stack and data boundaries:
 * - Real data: Supabase → CourseContext → app UI
 * - Simulation: read-only CourseContext → whatIfEngine → course detail overlay only
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <CourseProvider>{children}</CourseProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
