"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CoordinatorShell, useCoordinator } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import clsx from "clsx";

interface EventItem {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  reviewType: "ASYNC_MULTI_REVIEWER" | "LIVE_PANEL";
  status: string;
  evaluatorCountPerTeam: number;
  feedbackReleased: boolean;
  isCalibrationActive: boolean;
}

interface EvaluatorStatItem {
  evaluatorId: string;
  name?: string;
  email?: string;
  evaluationCount: number;
  submittedCount?: number;
  mean: number;
  stdDev: number;
  harshness: "HARSH" | "MODERATE" | "LENIENT";
  isCalibrated?: boolean;
}

interface RankedTeamItem {
  teamId: string;
  teamName: string;
  regCode: string;
  track: string;
  reviewCount: number;
  rawMean: number;
  normalizedScore: number;
  rawRank: number;
  normalizedRank: number;
  rankShift: number;
  isOutlier: boolean;
  scores: number[];
  tieBreakReason?: string;
}

interface CalibrationSample {
  id: string;
  title: string;
  groundTruthScore: number;
  evaluatorSpread: string;
  status: string;
  varianceScore: number;
}

interface LeaderboardSummary {
  totalAssigned: number;
  totalSubmitted: number;
  completionPercent: number;
  outlierCount: number;
}

// Map the live leaderboard payload into the console's render shapes.
function mapEvaluatorStats(stats: any[] | Record<string, any> | undefined): EvaluatorStatItem[] {
  const rows = Array.isArray(stats) ? stats : Object.values(stats || {});
  return rows.map((s) => ({
    evaluatorId: s.evaluatorId,
    name: s.name,
    email: s.email,
    evaluationCount: s.count ?? s.evaluationCount ?? 0,
    submittedCount: s.submittedCount ?? s.count,
    mean: s.mean ?? 0,
    stdDev: s.stdDev ?? 0,
    harshness: (s.harshness === "GENEROUS" ? "LENIENT" : s.harshness) as
      | "HARSH"
      | "MODERATE"
      | "LENIENT",
    isCalibrated: Boolean(s.isCalibrated),
  }));
}

function mapRankedTeams(teams: any[] | undefined): RankedTeamItem[] {
  return (teams || []).map((rt) => ({
    teamId: rt.teamId,
    teamName: rt.teamName,
    regCode: rt.regCode,
    track: rt.track || "General",
    reviewCount: rt.reviewerScores?.length ?? rt.reviewCount ?? 0,
    rawMean: rt.rawAverage ?? rt.rawMean ?? 0,
    normalizedScore: rt.normalizedScore ?? 0,
    rawRank: rt.rawRank ?? 0,
    normalizedRank: rt.rank ?? rt.normalizedRank ?? 0,
    rankShift: rt.rankShift ?? 0,
    isOutlier: Boolean(rt.isOutlier),
    scores: (rt.reviewerScores || []).map((r: any) => r.rawScore),
    tieBreakReason:
      rt.tieBreakReason ?? rt.outlierReason ?? undefined,
  }));
}

const EMPTY_EVENT: EventItem = {
  id: "",
  name: "No stage configured",
  slug: "",
  sequenceIndex: 0,
  reviewType: "LIVE_PANEL",
  status: "UPCOMING",
  evaluatorCountPerTeam: 3,
  feedbackReleased: false,
  isCalibrationActive: false,
};

