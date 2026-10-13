"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";

type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
type MilestoneSource = "COORDINATOR_MANDATORY" | "TEAM_CUSTOM";
type TeamHealth = "GREEN" | "YELLOW" | "RED";

interface TeamMentor {
  id: string;
  name: string;
  email: string;
}

interface TeamInfo {
  id: string;
  name: string;
  regCode: string;
  track?: string | null;
  mentor?: TeamMentor | null;
}

interface MilestoneEvent {
  id: string;
  name: string;
  slug: string;
}

interface MilestoneItem {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  source: MilestoneSource;
  status: MilestoneStatus;
  isOverdue: boolean;
  isDueSoon: boolean;
  daysOverdue: number;
  hoursRemaining: number;
  event?: MilestoneEvent | null;
  evidenceUrl?: string | null;
  evidenceNotes?: string | null;
}

interface CheckInRecord {
  id: string;
  meetingDate: string;
  health: TeamHealth;
  progressNotes?: string | null;
  blockers?: string | null;
  nextGoals?: string | null;
  evidenceUrl?: string | null;
  notes?: string | null;
  actionItems?: string | null;
  submittedByRole: string;
  createdAt: string;
  mentor?: TeamMentor | null;
}

interface CadenceSummary {
  daysSinceLastCheckIn: number | null;
  status: "ON_TRACK" | "CHECKIN_DUE" | "CHECKIN_OVERDUE";
  isOverdue: boolean;
  daysOverdue: number;
  daysRemaining: number;
  message: string;
}

interface ProgressSummary {
  mandatoryTotal: number;
  mandatoryCompleted: number;
  mandatoryProgressPercent: number;
  customTotal: number;
  customCompleted: number;
  totalCompleted: number;
  totalMilestones: number;
  overallProgressPercent: number;
}

interface MyTeamResponse {
  team: TeamInfo;
  milestones: MilestoneItem[];
  progress: ProgressSummary;
  cadence: CadenceSummary;
  checkInsCount: number;
}

