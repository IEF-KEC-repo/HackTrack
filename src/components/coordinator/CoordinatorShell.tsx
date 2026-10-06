"use client";

import React, { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import clsx from "clsx";

interface CoordinatorContextValue {
  isReadOnly: boolean;
  role: string;
  editionSlug: string;
}

const CoordinatorContext = createContext<CoordinatorContextValue>({
  isReadOnly: false,
  role: "COORDINATOR_MANAGE",
  editionSlug: "ht26",
});

export const useCoordinator = () => useContext(CoordinatorContext);

export interface CoordinatorShellProps {
  children: React.ReactNode;
  userRole?: string;
  editionSlug?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const CoordinatorShell: React.FC<CoordinatorShellProps> = ({
  children,
  userRole = "COORDINATOR_MANAGE",
  editionSlug = "ht26",
  title,
  description,
  action,
}) => {
  const pathname = usePathname();
  const isReadOnly = userRole === "COORDINATOR_VIEW";

  const navItems = [
    { label: "Overview", href: "/coordinator" },
    { label: "Pipeline & Events", href: "/coordinator/events" },
    { label: "Teams & Ideas", href: "/coordinator/teams" },
    { label: "Milestones & Mentors", href: "/coordinator/progress" },
    { label: "Rubrics & Anchors", href: "/coordinator/rubrics" },
    { label: "Evaluations & Scoring", href: "/coordinator/evaluations" },
    { label: "Analytics & Radar", href: "/coordinator/analytics" },
    { label: "Leaderboard & Results", href: "/results" },
    { label: "Announcements", href: "/coordinator/announcements" },
    { label: "Users & Roles", href: "/coordinator/users" },
    { label: "Bulk CSV Import", href: "/coordinator/import" },
    { label: "Audit Trail", href: "/coordinator/audit" },
  ];

  return (
    <CoordinatorContext.Provider value={{ isReadOnly, role: userRole, editionSlug }}>
      <div className="min-h-[85vh] bg-slate-50">
        {/* Tier Mode Status Banner */}
        <div
          className={clsx(
            "border-b px-4 py-2 text-xs font-semibold flex items-center justify-between",
            isReadOnly
              ? "bg-amber-50 text-amber-900 border-amber-200"
              : "bg-indigo-50 text-indigo-900 border-indigo-200"
          )}
        >
          <div className="flex items-center gap-2 mx-auto max-w-7xl w-full">
            <span>{isReadOnly ? "👁️ View-Only Tier Active:" : "🛠️ Manage Tier Active:"}</span>
            <span className="font-normal">
              {isReadOnly
                ? "Full institutional visibility enabled. All action controls, configuration updates, and delete triggers are disabled."
                : "Full operations authorized. You can add/reorder events, configure rubrics, import users, and advance gates."}
            </span>
            <span className="ml-auto">
              <Badge variant={isReadOnly ? "warning" : "purple"} size="sm">
                {userRole}
              </Badge>
            </span>
          </div>
        </div>

        {/* Coordinator Subnavigation */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-6 overflow-x-auto py-3 text-sm font-medium">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/coordinator"
                    ? pathname === "/coordinator"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "whitespace-nowrap px-1 py-1 border-b-2 transition-colors",
                      isActive
                        ? "border-indigo-600 text-indigo-600 font-bold"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Page Header */}
        {(title || action) && (
          <div className="border-b border-slate-200 bg-white py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
                {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
              </div>
              {action && <div>{action}</div>}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>
    </CoordinatorContext.Provider>
  );
};
