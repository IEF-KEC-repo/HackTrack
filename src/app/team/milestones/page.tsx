"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";

interface MilestoneItem {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  source: "COORDINATOR_MANDATORY" | "TEAM_CUSTOM";
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
  isOverdue: boolean;
  isDueSoon: boolean;
  daysOverdue?: number;
  hoursRemaining?: number;
  evidenceType?: "LINK" | "FILE";
  evidenceUrl?: string;
  evidenceNotes?: string;
  evidenceFile?: {
    id: string;
    originalName: string;
    storedName: string;
    fileUrl: string;
    fileSize?: number;
  };
}

interface CheckInRecord {
  id: string;
  meetingDate: string;
  health: "GREEN" | "YELLOW" | "RED";
  progressNotes?: string;
  blockers?: string;
  nextGoals?: string;
  evidenceUrl?: string;
  notes?: string;
  actionItems?: string;
  submittedByRole: string;
  createdAt: string;
  mentor?: { name: string; email: string };
}

export default function TeamMilestonesPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "MANDATORY" | "CUSTOM" | "OVERDUE">("ALL");

  // State
  const [team] = useState({
    id: "t_quantum",
    regCode: "HT26-T001",
    name: "QuantumForge",
    track: "AI/ML & Edge Computing",
    mentor: {
      name: "Prof. Alan Turing",
      email: "mentor@hacktrack.edu",
    },
    health: "GREEN" as "GREEN" | "YELLOW" | "RED",
  });

  const [milestones, setMilestones] = useState<MilestoneItem[]>([
    {
      id: "m_1",
      title: "Problem Statement & Persona Validation Survey",
      description: "Conduct interviews with at least 10 domain experts or end-users.",
      dueDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2 days ago
      source: "COORDINATOR_MANDATORY",
      status: "COMPLETED",
      isOverdue: false,
      isDueSoon: false,
      evidenceType: "LINK",
      evidenceUrl: "https://docs.google.com/forms/d/1BxiMVs0XRA5nFMdKvBdBZjgm/analytics",
      evidenceNotes: "Survey completed across 14 embedded robotics researchers.",
    },
    {
      id: "m_2",
      title: "Detailed Architecture Diagram & Hardware BOM Draft",
      description: "Specify system component block diagrams and complete bill of materials for CPR 1.",
      dueDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), // 1 day ago
      source: "COORDINATOR_MANDATORY",
      status: "IN_PROGRESS",
      isOverdue: true,
      isDueSoon: false,
      daysOverdue: 1,
      evidenceNotes: "Drafting schematic in KiCad.",
    },
    {
      id: "m_3",
      title: "Proof of Concept: Firmware Quantization Kernel",
      description: "Compile and run INT4 matrix multiplication benchmarks on target MCU.",
      dueDate: new Date(Date.now() + 36 * 3600 * 1000).toISOString(), // in 36 hours
      source: "COORDINATOR_MANDATORY",
      status: "IN_PROGRESS",
      isOverdue: false,
      isDueSoon: true,
      hoursRemaining: 36,
    },
    {
      id: "m_4",
      title: "CPR 1 Mid-Point Working Prototype Demo",
      description: "Present working live bench test demonstration to panel.",
      dueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(), // in 10 days
      source: "COORDINATOR_MANDATORY",
      status: "NOT_STARTED",
      isOverdue: false,
      isDueSoon: false,
    },
    {
      id: "m_custom_1",
      title: "Custom: PCB Testbench Layout v1",
      description: "Internal team deliverable to manufacture prototype carrier board.",
      dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      source: "TEAM_CUSTOM",
      status: "NOT_STARTED",
      isOverdue: false,
      isDueSoon: false,
    },
  ]);

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([
    {
      id: "ci_1",
      meetingDate: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
      health: "GREEN",
      progressNotes: "Finalized quantization algorithms and submitted Ideathon slides deck.",
      blockers: "Waiting on supplier quotes for edge FPGA chipsets.",
      nextGoals: "Complete BOM and validate KiCad layout.",
      submittedByRole: "TEAM",
      createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
      notes: "Team has solid conceptual grounding. Connect with Prof. Shannon for FPGA lab access.",
      actionItems: "Submit KiCad schematics before Friday.",
      mentor: { name: "Prof. Alan Turing", email: "mentor@hacktrack.edu" },
    },
  ]);

  // Modals
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customDueDate, setCustomDueDate] = useState("");

  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneItem | null>(null);
  const [evidenceMode, setEvidenceMode] = useState<"LINK" | "FILE">("LINK");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [checkInProgress, setCheckInProgress] = useState("");
  const [checkInBlockers, setCheckInBlockers] = useState("");
  const [checkInNextGoals, setCheckInNextGoals] = useState("");
  const [checkInHealth, setCheckInHealth] = useState<"GREEN" | "YELLOW" | "RED">("GREEN");
  const [checkInEvidenceUrl, setCheckInEvidenceUrl] = useState("");
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);

  // Calculations
  const mandatoryMilestones = milestones.filter((m) => m.source === "COORDINATOR_MANDATORY");
  const mandatoryCompleted = mandatoryMilestones.filter((m) => m.status === "COMPLETED").length;
  const mandatoryTotal = mandatoryMilestones.length;
  const progressPercent =
    mandatoryTotal > 0 ? Math.round((mandatoryCompleted / mandatoryTotal) * 1000) / 10 : 100;

  const overdueCount = milestones.filter((m) => m.isOverdue).length;

  // Cadence evaluation
  const latestCheckIn = checkIns[0];
  const daysSinceCheckIn = latestCheckIn
    ? Math.floor((Date.now() - new Date(latestCheckIn.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const isCheckInOverdue = daysSinceCheckIn > 14;
  const isCheckInDue = daysSinceCheckIn >= 10 && !isCheckInOverdue;

  // Filtered Milestones
  const filteredMilestones = milestones.filter((m) => {
    if (activeTab === "MANDATORY") return m.source === "COORDINATOR_MANDATORY";
    if (activeTab === "CUSTOM") return m.source === "TEAM_CUSTOM";
    if (activeTab === "OVERDUE") return m.isOverdue;
    return true;
  });

  // Handlers
  const handleAddCustomMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle || !customDueDate) return;

    const newMilestone: MilestoneItem = {
      id: `m_custom_${Date.now()}`,
      title: customTitle,
      description: customDescription,
      dueDate: new Date(customDueDate).toISOString(),
      source: "TEAM_CUSTOM",
      status: "NOT_STARTED",
      isOverdue: new Date(customDueDate).getTime() < Date.now(),
      isDueSoon: false,
    };

    setMilestones([...milestones, newMilestone]);
    setCustomTitle("");
    setCustomDescription("");
    setCustomDueDate("");
    setIsAddCustomOpen(false);
  };

  const handleUpdateStatus = (id: string, newStatus: MilestoneItem["status"]) => {
    setMilestones(
      milestones.map((m) => {
        if (m.id === id) {
          const isCompleted = newStatus === "COMPLETED";
          return {
            ...m,
            status: newStatus,
            isOverdue: isCompleted ? false : m.isOverdue,
            isDueSoon: isCompleted ? false : m.isDueSoon,
          };
        }
        return m;
      })
    );
  };

  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestone) return;

    if (evidenceMode === "LINK") {
      setMilestones(
        milestones.map((m) => {
          if (m.id === selectedMilestone.id) {
            return {
              ...m,
              status: "COMPLETED",
              isOverdue: false,
              isDueSoon: false,
              evidenceType: "LINK",
              evidenceUrl: evidenceUrl || m.evidenceUrl,
              evidenceNotes: evidenceNotes || m.evidenceNotes,
            };
          }
          return m;
        })
      );
      setSelectedMilestone(null);
      setEvidenceUrl("");
      setEvidenceNotes("");
    } else {
      // File Upload
      if (!selectedFile) {
        setUploadError("Please select a file to upload.");
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("teamId", team.id);
        formData.append("fileType", "MILESTONE_EVIDENCE");

        const res = await fetch("/api/artifacts/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "File upload failed.");
        }

        // Attach uploaded artifact to milestone
        setMilestones(
          milestones.map((m) => {
            if (m.id === selectedMilestone.id) {
              return {
                ...m,
                status: "COMPLETED",
                isOverdue: false,
                isDueSoon: false,
                evidenceType: "FILE",
                evidenceFile: data.artifact,
                evidenceNotes: evidenceNotes || m.evidenceNotes,
              };
            }
            return m;
          })
        );

        setSelectedMilestone(null);
        setSelectedFile(null);
        setEvidenceNotes("");
      } catch (err: any) {
        setUploadError(err.message || "Failed to upload file.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmitCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInProgress) return;

    setIsSubmittingCheckIn(true);
    const newRecord: CheckInRecord = {
      id: `ci_${Date.now()}`,
      meetingDate: new Date().toISOString(),
      health: checkInHealth,
      progressNotes: checkInProgress,
      blockers: checkInBlockers,
      nextGoals: checkInNextGoals,
      evidenceUrl: checkInEvidenceUrl,
      submittedByRole: "TEAM",
      createdAt: new Date().toISOString(),
      mentor: { name: team.mentor.name, email: team.mentor.email },
    };

    setCheckIns([newRecord, ...checkIns]);
    setCheckInProgress("");
    setCheckInBlockers("");
    setCheckInNextGoals("");
    setCheckInEvidenceUrl("");
    setIsSubmittingCheckIn(false);
    setIsCheckInOpen(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              {team.regCode}
            </span>
            <span className="text-xs text-slate-500 font-medium">({team.track})</span>
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

      {/* Progress & Mentorship Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Mandatory Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mandatory Milestone Progress
            </span>
            <Badge variant={progressPercent === 100 ? "success" : progressPercent >= 50 ? "info" : "warning"}>
              {progressPercent}% Complete
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
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            Official milestone completion percentage determines gate progression into POC.
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
            <p className="text-sm font-semibold text-slate-900">{team.mentor.name}</p>
            <p className="text-xs text-slate-500">Assigned Faculty Mentor</p>
          </div>
          <p className="text-xs text-slate-500">
            Last check-in logged {daysSinceCheckIn} days ago (14-day cycle).
          </p>
        </div>
      </div>

      {/* Overdue Alert Banner if active */}
      {isCheckInOverdue && (
        <Alert
          variant="error"
          title="Fortnightly Mentor Check-In Overdue"
        >
          Your team has not submitted a check-in within the 14-day window. Please submit your accomplishments and blockers immediately to maintain good standing.
        </Alert>
      )}

      {/* Milestones Checklist Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Milestone Deliverables & Evidence</h2>
            <p className="text-xs text-slate-500">
              Submit proof-of-work (GitHub commit, Figma diagram, or uploaded artifact) to mark items complete.
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
        <div className="divide-y divide-slate-100">
          {filteredMilestones.map((m) => (
            <div key={m.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={m.source === "COORDINATOR_MANDATORY" ? "purple" : "default"}>
                    {m.source === "COORDINATOR_MANDATORY" ? "Mandatory" : "Team Custom"}
                  </Badge>

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
                    {m.evidenceType === "LINK" && m.evidenceUrl && (
                      <a
                        href={m.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 underline font-mono hover:text-indigo-800 break-all"
                      >
                        {m.evidenceUrl}
                      </a>
                    )}
                    {m.evidenceType === "FILE" && m.evidenceFile && (
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200">
                        📄 {m.evidenceFile.storedName}
                      </span>
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
                  onChange={(e) => handleUpdateStatus(m.id, e.target.value as any)}
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
                  }}
                >
                  {m.status === "COMPLETED" ? "Edit Evidence" : "Attach Proof"}
                </Button>
              </div>
            </div>
          ))}
        </div>
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
          <p className="text-xs text-slate-400 text-center py-6">
            No check-ins logged yet. Submit your first fortnightly report.
          </p>
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
                    Logged by {ci.mentor?.name || "Faculty Mentor"}
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
            <Button variant="primary" type="submit">
              Save Milestone
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Attach Evidence (Link or Server-Renamed File Upload) */}
      <Modal
        isOpen={!!selectedMilestone}
        onClose={() => setSelectedMilestone(null)}
        title={`Attach Evidence: ${selectedMilestone?.title}`}
      >
        <form onSubmit={handleSaveEvidence} className="space-y-4">
          {uploadError && <Alert variant="error" title="Upload Failed">{uploadError}</Alert>}

          {/* Evidence Type Switcher */}
          <div className="flex rounded-md border border-slate-200 p-1 bg-slate-50 text-xs">
            <button
              type="button"
              onClick={() => setEvidenceMode("LINK")}
              className={`flex-1 py-1.5 rounded font-semibold text-center ${
                evidenceMode === "LINK" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
              }`}
            >
              🔗 External Link (GitHub / Figma / Loom)
            </button>
            <button
              type="button"
              onClick={() => setEvidenceMode("FILE")}
              className={`flex-1 py-1.5 rounded font-semibold text-center ${
                evidenceMode === "FILE" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
              }`}
            >
              📁 File Upload (Renamed to {team.regCode})
            </button>
          </div>

          {evidenceMode === "LINK" ? (
            <Input
              label="Evidence URL"
              required
              type="url"
              placeholder="https://github.com/..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              hint="Link to public PR, GitHub commit, Figma design, or demo video."
            />
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Upload Supporting Artifact (Max 25MB)
              </label>
              <input
                type="file"
                required
                accept=".pdf,.zip,.png,.jpg,.jpeg,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                🔒 Security Note: Server automatically renames your file to{" "}
                <span className="font-mono text-indigo-700">{team.regCode}_filename.ext</span>.
              </p>
            </div>
          )}

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
            <Button variant="primary" type="submit" isLoading={isUploading}>
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
              onChange={(e) => setCheckInHealth(e.target.value as any)}
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
