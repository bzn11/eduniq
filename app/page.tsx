import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold tracking-tight text-zinc-900">Eduniq</p>
      <h1 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        Track your GPA across every term, in one place.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
        Credit-weighted term and cumulative GPA, course insights, and academic
        history — built for students who want clarity without the spreadsheet.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-zinc-900 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}
