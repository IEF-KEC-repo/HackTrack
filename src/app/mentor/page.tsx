"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";

type TeamHealth = "GREEN" | "YELLOW" | "RED";
type CheckInCadenceStatus = "ON_TRACK" | "CHECKIN_DUE" | "CHECKIN_OVERDUE";

interface EditionSummary {
  id: string;
  name: string;
  slug: string;
}

interface MentorContext {
  mentorId: string;
  edition: EditionSummary;
}

interface MentorTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MentorMilestone {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  source?: string;
  status: string;
  isOverdue: boolean;
  isDueSoon?: boolean;
  daysOverdue?: number;
  evidenceType?: string | null;
  evidenceUrl?: string | null;
  evidenceNotes?: string | null;
}

interface MentorCheckInRecord {
  id: string;
  teamId: string;
  mentorId?: string | null;
  meetingDate: string;
  health: TeamHealth;
  notes?: string | null;
  actionItems?: string | null;
  progressNotes?: string | null;
  blockers?: string | null;
  nextGoals?: string | null;
  evidenceUrl?: string | null;
  submittedByRole?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamArtifact {
  id: string;
  fileType: string;
  originalName: string;
  storedName: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  createdAt: string;
}

interface MentoredTeam {
  id: string;
  regCode: string;
  name: string;
  track?: string | null;
  status: string;
  currentHealth: TeamHealth;
  progress: {
    mandatoryTotal: number;
    mandatoryCompleted: number;
    mandatoryProgressPercent: number;
    customTotal: number;
    customCompleted: number;
    totalCompleted: number;
    totalMilestones: number;
    overallProgressPercent: number;
  };
  overdueCount: number;
  members: MentorTeamMember[];
  cadence: {
    daysSinceLastCheckIn: number | null;
    status: CheckInCadenceStatus;
    isOverdue: boolean;
    daysOverdue: number;
    daysRemaining: number;
    message: string;
  };
  latestCheckIn?: MentorCheckInRecord | null;
  milestones: MentorMilestone[];
  checkIns: MentorCheckInRecord[];
  artifacts: TeamArtifact[];
}

interface MentorTeamsResponse {
  edition: EditionSummary;
  mentorId: string;
  teams: MentoredTeam[];
  count: number;
}

const isTeamHealth = (value: string): value is TeamHealth =>
  value === "GREEN" || value === "YELLOW" || value === "RED";

export default function MentorCockpitPage() {
  // Remote data: GET /api/mentor/teams?edition=ht26
  const [mentorContext, setMentorContext] = useState<MentorContext | null>(null);
  const [assignedTeams, setAssignedTeams] = useState<MentoredTeam[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  // Log Check-In Modal State
  const [selectedTeam, setSelectedTeam] = useState<MentoredTeam | null>(null);
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkInActionItems, setCheckInActionItems] = useState("");
  const [checkInHealth, setCheckInHealth] = useState<TeamHealth>("GREEN");
  const [checkInMeetingDate, setCheckInMeetingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Inspector Modal State
  const [inspectTeam, setInspectTeam] = useState<MentoredTeam | null>(null);

  const loadTeams = useCallback(async () => {
    setIsLoadingTeams(true);
    setTeamsError(null);
    try {
      const res = await fetch("/api/mentor/teams?edition=ht26", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<MentorTeamsResponse> & {
        error?: string;
      };

      if (!res.ok || data.error) {
        setTeamsError(data.error || "Failed to load your assigned teams.");
        return;
      }

      setMentorContext({
        mentorId: data.mentorId ?? "",
        edition: data.edition ?? { id: "", name: "HackTrack", slug: "ht26" },
      });
      setAssignedTeams(data.teams ?? []);
    } catch {
      setTeamsError("Could not reach the mentor teams service. Please try again.");
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleOpenCheckInModal = (team: MentoredTeam) => {
    setSelectedTeam(team);
    setCheckInHealth(team.currentHealth);
    setCheckInNotes("");
    setCheckInActionItems("");
    setCheckInMeetingDate(new Date().toISOString().split("T")[0]);
    setCheckInError(null);
  };

  const closeCheckInModal = () => {
    setSelectedTeam(null);
    setCheckInError(null);
  };

  const handleSaveCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !checkInNotes.trim()) return;

    setIsSubmittingLog(true);
    setCheckInError(null);

    try {
      const res = await fetch("/api/mentor/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          notes: checkInNotes,
          actionItems: checkInActionItems || undefined,
          health: checkInHealth,
          meetingDate: checkInMeetingDate,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setCheckInError(data.error || "Failed to save the check-in record.");
        return;
      }

      setSelectedTeam(null);
      setCheckInNotes("");
      setCheckInActionItems("");
      // Refetch so health/cadence reflect the newly logged check-in.
      await loadTeams();
    } catch {
      setCheckInError("Could not reach the check-in service. Please try again.");
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const hasTeamsData = !isLoadingTeams && !teamsError;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
              Mentor Guidance Cockpit
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Logged in as {mentorContext ? `Mentor (${mentorContext.edition.name})` : "Mentor"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Assigned Teams & CPR Guidance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor rolling deliverables, review student progress reports, and log bi-weekly session notes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="purple">Strictly Isolated View</Badge>
          <span className="text-xs text-slate-400">
            You have access ONLY to teams assigned to your mentorship.
          </span>
        </div>
      </div>

      {/* Cohort Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Assigned Teams
          </span>
          <p className="text-3xl font-black text-slate-900">{hasTeamsData ? assignedTeams.length : "–"}</p>
          <p className="text-xs text-slate-400">Teams assigned to you for CPR rounds.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Health Distribution
          </span>
          {hasTeamsData ? (
            <div className="flex items-center gap-4 text-xs font-semibold pt-1">
              <span className="text-emerald-700">
                ● {assignedTeams.filter((t) => t.currentHealth === "GREEN").length} Green
              </span>
              <span className="text-amber-700">
                ▲ {assignedTeams.filter((t) => t.currentHealth === "YELLOW").length} Yellow
              </span>
              <span className="text-rose-700">
                ■ {assignedTeams.filter((t) => t.currentHealth === "RED").length} Red
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 pt-1">
              {isLoadingTeams ? "Loading health distribution…" : "Health data unavailable."}
            </p>
          )}
          <p className="text-xs text-slate-400">Red health alerts Coordinator for escalation.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Deliverable Alerts
          </span>
          <p className="text-3xl font-black text-rose-600">
            {hasTeamsData ? assignedTeams.reduce((acc, t) => acc + t.overdueCount, 0) : "–"}
          </p>
          <p className="text-xs text-slate-400">Total overdue items across your teams.</p>
        </div>
      </div>

      {/* Assigned Teams Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your Mentored Teams</h2>
            <p className="text-xs text-slate-500">
              Teams under your guidance for the active Continuous Project Review (CPR) cycle.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {isLoadingTeams ? "Loading…" : `${assignedTeams.length} team(s)`}
          </span>
        </div>

        {isLoadingTeams ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Loading your assigned teams…
          </div>
        ) : teamsError ? (
          <div className="p-6">
            <Alert variant="error" title="Unable to load assigned teams">
              {teamsError}
            </Alert>
          </div>
        ) : assignedTeams.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No teams are currently assigned to you for mentorship. Event coordinators handle team-to-mentor pairings.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignedTeams.map((team) => (
              <div
                key={team.id}
                className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
              >
                {/* Team Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded">
                      {team.regCode}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">{team.name}</h3>
                    <span className="text-xs text-slate-500 font-medium">({team.track})</span>

                    {/* Health Badge */}
                    <Badge
                      variant={
                        team.currentHealth === "GREEN"
                          ? "success"
                          : team.currentHealth === "YELLOW"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {team.currentHealth === "GREEN"
                        ? "● On Track (Green)"
                        : team.currentHealth === "YELLOW"
                        ? "▲ Needs Help (Yellow)"
                        : "■ Critical Blocker (Red)"}
                    </Badge>

                    {/* Overdue Badge */}
                    {team.overdueCount > 0 && (
                      <Badge variant="danger">⚠️ {team.overdueCount} Overdue Item(s)</Badge>
                    )}
                  </div>

                  {/* Team Members */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Roster:</span>
                    {team.members.map((m) => (
                      <span key={m.id} className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200">
                        {m.name} {m.role === "LEAD" ? "(Lead)" : ""}
                      </span>
                    ))}
                  </div>

                  {/* Latest Check-In Snippet */}
                  {team.latestCheckIn && (
                    <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 max-w-2xl">
                      <div className="flex items-center justify-between text-slate-500 pb-1">
                        <span className="font-semibold text-slate-700">
                          Last Session ({new Date(team.latestCheckIn.meetingDate).toLocaleDateString()}):
                        </span>
                        <span
                          className={`font-semibold ${
                            team.cadence.status === "CHECKIN_OVERDUE"
                              ? "text-rose-600"
                              : team.cadence.status === "CHECKIN_DUE"
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {team.cadence.message}
                        </span>
                      </div>
                      {team.latestCheckIn.notes && (
                        <p className="text-slate-600 italic">&quot;{team.latestCheckIn.notes}&quot;</p>
                      )}
                      {team.latestCheckIn.actionItems && (
                        <p className="text-indigo-900 font-semibold mt-1">
                          🎯 Action Items: {team.latestCheckIn.actionItems}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress Meter & Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 min-w-[200px]">
                  <div className="w-full text-right">
                    <div className="flex justify-between text-xs font-semibold text-slate-600 pb-1">
                      <span>Mandatory Progress</span>
                      <span className="text-indigo-600">{team.progress.mandatoryProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${team.progress.mandatoryProgressPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {team.progress.mandatoryCompleted} of {team.progress.mandatoryTotal} Mandatory Completed
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setInspectTeam(team)}>
                      Inspect Milestones
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleOpenCheckInModal(team)}>
                      Log Meeting Notes
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Log Check-In */}
      <Modal
        isOpen={!!selectedTeam}
        onClose={closeCheckInModal}
        title={`Log Meeting Check-In: ${selectedTeam?.name} (${selectedTeam?.regCode})`}
      >
        <form onSubmit={handleSaveCheckIn} className="space-y-4">
          {checkInError && (
            <Alert variant="error" title="Check-in could not be saved">
              {checkInError}
            </Alert>
          )}

          <Input
            label="Meeting Date"
            type="date"
            required
            value={checkInMeetingDate}
            onChange={(e) => setCheckInMeetingDate(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Official Technical Health Rating (Sets Team Standing)
            </label>
            <select
              value={checkInHealth}
              onChange={(e) => {
                if (isTeamHealth(e.target.value)) setCheckInHealth(e.target.value);
              }}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600 font-medium"
            >
              <option value="GREEN">🟢 Green — On Track (Healthy progress towards CPR gate)</option>
              <option value="YELLOW">🟡 Yellow — Needs Attention (Minor delays, needs coordinator visibility)</option>
              <option value="RED">🔴 Red — Critical Blocker (At high risk of CPR disqualification)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mentor Meeting Notes & Guidance (Required)
            </label>
            <textarea
              rows={3}
              required
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="What technical challenges were discussed? Guidance provided on architecture/hardware?"
              value={checkInNotes}
              onChange={(e) => setCheckInNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Action Items for Team
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="Specific tasks team must deliver prior to next check-in session..."
              value={checkInActionItems}
              onChange={(e) => setCheckInActionItems(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={closeCheckInModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmittingLog}>
              Save Check-In Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Inspect Team Milestones & Proof */}
      <Modal
        isOpen={!!inspectTeam}
        onClose={() => setInspectTeam(null)}
        title={`Deliverables: ${inspectTeam?.name} (${inspectTeam?.regCode})`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {inspectTeam?.milestones.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No milestones have been recorded for this team yet.
            </div>
          ) : (
            inspectTeam?.milestones.map((m) => (
              <div key={m.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">{m.title}</span>
                  <Badge variant={m.status === "COMPLETED" ? "success" : m.isOverdue ? "danger" : "default"}>
                    {m.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">Due: {m.dueDate}</p>
                {m.evidenceUrl && (
                  <p className="text-xs text-indigo-700 break-all">
                    🔗 Evidence Link:{" "}
                    <a href={m.evidenceUrl} target="_blank" rel="noreferrer" className="underline">
                      {m.evidenceUrl}
                    </a>
                  </p>
                )}
                {m.evidenceNotes && (
                  <p className="text-xs text-slate-600 italic">Notes: {m.evidenceNotes}</p>
                )}
              </div>
            ))
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setInspectTeam(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}