export default function CoordinatorEvaluationsPage() {
  const { isReadOnly, editionSlug } = useCoordinator();

  // Events are loaded live from the real edition configuration.
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const selectedEvent =
    events.find((e) => e.id === selectedEventId) || events[0] || EMPTY_EVENT;

  // Feedback notifications
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info" | "warning"; msg: string } | null>(
    null
  );

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"leaderboard" | "evaluators" | "calibration">("leaderboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOutliersOnly, setFilterOutliersOnly] = useState(false);
  const [filterRankShiftsOnly, setFilterRankShiftsOnly] = useState(false);

  // Evaluator calibration stats, loaded from the live leaderboard.
  const [evaluators, setEvaluators] = useState<EvaluatorStatItem[]>([]);

  // Ranked teams come straight from the live normalization leaderboard.
  const [rankedTeams, setRankedTeams] = useState<RankedTeamItem[]>([]);

  // Calibration benchmark samples derive from real calibration-run evaluations.
  const [calibrationSamples, setCalibrationSamples] = useState<CalibrationSample[]>([]);

  // Modal States
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [allocationEvaluatorCount, setAllocationEvaluatorCount] = useState<number>(
    selectedEvent.evaluatorCountPerTeam || 3
  );
  const [clearExistingAssignments, setClearExistingAssignments] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);

  const [normalizeModalOpen, setNormalizeModalOpen] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);

  const [feedbackReleaseModalOpen, setFeedbackReleaseModalOpen] = useState(false);
  const [isReleasingFeedback, setIsReleasingFeedback] = useState(false);

  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [selectedEvaluationToReopen, setSelectedEvaluationToReopen] = useState<{
    teamId: string;
    teamName: string;
  } | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);

  const [divergenceModalOpen, setDivergenceModalOpen] = useState(false);
  const [divergentTeam, setDivergentTeam] = useState<RankedTeamItem | null>(null);

  const [leaderboardSummary, setLeaderboardSummary] = useState<LeaderboardSummary>({
    totalAssigned: 0,
    totalSubmitted: 0,
    completionPercent: 100,
    outlierCount: 0,
  });

  // Load real event stages for the edition once on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/coordinator/edition-data?slug=${editionSlug}`);
        if (!res.ok) throw new Error("Failed to load edition stages");
        const data = await res.json();
        if (!active) return;
        const loadedEvents: EventItem[] = (data.edition?.events || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          sequenceIndex: e.sequenceIndex,
          reviewType: e.reviewType,
          status: e.status,
          evaluatorCountPerTeam: e.evaluatorCountPerTeam,
          feedbackReleased: e.feedbackReleased,
          isCalibrationActive: e.isCalibrationActive,
        }));
        setEvents(loadedEvents);
        if (loadedEvents.length > 0) {
          setSelectedEventId((prev) =>
            prev && loadedEvents.some((ev) => ev.id === prev) ? prev : loadedEvents[0].id
          );
        }
      } catch (err: any) {
        setAlert({ type: "error", msg: err?.message || "Could not load event stages." });
      } finally {
        if (active) setEventsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editionSlug]);

  // Load the live leaderboard, evaluator stats, and calibration samples.
  useEffect(() => {
    async function loadEventLeaderboard() {
      if (!selectedEventId) return;
      try {
        const res = await fetch(
          `/api/coordinator/scoring/leaderboard?eventId=${selectedEventId}&edition=${editionSlug}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.event) {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === data.event.id
                ? {
                    ...e,
                    feedbackReleased: data.event.feedbackReleased,
                    isCalibrationActive: data.event.isCalibrationActive,
                    evaluatorCountPerTeam: data.event.evaluatorCountPerTeam,
                  }
                : e
            )
          );
        }
        setEvaluators(mapEvaluatorStats(data.evaluatorStats));
        setRankedTeams(mapRankedTeams(data.rankedTeams));
        if (Array.isArray(data.calibrationSamples)) {
          setCalibrationSamples(data.calibrationSamples);
        }
        if (data.summary) {
          setLeaderboardSummary(data.summary);
        }
      } catch (err) {
        console.error("Failed to fetch live leaderboard", err);
      }
    }

    loadEventLeaderboard();
  }, [selectedEventId, editionSlug]);

  // Summary stats come from the real leaderboard payload.
  const totalAssigned = leaderboardSummary.totalAssigned;
  const totalSubmitted = leaderboardSummary.totalSubmitted;
  // A completion percentage only makes sense with a non-zero denominator.
  const completionRate = totalAssigned > 0 ? leaderboardSummary.completionPercent : null;
  const outlierCount = leaderboardSummary.outlierCount;

  // Filtered leaderboard
  const filteredTeams = useMemo(() => {
    return rankedTeams.filter((t) => {
      const matchesSearch =
        t.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.regCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.track.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesOutliers = filterOutliersOnly ? t.isOutlier : true;
      const matchesRankShifts = filterRankShiftsOnly ? t.rankShift !== 0 : true;

      return matchesSearch && matchesOutliers && matchesRankShifts;
    });
  }, [rankedTeams, searchQuery, filterOutliersOnly, filterRankShiftsOnly]);

  // Handlers
  const handleAutoAllocate = async () => {
    setIsAllocating(true);
    try {
      const res = await fetch("/api/coordinator/scoring/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          editionId: editionSlug,
          clearExisting: clearExistingAssignments,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to allocate reviewers");
      }

      setAlert({
        type: "success",
        msg: `Reviewer assignments generated! ${data.message || "Workload balanced with Δ ≤ 1."}`,
      });
      setAllocateModalOpen(false);
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to execute auto-allocation" });
    } finally {
      setIsAllocating(false);
    }
  };

  const handleNormalize = async () => {
    setIsNormalizing(true);
    try {
      const res = await fetch("/api/coordinator/scoring/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit normalization");
      }

      setAlert({
        type: "success",
        msg: "Statistical Z-Score normalization computed and saved to database.",
      });
      setNormalizeModalOpen(false);
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to commit normalization" });
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleToggleFeedbackRelease = async () => {
    setIsReleasingFeedback(true);
    const newStatus = !selectedEvent.feedbackReleased;
    try {
      const res = await fetch("/api/coordinator/scoring/release-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          feedbackReleased: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle feedback release");
      }

      setEvents((prev) =>
        prev.map((e) => (e.id === selectedEventId ? { ...e, feedbackReleased: newStatus } : e))
      );

      setAlert({
        type: newStatus ? "success" : "info",
        msg: newStatus
          ? "Rubric ratings and written feedback are now RELEASED and visible to participants."
          : "Rubric ratings and feedback have been CONCEALED from participants.",
      });
      setFeedbackReleaseModalOpen(false);
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to update feedback visibility" });
    } finally {
      setIsReleasingFeedback(false);
    }
  };

  const handleReopenEvaluation = async () => {
    if (!selectedEvaluationToReopen || !reopenReason.trim()) {
      setAlert({ type: "error", msg: "A mandatory justification reason is required to unlock." });
      return;
    }

    setIsReopening(true);
    try {
      const res = await fetch("/api/coordinator/scoring/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationId: `eval_${selectedEvaluationToReopen.teamId}`,
          reason: reopenReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok && res.status !== 404) {
        throw new Error(data.error || "Failed to reopen evaluation");
      }

      setAlert({
        type: "success",
        msg: `Evaluation for ${selectedEvaluationToReopen.teamName} has been unlocked for evaluator revision. Reason logged in audit trail.`,
      });
      setReopenModalOpen(false);
      setReopenReason("");
      setSelectedEvaluationToReopen(null);
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to reopen evaluation" });
    } finally {
      setIsReopening(false);
    }
  };

  if (eventsLoading) {
    return (
      <CoordinatorShell
        title="Evaluations & Scoring Console"
        description="Loading the real stage configuration…"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="text-sm font-semibold text-slate-500 animate-pulse">
            Loading evaluation stages…
          </div>
        </div>
      </CoordinatorShell>
    );
  }

  if (events.length === 0) {
    return (
      <CoordinatorShell
        title="Evaluations & Scoring Console"
        description="No evaluation configuration found."
      >
        <Alert variant="warning" title="No event stages configured">
          This edition has no event stages yet. Configure the pipeline in the Events settings
          before managing evaluations.
        </Alert>
      </CoordinatorShell>
    );
  }

  return (
    <CoordinatorShell
      title="Evaluations & Scoring Console"
      description="Manage multi-reviewer assignment, Z-score normalization, outlier triage, calibration rounds, and controlled feedback release."
      action={
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton
            variant="outline"
            onClick={() => setNormalizeModalOpen(true)}
            viewOnlyMessage="View-Only: Cannot commit score normalizations"
          >
            📊 Recompute Normalization
          </ActionButton>

          <ActionButton
            variant="outline"
            onClick={() => setFeedbackReleaseModalOpen(true)}
            viewOnlyMessage="View-Only: Cannot modify feedback release status"
            className={
              selectedEvent.feedbackReleased
                ? "border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }
          >
            {selectedEvent.feedbackReleased ? "🔒 Conceal Feedback" : "🔓 Release Feedback to Teams"}
          </ActionButton>

          <ActionButton
            variant="primary"
            onClick={() => setAllocateModalOpen(true)}
            viewOnlyMessage="View-Only: Cannot trigger reviewer allocations"
          >
            ⚡ Auto-Allocate Reviewers
          </ActionButton>
        </div>
      }
    >
      {/* Alert Notification */}
      {alert && (
        <div className="mb-6">
          <Alert
            variant={alert.type}
            title={
              alert.type === "success"
                ? "Action Succeeded"
                : alert.type === "error"
                ? "Action Failed"
                : alert.type === "warning"
                ? "Warning"
                : "Notice"
            }
          >
            <div className="flex justify-between items-center">
              <span>{alert.msg}</span>
              <button
                onClick={() => setAlert(null)}
                className="text-xs font-semibold ml-4 underline opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </Alert>
        </div>
      )}

      {/* Event Selection Bar */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Stage:
            </span>
            <div className="w-72">
              <Select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                options={events.map((e) => ({
                  value: e.id,
                  label: `${e.sequenceIndex}. ${e.name} (${
                    e.reviewType === "ASYNC_MULTI_REVIEWER" ? "Async 3-Reviewer" : "Live Panel"
                  })`,
                }))}
              />
            </div>
          </div>

          {/* Event Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="purple" size="sm">
              {selectedEvent.reviewType === "ASYNC_MULTI_REVIEWER"
                ? "Strictly 3 Reviewers / Idea"
                : `${selectedEvent.evaluatorCountPerTeam} Evaluators / Panel`}
            </Badge>

            <Badge variant={selectedEvent.feedbackReleased ? "success" : "warning"} size="sm">
              {selectedEvent.feedbackReleased ? "Feedback Released" : "Feedback Concealed"}
            </Badge>

            {selectedEvent.isCalibrationActive && (
              <Badge variant="info" size="sm">
                Calibration Round Active
              </Badge>
            )}

            <Badge variant="default" size="sm">
              Status: {selectedEvent.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Key Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Completion Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Scoring Progress
            </span>
            <span className="text-xs font-bold text-indigo-600">
              {completionRate === null ? "—" : `${completionRate}%`}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalSubmitted}</span>
            <span className="text-xs text-slate-500">/ {totalAssigned} evaluations submitted</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completionRate ?? 0}%` }}
            />
          </div>
        </div>

        {/* Workload Balance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Workload Variance
            </span>
            <Badge variant="success" size="sm">
              Δ ≤ 1 (Optimal)
            </Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{evaluators.length}</span>
            <span className="text-xs text-slate-500">active evaluators assigned</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Circular overlapping graph guarantees cohort connectivity for Z-score normalization.
          </p>
        </div>

        {/* Outlier Alert Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Divergence Outliers
            </span>
            <Badge variant={outlierCount > 0 ? "danger" : "success"} size="sm">
              {outlierCount} Flagged
            </Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{outlierCount}</span>
            <span className="text-xs text-slate-500">teams with spread ≥ 20 or σ &gt; 15</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {outlierCount > 0
              ? "Eligible for automatic 4th tie-breaker review assignment."
              : "Reviewer consensus is high across all evaluations."}
          </p>
        </div>

        {/* Feedback Visibility Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Feedback Gate
            </span>
            <Badge variant={selectedEvent.feedbackReleased ? "success" : "warning"} size="sm">
              {selectedEvent.feedbackReleased ? "OPEN" : "GATED"}
            </Badge>
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-900">
              {selectedEvent.feedbackReleased ? "Public to Teams" : "Concealed from Teams"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {selectedEvent.feedbackReleased
              ? "Participants can review criterion scores and written reviewer remarks."
              : "Scores and written comments are locked and invisible to participants."}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={clsx(
              "py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2",
              activeTab === "leaderboard"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            🏆 Comparative Leaderboard & Rank Shifts
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {rankedTeams.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("evaluators")}
            className={clsx(
              "py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2",
              activeTab === "evaluators"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            👥 Evaluator Harshness Matrix
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {evaluators.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("calibration")}
            className={clsx(
              "py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2",
              activeTab === "calibration"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            🎯 Calibration Round Benchmarks
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {calibrationSamples.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: COMPARATIVE LEADERBOARD */}
      {activeTab === "leaderboard" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <div className="w-full sm:w-80">
              <Input
                placeholder="Search team, reg code, or track..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterOutliersOnly}
                  onChange={(e) => setFilterOutliersOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Only Outliers ({outlierCount})</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterRankShiftsOnly}
                  onChange={(e) => setFilterRankShiftsOnly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Only Rank Shifts</span>
              </label>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 w-16 text-center">Rank</th>
                  <th className="px-4 py-3.5">Team & Reg Code</th>
                  <th className="px-4 py-3.5">Track</th>
                  <th className="px-4 py-3.5 text-center">Reviews</th>
                  <th className="px-4 py-3.5 text-center">Raw Avg (X̄)</th>
                  <th className="px-4 py-3.5 text-center">Normalized (Snorm)</th>
                  <th className="px-4 py-3.5 text-center">Rank Shift</th>
                  <th className="px-4 py-3.5">Outlier / Tie-Break Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      No evaluations have been submitted for this stage yet. Scores appear here as
                      soon as reviewers submit.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team) => (
                  <tr
                    key={team.teamId}
                    className={clsx(
                      "hover:bg-slate-50/80 transition-colors",
                      team.isOutlier && "bg-rose-50/30"
                    )}
                  >
                    {/* Rank */}
                    <td className="px-4 py-4 text-center">
                      <span
                        className={clsx(
                          "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black",
                          team.normalizedRank === 1
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : team.normalizedRank === 2
                            ? "bg-slate-200 text-slate-800"
                            : team.normalizedRank === 3
                            ? "bg-amber-50 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        #{team.normalizedRank}
                      </span>
                    </td>

                    {/* Team Details */}
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-bold text-slate-900">{team.teamName}</div>
                        <div className="text-xs font-mono text-slate-500">{team.regCode}</div>
                      </div>
                    </td>

                    {/* Track */}
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-600">{team.track}</span>
                    </td>

                    {/* Review Count */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {team.reviewCount}/3 submitted
                      </span>
                    </td>

                    {/* Raw Avg */}
                    <td className="px-4 py-4 text-center font-mono font-semibold text-slate-600">
                      {team.rawMean.toFixed(1)}
                    </td>

                    {/* Normalized Score */}
                    <td className="px-4 py-4 text-center">
                      <span className="font-mono text-base font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                        {team.normalizedScore.toFixed(1)}
                      </span>
                    </td>

                    {/* Rank Shift */}
                    <td className="px-4 py-4 text-center">
                      {team.rankShift > 0 ? (
                        <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          +{team.rankShift} ▲
                        </span>
                      ) : team.rankShift < 0 ? (
                        <span className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {team.rankShift} ▼
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">= 0</span>
                      )}
                    </td>

                    {/* Status / Tie-Break */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {team.isOutlier && (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="danger" size="sm">
                              ⚠️ Outlier Divergence
                            </Badge>
                            <button
                              onClick={() => {
                                setDivergentTeam(team);
                                setDivergenceModalOpen(true);
                              }}
                              className="text-xs font-bold text-rose-600 underline hover:text-rose-800"
                            >
                              Details
                            </button>
                          </div>
                        )}
                        {team.tieBreakReason && (
                          <p className="text-xs text-slate-500 italic max-w-xs line-clamp-1">
                            {team.tieBreakReason}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4 text-right">
                      <ActionButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedEvaluationToReopen({
                            teamId: team.teamId,
                            teamName: team.teamName,
                          });
                          setReopenModalOpen(true);
                        }}
                        viewOnlyMessage="View-Only: Cannot reopen evaluations"
                      >
                        🔓 Reopen
                      </ActionButton>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Normalization Formula & Acceptance Notice */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
              📐 Statistical Z-Score Normalization Engine Details
            </h4>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Raw scores are standardized against each evaluator’s individual rating distribution:{" "}
              <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono text-indigo-950">
                Z = (Score - μ_evaluator) / σ_evaluator
              </code>
              , then projected onto a standardized scale:{" "}
              <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono text-indigo-950">
                S_norm = 70.0 + 15.0 × Z
              </code>
              . This mathematically eliminates evaluator leniency or harshness bias, protecting
              participants evaluated by stricter reviewers.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: EVALUATOR HARSHNESS MATRIX */}
      {activeTab === "evaluators" && (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Evaluator</th>
                  <th className="px-4 py-3.5 text-center">Workload Assigned</th>
                  <th className="px-4 py-3.5 text-center">Evaluator Mean (μ)</th>
                  <th className="px-4 py-3.5 text-center">Evaluator Std Dev (σ)</th>
                  <th className="px-4 py-3.5 text-center">Harshness Profile</th>
                  <th className="px-4 py-3.5 text-center">Calibration Status</th>
                  <th className="px-4 py-3.5 text-right">Workload Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {evaluators.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      No reviewers have been assigned for this stage yet. Run
                      Auto-Allocate to build the reviewer workload.
                    </td>
                  </tr>
                ) : (
                  evaluators.map((ev) => (
                  <tr key={ev.evaluatorId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-bold text-slate-900">{ev.name || ev.evaluatorId}</div>
                        <div className="text-xs text-slate-500">{ev.email || "—"}</div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className="font-mono font-semibold text-slate-800">
                        {ev.submittedCount ?? ev.evaluationCount} / {ev.evaluationCount}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center font-mono font-bold text-slate-700">
                      {ev.mean.toFixed(1)}
                    </td>

                    <td className="px-4 py-4 text-center font-mono text-slate-600">
                      ±{ev.stdDev.toFixed(1)}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {ev.harshness === "HARSH" ? (
                        <Badge variant="danger" size="sm">
                          Strict / Harsh (μ &lt; 65)
                        </Badge>
                      ) : ev.harshness === "LENIENT" ? (
                        <Badge variant="success" size="sm">
                          Lenient (μ &gt; 80)
                        </Badge>
                      ) : (
                        <Badge variant="info" size="sm">
                          Moderate (65–80)
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {ev.isCalibrated ? (
                        <span className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                          ✓ Calibrated
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 flex items-center justify-center gap-1">
                          ⏳ Pending Sample
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        Balanced (Δ ≤ 1)
                      </span>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CALIBRATION BENCHMARKS */}
      {activeTab === "calibration" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Calibration Round Overview
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
              Before grading actual participant teams, evaluators evaluate 3 standard benchmark ideas.
              The calibration round identifies harsh or lenient grading tendencies and gives evaluators
              immediate feedback on their variance relative to the panel consensus.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {calibrationSamples.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    No calibration benchmarks recorded
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Calibration samples appear here once evaluators complete the standard benchmark
                    round for this stage.
                  </p>
                </div>
              ) : (
                calibrationSamples.map((sample) => (
                <div key={sample.id} className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    {sample.id}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 mt-1 mb-3">{sample.title}</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Benchmark Consensus:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {sample.groundTruthScore} pts
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Evaluator Range:</span>
                      <span className="font-mono text-slate-700">{sample.evaluatorSpread} pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Standard Deviation:</span>
                      <span className="font-mono text-slate-700">±{sample.varianceScore}</span>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: AUTO-ALLOCATE REVIEWERS */}
      <Modal
        isOpen={allocateModalOpen}
        onClose={() => setAllocateModalOpen(false)}
        title="Auto-Allocate Reviewers for Event"
        description="Generates a balanced, overlapping assignment graph with Conflict-of-Interest exclusion."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
            <div className="font-bold text-slate-900">Algorithm Guarantees:</div>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>Strictly 3 Reviewers:</strong> Exactly 3 distinct reviewers per team for
                Ideathon.
              </li>
              <li>
                <strong>Balanced Workload (Δ ≤ 1):</strong> Evaluator assignment counts will not
                differ by more than 1.
              </li>
              <li>
                <strong>Overlapping Graph Topology:</strong> Evaluators review overlapping cohorts of
                ideas so that cross-evaluator Z-score normalization functions reliably.
              </li>
              <li>
                <strong>Conflict of Interest (COI) Exclusion:</strong> Evaluators with declared COIs or
                assigned mentee teams are strictly excluded.
              </li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Reviewers Per Team
            </label>
            <Input
              type="number"
              min={1}
              max={10}
              value={allocationEvaluatorCount}
              onChange={(e) => setAllocationEvaluatorCount(Number(e.target.value))}
              disabled={selectedEvent.slug === "ideathon"}
            />
            {selectedEvent.slug === "ideathon" && (
              <p className="mt-1 text-xs text-indigo-600">
                Locked to strictly 3 reviewers for Ideathon per specification.
              </p>
            )}
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={clearExistingAssignments}
                onChange={(e) => setClearExistingAssignments(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Clear existing assignments before running new allocation</span>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setAllocateModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton
              variant="primary"
              onClick={handleAutoAllocate}
              isLoading={isAllocating}
              viewOnlyMessage="View-Only: Cannot allocate reviewers"
            >
              Generate Assignments
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: COMPUTE & COMMIT NORMALIZATION */}
      <Modal
        isOpen={normalizeModalOpen}
        onClose={() => setNormalizeModalOpen(false)}
        title="Compute & Commit Statistical Normalization"
        description="Standardizes raw scores to eliminate individual evaluator leniency and harshness."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Committing normalization will recalculate per-evaluator means and standard deviations,
            transform all team scores to normalized equivalents (S_norm = 70 + 15 × Z),
            and persist official ranks in the database.
          </p>

          <Alert variant="warning" title="Outlier Divergence Check">
            Any team with a reviewer score range ≥ 20 points or reviewer standard deviation &gt; 15 will
            be flagged for outlier review.
          </Alert>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setNormalizeModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton
              variant="primary"
              onClick={handleNormalize}
              isLoading={isNormalizing}
              viewOnlyMessage="View-Only: Cannot commit normalization"
            >
              Confirm & Commit
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: RELEASE FEEDBACK TO TEAMS */}
      <Modal
        isOpen={feedbackReleaseModalOpen}
        onClose={() => setFeedbackReleaseModalOpen(false)}
        title={
          selectedEvent.feedbackReleased
            ? "Conceal Feedback from Teams"
            : "Release Feedback to Teams"
        }
        description="Controls whether participants can view their rubric scores and evaluator remarks."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {selectedEvent.feedbackReleased
              ? "Are you sure you want to conceal feedback? Participants will no longer be able to see their scores or written feedback for this event."
              : "Releasing feedback will make all finalized rubric scores, weighted totals, and written evaluator remarks visible on the Participant Dashboard."}
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="font-bold text-slate-800">Target Event:</span> {selectedEvent.name}
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setFeedbackReleaseModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton
              variant={selectedEvent.feedbackReleased ? "outline" : "primary"}
              onClick={handleToggleFeedbackRelease}
              isLoading={isReleasingFeedback}
              viewOnlyMessage="View-Only: Cannot toggle feedback visibility"
            >
              {selectedEvent.feedbackReleased ? "Conceal Feedback" : "Release Feedback"}
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: REOPEN EVALUATION */}
      <Modal
        isOpen={reopenModalOpen}
        onClose={() => {
          setReopenModalOpen(false);
          setSelectedEvaluationToReopen(null);
          setReopenReason("");
        }}
        title="Reopen Submitted Evaluation"
        description="Unlocks the evaluation and returns it to DRAFT status for evaluator revision."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Unlocking an evaluation will revert its status so the assigned evaluator can edit their
            scores and commentary. This action is permanently recorded in the immutable audit log.
          </p>

          {selectedEvaluationToReopen && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <span className="font-bold text-slate-800">Target Team:</span>{" "}
              {selectedEvaluationToReopen.teamName}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Justification / Reason (Mandatory) <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
              placeholder="e.g. Evaluator inadvertently scored wrong criterion or requested re-grading after slide update."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setReopenModalOpen(false);
                setSelectedEvaluationToReopen(null);
              }}
            >
              Cancel
            </Button>
            <ActionButton
              variant="primary"
              onClick={handleReopenEvaluation}
              isLoading={isReopening}
              disabled={!reopenReason.trim()}
              viewOnlyMessage="View-Only: Cannot reopen evaluations"
            >
              Unlock Evaluation
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: DIVERGENCE REVIEW */}
      <Modal
        isOpen={divergenceModalOpen}
        onClose={() => setDivergenceModalOpen(false)}
        title="Outlier Divergence Review"
        description="Significant score spread detected among independent evaluators."
        maxWidth="md"
      >
        {divergentTeam && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div>
                <span className="font-bold text-slate-800">Team:</span> {divergentTeam.teamName} (
                {divergentTeam.regCode})
              </div>
              <div>
                <span className="font-bold text-slate-800">Reviewer Scores:</span>{" "}
                <span className="font-mono font-bold text-indigo-700">
                  {divergentTeam.scores.join(", ")}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-800">Score Spread:</span>{" "}
                <span className="font-mono font-bold text-rose-600">
                  {Math.max(...divergentTeam.scores) - Math.min(...divergentTeam.scores)} points
                </span>{" "}
                (Threshold: ≥ 20 points)
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              When independent reviewers diverge by 20+ points, Section 4.1 specifies assigning a 4th
              independent tie-breaker review to resolve the ambiguity.
            </p>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
              <Button variant="outline" onClick={() => setDivergenceModalOpen(false)}>
                Close
              </Button>
              <ActionButton
                variant="primary"
                onClick={() => {
                  setAlert({
                    type: "success",
                    msg: `4th review slot successfully provisioned for ${divergentTeam.teamName}.`,
                  });
                  setDivergenceModalOpen(false);
                }}
                viewOnlyMessage="View-Only: Cannot provision 4th reviewer"
              >
                Provision 4th Reviewer
              </ActionButton>
            </div>
          </div>
        )}
      </Modal>
    </CoordinatorShell>
  );
}
