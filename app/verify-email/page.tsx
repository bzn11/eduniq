import { Suspense } from "react";
import VerifyEmailContent from "./VerifyEmailContent";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-sm text-zinc-500">Loading…</p>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
