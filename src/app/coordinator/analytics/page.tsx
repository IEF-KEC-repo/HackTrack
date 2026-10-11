"use client";

import React, { useState, useEffect } from "react";
import { CoordinatorShell, useCoordinator } from "@/components/coordinator/CoordinatorShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";

interface FunnelStage {
  sequenceIndex: number;
  eventName: string;
  status: string;
  activeCount: number;
  conversionPercent: number;
  dropOffCount: number;
  dropOffPercent: number;
}

interface OverdueMilestone {
  id: string;
  teamCode: string;
  teamName: string;
  title: string;
  dueDate: string;
  daysOverdue: number;
}

interface OverdueCheckIn {
  teamCode: string;
  teamName: string;
  mentorName: string;
  daysSinceLastCheckIn: number;
}

interface DistributionMetrics {
  count: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  mean: number;
  standardDeviation: number;
}

interface NudgeAlert {
  variant: "success" | "error";
  message: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export default function CoordinatorAnalyticsPage() {
  const { isReadOnly, editionSlug } = useCoordinator();
  const [activeTab, setActiveTab] = useState<"funnel" | "overdue" | "distributions" | "export">("funnel");

  // Edition reference state
  const [editionId, setEditionId] = useState<string>("");
  const [events, setEvents] = useState<Array<{ id: string; name: string; sequenceIndex: number; status: string }>>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Funnel State
  const [funnelData, setFunnelData] = useState<{
    totalRegistered: number;
    stages: FunnelStage[];
  }>({ totalRegistered: 0, stages: [] });

  // Overdue Radar State
  const [missingSlides, setMissingSlides] = useState<Array<{ id: string; regCode: string; name: string; track: string }>>([]);

  const [overdueMilestones, setOverdueMilestones] = useState<OverdueMilestone[]>([]);

  const [overdueCheckIns, setOverdueCheckIns] = useState<OverdueCheckIn[]>([]);

  const [pendingEvaluators, setPendingEvaluators] = useState<Array<{ name: string; email: string; pendingCount: number; event: string }>>([]);

  // Score Distribution State
  const [distributionStats, setDistributionStats] = useState<{
    raw: DistributionMetrics;
    normalized: DistributionMetrics;
    outlierCount: number;
  } | null>(null);

  // Loading / Error State
  const [isLoadingCore, setIsLoadingCore] = useState(true);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [isLoadingDist, setIsLoadingDist] = useState(false);
  const [distError, setDistError] = useState<string | null>(null);

  // Nudge Modal State
  const [isNudgeModalOpen, setIsNudgeModalOpen] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<string>("");
  const [nudgeMessage, setNudgeMessage] = useState<string>("");
  const [nudgeTargetRole, setNudgeTargetRole] = useState<"PARTICIPANT" | "EVALUATOR">("PARTICIPANT");
  const [nudgeTeamId, setNudgeTeamId] = useState<string | null>(null);
  const [nudgeAlert, setNudgeAlert] = useState<NudgeAlert | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCoreData = async () => {
      setIsLoadingCore(true);
      setCoreError(null);
      try {
        const [editionRes, funnelRes, overdueRes] = await Promise.all([
          fetch(`/api/coordinator/edition-data?slug=${encodeURIComponent(editionSlug)}`),
          fetch(`/api/coordinator/analytics/funnel?edition=${encodeURIComponent(editionSlug)}`),
          fetch(`/api/coordinator/analytics/overdue?edition=${encodeURIComponent(editionSlug)}`),
        ]);

        const editionJson = await editionRes.json();
        if (cancelled) return;
        if (!editionRes.ok) throw new Error(editionJson.error || "Failed to load edition data.");

        const edition = editionJson.edition as
          | { id: string; events?: Array<{ id: string; name: string; sequenceIndex: number; status: string }> }
          | null
          | undefined;

        const editionIdFromApi = edition?.id || "";
        setEditionId(editionIdFromApi);

        const evts = (edition?.events ?? []).map((ev) => ({
          id: ev.id,
          name: ev.name,
          sequenceIndex: ev.sequenceIndex,
          status: ev.status,
        }));
        setEvents(evts);
        setSelectedEventId((prev) => (evts.some((ev) => ev.id === prev) ? prev : evts[0]?.id ?? ""));

        // Funnel
        const funnelJson = await funnelRes.json();
        if (cancelled) return;
        if (!funnelRes.ok) throw new Error(funnelJson.error || "Failed to load funnel data.");

        const funnel = (funnelJson.funnel ?? null) as {
          totalRegisteredTeams?: number;
          stages?: Array<{
            sequenceIndex: number;
            eventName: string;
            status: string;
            activeTeamsCount: number;
            conversionPercent: number;
            dropOffCount: number;
            dropOffPercent: number;
          }>;
        } | null;

        setFunnelData({
          totalRegistered: funnel?.totalRegisteredTeams ?? 0,
          stages: (funnel?.stages ?? []).map((s) => ({
            sequenceIndex: s.sequenceIndex,
            eventName: s.eventName,
            status: s.status,
            activeCount: s.activeTeamsCount,
            conversionPercent: s.conversionPercent,
            dropOffCount: s.dropOffCount,
            dropOffPercent: s.dropOffPercent,
          })),
        });

        // Overdue
        const overdueJson = await overdueRes.json();
        if (cancelled) return;
        if (!overdueRes.ok) throw new Error(overdueJson.error || "Failed to load overdue items.");

        const overdue = (overdueJson.overdue ?? null) as {
          missingSlidesTeams?: Array<{ id: string; regCode: string; name: string }>;
          overdueMilestones?: Array<{
            id: string;
            teamId: string;
            teamName: string;
            title: string;
            dueDate: string;
            daysOverdue: number;
          }>;
          overdueCheckInTeams?: Array<{
            teamId: string;
            teamName: string;
            mentorName: string;
            daysSinceLastCheckIn: number;
          }>;
          pendingEvaluators?: Array<{
            evaluatorName: string;
            eventName: string;
            pendingCount: number;
          }>;
        } | null;

        setMissingSlides(
          (overdue?.missingSlidesTeams ?? []).map((t) => ({
            id: t.id,
            regCode: t.regCode,
            name: t.name,
            track: "—",
          }))
        );

        setOverdueMilestones(
          (overdue?.overdueMilestones ?? []).map((m) => ({
            id: m.id,
            teamCode: m.teamId,
            teamName: m.teamName,
            title: m.title,
            dueDate: m.dueDate,
            daysOverdue: m.daysOverdue,
          }))
        );

        setOverdueCheckIns(
          (overdue?.overdueCheckInTeams ?? []).map((c) => ({
            teamCode: c.teamId,
            teamName: c.teamName,
            mentorName: c.mentorName,
            daysSinceLastCheckIn: c.daysSinceLastCheckIn,
          }))
        );

        setPendingEvaluators(
          (overdue?.pendingEvaluators ?? []).map((p) => ({
            name: p.evaluatorName,
            email: "—",
            pendingCount: p.pendingCount,
            event: p.eventName,
          }))
        );

        if (cancelled) return;
        setIsLoadingCore(false);
      } catch (err) {
        if (!cancelled) {
          setCoreError(getErrorMessage(err));
          setIsLoadingCore(false);
        }
      }
    };

    loadCoreData();

    return () => {
      cancelled = true;
    };
  }, [editionSlug]);

  useEffect(() => {
    if (activeTab !== "distributions" || !selectedEventId) return;

    let cancelled = false;

    const loadDistribution = async () => {
      setIsLoadingDist(true);
      setDistError(null);
      try {
        const [scoresRes, leaderboardRes] = await Promise.all([
          fetch(`/api/coordinator/analytics/scores?eventId=${encodeURIComponent(selectedEventId)}`),
          fetch(
            `/api/coordinator/scoring/leaderboard?eventId=${encodeURIComponent(selectedEventId)}&edition=${encodeURIComponent(editionSlug)}`
          ),
        ]);

        const scoresJson = await scoresRes.json();
        const leaderboardJson = leaderboardRes.ok ? await leaderboardRes.json() : null;
        if (cancelled) return;
        if (!scoresRes.ok) throw new Error(scoresJson.error || "Failed to load score distributions.");

        const distributions = (scoresJson.distributions ?? null) as {
          rawDistribution?: Partial<DistributionMetrics>;
          normalizedDistribution?: Partial<DistributionMetrics>;
        } | null;

        const raw = distributions?.rawDistribution;
        const normalized = distributions?.normalizedDistribution;

        setDistributionStats({
          raw: {
            count: raw?.count ?? 0,
            min: raw?.min ?? 0,
            p25: raw?.p25 ?? 0,
            median: raw?.median ?? 0,
            p75: raw?.p75 ?? 0,
            p90: raw?.p90 ?? 0,
            max: raw?.max ?? 0,
            mean: raw?.mean ?? 0,
            standardDeviation: raw?.standardDeviation ?? 0,
          },
          normalized: {
            count: normalized?.count ?? 0,
            min: normalized?.min ?? 0,
            p25: normalized?.p25 ?? 0,
            median: normalized?.median ?? 0,
            p75: normalized?.p75 ?? 0,
            p90: normalized?.p90 ?? 0,
            max: normalized?.max ?? 0,
            mean: normalized?.mean ?? 0,
            standardDeviation: normalized?.standardDeviation ?? 0,
          },
          outlierCount: leaderboardJson?.summary?.outlierCount ?? 0,
        });

        if (cancelled) return;
        setIsLoadingDist(false);
      } catch (err) {
        if (!cancelled) {
          setDistributionStats(null);
          setDistError(getErrorMessage(err));
          setIsLoadingDist(false);
        }
      }
    };

    loadDistribution();

    return () => {
      cancelled = true;
    };
  }, [activeTab, editionSlug, selectedEventId]);

  const handleOpenNudge = (
    target: string,
    defaultMsg: string,
    targetRole: "PARTICIPANT" | "EVALUATOR",
    teamId?: string
  ) => {
    if (isReadOnly) return;
    setNudgeTarget(target);
    setNudgeMessage(defaultMsg);
    setNudgeTargetRole(targetRole);
    setNudgeTeamId(teamId ?? null);
    setNudgeAlert(null);
    setIsNudgeModalOpen(true);
  };

  const handleSendNudge = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editionId) {
      setIsNudgeModalOpen(false);
      setNudgeAlert({ variant: "error", message: "Edition context is not loaded yet. Please retry shortly." });
      return;
    }

    try {
      const res = await fetch("/api/announcements/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId,
          title: "Reminder",
          content: nudgeMessage,
          priority: "NORMAL",
          targetRole: nudgeTargetRole,
          teamId: nudgeTeamId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch nudge.");

      const recipientsText =
        typeof data.recipientsCount === "number" ? ` (dispatched to ${data.recipientsCount} recipients)` : "";
      setIsNudgeModalOpen(false);
      setNudgeAlert({
        variant: "success",
        message: `Automated nudge notification dispatched to: ${nudgeTarget}${recipientsText}`,
      });
    } catch (err) {
      setIsNudgeModalOpen(false);
      setNudgeAlert({ variant: "error", message: getErrorMessage(err) });
    }
  };

  const overdueTotal = missingSlides.length + overdueMilestones.length + overdueCheckIns.length + pendingEvaluators.length;

  return (
    <CoordinatorShell
      title="Cohort Analytics & Operational Radar"
      description="Funnel conversion rates across stages, overdue items, score normalization calibration, and institutional exports"
    >
      <div className="space-y-6">
        {/* Nudge Dispatch Toast */}
        {nudgeAlert && (
          <Alert
            variant={nudgeAlert.variant}
            title={nudgeAlert.variant === "success" ? "Notification Dispatched" : "Nudge Dispatch Failed"}
          >
            {nudgeAlert.message}
          </Alert>
        )}

        {/* Core Data Load Errors */}
        {coreError && (
          <Alert variant="error" title="Failed to Load Analytics">
            {coreError}
          </Alert>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-3 rounded-t-xl gap-6 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("funnel")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "funnel"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>📊 Cohort Funnel</span>
            <Badge variant="purple" size="sm">{events.length} Stages</Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("overdue")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "overdue"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>⚠️ Overdue Radar</span>
            <Badge variant="danger" size="sm">
              {overdueTotal}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("distributions")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "distributions"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>📈 Score Distributions & Stats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "export"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>📥 Export Center</span>
            <Badge variant="info" size="sm">CSV / PDF</Badge>
          </button>
        </div>

        {/* TAB 1: COHORT FUNNEL */}
        {activeTab === "funnel" && (
          <div className="space-y-6">
            {isLoadingCore && (
              <Alert variant="info" title="Loading Analytics">
                Fetching cohort funnel and overdue radar data…
              </Alert>
            )}

            {/* Funnel Metrics Overview Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Cohort Funnel & Gate Conversion</h2>
                  <p className="text-xs text-slate-500">
                    Progression of {funnelData.totalRegistered} registered teams across sequential edition gates
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-semibold">Total Initial Cohort:</span>
                  <Badge variant="purple" size="md">
                    {funnelData.totalRegistered} Teams
                  </Badge>
                </div>
              </div>

              {/* Sequential Funnel Visual */}
              <div className="mt-6 space-y-4">
                {funnelData.stages.map((stage) => {
                  return (
                    <div
                      key={stage.sequenceIndex}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px]">
                            {stage.sequenceIndex}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{stage.eventName}</span>
                          <Badge
                            variant={
                              stage.status === "COMPLETED"
                                ? "success"
                                : stage.status === "ACTIVE"
                                ? "info"
                                : "default"
                            }
                            size="sm"
                          >
                            {stage.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-6 font-mono text-xs">
                          <div>
                            <span className="text-slate-400">Active Teams:</span>{" "}
                            <strong className="text-slate-900">{stage.activeCount}</strong>{" "}
                            <span className="text-indigo-600 font-bold">({stage.conversionPercent}% of cohort)</span>
                          </div>

                          {stage.dropOffCount > 0 && (
                            <div className="text-rose-600">
                              <span>Drop-off: </span>
                              <strong>-{stage.dropOffCount}</strong> ({stage.dropOffPercent}%)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bar Visual */}
                      <div className="mt-3 w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${stage.conversionPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {funnelData.stages.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No funnel stages are available for this edition yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OVERDUE RADAR & NUDGE CENTER */}
        {activeTab === "overdue" && (
          <div className="space-y-6">
            {isLoadingCore && (
              <Alert variant="info" title="Loading Analytics">
                Fetching overdue radar data…
              </Alert>
            )}

            {/* Missing Slides Radar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Missing Pitch Presentation Decks</span>
                    <Badge variant={missingSlides.length > 0 ? "danger" : "success"} size="sm">
                      {missingSlides.length} Teams
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Teams that have not provided a verified public Google Slides URL
                  </p>
                </div>
                {!isReadOnly && missingSlides.length > 0 && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      handleOpenNudge(
                        "All Teams with Missing Decks",
                        "Urgent: Your Google Slides pitch deck has not been submitted or verified. Please submit it via your Team Hub immediately before the evaluation cutoff.",
                        "PARTICIPANT"
                      )
                    }
                  >
                    Nudge All Missing Slides ✉️
                  </Button>
                )}
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {missingSlides.map((team) => (
                  <div key={team.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-indigo-700 mr-2">{team.regCode}</span>
                      <span className="font-bold text-slate-900">{team.name}</span>
                      <span className="text-slate-400 ml-2">({team.track})</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isReadOnly}
                      onClick={() =>
                        handleOpenNudge(
                          team.name,
                          `Reminder for ${team.name}: Please upload your presentation deck URL.`,
                          "PARTICIPANT",
                          team.id
                        )
                      }
                    >
                      Send Nudge
                    </Button>
                  </div>
                ))}

                {missingSlides.length === 0 && (
                  <p className="py-3 text-xs text-slate-500">No teams are missing verified presentation decks. 🎉</p>
                )}
              </div>
            </div>

            {/* Overdue Milestones Radar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Overdue Milestone Deliverables</span>
                    <Badge variant="danger" size="sm">
                      {overdueMilestones.length} Overdue
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mandatory deliverables that have passed their assigned deadline without submission
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {overdueMilestones.map((ms) => (
                  <div key={ms.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-indigo-700 mr-2">{ms.teamCode}</span>
                      <span className="font-bold text-slate-900">{ms.teamName}</span>
                      <span className="text-slate-500 ml-2">— &ldquo;{ms.title}&rdquo;</span>
                      <span className="ml-2 font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {ms.daysOverdue} Days Overdue (Due: {ms.dueDate})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isReadOnly}
                      onClick={() =>
                        handleOpenNudge(
                          ms.teamName,
                          `Urgent Milestone Alert: "${ms.title}" is ${ms.daysOverdue} days past due.`,
                          "PARTICIPANT",
                          ms.teamCode
                        )
                      }
                    >
                      Nudge Team
                    </Button>
                  </div>
                ))}

                {overdueMilestones.length === 0 && (
                  <p className="py-3 text-xs text-slate-500">No overdue milestone deliverables. 🎉</p>
                )}
              </div>
            </div>

            {/* Overdue Mentor Check-Ins (>14 days) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Lapsed Mentor Check-Ins (&gt;14 Day Cadence)</span>
                    <Badge variant="warning" size="sm">
                      {overdueCheckIns.length} Teams
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Teams with no recorded mentor guidance touchpoint in over two weeks
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {overdueCheckIns.map((ci, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-indigo-700 mr-2">{ci.teamCode}</span>
                      <span className="font-bold text-slate-900">{ci.teamName}</span>
                      <span className="text-slate-500 ml-2">Mentor: {ci.mentorName}</span>
                      <span className="ml-2 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {ci.daysSinceLastCheckIn} days without check-in
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isReadOnly}
                      onClick={() =>
                        handleOpenNudge(
                          `${ci.teamName} & ${ci.mentorName}`,
                          `Reminder: Bi-weekly mentor check-in is overdue (${ci.daysSinceLastCheckIn} days since last session). Please log your discussion.`,
                          "PARTICIPANT",
                          ci.teamCode
                        )
                      }
                    >
                      Nudge Mentor & Team
                    </Button>
                  </div>
                ))}

                {overdueCheckIns.length === 0 && (
                  <p className="py-3 text-xs text-slate-500">No lapsed mentor check-ins. 🎉</p>
                )}
              </div>
            </div>

            {/* Pending Evaluator Queues */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Pending Evaluator Queues</span>
                    <Badge variant="purple" size="sm">
                      {pendingEvaluators.length} Reviewers
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Evaluators with incomplete reviews nearing the stage calibration cutoff
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {pendingEvaluators.map((ev, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{ev.name}</span>
                      <span className="font-mono text-slate-500 ml-2">({ev.email})</span>
                      <span className="ml-2 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {ev.pendingCount} evaluations remaining
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isReadOnly}
                      onClick={() =>
                        handleOpenNudge(
                          ev.name,
                          `Evaluation Cutoff Reminder: You have ${ev.pendingCount} incomplete reviews remaining in your ${ev.event} queue.`,
                          "EVALUATOR"
                        )
                      }
                    >
                      Send Queue Reminder
                    </Button>
                  </div>
                ))}

                {pendingEvaluators.length === 0 && (
                  <p className="py-3 text-xs text-slate-500">No pending evaluator queues. 🎉</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SCORE DISTRIBUTIONS & NORMALIZATION STATS */}
        {activeTab === "distributions" && (
          <div className="space-y-6">
            {isLoadingDist ? (
              <Alert variant="info" title="Loading Distributions">
                Fetching score distributions for the selected event…
              </Alert>
            ) : distError ? (
              <Alert variant="error" title="Failed to Load Score Distributions">
                {distError}
              </Alert>
            ) : !distributionStats ||
              (distributionStats.raw.count === 0 && distributionStats.normalized.count === 0) ? (
              <Alert variant="info" title="No Score Distribution Data">
                No submitted evaluations are available for this event yet. Distribution metrics will appear once
                reviews are recorded.
              </Alert>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Score Distributions & Calibration Metrics</h2>
                    <p className="text-xs text-slate-500">
                      Empirical validation of Z-Score normalization eliminating evaluator grading leniency and harshness
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="purple" size="md">
                      Total Evaluations: {distributionStats.raw.count}
                    </Badge>
                    <Badge variant="warning" size="md">
                      Outlier Discrepancies: {distributionStats.outlierCount}
                    </Badge>
                  </div>
                </div>

                {/* Side-by-Side Distribution Metric Comparison */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Raw Scores Column */}
                  <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/50">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900 text-sm">Raw Scores (Pre-Normalization)</h3>
                      <Badge variant="default" size="sm">Subjective</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Mean (μ)</span>
                        <p className="text-lg font-bold text-slate-900 mt-1">{distributionStats.raw.mean.toFixed(1)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Std Dev (σ)</span>
                        <p className="text-lg font-bold text-slate-900 mt-1">{distributionStats.raw.standardDeviation.toFixed(1)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Median (p50)</span>
                        <p className="text-lg font-bold text-slate-900 mt-1">{distributionStats.raw.median.toFixed(1)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Min / Max</span>
                        <p className="text-sm font-bold text-slate-900 mt-1.5">
                          {distributionStats.raw.min.toFixed(0)} - {distributionStats.raw.max.toFixed(0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200 text-xs flex justify-between font-mono">
                      <span>25th Percentile: <strong>{distributionStats.raw.p25.toFixed(1)}</strong></span>
                      <span>75th Percentile: <strong>{distributionStats.raw.p75.toFixed(1)}</strong></span>
                      <span>90th Percentile: <strong>{distributionStats.raw.p90.toFixed(1)}</strong></span>
                    </div>
                  </div>

                  {/* Normalized Scores Column */}
                  <div className="rounded-xl border border-indigo-200 p-5 bg-indigo-50/20">
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-200">
                      <h3 className="font-bold text-indigo-950 text-sm">Normalized Scores (Z-Score Standardized)</h3>
                      <Badge variant="purple" size="sm">Calibrated</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 bg-white rounded-lg border border-indigo-200">
                        <span className="text-[10px] uppercase font-bold text-indigo-700">Cohort μ</span>
                        <p className="text-lg font-bold text-indigo-900 mt-1">{distributionStats.normalized.mean.toFixed(1)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-indigo-200">
                        <span className="text-[10px] uppercase font-bold text-indigo-700">Target σ</span>
                        <p className="text-lg font-bold text-indigo-900 mt-1">{distributionStats.normalized.standardDeviation.toFixed(1)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-indigo-200">
                        <span className="text-[10px] uppercase font-bold text-indigo-700">Median</span>
                        <p className="text-lg font-bold text-indigo-900 mt-1">{distributionStats.normalized.median.toFixed(1)}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-indigo-200">
                        <span className="text-[10px] uppercase font-bold text-indigo-700">Min / Max</span>
                        <p className="text-sm font-bold text-indigo-900 mt-1.5">
                          {distributionStats.normalized.min.toFixed(0)} - {distributionStats.normalized.max.toFixed(0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-white rounded-lg border border-indigo-200 text-xs flex justify-between font-mono text-indigo-950">
                      <span>25th Percentile: <strong>{distributionStats.normalized.p25.toFixed(1)}</strong></span>
                      <span>75th Percentile: <strong>{distributionStats.normalized.p75.toFixed(1)}</strong></span>
                      <span>90th Percentile: <strong>{distributionStats.normalized.p90.toFixed(1)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXPORT CENTER */}
        {activeTab === "export" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Institutional Data & Report Exports</h2>
                <p className="text-xs text-slate-500">
                  RFC 4180 CSV files with UTF-8 BOM encoding for Excel, plus print-to-PDF audit documentation
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export 1: Ideas & Teams */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Teams & Idea Submissions CSV</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Comprehensive export of registration codes, tracks, team leads, problem statements, abstracts, and pitch decks.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-mono text-slate-400">ideas-ht26.csv</span>
                    <a href="/api/export/ideas?edition=ht26" download>
                      <Button size="sm" variant="secondary">
                        Download CSV 📥
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Export 2: Scores & Normalized Standings */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Leaderboard & Score Normalization CSV</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Exact 100% numerical parity with on-screen rankings: Raw averages, normalized scores, Z-scores, and tie-breaks.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-mono text-slate-400">leaderboard-ht26.csv</span>
                    <a href="/api/export/scores?edition=ht26" download>
                      <Button size="sm" variant="secondary">
                        Download CSV 📥
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Export 3: Evaluator Feedback */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Rubric Ratings & Written Feedback CSV</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Evaluator criteria breakdowns, weighted scores awarded, and qualitative commentary across all reviews.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-mono text-slate-400">rubric-feedback-ht26.csv</span>
                    <a href="/api/export/feedback?edition=ht26" download>
                      <Button size="sm" variant="secondary">
                        Download CSV 📥
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Export 4: Milestones Compliance */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Milestones & Deliverable Compliance CSV</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Tracking mandatory and custom milestone completion, submission timestamps, and overdue day counts.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-mono text-slate-400">milestones-ht26.csv</span>
                    <a href="/api/export/milestones?edition=ht26" download>
                      <Button size="sm" variant="secondary">
                        Download CSV 📥
                      </Button>
                    </a>
                  </div>
                </div>
              </div>

              {/* Printable PDF Section */}
              <div className="mt-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Printable Audit Standings & PDF Report</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Generates an A4 landscape formatted print page with official audit headers, podium badges, and summary cards.
                  </p>
                </div>
                <a
                  href="/api/export/report?edition=ht26&autoprint=true"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="primary" className="bg-indigo-600 text-white">
                    Print to PDF 🖨️
                  </Button>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Dispatch Nudge Reminder */}
      <Modal
        isOpen={isNudgeModalOpen}
        onClose={() => setIsNudgeModalOpen(false)}
        title={`Dispatch Operational Nudge: ${nudgeTarget}`}
      >
        <form onSubmit={handleSendNudge} className="space-y-4 text-xs">
          <p className="text-slate-600">
            This will dispatch an in-app notification and an automated email reminder to all team leads and members.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Custom Reminder Message:
            </label>
            <textarea
              rows={3}
              required
              value={nudgeMessage}
              onChange={(e) => setNudgeMessage(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsNudgeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="bg-indigo-600 text-white">
              Send Reminder
            </Button>
          </div>
        </form>
      </Modal>
    </CoordinatorShell>
  );
}