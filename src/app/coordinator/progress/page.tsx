"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CoordinatorShell, useCoordinator } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

interface MentorOption {
  id: string;
  name: string;
  email: string;
}

interface CohortTeamItem {
  id: string;
  regCode: string;
  name: string;
  track: string | null;
  status: string;
  mentor: { id: string; name: string; email: string } | null;
  progress: {
    mandatoryTotal: number;
    mandatoryCompleted: number;
    mandatoryProgressPercent: number;
  };
  overdueCount: number;
  currentHealth: "GREEN" | "YELLOW" | "RED";
  cadence: {
    daysSinceLastCheckIn: number | null;
    status: "ON_TRACK" | "CHECKIN_DUE" | "CHECKIN_OVERDUE";
    message: string;
  };
  latestCheckIn?: {
    meetingDate: string;
    health: "GREEN" | "YELLOW" | "RED";
    notes?: string;
  } | null;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string;
    isOverdue: boolean;
    evidenceUrl?: string;
  }>;
}

interface EventStage {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  status: string;
}

interface CohortResponse {
  edition: { id: string; name: string; slug: string };
  events: EventStage[];
  availableMentors: MentorOption[];
  cohortTeams: CohortTeamItem[];
}

export default function CoordinatorProgressPage() {
  const { isReadOnly, editionSlug } = useCoordinator();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState<string>("ALL");
  const [trackFilter, setTrackFilter] = useState<string>("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(
    null
  );

  // Remote Data
  const [loading, setLoading] = useState(true);
  const [editionId, setEditionId] = useState("");
  const [events, setEvents] = useState<EventStage[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [teams, setTeams] = useState<CohortTeamItem[]>([]);

  // Define Milestone Modal State
  const [isDefineModalOpen, setIsDefineModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDesc, setNewMilestoneDesc] = useState("");
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("");

  // Assign Mentor Modal State
  const [assignTeam, setAssignTeam] = useState<CohortTeamItem | null>(null);
  const [selectedMentorId, setSelectedMentorId] = useState("");

  // Inspect Modal State
  const [inspectTeam, setInspectTeam] = useState<CohortTeamItem | null>(null);

  // Load cohort progress, events, mentors & teams from the API
  const loadCohort = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coordinator/progress/cohort?edition=${editionSlug || "ht26"}`);
      const data: Partial<CohortResponse> & { error?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || data.error) {
        setNotification({
          type: "error",
          msg: data.error || "Failed to load cohort progress data.",
        });
        return;
      }

      setEditionId(data.edition?.id || "");
      setEvents(data.events || []);
      setMentors(data.availableMentors || []);
      setTeams(data.cohortTeams || []);
      setSelectedEventId((prev) => prev || data.events?.[0]?.id || "");
    } catch {
      setNotification({ type: "error", msg: "Failed to load cohort progress data." });
    } finally {
      setLoading(false);
    }
  }, [editionSlug]);

  useEffect(() => {
    loadCohort();
  }, [loadCohort]);

  // Define Mandatory Milestone Handler
  const handleDefineMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle || !newMilestoneDueDate || isReadOnly) return;

    const title = newMilestoneTitle;
    const description = newMilestoneDesc;
    const dueDate = new Date(newMilestoneDueDate).toISOString();

    try {
      const res = await fetch("/api/coordinator/progress/define-milestone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId,
          eventId: selectedEventId,
          title,
          description,
          dueDate,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotification({
          type: "error",
          msg: data?.error || "Failed to define mandatory milestone.",
        });
        return;
      }

      setNewMilestoneTitle("");
      setNewMilestoneDesc("");
      setNewMilestoneDueDate("");
      setIsDefineModalOpen(false);

      setNotification({
        type: "success",
        msg: `Mandatory milestone "${title}" created and propagated to all teams in edition.`,
      });
      await loadCohort();
    } catch {
      setNotification({ type: "error", msg: "Failed to define mandatory milestone." });
    }
  };

  // Assign Mentor Handler
  const handleAssignMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTeam || isReadOnly) return;

    const chosenMentor = mentors.find((m) => m.id === selectedMentorId) || null;
    const team = assignTeam;

    try {
      const res = await fetch("/api/coordinator/progress/assign-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, mentorId: selectedMentorId || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotification({
          type: "error",
          msg: data?.error || "Failed to update mentor assignment.",
        });
        return;
      }

      setNotification({
        type: "success",
        msg: chosenMentor
          ? `Assigned ${chosenMentor.name} as mentor to ${team.regCode} (${team.name}).`
          : `Unassigned mentor from ${team.regCode}.`,
      });

      setAssignTeam(null);
      setSelectedMentorId("");
      await loadCohort();
    } catch {
      setNotification({ type: "error", msg: "Failed to update mentor assignment." });
    }
  };

  // Run Overdue Scan
  const handleRunAlertsScan = async () => {
    if (isReadOnly) return;

    try {
      const res = await fetch("/api/coordinator/progress/run-alerts-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setNotification({
          type: "error",
          msg: data?.error || "Failed to run overdue alert scan.",
        });
        return;
      }

      const report = data?.report;

      setNotification({
        type: "info",
        msg: `Overdue scan completed: ${report?.overdueMilestones ?? 0} overdue deliverables and ${
          report?.overdueCheckInTeams ?? 0
        } overdue check-in teams flagged.`,
      });
      await loadCohort();
    } catch {
      setNotification({ type: "error", msg: "Failed to run overdue alert scan." });
    }
  };

  // Filtering
  const filteredTeams = teams.filter((t) => {
    if (healthFilter !== "ALL" && t.currentHealth !== healthFilter) return false;
    if (trackFilter !== "ALL" && t.track !== trackFilter) return false;
    if (overdueOnly && t.overdueCount === 0) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        t.name.toLowerCase().includes(q) ||
        t.regCode.toLowerCase().includes(q) ||
        t.mentor?.name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // KPIs
  const totalMandatorySum = teams.reduce((acc, t) => acc + t.progress.mandatoryTotal, 0);
  const totalMandatoryCompleted = teams.reduce((acc, t) => acc + t.progress.mandatoryCompleted, 0);
  const cohortAverageProgress =
    totalMandatorySum > 0 ? Math.round((totalMandatoryCompleted / totalMandatorySum) * 1000) / 10 : null;
  const totalOverdueItems = teams.reduce((acc, t) => acc + t.overdueCount, 0);
  const redTeamsCount = teams.filter((t) => t.currentHealth === "RED").length;
  const unassignedMentorsCount = teams.filter((t) => !t.mentor).length;

  return (
    <CoordinatorShell
      title="Cohort Milestone Progress & Mentorship Governance"
      description="Monitor mandatory deliverable completion and assign faculty mentors."
      action={
        <div className="flex gap-2">
          <ActionButton
            variant="outline"
            size="sm"
            onClick={handleRunAlertsScan}
            viewOnlyMessage="Scanning overdue flags modifies cohort alert state."
          >
            🔄 Run Overdue Alert Scan
          </ActionButton>
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => setIsDefineModalOpen(true)}
            viewOnlyMessage="Defining mandatory milestones propagates requirements to all teams."
          >
            + Define Mandatory Milestone
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Notification Alert */}
        {notification && (
          <Alert variant={notification.type === "error" ? "error" : "success"} title="Cohort Management Update">
            {notification.msg}
          </Alert>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm font-medium text-slate-500 shadow-sm">
            Loading cohort progress data…
          </div>
        ) : (
          <>
            {/* Cohort KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cohort Progress Average
                </span>
                <p className="text-3xl font-black text-indigo-600">
                  {cohortAverageProgress === null ? "—" : `${cohortAverageProgress}%`}
                </p>
                <p className="text-xs text-slate-400">
                  {totalMandatorySum > 0
                    ? `${totalMandatoryCompleted} / ${totalMandatorySum} total mandatory milestones delivered.`
                    : "No mandatory milestones defined across assigned teams."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Overdue Deliverables
                </span>
                <p className={`text-3xl font-black ${totalOverdueItems > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {totalOverdueItems}
                </p>
                <p className="text-xs text-slate-400">Milestones past due date across cohort.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Red Flagged Teams
                </span>
                <p className={`text-3xl font-black ${redTeamsCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {redTeamsCount}
                </p>
                <p className="text-xs text-slate-400">Teams flagged as critically blocked by mentors.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Mentorship Coverage
                </span>
                <p className={`text-3xl font-black ${unassignedMentorsCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {teams.length - unassignedMentorsCount} / {teams.length}
                </p>
                <p className="text-xs text-slate-400">
                  {unassignedMentorsCount > 0 ? `${unassignedMentorsCount} team(s) need mentor assignment.` : "100% paired with mentors."}
                </p>
              </div>
            </div>

            {/* Cohort Progress Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-4">
              <div className="border-b border-slate-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Cohort Team Deliverables & Standing</h2>
                  <p className="text-xs text-slate-500">
                    Track completion percentages, overdue items, mentor pairings, and technical health ratings.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search team, code, mentor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-600"
                  />

                  <select
                    value={healthFilter}
                    onChange={(e) => setHealthFilter(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium"
                  >
                    <option value="ALL">All Health Ratings</option>
                    <option value="GREEN">🟢 Green Only</option>
                    <option value="YELLOW">🟡 Yellow Only</option>
                    <option value="RED">🔴 Red Only</option>
                  </select>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overdueOnly}
                      onChange={(e) => setOverdueOnly(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Overdue Only
                  </label>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th scope="col" className="px-5 py-3 text-left">Team</th>
                      <th scope="col" className="px-5 py-3 text-left">Track</th>
                      <th scope="col" className="px-5 py-3 text-left">Assigned Mentor</th>
                      <th scope="col" className="px-5 py-3 text-left">Health</th>
                      <th scope="col" className="px-5 py-3 text-left">Mandatory Progress</th>
                      <th scope="col" className="px-5 py-3 text-center">Overdue</th>
                      <th scope="col" className="px-5 py-3 text-left">Cadence</th>
                      <th scope="col" className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Team */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {team.regCode}
                            </span>
                            <span className="font-bold text-slate-900">{team.name}</span>
                          </div>
                        </td>

                        {/* Track */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                          {team.track || "—"}
                        </td>

                        {/* Mentor */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {team.mentor ? (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{team.mentor.name}</span>
                              <ActionButton
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAssignTeam(team);
                                  setSelectedMentorId(team.mentor?.id || "");
                                }}
                                viewOnlyMessage="Reassigning mentors requires Coordinator Manage tier."
                              >
                                Edit
                              </ActionButton>
                            </div>
                          ) : (
                            <ActionButton
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAssignTeam(team);
                                setSelectedMentorId("");
                              }}
                              viewOnlyMessage="Assigning mentors requires Coordinator Manage tier."
                            >
                              + Assign Mentor
                            </ActionButton>
                          )}
                        </td>

                        {/* Health */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Badge
                            variant={
                              team.currentHealth === "GREEN"
                                ? "success"
                                : team.currentHealth === "YELLOW"
                                ? "warning"
                                : "danger"
                            }
                          >
                            {team.currentHealth === "GREEN" ? "● Green" : team.currentHealth === "YELLOW" ? "▲ Yellow" : "■ Red"}
                          </Badge>
                        </td>

                        {/* Mandatory Progress */}
                        <td className="px-5 py-3.5 whitespace-nowrap min-w-[150px]">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pb-1">
                            <span>
                              {team.progress.mandatoryTotal > 0
                                ? `${team.progress.mandatoryProgressPercent}%`
                                : "—"}
                            </span>
                            <span className="text-slate-400">
                              {team.progress.mandatoryCompleted}/{team.progress.mandatoryTotal}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full"
                              style={{
                                width: `${
                                  team.progress.mandatoryTotal > 0
                                    ? team.progress.mandatoryProgressPercent
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </td>

                        {/* Overdue */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          {team.overdueCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800">
                              {team.overdueCount}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">0</span>
                          )}
                        </td>

                        {/* Cadence */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`text-[11px] font-semibold ${
                              team.cadence.status === "CHECKIN_OVERDUE"
                                ? "text-rose-600"
                                : team.cadence.status === "CHECKIN_DUE"
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {team.cadence.message}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <Button variant="outline" size="sm" onClick={() => setInspectTeam(team)}>
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal: Define Mandatory Milestone */}
      <Modal
        isOpen={isDefineModalOpen}
        onClose={() => setIsDefineModalOpen(false)}
        title="Define Mandatory Milestone (Propagates to All Teams)"
      >
        <form onSubmit={handleDefineMilestone} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Event Stage
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600 font-medium"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  Stage {ev.sequenceIndex}: {ev.name} ({ev.status})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Milestone Title"
            required
            placeholder="e.g., Firmware INT4 Matrix Multiply Benchmark"
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deliverable Specifications / Verification Criteria
            </label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              placeholder="What evidence must students submit (GitHub commit tag, schematic PDF, BOM spreadsheet)?"
              value={newMilestoneDesc}
              onChange={(e) => setNewMilestoneDesc(e.target.value)}
            />
          </div>

          <Input
            label="Due Date"
            type="date"
            required
            value={newMilestoneDueDate}
            onChange={(e) => setNewMilestoneDueDate(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsDefineModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Propagate to All Teams
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Mentor */}
      <Modal
        isOpen={!!assignTeam}
        onClose={() => setAssignTeam(null)}
        title={`Assign Faculty Mentor: ${assignTeam?.name} (${assignTeam?.regCode})`}
      >
        <form onSubmit={handleAssignMentor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Registered Mentor
            </label>
            <select
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600 font-medium"
            >
              <option value="">-- No Mentor (Unassigned) --</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-500">
            Assigned mentors will have visibility into this team&apos;s rolling deliverables, check-in reports, and can log session notes.
          </p>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setAssignTeam(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Mentor Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Inspect Milestones */}
      <Modal
        isOpen={!!inspectTeam}
        onClose={() => setInspectTeam(null)}
        title={`Milestones & Check-Ins: ${inspectTeam?.name} (${inspectTeam?.regCode})`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div>
              <span className="text-xs text-slate-500">Assigned Mentor:</span>
              <p className="text-xs font-bold text-slate-900">{inspectTeam?.mentor?.name || "Unassigned"}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Health:</span>
              <Badge variant={inspectTeam?.currentHealth === "GREEN" ? "success" : inspectTeam?.currentHealth === "YELLOW" ? "warning" : "danger"}>
                {inspectTeam?.currentHealth}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            {inspectTeam?.milestones.map((m) => (
              <div key={m.id} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">{m.title}</span>
                  <Badge variant={m.status === "COMPLETED" ? "success" : m.isOverdue ? "danger" : "default"}>
                    {m.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">Due: {m.dueDate}</p>
                {m.evidenceUrl && (
                  <p className="text-xs text-indigo-700 break-all">
                    🔗 Evidence: <a href={m.evidenceUrl} target="_blank" rel="noreferrer" className="underline">{m.evidenceUrl}</a>
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setInspectTeam(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </CoordinatorShell>
  );
}
