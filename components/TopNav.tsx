"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/home", label: "Home" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, isConfigured } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/home"
          className="text-sm font-semibold tracking-tight text-zinc-900"
        >
          Eduniq
        </Link>
        <ul className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
          {links.map(({ href, label }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-zinc-100 font-medium text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex min-w-0 items-center gap-2">
          {isConfigured && user?.email && (
            <p className="hidden max-w-[10rem] truncate text-xs text-zinc-500 sm:block">
              {user.email}
            </p>
          )}
          {isConfigured && (
            <button
              type="button"
              onClick={handleSignOut}
              className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              Log out
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
