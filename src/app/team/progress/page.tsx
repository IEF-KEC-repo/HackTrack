"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";

// ---------- Local type definitions (mirror GET /api/milestones/my-team) ----------

type CadenceStatus = "ON_TRACK" | "CHECKIN_DUE" | "CHECKIN_OVERDUE";
type HealthStatus = "GREEN" | "YELLOW" | "RED";
type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
type MilestoneSource = "COORDINATOR_MANDATORY" | "TEAM_CUSTOM";

interface MentorInfo {
  id: string;
  name: string;
  email: string;
}

interface TeamMemberInfo {
  id: string;
  role?: string | null;
  user: { id: string; name: string; email: string };
}

interface TeamInfo {
  id: string;
  name: string;
  regCode: string;
  track: string | null;
  mentor: MentorInfo | null;
  members: TeamMemberInfo[];
  slidesUrl: string | null;
  embedSlidesUrl: string | null;
}

interface EventInfo {
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
  evidenceUrl?: string | null;
  evidenceNotes?: string | null;
  event?: EventInfo | null;
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

interface CadenceSummary {
  daysSinceLastCheckIn: number | null;
  status: CadenceStatus;
  isOverdue: boolean;
  daysOverdue: number;
  daysRemaining: number;
  message: string;
}

interface LatestCheckIn {
  id: string;
  meetingDate: string;
  createdAt: string;
  health: HealthStatus;
  notes?: string | null;
  progressNotes?: string | null;
  blockers?: string | null;
  nextGoals?: string | null;
  evidenceUrl?: string | null;
  submittedByRole: string;
  mentor?: MentorInfo | null;
}

interface MyTeamProgressResponse {
  team: TeamInfo;
  milestones: MilestoneItem[];
  progress: ProgressSummary;
  latestCheckIn: LatestCheckIn | null;
  cadence: CadenceSummary;
  checkInsCount: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function ParticipantProgressPage() {
  // ---- Server data (populated on mount) ----
  const [data, setData] = useState<MyTeamProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Fortnightly check-in submission form ----
  const [progressNotes, setProgressNotes] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextGoals, setNextGoals] = useState("");
  const [health, setHealth] = useState<HealthStatus>("GREEN");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchTeamProgress = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/milestones/my-team");
      if (!res.ok) {
        let message = `Failed to load team progress (HTTP ${res.status}).`;
        try {
          const body: { error?: string } = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // Non-JSON error body — keep the HTTP status message.
        }
        throw new Error(message);
      }
      const body: MyTeamProgressResponse = await res.json();
      setData(body);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load team progress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamProgress();
  }, [fetchTeamProgress]);

  const team = data?.team;
  const milestones = data?.milestones ?? [];
  const progress = data?.progress ?? null;
  const cadence = data?.cadence ?? null;
  const latestCheckIn = data?.latestCheckIn ?? null;

  const overdueCount = milestones.filter((m) => m.isOverdue).length;
  const dueSoonCount = milestones.filter((m) => m.isDueSoon).length;

  const handleSubmitCheckIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!team) return;
    if (!progressNotes.trim()) {
      setFormError("Progress summary is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch("/api/milestones/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          progressNotes: progressNotes.trim(),
          blockers: blockers.trim(),
          nextGoals: nextGoals.trim(),
          health,
          evidenceUrl: evidenceUrl.trim(),
        }),
      });
      const body: { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to submit check-in.");
      }

      setProgressNotes("");
      setBlockers("");
      setNextGoals("");
      setEvidenceUrl("");
      setHealth("GREEN");
      setFormSuccess("Fortnightly check-in submitted. Mentorship cadence updated.");
      await fetchTeamProgress();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to submit check-in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Display mappings ----

  const cadenceBadge = (() => {
    switch (cadence?.status) {
      case "CHECKIN_OVERDUE":
        return { variant: "danger" as const, label: "Check-In Overdue" };
      case "CHECKIN_DUE":
        return { variant: "warning" as const, label: "Check-In Due" };
      case "ON_TRACK":
        return { variant: "success" as const, label: "On Track" };
      default:
        return null;
    }
  })();

  const cadencePanelStyles =
    cadence?.status === "CHECKIN_OVERDUE"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : cadence?.status === "CHECKIN_DUE"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-emerald-50 border-emerald-200 text-emerald-900";

  const healthBadge = (value?: HealthStatus) => {
    switch (value) {
      case "RED":
        return { variant: "danger" as const, label: "■ Red (Blocked)" };
      case "YELLOW":
        return { variant: "warning" as const, label: "▲ Yellow (Needs Help)" };
      case "GREEN":
        return { variant: "success" as const, label: "● Green (On Track)" };
      default:
        return { variant: "default" as const, label: "—" };
    }
  };

  const statusBadge = (status: MilestoneStatus) => {
    switch (status) {
      case "COMPLETED":
        return { variant: "success" as const, label: "Completed" };
      case "IN_PROGRESS":
        return { variant: "info" as const, label: "In Progress" };
      case "BLOCKED":
        return { variant: "danger" as const, label: "Blocked" };
      default:
        return { variant: "default" as const, label: "Not Started" };
    }
  };

  const progressBadge =
    progress && progress.totalMilestones === 0
      ? { variant: "default" as const, label: "No Milestones Yet" }
      : overdueCount > 0
      ? { variant: "danger" as const, label: `🚨 ${overdueCount} Overdue` }
      : progress && progress.overallProgressPercent >= 100
      ? { variant: "success" as const, label: "100% Complete" }
      : { variant: "info" as const, label: `${progress?.overallProgressPercent ?? 0}% Complete` };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                <span>Track: {team?.track ?? "—"}</span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                Milestone Progress: {team?.name ?? "Loading…"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Official registration code:{" "}
                <span className="font-mono font-bold text-slate-800">{team?.regCode ?? "—"}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/team">
                <Button variant="secondary" size="sm">
                  Team Hub & Profile
                </Button>
              </Link>
              <Link href="/team/milestones">
                <Button variant="secondary" size="sm">
                  Milestone Board
                </Button>
              </Link>
              <Link href="/results">
                <Button variant="primary" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  🏆 View Published Results
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Loading state */}
        {loading && (
          <Alert variant="info" title="Loading team progress">
            Fetching your team&apos;s milestones, check-ins, and mentorship cadence…
          </Alert>
        )}

        {/* Error state */}
        {!loading && loadError && (
          <Alert variant="error" title="Unable to load team progress">
            <div className="space-y-2">
              <p>{loadError}</p>
              <Button size="sm" variant="secondary" onClick={fetchTeamProgress}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* Empty state: authenticated user is not on a team */}
        {!loading && !loadError && !team && (
          <Alert variant="error" title="No team found">
            No active team is linked to your account. Join or create a team before viewing progress.
          </Alert>
        )}

        {!loading && !loadError && team && (
          <>
            {/* Overdue check-in alert (real cadence data) */}
            {cadence?.status === "CHECKIN_OVERDUE" && (
              <Alert variant="error" title="Fortnightly Check-In Overdue">
                <p>{cadence.message}</p>
                <p className="mt-1">
                  Submit your latest progress report below to restore good standing with your assigned mentor.
                </p>
              </Alert>
            )}

            {/* Milestone Progress Pipeline */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Milestone Progress Overview</h2>
                  <p className="text-xs text-slate-500">
                    Mandatory and team-defined deliverables with live due-status tracking
                  </p>
                </div>
                <Badge variant={progressBadge.variant} size="sm">
                  {progressBadge.label}
                </Badge>
              </div>

              {/* Progress summary strip */}
              {progress && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Mandatory
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-black text-slate-900">
                          {progress.mandatoryCompleted}
                        </span>
                        <span className="text-xs text-slate-500">/ {progress.mandatoryTotal} done</span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Team Custom
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-black text-slate-900">
                          {progress.customCompleted}
                        </span>
                        <span className="text-xs text-slate-500">/ {progress.customTotal} done</span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Overdue
                      </div>
                      <div
                        className={`mt-1 text-xl font-black ${
                          overdueCount > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {overdueCount}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Due Soon
                      </div>
                      <div
                        className={`mt-1 text-xl font-black ${
                          dueSoonCount > 0 ? "text-amber-600" : "text-slate-400"
                        }`}
                      >
                        {dueSoonCount}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">Overall Completion</span>
                      <span className="font-semibold text-indigo-700">
                        {progress.overallProgressPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, progress.overallProgressPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Milestone cards */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {milestones.length === 0 ? (
                  <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    No milestones assigned yet. Coordinator-defined deliverables will appear here once
                    published for your team.
                  </div>
                ) : (
                  milestones.map((m) => {
                    const isDone = m.status === "COMPLETED";
                    const isActive = m.status === "IN_PROGRESS";
                    const sb = statusBadge(m.status);

                    return (
                      <div
                        key={m.id}
                        className={`rounded-lg border p-4 transition-all relative ${
                          isActive
                            ? "border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-sm"
                            : isDone
                            ? "border-emerald-200 bg-white"
                            : "border-slate-200 bg-slate-50/50 opacity-80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-500 truncate">
                            {m.event ? `Stage: ${m.event.name}` : "Deliverable"}
                          </span>
                          <Badge variant={sb.variant} size="sm">
                            {sb.label}
                          </Badge>
                        </div>

                        <h3 className="mt-2 font-bold text-slate-900 text-sm">{m.title}</h3>
                        {m.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                        )}

                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">
                              Due:{" "}
                              <strong className="text-slate-700">
                                {new Date(m.dueDate).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </strong>
                            </span>
                            <Badge
                              variant={m.source === "COORDINATOR_MANDATORY" ? "purple" : "default"}
                              size="sm"
                            >
                              {m.source === "COORDINATOR_MANDATORY" ? "Mandatory" : "Team Custom"}
                            </Badge>
                          </div>

                          {m.isOverdue && (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold px-2 py-0.5">
                              🚨 Overdue{m.daysOverdue > 0 ? ` (${m.daysOverdue}d)` : ""}
                            </span>
                          )}
                          {m.isDueSoon && !m.isOverdue && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 text-amber-700 font-semibold px-2 py-0.5">
                              ⏳ Due Soon{m.hoursRemaining >= 0 ? ` (${m.hoursRemaining}h)` : ""}
                            </span>
                          )}

                          {m.evidenceUrl && (
                            <a
                              href={m.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline font-mono text-[10px] block break-all"
                            >
                              View Evidence ↗
                            </a>
                          )}
                          {m.evidenceNotes && (
                            <p className="text-[11px] text-slate-500 italic">{m.evidenceNotes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Dual Grid: Google Slides Embed & Check-In / Mentor Column */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Live Google Slides Embed (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>📊 Google Slides Pitch Deck</span>
                      {team.embedSlidesUrl ? (
                        <Badge variant="success" size="sm">
                          Verified Public
                        </Badge>
                      ) : (
                        <Badge variant="default" size="sm">
                          Not Configured
                        </Badge>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Real-time preview rendered directly to assigned evaluators in their split-screen cockpit
                    </p>
                  </div>
                  {team.slidesUrl && (
                    <a href={team.slidesUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="secondary">
                        Open in Drive ↗
                      </Button>
                    </a>
                  )}
                </div>

                {team.embedSlidesUrl ? (
                  <>
                    <div className="mt-4 flex-1 min-h-[380px] bg-slate-900 rounded-lg overflow-hidden border border-slate-300 relative shadow-inner">
                      <iframe
                        src={team.embedSlidesUrl}
                        title="Google Slides Pitch Deck"
                        width="100%"
                        height="100%"
                        className="absolute inset-0 w-full h-full border-0"
                        allowFullScreen
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 text-center">
                      Evaluators review slides live during evaluation windows. Updates made in Google
                      Slides reflect immediately.
                    </p>
                  </>
                ) : (
                  <div className="mt-4 flex-1 min-h-[380px] rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <span className="text-3xl">📄</span>
                    <p className="text-xs font-semibold text-slate-700">No pitch deck configured yet</p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Set a public Google Slides URL in the Team Hub to enable live evaluator preview.
                    </p>
                    <Link href="/team">
                      <Button size="sm" variant="secondary">
                        Configure in Team Hub
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Right Column: Check-In Form & Mentor Cadence (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Fortnightly Check-In Submission Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Submit Fortnightly Check-In</h2>
                      <p className="text-xs text-slate-500">14-day self-report for your assigned mentor</p>
                    </div>
                    <Badge variant={cadenceBadge?.variant ?? "default"} size="sm">
                      {cadenceBadge?.label ?? "Cadence Pending"}
                    </Badge>
                  </div>

                  {formError && (
                    <div className="mt-3">
                      <Alert variant="error" title="Check-In Not Submitted">
                        {formError}
                      </Alert>
                    </div>
                  )}
                  {formSuccess && (
                    <div className="mt-3">
                      <Alert variant="success" title="Check-In Submitted">
                        {formSuccess}
                      </Alert>
                    </div>
                  )}

                  <form onSubmit={handleSubmitCheckIn} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Progress &amp; Accomplishments Since Last Check-In{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
                        placeholder="What key milestones did your team complete in the past 14 days?"
                        value={progressNotes}
                        onChange={(e) => setProgressNotes(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Blockers / Challenges Encountered
                      </label>
                      <textarea
                        rows={2}
                        className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
                        placeholder="Equipment access, algorithmic bottlenecks, debugging assistance…"
                        value={blockers}
                        onChange={(e) => setBlockers(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Targets &amp; Goals for Next Fortnight
                      </label>
                      <textarea
                        rows={2}
                        className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
                        placeholder="What will your team achieve in the next 14 days?"
                        value={nextGoals}
                        onChange={(e) => setNextGoals(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Team Health Self-Assessment
                      </label>
                      <select
                        value={health}
                        onChange={(e) => setHealth(e.target.value as HealthStatus)}
                        className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600 font-medium"
                      >
                        <option value="GREEN">🟢 Green — On Track, meeting all sprint targets</option>
                        <option value="YELLOW">🟡 Yellow — Minor delay, need guidance</option>
                        <option value="RED">🔴 Red — Critically blocked / at risk of review gate</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Proof Link / Demo Video URL
                      </label>
                      <input
                        type="url"
                        className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
                        placeholder="https://..."
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                      />
                    </div>

                    <Button variant="primary" size="sm" className="w-full" type="submit" isLoading={isSubmitting}>
                      Submit Check-In
                    </Button>
                  </form>
                </div>

                {/* Mentor Cadence Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Assigned Mentor &amp; Cadence</h2>
                      <p className="text-xs text-slate-500">Rolling milestones and guidance check-ins</p>
                    </div>
                    <Badge variant={cadenceBadge?.variant ?? "default"} size="sm">
                      {cadenceBadge?.label ?? "Cadence Pending"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3 text-xs">
                    {team.mentor ? (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                          {initials(team.mentor.name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900">{team.mentor.name}</h3>
                          <p className="text-[11px] font-mono text-indigo-600 truncate">
                            {team.mentor.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-slate-500">
                        No faculty mentor assigned yet.
                      </div>
                    )}

                    <div className={`rounded-lg border p-3 text-xs ${cadencePanelStyles}`}>
                      <div className="flex items-center justify-between font-semibold">
                        <span>Cadence: {cadenceBadge?.label ?? "Pending"}</span>
                        <span>
                          {cadence?.daysSinceLastCheckIn != null
                            ? `${cadence.daysSinceLastCheckIn} days since check-in`
                            : "No check-ins yet"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-90">
                        {cadence?.message ?? "Mandatory check-in required every 14 days."}
                      </p>
                      {cadence && cadence.daysRemaining > 0 && (
                        <p className="mt-1 text-[11px] font-semibold">
                          Next check-in due in {cadence.daysRemaining} days.
                        </p>
                      )}
                      <p className="mt-1 text-[11px] opacity-80">
                        Total check-ins logged: {data?.checkInsCount ?? 0}
                      </p>
                    </div>

                    {latestCheckIn ? (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-700 text-[11px]">Latest Check-In</div>
                          <Badge variant={healthBadge(latestCheckIn.health).variant} size="sm">
                            {healthBadge(latestCheckIn.health).label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono">
                            {new Date(latestCheckIn.createdAt).toLocaleDateString()}
                          </span>
                          <span>• Logged by {latestCheckIn.mentor?.name || "Team"}</span>
                        </div>
                        {latestCheckIn.progressNotes && (
                          <p className="text-slate-600 text-xs">
                            <strong>Progress:</strong> {latestCheckIn.progressNotes}
                          </p>
                        )}
                        {latestCheckIn.blockers && (
                          <p className="text-rose-700 text-xs">
                            <strong>Blockers:</strong> {latestCheckIn.blockers}
                          </p>
                        )}
                        {latestCheckIn.notes && (
                          <p className="text-indigo-800 text-xs italic">
                            &ldquo;{latestCheckIn.notes}&rdquo;
                          </p>
                        )}
                        {latestCheckIn.evidenceUrl && (
                          <a
                            href={latestCheckIn.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline font-mono text-[11px] block break-all"
                          >
                            View Evidence ↗
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-slate-500">
                        No check-ins logged yet. Submit your first fortnightly report above.
                      </div>
                    )}

                    {team.mentor && (
                      <a href={`mailto:${team.mentor.email}`} className="block w-full">
                        <Button variant="secondary" size="sm" className="w-full">
                          Request Mentor Office Hours / Check-In
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}