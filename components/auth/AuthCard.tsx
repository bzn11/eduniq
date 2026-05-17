import Link from "next/link";
import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-900"
        >
          Eduniq
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>}
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          {children}
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm text-zinc-600">{footer}</div>
        )}
      </div>
    </div>
  );
}
