"use client";

import { AuthProvider } from "@/context/AuthContext";
import { CourseProvider } from "@/context/CourseContext";
import { ProfileProvider } from "@/context/ProfileContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <CourseProvider>{children}</CourseProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
