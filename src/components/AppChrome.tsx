"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/**
 * Application chrome wrapper.
 *
 * The root layout is shared by every route, but the public front door (`/`)
 * and the public auth screens render their own headers/navigation intended for
 * logged-out visitors. For those paths we render children directly (no
 * dashboard header/footer, no notification bell); everywhere else the
 * dashboard chrome is rendered.
 */
function isChromeFree(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/auth/");
}

interface SessionUser {
  id: string;
  name: string;
  email: string;
  globalRole: string;
  editionRole?: string | null;
}

interface NavLink {
  label: string;
  href: string;
}

/**
 * Role-scoped navigation. Each role only links to areas it can actually open,
 * so we never present a link that dead-ends in a 403 redirect.
 */
const NAV_BY_ROLE: Record<string, NavLink[]> = {
  SUPER_ADMIN: [
    { label: "Admin", href: "/admin" },
    { label: "Coordinator", href: "/coordinator" },
    { label: "Evaluator", href: "/evaluator" },
    { label: "Mentor", href: "/mentor" },
    { label: "Teams", href: "/team" },
  ],
  COORDINATOR_MANAGE: [
    { label: "Coordinator", href: "/coordinator" },
    { label: "Evaluator", href: "/evaluator" },
    { label: "Mentor", href: "/mentor" },
    { label: "Teams", href: "/team" },
  ],
  COORDINATOR_VIEW: [
    { label: "Coordinator", href: "/coordinator" },
    { label: "Teams", href: "/team" },
  ],
  EVALUATOR: [
    { label: "My Reviews", href: "/evaluator" },
    { label: "Results", href: "/results" },
  ],
  MENTOR: [
    { label: "My Teams", href: "/mentor" },
    { label: "Results", href: "/results" },
  ],
  PARTICIPANT: [
    { label: "My Team", href: "/team" },
    { label: "Results", href: "/results" },
  ],
};

function resolveRole(user: SessionUser | null): string | null {
  if (!user) return null;
  if (user.globalRole === "SUPER_ADMIN" || user.editionRole === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }
  return user.editionRole ?? null;
}

function initialsOf(name?: string): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Resolve the signed-in identity so the header can be role-aware.
  useEffect(() => {
    if (isChromeFree(pathname)) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const json = await res.json();
        if (active) setUser(json.user ?? null);
      } catch {
        // Identity is cosmetic; route access is enforced server-side.
      }
    })();
    return () => {
      active = false;
    };
  }, [pathname]);

  if (isChromeFree(pathname)) {
    return <>{children}</>;
  }

  const role = resolveRole(user);
  const links = role ? NAV_BY_ROLE[role] ?? [] : [];
  const initials = initialsOf(user?.name);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, continue to the login screen.
    }
    setUser(null);
    setMobileOpen(false);
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-sm">
              HT
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/"
                className="text-lg font-bold tracking-tight text-slate-900 hover:text-indigo-600"
              >
                HackTrack
              </Link>
              <span className="hidden shrink-0 items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 lg:inline-flex">
                Edition 2026
              </span>
            </div>
          </div>

          {/* Desktop navigation — links scoped to the signed-in role. */}
          <nav
            aria-label="Main Navigation"
            className="hidden items-center gap-3 text-sm font-medium text-slate-600 md:flex lg:gap-4"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  isActive(link.href)
                    ? "font-semibold text-indigo-600"
                    : "hover:text-indigo-600"
                )}
              >
                {link.label}
              </Link>
            ))}

            {user && <NotificationBell />}

            {user && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <div className="hidden text-right lg:block">
                  <p className="text-xs font-semibold leading-tight text-slate-900">
                    {user.name}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    {role}
                  </p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {initials}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Sign out
                </button>
              </div>
            )}
          </nav>

          {/* Mobile menu trigger */}
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:hidden"
            aria-label="Toggle navigation menu"
            aria-controls="app-mobile-navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <nav
            id="app-mobile-navigation"
            aria-label="Mobile"
            className="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "block rounded-lg px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset",
                  isActive(link.href)
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                {link.label}
              </Link>
            ))}

            {user && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user.email} • {role}
                      </p>
                    </div>
                  </div>
                  <NotificationBell />
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-3 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Sign out
                </button>
              </div>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <p>© 2026 HackTrack Collegiate Platform. Designed for high-scale, accessible hackathon operations.</p>
      </footer>
    </>
  );
}
