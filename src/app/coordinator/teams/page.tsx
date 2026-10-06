"use client";

import { useState } from "react";
import { CoordinatorShell } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

interface TeamItem {
  id: string;
  regCode: string;
  name: string;
  track: string;
  leadName: string;
  memberCount: number;
  status: "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "SHORTLISTED" | "ELIMINATED";
  slidesUrl?: string;
  embedSlidesUrl?: string;
  problemStatement?: string;
  solutionAbstract?: string;
  techStack?: string;
  coordinatorFeedback?: string;
}

export default function CoordinatorTeamsPage() {
  const [teams, setTeams] = useState<TeamItem[]>([
    {
      id: "t1",
      regCode: "HT26-T001",
      name: "QuantumForge",
      track: "AI/ML & Edge Computing",
      leadName: "Priya Sharma",
      memberCount: 2,
      status: "SUBMITTED",
      slidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
      embedSlidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
      problemStatement: "High energy consumption and network latency in cloud AI inference for edge robotics.",
      solutionAbstract: "Neuromorphic edge acceleration algorithms with quantized INT4 inference pipelines.",
    },
    {
      id: "t2",
      regCode: "HT26-T002",
      name: "BioSentry AI",
      track: "Healthcare & Biotech",
      leadName: "Rohan Gupta",
      memberCount: 4,
      status: "SUBMITTED",
      slidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
      embedSlidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
      problemStatement: "Diagnostic delays in sepsis detection in neonatal emergency care units.",
      solutionAbstract: "Real-time non-invasive optical sensor analysis with predictive biomarker alarms.",
    },
    {
      id: "t3",
      regCode: "HT26-T003",
      name: "AeroGrid CleanTech",
      track: "Clean Energy & IoT",
      leadName: "Ananya Roy",
      memberCount: 3,
      status: "CHANGES_REQUESTED",
      slidesUrl: "",
      problemStatement: "Grid instability during renewable energy peak solar feed-in periods.",
      solutionAbstract: "Decentralized battery storage synchronization across campus solar micro-grids.",
      coordinatorFeedback: "Missing official Google Slides presentation deck. Please submit link before deadline.",
    },
    {
      id: "t4",
      regCode: "HT26-T004",
      name: "CyberShield Zero",
      track: "Cybersecurity",
      leadName: "Karthik Rajan",
      memberCount: 1,
      status: "DRAFT",
      problemStatement: "Credential stuffing attacks targeting legacy university portals.",
      solutionAbstract: "FIDO2 WebAuthn biometric layer with zero-trust device posture scoring.",
    },
  ]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [trackFilter, setTrackFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk Decision Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDecision, setBulkDecision] = useState<"SHORTLIST" | "REJECT">("SHORTLIST");
  const [bulkFilterType, setBulkFilterType] = useState<"TOP_N" | "PERCENTAGE" | "SELECTED">("TOP_N");
  const [bulkValue, setBulkValue] = useState<number>(2);
  const [bulkNote, setBulkNote] = useState("");

  // Single Team Change Request Modal
  const [changeReqModalOpen, setChangeReqModalOpen] = useState(false);
  const [selectedTeamForChanges, setSelectedTeamForChanges] = useState<TeamItem | null>(null);
  const [changeRemarks, setChangeRemarks] = useState("");

  // Inspect Idea Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectTeam, setInspectTeam] = useState<TeamItem | null>(null);

  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Filtered Teams
  const filteredTeams = teams.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.regCode.toLowerCase().includes(search.toLowerCase()) ||
      t.leadName.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchTrack = trackFilter === "ALL" || t.track === trackFilter;

    return matchSearch && matchStatus && matchTrack;
  });

  const toggleSelectTeam = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selectedIds.length === filteredTeams.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTeams.map((t) => t.id));
    }
  };

  // Execute Bulk Decision
  const handleExecuteBulk = () => {
    let targetIds: string[] = [];
    if (bulkFilterType === "SELECTED") {
      targetIds = selectedIds;
    } else if (bulkFilterType === "TOP_N") {
      targetIds = filteredTeams.slice(0, Math.max(0, bulkValue)).map((t) => t.id);
    } else if (bulkFilterType === "PERCENTAGE") {
      const count = Math.ceil((filteredTeams.length * Math.min(100, Math.max(0, bulkValue))) / 100);
      targetIds = filteredTeams.slice(0, count).map((t) => t.id);
    }

    if (targetIds.length === 0) {
      setNotification({ type: "error", msg: "No teams matched the selected bulk criteria." });
      return;
    }

    const updated = teams.map((t) => {
      if (targetIds.includes(t.id)) {
        return {
          ...t,
          status: bulkDecision === "SHORTLIST" ? ("SHORTLISTED" as const) : ("ELIMINATED" as const),
          coordinatorFeedback: bulkNote || undefined,
        };
      }
      return t;
    });

    setTeams(updated);
    setBulkModalOpen(false);
    setSelectedIds([]);
    setNotification({
      type: "success",
      msg: `Successfully ${bulkDecision.toLowerCase()}ed ${targetIds.length} team(s) with broadcast note.`,
    });
  };

  // Submit Request Changes
  const handleRequestChanges = () => {
    if (!selectedTeamForChanges || !changeRemarks.trim()) return;

    const updated = teams.map((t) => {
      if (t.id === selectedTeamForChanges.id) {
        return {
          ...t,
          status: "CHANGES_REQUESTED" as const,
          coordinatorFeedback: changeRemarks.trim(),
        };
      }
      return t;
    });

    setTeams(updated);
    setChangeReqModalOpen(false);
    setChangeRemarks("");
    setNotification({
      type: "success",
      msg: `Requested revisions from ${selectedTeamForChanges.name}. Team notified on their portal.`,
    });
  };

  const getStatusBadgeVariant = (st: string) => {
    switch (st) {
      case "SUBMITTED":
        return "info" as const;
      case "SHORTLISTED":
        return "success" as const;
      case "CHANGES_REQUESTED":
        return "warning" as const;
      case "ELIMINATED":
        return "danger" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <CoordinatorShell
      title="Team Directory & Idea Registry"
      description="Manage registered teams, review Google Slides embeds, request revisions, and execute bulk shortlist/reject cutoffs."
      action={
        <div className="flex gap-2">
          <ActionButton onClick={() => setBulkModalOpen(true)}>
            Bulk Decision Engine
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {notification && (
          <Alert variant={notification.type === "success" ? "success" : "error"} title="Operation Telemetry">
            {notification.msg}
          </Alert>
        )}

        {/* Filter & Search Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full md:w-auto">
            <Input
              placeholder="Search by team name, code (HT26-T001), or lead..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Select
              className="text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "SUBMITTED", label: "Submitted" },
                { value: "SHORTLISTED", label: "Shortlisted" },
                { value: "CHANGES_REQUESTED", label: "Changes Requested" },
                { value: "DRAFT", label: "Draft" },
                { value: "ELIMINATED", label: "Eliminated" },
              ]}
            />

            <Select
              className="text-xs"
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              options={[
                { value: "ALL", label: "All Tracks" },
                { value: "AI/ML & Edge Computing", label: "AI/ML & Edge" },
                { value: "Healthcare & Biotech", label: "Healthcare" },
                { value: "Clean Energy & IoT", label: "CleanTech" },
                { value: "Cybersecurity", label: "Cybersecurity" },
              ]}
            />
          </div>
        </div>

        {/* Teams Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.length > 0 && selectedIds.length === filteredTeams.length}
                onChange={selectAll}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700">
                {selectedIds.length > 0
                  ? `${selectedIds.length} team(s) selected`
                  : `Showing ${filteredTeams.length} teams`}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setBulkModalOpen(true)}>
                Apply Bulk Action to {selectedIds.length} Teams
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-700 text-xs">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3"></th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Team Code & Name</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Track & Roster</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Google Slides Embed</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-xs">
                {filteredTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(team.id)}
                        onChange={() => toggleSelectTeam(team.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-indigo-600">{team.regCode}</span>
                      <p className="font-bold text-slate-900 text-sm">{team.name}</p>
                      <p className="text-slate-500">Lead: {team.leadName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800 font-medium">{team.track || "Unassigned"}</p>
                      <p className="text-slate-500">{team.memberCount} of 6 members</p>
                    </td>
                    <td className="px-4 py-3">
                      {team.slidesUrl ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                          <span>✓</span>
                          <span>Deck Attached</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                          <span>⚠️</span>
                          <span>Missing Slides</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(team.status)} size="sm">
                        {team.status}
                      </Badge>
                      {team.coordinatorFeedback && (
                        <p className="mt-1 text-[11px] text-amber-800 line-clamp-1 italic">
                          &quot;{team.coordinatorFeedback}&quot;
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setInspectTeam(team);
                          setInspectModalOpen(true);
                        }}
                      >
                        Inspect
                      </Button>
                      <ActionButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedTeamForChanges(team);
                          setChangeRemarks(team.coordinatorFeedback || "");
                          setChangeReqModalOpen(true);
                        }}
                      >
                        Request Changes
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bulk Decision Modal */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Bulk Evaluation Decision Engine"
        description="Advance or eliminate cohorts of teams using percentile cutoffs, top rankings, or explicit selections."
      >
        <div className="space-y-4">
          <Select
            label="Decision Action"
            value={bulkDecision}
            onChange={(e) => setBulkDecision(e.target.value as any)}
            options={[
              { value: "SHORTLIST", label: "Shortlist (Advance to Innovatz Pitch & Unlock Step 2)" },
              { value: "REJECT", label: "Reject / Eliminate (Exit from active competition)" },
            ]}
          />

          <Select
            label="Target Cohort Filter"
            value={bulkFilterType}
            onChange={(e) => setBulkFilterType(e.target.value as any)}
            options={[
              { value: "TOP_N", label: "Top N Teams (e.g. Top 25, 50, 100)" },
              { value: "PERCENTAGE", label: "Top Percentage (e.g. Top 30% of cohort)" },
              { value: "SELECTED", label: `Selected Checkboxes (${selectedIds.length} teams selected)` },
            ]}
          />

          {bulkFilterType !== "SELECTED" && (
            <Input
              label={bulkFilterType === "TOP_N" ? "Number of Teams (Top N)" : "Percentage of Cohort (%)"}
              type="number"
              value={bulkValue}
              onChange={(e) => setBulkValue(Number(e.target.value))}
            />
          )}

          <div>
            <label htmlFor="bulk-note" className="block text-sm font-medium text-slate-700 mb-1">
              Broadcast Note to Teams
            </label>
            <textarea
              id="bulk-note"
              rows={3}
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 p-2 focus:border-indigo-500 focus:outline-none"
              placeholder="Feedback note displayed on each advancing/eliminated team's portal..."
              defaultValue="Congratulations on your Ideathon performance. Your idea has been selected for the Innovatz live pitch panel."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setBulkModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton onClick={handleExecuteBulk}>Execute Bulk Action</ActionButton>
          </div>
        </div>
      </Modal>

      {/* Request Changes Modal */}
      <Modal
        isOpen={changeReqModalOpen}
        onClose={() => setChangeReqModalOpen(false)}
        title={`Request Revisions: ${selectedTeamForChanges?.name || ""}`}
        description="Unlocks the submission form for this team with specific feedback instructions."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="change-remarks" className="block text-sm font-medium text-slate-700 mb-1">
              Required Modifications & Coordinator Notes
            </label>
            <textarea
              id="change-remarks"
              rows={4}
              required
              value={changeRemarks}
              onChange={(e) => setChangeRemarks(e.target.value)}
              className="w-full text-xs rounded-md border border-slate-300 p-3 focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Please update slide 4 to clarify edge hardware requirements and recheck Google Slides sharing permissions..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setChangeReqModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton onClick={handleRequestChanges} disabled={!changeRemarks.trim()}>
              Send Change Request
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* Inspect Idea Modal */}
      {inspectTeam && (
        <Modal
          isOpen={inspectModalOpen}
          onClose={() => setInspectModalOpen(false)}
          title={`${inspectTeam.regCode} — ${inspectTeam.name}`}
          description={`Track: ${inspectTeam.track} • Lead: ${inspectTeam.leadName} (${inspectTeam.memberCount} members)`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500">Problem Statement</h4>
              <p className="mt-1 text-xs text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">
                {inspectTeam.problemStatement || "No problem statement submitted yet."}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500">Solution Abstract</h4>
              <p className="mt-1 text-xs text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">
                {inspectTeam.solutionAbstract || "No solution abstract submitted yet."}
              </p>
            </div>

            {inspectTeam.embedSlidesUrl && (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Google Slides Deck</h4>
                <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                  <iframe
                    src={inspectTeam.embedSlidesUrl}
                    title={`${inspectTeam.name} Slides`}
                    className="w-full h-full"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button onClick={() => setInspectModalOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </CoordinatorShell>
  );
}
