"use client";

import { CourseProvider } from "@/context/CourseContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <CourseProvider>{children}</CourseProvider>;
}
