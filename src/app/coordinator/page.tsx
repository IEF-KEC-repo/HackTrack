"use client";

import { CoordinatorShell } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default function CoordinatorOverviewPage() {
  return (
    <CoordinatorShell
      title="HackTrack 2026 — Program Overview"
      description="Real-time macro telemetry and stage health across 300 teams and 1,000+ participants."
      action={
        <div className="flex gap-2">
          <Link href="/coordinator/events">
            <ActionButton variant="primary">Configure Pipeline</ActionButton>
          </Link>
          <Link href="/coordinator/import">
            <ActionButton variant="outline">Bulk CSV Import</ActionButton>
          </Link>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Registered Teams</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">300</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span>●</span> 100% Target Capacity
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Active Stage</p>
            <p className="mt-2 text-2xl font-bold text-indigo-600">Ideathon (Gate 1)</p>
            <p className="mt-1 text-xs text-slate-500">3 Reviews / Idea Assigned</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Evaluation Progress</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">78.4%</p>
            <p className="mt-1 text-xs text-slate-500">706 of 900 reviews submitted</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Continuous Reviews</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">3 Rounds</p>
            <p className="mt-1 text-xs text-indigo-600">CPR 1, CPR 2, CPR 3</p>
          </div>
        </div>

        {/* Event Pipeline Stepper */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Event Sequence Pipeline</h2>
              <p className="text-xs text-slate-500">Sequential gating from Intake to Finale</p>
            </div>
            <Link href="/coordinator/events" className="text-xs font-semibold text-indigo-600 hover:underline">
              Customize Stages →
            </Link>
          </div>

          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 overflow-x-auto py-2">
            {[
              { idx: 1, name: "Ideathon", status: "Submission Open", variant: "info" as const },
              { idx: 2, name: "Innovatz", status: "Upcoming", variant: "default" as const },
              { idx: 3, name: "CPR 1", status: "Upcoming", variant: "default" as const },
              { idx: 4, name: "CPR 2", status: "Upcoming", variant: "default" as const },
              { idx: 5, name: "CPR 3", status: "Upcoming", variant: "default" as const },
              { idx: 6, name: "POC", status: "Upcoming", variant: "default" as const },
              { idx: 7, name: "Demo Day", status: "Upcoming", variant: "default" as const },
            ].map((stg, i, arr) => (
              <div key={stg.idx} className="flex items-center w-full">
                <div className="flex flex-col items-center text-center p-3 rounded-lg border border-slate-200 bg-slate-50 w-full">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-bold mb-1">
                    {stg.idx}
                  </span>
                  <span className="font-bold text-xs text-slate-900">{stg.name}</span>
                  <Badge variant={stg.variant} size="sm" className="mt-1.5">
                    {stg.status}
                  </Badge>
                </div>
                {i < arr.length - 1 && <span className="hidden md:inline mx-2 text-slate-400 font-bold">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </CoordinatorShell>
  );
}
