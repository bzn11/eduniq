import { Suspense } from "react";
import LoginContent from "./LoginContent";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-sm text-zinc-500">Loading…</p>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
