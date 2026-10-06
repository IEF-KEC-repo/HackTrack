"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { validateGoogleSlidesUrl } from "@/lib/services/team-service";

interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  role: "LEAD" | "MEMBER";
}

interface TeamState {
  id: string;
  regCode: string;
  name: string;
  track: string;
  status: "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "SHORTLISTED" | "WITHDRAWN";
  problemStatement: string;
  solutionAbstract: string;
  slidesUrl: string;
  embedSlidesUrl: string;
  techStack?: string;
  architectureDescription?: string;
  githubUrl?: string;
  risksAndMitigation?: string;
  hardwareBOM?: string;
  coordinatorFeedback?: string;
  members: TeamMemberItem[];
}

export default function TeamHubPage() {
  const [team, setTeam] = useState<TeamState | null>({
    id: "t_quantum",
    regCode: "HT26-T001",
    name: "QuantumForge",
    track: "AI/ML & Edge Computing",
    status: "SUBMITTED",
    problemStatement:
      "Cloud AI inference incurs severe bandwidth bottlenecks and latency spikes in remote robotics systems.",
    solutionAbstract:
      "Neuromorphic micro-controller architecture with quantized INT4 weight caching, cutting inference power by 85%.",
    slidesUrl:
      "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing",
    embedSlidesUrl:
      "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
    techStack: "Rust, WebAssembly, ONNX Runtime, STM32 Microcontroller",
    architectureDescription: "Layered pipeline streaming camera frames to INT4 quantized edge tensor cores.",
    githubUrl: "https://github.com/hacktrack/quantumforge-core",
    members: [
      { id: "u_lead", name: "Priya Sharma", email: "lead@hacktrack.edu", role: "LEAD" },
      { id: "u_mem", name: "Liam O'Connor", email: "member@hacktrack.edu", role: "MEMBER" },
    ],
  });

  const [currentUserRole] = useState<"LEAD" | "MEMBER">("LEAD");

  // Step 1 Form state
  const [teamName, setTeamName] = useState(team?.name || "");
  const [track, setTrack] = useState(team?.track || "AI/ML & Edge Computing");
  const [problemStatement, setProblemStatement] = useState(team?.problemStatement || "");
  const [solutionAbstract, setSolutionAbstract] = useState(team?.solutionAbstract || "");
  const [slidesInput, setSlidesInput] = useState(team?.slidesUrl || "");
  const [embedUrl, setEmbedUrl] = useState(team?.embedSlidesUrl || "");
  const [slidesError, setSlidesError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState(false);

  // Step 2 Form state
  const [techStack, setTechStack] = useState(team?.techStack || "");
  const [architecture, setArchitecture] = useState(team?.architectureDescription || "");
  const [githubUrl, setGithubUrl] = useState(team?.githubUrl || "");
  const [bom, setBom] = useState(team?.hardwareBOM || "");

  // Duplicate Title Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Modals & Feedback
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [transferLeadModalOpen, setTransferLeadModalOpen] = useState(false);
  const [newLeadId, setNewLeadId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Check Duplicate Title
  const handleTitleChange = (val: string) => {
    setTeamName(val);
    const existingTitles = ["QuantumForge", "BioSentry AI", "AeroGrid CleanTech", "CyberShield Zero"];
    const match = existingTitles.find(
      (t) => t.toLowerCase() === val.toLowerCase().trim() && t !== team?.name
    );
    if (match) {
      setDuplicateWarning(`Warning: Another team in this edition is already using the name "${match}".`);
    } else {
      setDuplicateWarning(null);
    }
  };

  // Google Slides validation
  const handleUpdateSlides = (url: string) => {
    setSlidesInput(url);
    if (!url.trim()) {
      setSlidesError(null);
      setEmbedUrl("");
      return;
    }
    const check = validateGoogleSlidesUrl(url);
    if (!check.valid) {
      setSlidesError(check.error || "Invalid Google Slides URL");
      setEmbedUrl("");
    } else {
      setSlidesError(null);
      setEmbedUrl(check.embedUrl || "");
    }
  };

  // Step 1 Submit
  const handleStepOneSubmit = () => {
    if (!team) return;
    if (!slidesInput || slidesError) {
      setNotification({ type: "error", msg: "A valid Google Slides URL is required before submitting." });
      return;
    }
    if (problemStatement.length < 30) {
      setNotification({ type: "error", msg: "Problem statement must be at least 30 characters long." });
      return;
    }

    setTeam({
      ...team,
      name: teamName,
      track,
      problemStatement,
      solutionAbstract,
      slidesUrl: slidesInput,
      embedSlidesUrl: embedUrl,
      status: "SUBMITTED",
      coordinatorFeedback: undefined,
    });
    setNotification({
      type: "success",
      msg: "Ideathon idea submitted successfully! Evaluators can now access your slide deck.",
    });
  };

  // Step 2 Submit
  const handleStepTwoSubmit = () => {
    if (!team) return;
    if (!techStack || !architecture) {
      setNotification({ type: "error", msg: "Please fill out both Tech Stack and System Architecture." });
      return;
    }
    setTeam({
      ...team,
      techStack,
      architectureDescription: architecture,
      githubUrl,
      hardwareBOM: bom,
    });
    setNotification({
      type: "success",
      msg: "Detailed Architecture & BOM submitted successfully for Innovatz panel review.",
    });
  };

  // Withdraw Submission
  const handleWithdraw = () => {
    if (!team) return;
    setTeam({ ...team, status: "WITHDRAWN" });
    setNotification({
      type: "error",
      msg: "Submission has been withdrawn. You can resume as Draft before the deadline passes.",
    });
  };

  // Resume Draft
  const handleResumeDraft = () => {
    if (!team) return;
    setTeam({ ...team, status: "DRAFT" });
    setNotification({ type: "success", msg: "Submission draft resumed. You may now make edits and resubmit." });
  };

  // Invite member
  const handleSendInvite = () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setNotification({ type: "error", msg: "Enter a valid email address." });
      return;
    }
    if (team && team.members.length >= 6) {
      setNotification({ type: "error", msg: "Team is at maximum capacity (6 members)." });
      return;
    }

    setInviteModalOpen(false);
    setInviteEmail("");
    setNotification({
      type: "success",
      msg: `Invitation token dispatched to ${inviteEmail}. Member can accept from their portal.`,
    });
  };

  // Transfer lead
  const handleTransferLead = () => {
    if (!team || !newLeadId) return;
    const target = team.members.find((m) => m.id === newLeadId);
    if (!target) return;

    const updatedMembers = team.members.map((m) => {
      if (m.id === newLeadId) return { ...m, role: "LEAD" as const };
      if (m.role === "LEAD") return { ...m, role: "MEMBER" as const };
      return m;
    });

    setTeam({ ...team, members: updatedMembers });
    setTransferLeadModalOpen(false);
    setNotification({
      type: "success",
      msg: `Team leadership successfully transferred to ${target.name}.`,
    });
  };

  const isLead = currentUserRole === "LEAD";
  const isShortlisted = team?.status === "SHORTLISTED";
  const isChangesRequested = team?.status === "CHANGES_REQUESTED";
  const isWithdrawn = team?.status === "WITHDRAWN";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Notifications */}
      {notification && (
        <Alert variant={notification.type === "success" ? "success" : "error"} title="Team Portal Update">
          {notification.msg}
        </Alert>
      )}

      {/* Changes Requested Coordinator Banner */}
      {isChangesRequested && (
        <Alert variant="warning" title="⚠️ Coordinator Requested Revisions">
          <p className="font-semibold text-amber-900 mt-1">Feedback from Evaluation Coordinator:</p>
          <p className="mt-0.5 text-xs italic bg-white/70 p-2.5 rounded border border-amber-200">
            &quot;{team.coordinatorFeedback || "Please review slide presentation and clarify system architecture."}&quot;
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Your idea submission has been unlocked for edits. Make required updates and click &quot;Submit for Review&quot;.
          </p>
        </Alert>
      )}

      {/* Withdrawn Notice Banner */}
      {isWithdrawn && (
        <Alert variant="error" title="Submission Withdrawn">
          This idea submission is currently marked as Withdrawn.
          {isLead && (
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={handleResumeDraft}>
                Resume as Draft
              </Button>
            </div>
          )}
        </Alert>
      )}

      {/* Team Header & Roster Bar */}
      {team && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-md border border-indigo-200">
                  {team.regCode}
                </span>
                <h1 className="text-2xl font-black text-slate-900">{team.name}</h1>
                <Badge
                  variant={
                    team.status === "SUBMITTED"
                      ? "info"
                      : team.status === "SHORTLISTED"
                      ? "success"
                      : team.status === "CHANGES_REQUESTED"
                      ? "warning"
                      : team.status === "WITHDRAWN"
                      ? "danger"
                      : "default"
                  }
                >
                  {team.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Track: {team.track} • {team.members.length} of 6 Members (Solo Allowed) • Ideathon Deadline: Aug 25, 23:59 UTC
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/team/milestones">
                <Button size="sm" variant="secondary">
                  🎯 Milestones & Check-Ins →
                </Button>
              </Link>
              {isLead && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setInviteModalOpen(true)}>
                    + Invite Teammate
                  </Button>
                  {team.members.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setTransferLeadModalOpen(true)}>
                      Transfer Lead
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Member Roster Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase text-slate-500">Roster:</span>
            {team.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs shadow-2xs"
              >
                <span className="font-semibold text-slate-900">{m.name}</span>
                <span className="text-slate-500 font-mono">({m.email})</span>
                <Badge variant={m.role === "LEAD" ? "purple" : "default"} size="sm">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Step Idea Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* STEP 1: Ideathon Registration Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <span className="font-mono text-xs font-bold text-indigo-600 uppercase">Step 1 of 2</span>
              <h2 className="text-lg font-bold text-slate-900">Ideathon Idea Registration</h2>
            </div>
            <Badge variant="info">Open to All Teams</Badge>
          </div>

          {duplicateWarning && (
            <div role="alert" className="rounded-md bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
              ⚠️ {duplicateWarning}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Team / Idea Name"
              value={teamName}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={!isLead || isWithdrawn}
            />

            <Select
              label="Track Category"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              disabled={!isLead || isWithdrawn}
              options={[
                { value: "AI/ML & Edge Computing", label: "AI/ML & Edge Computing" },
                { value: "Healthcare & Biotech", label: "Healthcare & Biotech" },
                { value: "Clean Energy & IoT", label: "Clean Energy & IoT" },
                { value: "Cybersecurity", label: "Cybersecurity & Zero Trust" },
                { value: "FinTech & Web3", label: "FinTech & Web3" },
              ]}
            />

            <div>
              <label htmlFor="problem" className="block text-sm font-medium text-slate-700 mb-1">
                Problem Statement (min 30 chars)
              </label>
              <textarea
                id="problem"
                rows={3}
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                disabled={!isLead || isWithdrawn}
                className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                placeholder="What critical challenge or unmet need are you solving?"
              />
            </div>

            <div>
              <label htmlFor="solution" className="block text-sm font-medium text-slate-700 mb-1">
                Proposed Solution & Innovation (min 50 chars)
              </label>
              <textarea
                id="solution"
                rows={4}
                value={solutionAbstract}
                onChange={(e) => setSolutionAbstract(e.target.value)}
                disabled={!isLead || isWithdrawn}
                className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
                placeholder="Describe your technical solution and how it differs from existing products..."
              />
            </div>

            {/* Google Slides Presentation Section */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
              <div>
                <label htmlFor="slides-url" className="block text-sm font-bold text-slate-900">
                  Google Slides Shareable URL
                </label>
                <p className="text-xs text-slate-500">
                  Must be set to &quot;Anyone with the link can view&quot;. This deck renders embedded on every evaluator&apos;s scoring cockpit.
                </p>
              </div>

              <input
                id="slides-url"
                type="url"
                value={slidesInput}
                onChange={(e) => handleUpdateSlides(e.target.value)}
                disabled={!isLead || isWithdrawn}
                className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none bg-white"
                placeholder="https://docs.google.com/presentation/d/1BxiMVs0XRA5..."
              />

              {slidesError && <p className="text-xs text-rose-600 font-semibold">{slidesError}</p>}

              {/* Embed Load Check & Warning */}
              {embedUrl && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">Live Slide Preview</span>
                    <button
                      type="button"
                      onClick={() => setLoadWarning(!loadWarning)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      {loadWarning ? "Hide Sharing Check" : "Verify Sharing Permissions"}
                    </button>
                  </div>

                  {loadWarning && (
                    <div className="rounded bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900 space-y-1">
                      <p className="font-bold">⚠️ Sharing Permission Check Reminder:</p>
                      <p>
                        In Google Slides, click <strong>Share</strong> → change from &quot;Restricted&quot; to <strong>&quot;Anyone with the link&quot;</strong> as <strong>Viewer</strong>.
                      </p>
                      <p>If set to private, evaluators will see a permission error and cannot score your idea.</p>
                    </div>
                  )}

                  <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800 shadow-md">
                    <iframe
                      src={embedUrl}
                      title="Google Slides Preview"
                      className="w-full h-full"
                      allowFullScreen
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            {isLead && !isWithdrawn && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={handleWithdraw} className="text-rose-600 hover:bg-rose-50">
                  Withdraw Idea
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setNotification({ type: "success", msg: "Draft saved locally." })}>
                    Save Draft
                  </Button>
                  <Button variant="primary" onClick={handleStepOneSubmit}>
                    Submit for Review
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: Detailed Architecture & BOM Form (Gated) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <span className="font-mono text-xs font-bold text-indigo-600 uppercase">Step 2 of 2</span>
              <h2 className="text-lg font-bold text-slate-900">Detailed Architecture & BOM</h2>
            </div>
            <Badge variant={isShortlisted ? "success" : "default"}>
              {isShortlisted ? "Unlocked (Shortlisted)" : "Locked"}
            </Badge>
          </div>

          {!isShortlisted ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center space-y-3">
              <span className="text-3xl">🔒</span>
              <h3 className="font-bold text-sm text-slate-800">
                Step 2 Unlocks When Your Idea is Shortlisted
              </h3>
              <p className="max-w-md mx-auto text-xs text-slate-500">
                Teams advancing past the Ideathon cutoff (Top teams selected for Innovatz Live Pitch) gain access to submit their engineering architecture, GitHub repository, and hardware BOM.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <Alert variant="success" title="🎉 Congratulations! Your team is Shortlisted">
                Your team has qualified for Innovatz. Please complete this detailed architecture specification prior to panel defense.
              </Alert>

              <div>
                <label htmlFor="tech-stack" className="block text-sm font-medium text-slate-700 mb-1">
                  Proposed Tech Stack & Frameworks
                </label>
                <input
                  id="tech-stack"
                  type="text"
                  value={techStack}
                  onChange={(e) => setTechStack(e.target.value)}
                  disabled={!isLead}
                  className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. Next.js, PyTorch, ROS2, WebAssembly, PostgreSQL"
                />
              </div>

              <div>
                <label htmlFor="architecture" className="block text-sm font-medium text-slate-700 mb-1">
                  System Architecture Breakdown (min 40 chars)
                </label>
                <textarea
                  id="architecture"
                  rows={4}
                  value={architecture}
                  onChange={(e) => setArchitecture(e.target.value)}
                  disabled={!isLead}
                  className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none"
                  placeholder="Detail your data flow, edge runtime, security boundary, and APIs..."
                />
              </div>

              <Input
                label="Public or Private GitHub Repository URL"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                disabled={!isLead}
                placeholder="https://github.com/organization/repo"
                hint="Grant read access to reviewer coordinators if private."
              />

              <div>
                <label htmlFor="bom" className="block text-sm font-medium text-slate-700 mb-1">
                  Hardware / Cloud Resource Bill of Materials (BOM)
                </label>
                <textarea
                  id="bom"
                  rows={3}
                  value={bom}
                  onChange={(e) => setBom(e.target.value)}
                  disabled={!isLead}
                  className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none"
                  placeholder="Sensors, GPUs, dev kits, or specific cloud APIs required..."
                />
              </div>

              {isLead && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button variant="primary" onClick={handleStepTwoSubmit}>
                    Submit Detailed Architecture
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Teammate Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Teammate"
        description="Rosters allow between 1 (solo) and 6 members. Teammate will receive an accept link."
      >
        <div className="space-y-4">
          <Input
            label="Teammate College Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="student@college.edu"
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite}>Dispatch Invite</Button>
          </div>
        </div>
      </Modal>

      {/* Transfer Team Lead Modal */}
      <Modal
        isOpen={transferLeadModalOpen}
        onClose={() => setTransferLeadModalOpen(false)}
        title="Transfer Team Leadership"
        description="Designate another verified roster member as the primary Team Lead."
      >
        <div className="space-y-4">
          <Select
            label="Select New Team Lead"
            value={newLeadId}
            onChange={(e) => setNewLeadId(e.target.value)}
            options={[
              { value: "", label: "-- Choose Member --" },
              ...(team?.members
                .filter((m) => m.role !== "LEAD")
                .map((m) => ({ value: m.id, label: `${m.name} (${m.email})` })) || []),
            ]}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setTransferLeadModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransferLead} disabled={!newLeadId}>
              Confirm Transfer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