/** Client-side mirror of evaluateMilestoneDueStatus for locally patched milestones. */
function evaluateDueStatus(
  dueDate: string,
  status: MilestoneStatus
): Pick<MilestoneItem, "isOverdue" | "isDueSoon" | "daysOverdue" | "hoursRemaining"> {
  if (status === "COMPLETED") {
    return { isOverdue: false, isDueSoon: false, daysOverdue: 0, hoursRemaining: 0 };
  }

  const diffMs = new Date(dueDate).getTime() - Date.now();

  if (diffMs < 0) {
    const daysOverdue = Math.max(1, Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
    return { isOverdue: true, isDueSoon: false, daysOverdue, hoursRemaining: 0 };
  }

  const hoursRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
  return {
    isOverdue: false,
    isDueSoon: hoursRemaining <= 48,
    daysOverdue: 0,
    hoursRemaining,
  };
}

export default function TeamMilestonesPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "MANDATORY" | "CUSTOM" | "OVERDUE">("ALL");

  // Data (populated from the real API in useEffect)
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [cadence, setCadence] = useState<CadenceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customDueDate, setCustomDueDate] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneItem | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [checkInProgress, setCheckInProgress] = useState("");
  const [checkInBlockers, setCheckInBlockers] = useState("");
  const [checkInNextGoals, setCheckInNextGoals] = useState("");
  const [checkInHealth, setCheckInHealth] = useState<TeamHealth>("GREEN");
  const [checkInEvidenceUrl, setCheckInEvidenceUrl] = useState("");
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const loadTeamMilestones = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setLoadError(null);

    try {
      const res = await fetch("/api/milestones/my-team", { cache: "no-store" });
      const data = (await res.json()) as MyTeamResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load your team milestones.");
      }

      setTeam(data.team);
      setMilestones(data.milestones);
      setProgress(data.progress);
      setCadence(data.cadence);

      // Full check-in history lives behind a dedicated endpoint on the same route file.
      try {
        const histRes = await fetch(
          `/api/milestones/checkin-history?teamId=${encodeURIComponent(data.team.id)}`,
          { cache: "no-store" }
        );
        const histData = (await histRes.json()) as { checkIns: CheckInRecord[] };
        if (histRes.ok) {
          setCheckIns(histData.checkIns);
        } else {
          setCheckIns([]);
        }
      } catch {
        setCheckIns([]);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load your team milestones.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeamMilestones();
  }, [loadTeamMilestones]);

  // Calculations
  const mandatoryMilestones = milestones.filter((m) => m.source === "COORDINATOR_MANDATORY");
  const mandatoryTotal = progress?.mandatoryTotal ?? mandatoryMilestones.length;
  const mandatoryCompleted =
    progress?.mandatoryCompleted ??
    mandatoryMilestones.filter((m) => m.status === "COMPLETED").length;
  const hasMandatoryMilestones = mandatoryTotal > 0;
  const progressPercent = progress?.mandatoryProgressPercent ?? 0;

  const overdueCount = milestones.filter((m) => m.isOverdue).length;

  // Cadence evaluation (server-computed via checkin-service)
  const isCheckInOverdue = cadence?.isOverdue ?? false;
  const isCheckInDue = !isCheckInOverdue && cadence?.status === "CHECKIN_DUE";
  const lastCheckInLabel =
    cadence?.daysSinceLastCheckIn == null
      ? "No check-in logged yet (14-day cycle)."
      : `Last check-in logged ${cadence.daysSinceLastCheckIn} day${
          cadence.daysSinceLastCheckIn === 1 ? "" : "s"
        } ago (14-day cycle).`;

  // Filtered Milestones
  const filteredMilestones = milestones.filter((m) => {
    if (activeTab === "MANDATORY") return m.source === "COORDINATOR_MANDATORY";
    if (activeTab === "CUSTOM") return m.source === "TEAM_CUSTOM";
    if (activeTab === "OVERDUE") return m.isOverdue;
    return true;
  });

  // Handlers
  const patchMilestoneLocally = (updated: MilestoneItem) => {
    const due = evaluateDueStatus(updated.dueDate, updated.status);
    setMilestones((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated, ...due } : m)));
  };

  const handleAddCustomMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !customTitle || !customDueDate) return;

    setIsCreatingCustom(true);
    setCustomError(null);

    try {
      const res = await fetch("/api/milestones/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          title: customTitle,
          description: customDescription || undefined,
          dueDate: new Date(customDueDate).toISOString(),
        }),
      });
      const data = (await res.json()) as { milestone: MilestoneItem; error?: string };
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create the custom milestone.");
      }

      const created = data.milestone;
      const due = evaluateDueStatus(created.dueDate, created.status);
      setMilestones((prev) => [...prev, { ...created, ...due }]);
      setCustomTitle("");
      setCustomDescription("");
      setCustomDueDate("");
      setIsAddCustomOpen(false);

      // Re-sync server-computed progress/cadence after the team gained a milestone.
      void loadTeamMilestones(false);
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Failed to create the custom milestone.");
    } finally {
      setIsCreatingCustom(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: MilestoneStatus) => {
    // Optimistic update for snappy dropdown UX.
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: newStatus,
              isOverdue: newStatus === "COMPLETED" ? false : m.isOverdue,
              isDueSoon: newStatus === "COMPLETED" ? false : m.isDueSoon,
            }
          : m
      )
    );

    try {
      const res = await fetch("/api/milestones/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMilestoneId: id, status: newStatus }),
      });
      const data = (await res.json()) as { milestone: MilestoneItem; error?: string };
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update milestone status.");
      }
      patchMilestoneLocally(data.milestone);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update milestone status.");
      // Revert to server truth so UI does not mask the failure.
      void loadTeamMilestones(false);
    }
  };

  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestone) return;

    setIsSavingEvidence(true);
    setEvidenceError(null);

    try {
      const res = await fetch("/api/milestones/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamMilestoneId: selectedMilestone.id,
          status: "COMPLETED",
          evidenceUrl: evidenceUrl || undefined,
          evidenceNotes: evidenceNotes || undefined,
        }),
      });
      const data = (await res.json()) as { milestone: MilestoneItem; error?: string };
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save evidence.");
      }

      patchMilestoneLocally(data.milestone);
      setSelectedMilestone(null);
      setEvidenceUrl("");
      setEvidenceNotes("");
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : "Failed to save evidence.");
    } finally {
      setIsSavingEvidence(false);
    }
  };

  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !checkInProgress) return;

    setIsSubmittingCheckIn(true);
    setCheckInError(null);

    try {
      const res = await fetch("/api/milestones/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          progressNotes: checkInProgress,
          blockers: checkInBlockers || undefined,
          nextGoals: checkInNextGoals || undefined,
          health: checkInHealth,
          evidenceUrl: checkInEvidenceUrl || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit check-in.");
      }

      setCheckInProgress("");
      setCheckInBlockers("");
      setCheckInNextGoals("");
      setCheckInEvidenceUrl("");
      setIsCheckInOpen(false);

      // Re-sync cadence + timeline with server data.
      void loadTeamMilestones(false);
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Failed to submit check-in.");
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Loading team milestones & check-ins…</p>
          <p className="text-xs text-slate-400">Fetching live data from the HackTrack server.</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Alert variant="error" title="Unable to Load Milestones">
          {loadError}
        </Alert>
        <div>
          <Button variant="primary" size="sm" onClick={() => void loadTeamMilestones()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Alert variant="warning" title="No Team Found">
          You are not currently assigned to a team with milestones enabled.
        </Alert>
        <div>
          <Button variant="primary" size="sm" onClick={() => void loadTeamMilestones()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              {team.regCode}
            </span>
            {team.track && (
              <span className="text-xs text-slate-500 font-medium">({team.track})</span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {team.name} — Rolling Milestones & Check-Ins
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Continuous Project Review (CPR) deliverables, proof of work evidence, and fortnightly mentor guidance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/team">
            <Button variant="outline" size="sm">
              ← Idea & Team Settings
            </Button>
          </Link>
          <Button variant="primary" size="sm" onClick={() => setIsCheckInOpen(true)}>
            📝 Submit Fortnightly Check-In
          </Button>
        </div>
      </div>

      {actionError && (
        <Alert variant="error" title="Update Failed">
          {actionError}
        </Alert>
      )}

      {/* Progress & Mentorship Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Mandatory Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mandatory Milestone Progress
            </span>
            <Badge
              variant={
                !hasMandatoryMilestones
                  ? "default"
                  : progressPercent === 100
                  ? "success"
                  : progressPercent >= 50
                  ? "info"
                  : "warning"
              }
            >
              {hasMandatoryMilestones ? `${progressPercent}% Complete` : "—"}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{mandatoryCompleted}</span>
            <span className="text-sm font-medium text-slate-500">/ {mandatoryTotal} Completed</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${hasMandatoryMilestones ? progressPercent : 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            {hasMandatoryMilestones
              ? "Official milestone completion percentage determines gate progression into POC."
              : "No mandatory milestones have been defined by the coordinator yet."}
          </p>
        </div>

        {/* Card 2: Overdue Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Attention & Overdue
            </span>
            <Badge variant={overdueCount > 0 ? "danger" : "success"}>
              {overdueCount > 0 ? `⚠️ ${overdueCount} Overdue` : "All Clear"}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${overdueCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {overdueCount}
            </span>
            <span className="text-sm font-medium text-slate-500">Overdue Deliverables</span>
          </div>
          <p className="text-xs text-slate-400">
            {overdueCount > 0
              ? "Overdue milestones negatively impact your CPR evaluation score."
              : "No overdue deliverables. Great cadence!"}
          </p>
        </div>

        {/* Card 3: Fortnightly Cadence & Mentor */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fortnightly Review
            </span>
            <Badge
              variant={
                isCheckInOverdue
                  ? "danger"
                  : isCheckInDue
                  ? "warning"
                  : "success"
              }
            >
              {isCheckInOverdue
                ? "Overdue"
                : isCheckInDue
                ? "Check-In Due"
                : "On Track"}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {team.mentor ? team.mentor.name : "No mentor assigned"}
            </p>
            <p className="text-xs text-slate-500">Assigned Faculty Mentor</p>
          </div>
          <p className="text-xs text-slate-500">{lastCheckInLabel}</p>
        </div>
      </div>

      {/* Overdue Alert Banner if active */}
      {isCheckInOverdue && (
        <Alert
          variant="error"
          title="Fortnightly Mentor Check-In Overdue"
        >
          {cadence?.message || "Your team has not submitted a check-in within the 14-day window."} Please submit your accomplishments and blockers immediately to maintain good standing.
        </Alert>
      )}

      {/* Milestones Checklist Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Milestone Deliverables & Evidence</h2>
            <p className="text-xs text-slate-500">
              Submit proof-of-work (GitHub commit, Figma diagram, or reference link) to mark items complete.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("ALL")}
                className={`rounded-md px-3 py-1 transition-colors ${
                  activeTab === "ALL" ? "bg-white text-indigo-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({milestones.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("MANDATORY")}
                className={`rounded-md px-3 py-1 transition-colors ${
                  activeTab === "MANDATORY" ? "bg-white text-indigo-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mandatory ({mandatoryTotal})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("CUSTOM")}
                className={`rounded-md px-3 py-1 transition-colors ${
                  activeTab === "CUSTOM" ? "bg-white text-indigo-700 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Custom ({milestones.filter((m) => m.source === "TEAM_CUSTOM").length})
              </button>
              {overdueCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("OVERDUE")}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    activeTab === "OVERDUE" ? "bg-rose-50 text-rose-700 shadow-sm font-bold" : "text-rose-600 hover:text-rose-900"
                  }`}
                >
                  Overdue ({overdueCount})
                </button>
              )}
            </div>

            <Button variant="secondary" size="sm" onClick={() => setIsAddCustomOpen(true)}>
              + Add Custom Milestone
            </Button>
          </div>
        </div>

        {/* Milestones List */}
        {filteredMilestones.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {activeTab === "ALL"
                ? "No milestones defined yet"
                : activeTab === "OVERDUE"
                ? "No overdue milestones 🎉"
                : `No ${activeTab === "MANDATORY" ? "mandatory" : "custom"} milestones`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === "CUSTOM"
                ? "Create your first team-defined milestone with the button above."
                : activeTab === "ALL"
                ? "Coordinator-defined and team custom milestones will appear here once created."
                : "Your team is all caught up."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMilestones.map((m) => (
              <div key={m.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={m.source === "COORDINATOR_MANDATORY" ? "purple" : "default"}>
                      {m.source === "COORDINATOR_MANDATORY" ? "Mandatory" : "Team Custom"}
                    </Badge>

                    {m.event && (
                      <Badge variant="default">{m.event.name}</Badge>
                    )}

                    {m.isOverdue && (
                      <Badge variant="danger">
                        🚨 Overdue ({m.daysOverdue} day{m.daysOverdue! > 1 ? "s" : ""})
                      </Badge>
                    )}

                    {m.isDueSoon && (
                      <Badge variant="warning">
                        ⏳ Due Soon ({m.hoursRemaining}h remaining)
                      </Badge>
                    )}

                    <h3 className="font-semibold text-slate-900 text-sm">{m.title}</h3>
                  </div>

                  {m.description && <p className="text-xs text-slate-600 max-w-2xl">{m.description}</p>}

                  {/* Evidence snippet */}
                  {m.status === "COMPLETED" && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        ✓ Evidence Provided:
                      </span>
                      {m.evidenceUrl && (
                        <a
                          href={m.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 underline font-mono hover:text-indigo-800 break-all"
                        >
                          {m.evidenceUrl}
                        </a>
                      )}
                      {m.evidenceNotes && (
                        <span className="text-slate-500 italic">({m.evidenceNotes})</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Status and Action Controls */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-medium">Due Date</span>
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {new Date(m.dueDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={m.status}
                    onChange={(e) => handleUpdateStatus(m.id, e.target.value as MilestoneStatus)}
                    className={`rounded-md border text-xs font-semibold px-2.5 py-1.5 focus:outline-none focus:ring-1 ${
                      m.status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : m.status === "IN_PROGRESS"
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : m.status === "BLOCKED"
                        ? "bg-rose-50 text-rose-800 border-rose-300"
                        : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMilestone(m);
                      setEvidenceUrl(m.evidenceUrl || "");
                      setEvidenceNotes(m.evidenceNotes || "");
                      setEvidenceError(null);
                    }}
                  >
                    {m.status === "COMPLETED" ? "Edit Evidence" : "Attach Proof"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fortnightly Check-In Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fortnightly Check-In History</h2>
            <p className="text-xs text-slate-500">
              Bi-weekly reports submitted by your team and official notes from faculty mentor.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setIsCheckInOpen(true)}>
            + Submit New Check-In
          </Button>
        </div>

        {checkIns.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <p className="text-xs text-slate-400">
              No check-ins logged yet. Submit your first fortnightly report.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {checkIns.map((ci) => (
              <div key={ci.id} className="rounded-lg border border-slate-200 p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {new Date(ci.meetingDate).toLocaleDateString()}
                    </span>
                    <Badge
                      variant={
                        ci.health === "GREEN"
                          ? "success"
                          : ci.health === "YELLOW"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {ci.health === "GREEN" ? "● Green (On Track)" : ci.health === "YELLOW" ? "▲ Yellow (Needs Help)" : "■ Red (Blocked)"}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400">
                    {ci.mentor ? `Logged by ${ci.mentor.name}` : "Submitted by your team"}
                  </span>
                </div>

                {ci.progressNotes && (
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                      Team Progress & Accomplishments:
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">{ci.progressNotes}</p>
                  </div>
                )}

                {ci.blockers && (
                  <div className="bg-rose-50/70 p-2.5 rounded border border-rose-100">
                    <span className="text-xs font-bold text-rose-800 uppercase tracking-wide block">
                      Blockers / Challenges:
                    </span>
                    <p className="text-xs text-rose-700 mt-0.5">{ci.blockers}</p>
                  </div>
                )}

                {ci.notes && (
                  <div className="bg-indigo-50/60 p-2.5 rounded border border-indigo-100">
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide block">
                      Mentor Feedback & Guidance:
                    </span>
                    <p className="text-xs text-indigo-800 mt-0.5">{ci.notes}</p>
                    {ci.actionItems && (
                      <p className="text-xs text-indigo-950 font-semibold mt-1">
                        🎯 Action Items: {ci.actionItems}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add Custom Milestone */}
      <Modal
        isOpen={isAddCustomOpen}
        onClose={() => setIsAddCustomOpen(false)}
        title="Add Team-Defined Milestone"
      >
        <form onSubmit={handleAddCustomMilestone} className="space-y-4">
          {customError && <Alert variant="error" title="Creation Failed">{customError}</Alert>}

          <Input
            label="Milestone Title"
            required
            placeholder="e.g., Fabricate PCB testbench / User Testing Round 1"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Acceptance Criteria
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="What must be completed for this milestone?"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
            />
          </div>

          <Input
            label="Target Due Date"
            type="date"
            required
            value={customDueDate}
            onChange={(e) => setCustomDueDate(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsAddCustomOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isCreatingCustom}>
              Save Milestone
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Attach Evidence (External Link) */}
      <Modal
        isOpen={!!selectedMilestone}
        onClose={() => setSelectedMilestone(null)}
        title={`Attach Evidence: ${selectedMilestone?.title}`}
      >
        <form onSubmit={handleSaveEvidence} className="space-y-4">
          {evidenceError && <Alert variant="error" title="Unable to Save Evidence">{evidenceError}</Alert>}

          <Input
            label="Evidence URL"
            required
            type="url"
            placeholder="https://github.com/..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            hint="Link to a public PR, GitHub commit, Figma design, or demo video."
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Submission Remarks / Verification Notes
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="Explain how this evidence fulfills the milestone criteria..."
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setSelectedMilestone(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSavingEvidence}>
              Mark Completed & Attach Evidence
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Submit Fortnightly Check-in */}
      <Modal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        title="Submit Fortnightly Check-In Report"
      >
        <form onSubmit={handleSubmitCheckIn} className="space-y-4">
          {checkInError && <Alert variant="error" title="Submission Failed">{checkInError}</Alert>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Progress & Accomplishments Since Last Check-In (Required)
            </label>
            <textarea
              rows={3}
              required
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="What key technical milestones did your team complete during the past 2 weeks?"
              value={checkInProgress}
              onChange={(e) => setCheckInProgress(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Blockers / Challenges Encountered (Where do you need faculty help?)
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="Equipment access, algorithmic bottlenecks, debugging assistance..."
              value={checkInBlockers}
              onChange={(e) => setCheckInBlockers(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Targets & Goals for Next Fortnight
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="What will your team achieve in the next 14 days?"
              value={checkInNextGoals}
              onChange={(e) => setCheckInNextGoals(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Team Health Self-Assessment
            </label>
            <select
              value={checkInHealth}
              onChange={(e) => setCheckInHealth(e.target.value as TeamHealth)}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600 font-medium"
            >
              <option value="GREEN">🟢 Green — On Track, meeting all sprint targets</option>
              <option value="YELLOW">🟡 Yellow — Minor delay or technical challenge, need guidance</option>
              <option value="RED">🔴 Red — Critically blocked or at risk of missing review gate</option>
            </select>
          </div>

          <Input
            label="Proof Link / Demo Video URL"
            type="url"
            placeholder="https://..."
            value={checkInEvidenceUrl}
            onChange={(e) => setCheckInEvidenceUrl(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsCheckInOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmittingCheckIn}>
              Submit Check-In
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}