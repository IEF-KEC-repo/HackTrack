"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CoordinatorShell, useCoordinator } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";

interface StageEvent {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  status: string;
  reviewType: string;
  submissionDeadline: string | null;
  evaluationDeadline: string | null;
  evaluatorCountPerTeam: number;
}

interface OverviewData {
  edition: { id: string; name: string; slug: string; status: string } | null;
  events: StageEvent[];
  cprCount: number;
  totalRegisteredTeams: number | null;
  evalSummary: { totalAssigned: number; totalSubmitted: number; completionPercent: number } | null;
  error: string | null;
  loading: boolean;
}

function statusVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "COMPLETED") return "success";
  if (status.includes("LOCKED")) return "warning";
  if (status.includes("OPEN") || status === "EVALUATION_ACTIVE" || status === "REGISTRATION_OPEN") {
    return "info";
  }
  return "default";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export default function CoordinatorOverviewPage() {
  const { editionSlug } = useCoordinator();
  const [data, setData] = useState<OverviewData>({
    edition: null,
    events: [],
    cprCount: 0,
    totalRegisteredTeams: null,
    evalSummary: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [editionRes, funnelRes, leaderboardRes] = await Promise.all([
          fetch(`/api/coordinator/edition-data?slug=${editionSlug || "ht26"}`),
          fetch(`/api/coordinator/analytics/funnel?edition=${editionSlug || "ht26"}`),
          fetch(`/api/coordinator/scoring/leaderboard?edition=${editionSlug || "ht26"}`),
        ]);

        const editionJson = await editionRes.json().catch(() => ({}));
        const funnelJson = await funnelRes.json().catch(() => ({}));
        const leaderboardJson = await leaderboardRes.json().catch(() => ({}));

        if (!active) return;

        const editionError = !editionRes.ok ? "Edition data unavailable." : null;
        const funnelError = !funnelRes.ok ? "Funnel data unavailable." : null;

        const edition = editionJson.edition || null;
        const events: StageEvent[] = (edition?.events || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          sequenceIndex: e.sequenceIndex,
          status: e.status,
          reviewType: e.reviewType,
          submissionDeadline: e.submissionDeadline,
          evaluationDeadline: e.evaluationDeadline,
          evaluatorCountPerTeam: e.evaluatorCountPerTeam,
        }));

        setData({
          edition,
          events,
          cprCount:
            edition?.continuousProjectReviewCount ??
            edition?.cprCount ??
            events.filter((e) => e.slug.startsWith("cpr-")).length,
          totalRegisteredTeams: funnelJson.funnel?.totalRegisteredTeams ?? null,
          evalSummary: leaderboardJson.summary
            ? {
                totalAssigned: leaderboardJson.summary.totalAssigned,
                totalSubmitted: leaderboardJson.summary.totalSubmitted,
                completionPercent: leaderboardJson.summary.completionPercent,
              }
            : null,
          error: editionError || funnelError,
          loading: false,
        });
      } catch (err: any) {
        if (active) {
          setData((prev) => ({
            ...prev,
            error: err?.message || "Failed to load program overview.",
            loading: false,
          }));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [editionSlug]);

  const { edition, events, cprCount, totalRegisteredTeams, evalSummary, error, loading } = data;

  const activeStage = events.find((e) => {
    const s = e.status;
    return s === "SUBMISSION_OPEN" || s === "EVALUATION_ACTIVE" || s === "REGISTRATION_OPEN";
  });
  const cprEvents = events.filter((e) => e.slug.startsWith("cpr-"));

  return (
    <CoordinatorShell
      title={edition ? `${edition.name} — Program Overview` : "Program Overview"}
      description="Live macro telemetry and stage health across the active edition."
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
        {error && (
          <Alert variant="error" title="Program overview partially unavailable">
            {error} Reconnect and reload to retry.
          </Alert>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Registered Teams</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {loading ? "…" : totalRegisteredTeams ?? "—"}
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="text-slate-400">●</span>
              {loading ? "Loading…" : totalRegisteredTeams !== null ? `${totalRegisteredTeams} teams in this edition` : "No teams registered yet"}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Active Stage</p>
            <p className="mt-2 text-2xl font-bold text-indigo-600">
              {loading ? "…" : activeStage ? `${activeStage.name} (Gate ${activeStage.sequenceIndex})` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {activeStage
                ? `${activeStage.evaluatorCountPerTeam} review${activeStage.evaluatorCountPerTeam > 1 ? "s" : ""} / team · ${statusLabel(activeStage.status)}`
                : "No stage is currently open"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Evaluation Progress</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {loading ? "…" : evalSummary ? `${evalSummary.completionPercent}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {evalSummary
                ? `${evalSummary.totalSubmitted} of ${evalSummary.totalAssigned} reviews submitted`
                : "No evaluations assigned yet"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Continuous Reviews</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">
              {loading ? "…" : `${cprCount || cprEvents.length}`} Rounds
            </p>
            <p className="mt-1 text-xs text-indigo-600">
              {cprEvents.length > 0
                ? cprEvents.map((e) => e.slug.toUpperCase()).join(", ")
                : "No CPR stages configured"}
            </p>
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

          {loading ? (
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-7">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No event stages configured for this edition yet.
            </p>
          ) : (
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 overflow-x-auto py-2">
              {events.map((stg, i, arr) => (
                <div key={stg.id} className="flex items-center w-full">
                  <div className="flex flex-col items-center text-center p-3 rounded-lg border border-slate-200 bg-slate-50 w-full">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-bold mb-1">
                      {stg.sequenceIndex}
                    </span>
                    <span className="font-bold text-xs text-slate-900">{stg.name}</span>
                    <Badge variant={statusVariant(stg.status)} size="sm" className="mt-1.5">
                      {statusLabel(stg.status)}
                    </Badge>
                  </div>
                  {i < arr.length - 1 && <span className="hidden md:inline mx-2 text-slate-400 font-bold">→</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CoordinatorShell>
  );
}