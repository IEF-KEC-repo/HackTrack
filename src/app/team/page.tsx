"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { validateGoogleSlidesUrl } from "@/lib/services/team-service";

const EDITION_SLUG = "ht26";

const TRACK_OPTIONS = [
  { value: "AI/ML & Edge Computing", label: "AI/ML & Edge Computing" },
  { value: "Healthcare & Biotech", label: "Healthcare & Biotech" },
  { value: "Clean Energy & IoT", label: "Clean Energy & IoT" },
  { value: "Cybersecurity", label: "Cybersecurity & Zero Trust" },
  { value: "FinTech & Web3", label: "FinTech & Web3" },
];

const TEAM_STATUSES = [
  "DRAFT",
  "REGISTERED",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "SHORTLISTED",
  "IDEATHON_EVALUATED",
  "INCL_INNOVATZ",
  "CPR_ACTIVE",
  "POC_QUALIFIED",
  "DEMO_DAY_FINALIST",
  "COMPLETED",
  "ELIMINATED",
  "WITHDRAWN",
] as const;

type TeamStatusCode = (typeof TEAM_STATUSES)[number];

interface TeamMemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "LEAD" | "MEMBER";
}

interface TeamInviteItem {
  id: string;
  email: string;
  role: "LEAD" | "MEMBER";
  status: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

interface PendingInviteItem {
  id: string;
  token: string;
  email: string;
  role: "LEAD" | "MEMBER";
  status: string;
  expiresAt: string;
  createdAt: string;
  team: {
    id: string;
    name: string;
    regCode: string;
    track: string | null;
  };
}

interface TeamState {
  id: string;
  editionId: string;
  regCode: string;
  name: string;
  track: string | null;
  status: TeamStatusCode;
  problemStatement: string | null;
  solutionAbstract: string | null;
  slidesUrl: string | null;
  embedSlidesUrl: string | null;
  techStack: string | null;
  architectureDescription: string | null;
  githubUrl: string | null;
  risksAndMitigation: string | null;
  hardwareBOM: string | null;
  coordinatorFeedback: string | null;
  members: TeamMemberItem[];
  teamInvites: TeamInviteItem[];
  edition: {
    id: string;
    name: string;
    slug: string;
    events: Array<{ submissionDeadline: string | null; status: string }>;
  };
}

interface EditionData {
  id: string;
  name: string;
  slug: string;
  status: string;
  events: Array<{
    id: string;
    slug: string;
    name: string;
    status: string;
    submissionDeadline: string | null;
  }>;
}

type ApiErrorResponse = { error?: string };

type MyTeamResponse = {
  team: {
    id: string;
    editionId: string;
    regCode: string;
    name: string;
    track: string | null;
    status: string;
    problemStatement: string | null;
    solutionAbstract: string | null;
    slidesUrl: string | null;
    embedSlidesUrl: string | null;
    techStack: string | null;
    architectureDescription: string | null;
    githubUrl: string | null;
    risksAndMitigation: string | null;
    hardwareBOM: string | null;
    coordinatorFeedback: string | null;
    members: Array<{
      id: string;
      role: "LEAD" | "MEMBER";
      user: { id: string; name: string; email: string };
    }>;
    teamInvites: Array<{
      id: string;
      email: string;
      role: "LEAD" | "MEMBER";
      status: string;
      token: string;
      createdAt: string;
      expiresAt: string;
    }>;
    edition: {
      id: string;
      name: string;
      slug: string;
      events: Array<{ submissionDeadline: string | null; status: string }>;
    };
  } | null;
  myRole: "LEAD" | "MEMBER" | null;
  pendingInvites: Array<{
    id: string;
    token: string;
    email: string;
    role: "LEAD" | "MEMBER";
    status: string;
    expiresAt: string;
    createdAt: string;
    team: { id: string; name: string; regCode: string; track: string | null };
  }>;
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const getStatusBadgeVariant = (status: TeamStatusCode) => {
  switch (status) {
    case "SUBMITTED":
      return "info" as const;
    case "SHORTLISTED":
    case "INCL_INNOVATZ":
    case "POC_QUALIFIED":
    case "DEMO_DAY_FINALIST":
    case "COMPLETED":
      return "success" as const;
    case "CHANGES_REQUESTED":
      return "warning" as const;
    case "ELIMINATED":
    case "WITHDRAWN":
      return "danger" as const;
    default:
      return "default" as const;
  }
};

const formatDeadline = (iso: string | null): string => {
  if (!iso) return "TBD";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "TBD";
    return `${d.toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })} UTC`;
  } catch {
    return "TBD";
  }
};

export default function TeamHubPage() {
  // Live data loaded from the real API. All state starts empty/null.
  const [team, setTeam] = useState<TeamState | null>(null);
  const [myRole, setMyRole] = useState<"LEAD" | "MEMBER" | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteItem[]>([]);
  const [edition, setEdition] = useState<EditionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1 Form state
  const [teamName, setTeamName] = useState("");
  const [track, setTrack] = useState(TRACK_OPTIONS[0].value);
  const [problemStatement, setProblemStatement] = useState("");
  const [solutionAbstract, setSolutionAbstract] = useState("");
  const [slidesInput, setSlidesInput] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [slidesError, setSlidesError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState(false);

  // Step 2 Form state
  const [techStack, setTechStack] = useState("");
  const [architecture, setArchitecture] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [bom, setBom] = useState("");

  // Create team form
  const [createName, setCreateName] = useState("");
  const [createTrack, setCreateTrack] = useState(TRACK_OPTIONS[0].value);
  const [createProblem, setCreateProblem] = useState("");
  const [createSolution, setCreateSolution] = useState("");
  const [createSlides, setCreateSlides] = useState("");
  const [createSlidesError, setCreateSlidesError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Duplicate Title Warning State
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const duplicateCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals & Feedback
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [transferLeadModalOpen, setTransferLeadModalOpen] = useState(false);
  const [newLeadId, setNewLeadId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Async action flags
  const [isSubmittingStep1, setIsSubmittingStep1] = useState(false);
  const [isSubmittingStep2, setIsSubmittingStep2] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);

  const updateTeamFormFromServer = (t: MyTeamResponse["team"]) => {
    if (!t) return;
    setTeamName(t.name || "");
    setTrack(t.track || TRACK_OPTIONS[0].value);
    setProblemStatement(t.problemStatement || "");
    setSolutionAbstract(t.solutionAbstract || "");
    setSlidesInput(t.slidesUrl || "");
    setEmbedUrl(t.embedSlidesUrl || "");
    setTechStack(t.techStack || "");
    setArchitecture(t.architectureDescription || "");
    setGithubUrl(t.githubUrl || "");
    setBom(t.hardwareBOM || "");
  };

  const applyMyTeamPayload = (data: MyTeamResponse) => {
    if (data.team) {
      const t = data.team;
      setTeam({
        id: t.id,
        editionId: t.editionId,
        regCode: t.regCode,
        name: t.name,
        track: t.track,
        status: t.status as TeamStatusCode,
        problemStatement: t.problemStatement,
        solutionAbstract: t.solutionAbstract,
        slidesUrl: t.slidesUrl,
        embedSlidesUrl: t.embedSlidesUrl,
        techStack: t.techStack,
        architectureDescription: t.architectureDescription,
        githubUrl: t.githubUrl,
        risksAndMitigation: t.risksAndMitigation,
        hardwareBOM: t.hardwareBOM,
        coordinatorFeedback: t.coordinatorFeedback,
        members: (t.members || []).map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        })),
        teamInvites: t.teamInvites || [],
        edition: t.edition || { id: t.editionId, name: "", slug: EDITION_SLUG, events: [] },
      });
      updateTeamFormFromServer(t);
    } else {
      setTeam(null);
    }
    setMyRole(data.myRole || null);
    setPendingInvites(data.pendingInvites || []);
  };

  const fetchTeamData = async () => {
    const res = await fetch(`/api/teams/my-team?editionSlug=${EDITION_SLUG}`);
    if (!res.ok) {
      const errData: ApiErrorResponse = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to load your team data.");
    }
    const data: MyTeamResponse = await res.json();
    applyMyTeamPayload(data);
  };

  const loadData = async () => {
    try {
      await fetchTeamData();
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load your team data."));
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to load your team data.") });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      await fetchTeamData();
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Failed to load your team data."));
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to load your team data.") });
    }
  };

  const loadEdition = async () => {
    // Primary: coordinator edition-data. Available to coordinator tiers; used
    // here so the exact edition (by slug) is resolved when the viewer has access.
    try {
      const res = await fetch(`/api/coordinator/edition-data?slug=${EDITION_SLUG}`);
      if (res.ok) {
        const data: { edition?: EditionData } = await res.json();
        if (data.edition) {
          setEdition(data.edition);
          return;
        }
      }
    } catch {
      // Fall through to the participant-accessible public timeline below.
    }

    // Fallback: public timeline (no auth). Supplies the active edition id and
    // event stage statuses so participants can register a team and see deadlines.
    try {
      const res = await fetch("/api/public/timeline", { cache: "no-store" });
      if (!res.ok) return;
      const data: {
        edition: { id: string; name: string; slug: string; status: string } | null;
        events: Array<{
          id: string;
          slug: string;
          name: string;
          status: string;
          submissionDeadline: string | null;
        }>;
      } = await res.json();
      if (data.edition) {
        setEdition({
          id: data.edition.id,
          name: data.edition.name,
          slug: data.edition.slug,
          status: data.edition.status,
          events: data.events || [],
        });
      }
    } catch {
      // Non-fatal: edition context is optional once a team exists.
    }
  };

  useEffect(() => {
    loadData();
    loadEdition();
    return () => {
      if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
    };
    // Runs once on mount; loaders are stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check duplicate title against the real check-duplicate endpoint
  const handleTitleChange = (val: string) => {
    setTeamName(val);
    if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
    if (!val.trim() || val.trim().length < 3) {
      setDuplicateWarning(null);
      return;
    }
    const editionId = edition?.id || team?.editionId || "";
    if (!editionId) {
      setDuplicateWarning(null);
      return;
    }
    duplicateCheckTimer.current = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          editionId,
          title: val.trim(),
          ...(team?.id ? { excludeTeamId: team.id } : {}),
        });
        const res = await fetch(`/api/teams/check-duplicate?${qs.toString()}`);
        if (!res.ok) return;
        const result: { isDuplicate: boolean; matchedTeamName?: string } = await res.json();
        if (result.isDuplicate) {
          setDuplicateWarning(
            `Warning: Another team in this edition is already using the name "${result.matchedTeamName || val.trim()}".`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      }
    }, 400);
  };

  // Google Slides validation (client-side helper only)
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

  const handleCreateSlidesChange = (url: string) => {
    setCreateSlides(url);
    if (!url.trim()) {
      setCreateSlidesError(null);
      return;
    }
    const check = validateGoogleSlidesUrl(url);
    setCreateSlidesError(check.valid ? null : check.error || "Invalid Google Slides URL");
  };

  // Create a new team (guest / no-team landing)
  const handleCreateTeam = async () => {
    if (!edition?.id) {
      setNotification({
        type: "error",
        msg: "Edition context is not loaded yet. Please retry or contact a coordinator.",
      });
      return;
    }
    if (!createName.trim() || createName.trim().length < 2) {
      setNotification({ type: "error", msg: "Team name must be at least 2 characters long." });
      return;
    }
    if (createSlides && (createSlidesError || !validateGoogleSlidesUrl(createSlides).valid)) {
      setNotification({ type: "error", msg: "Please provide a valid Google Slides URL or leave the field empty for now." });
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/teams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: edition.id,
          name: createName.trim(),
          track: createTrack,
          problemStatement: createProblem.trim() || undefined,
          solutionAbstract: createSolution.trim() || undefined,
          slidesUrl: createSlides.trim() || undefined,
        }),
      });
      const data: ApiErrorResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team.");
      setNotification({ type: "success", msg: `Team "${createName.trim()}" registered. You are the Team Lead.` });
      setCreateName("");
      setCreateProblem("");
      setCreateSolution("");
      setCreateSlides("");
      await refreshData();
    } catch (err) {
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to create team.") });
    } finally {
      setIsCreating(false);
    }
  };

  // Step 1 Submit
  const handleStepOneSubmit = async () => {
    if (!team) return;
    if (!slidesInput || slidesError) {
      setNotification({ type: "error", msg: "A valid Google Slides URL is required before submitting." });
      return;
    }
    if (problemStatement.length < 30) {
      setNotification({ type: "error", msg: "Problem statement must be at least 30 characters long." });
      return;
    }
    if (solutionAbstract.length < 50) {
      setNotification({ type: "error", msg: "Solution abstract must be at least 50 characters long." });
      return;
    }
    setIsSubmittingStep1(true);
    try {
      const res = await fetch("/api/teams/submit-step1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          data: {
            name: teamName.trim(),
            track,
            problemStatement: problemStatement.trim(),
            solutionAbstract: solutionAbstract.trim(),
            slidesUrl: slidesInput.trim(),
          },
        }),
      });
      const data: ApiErrorResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit your idea.");
      setNotification({
        type: "success",
        msg: "Ideathon idea submitted successfully! Evaluators can now access your slide deck.",
      });
      await refreshData();
    } catch (err) {
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to submit your idea.") });
    } finally {
      setIsSubmittingStep1(false);
    }
  };

  // Step 2 Submit
  const handleStepTwoSubmit = async () => {
    if (!team) return;
    if (!techStack || !architecture) {
      setNotification({ type: "error", msg: "Please fill out both Tech Stack and System Architecture." });
      return;
    }
    if (architecture.length < 40) {
      setNotification({ type: "error", msg: "Architecture description must be at least 40 characters long." });
      return;
    }
    if (githubUrl && !githubUrl.startsWith("https://github.com/")) {
      setNotification({ type: "error", msg: "GitHub URL must start with https://github.com/..." });
      return;
    }
    setIsSubmittingStep2(true);
    try {
      const res = await fetch("/api/teams/submit-step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          data: {
            techStack: techStack.trim(),
            architectureDescription: architecture.trim(),
            githubUrl: githubUrl.trim(),
            risksAndMitigation: team.risksAndMitigation || "",
            hardwareBOM: bom.trim() || undefined,
          },
        }),
      });
      const data: ApiErrorResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit detailed architecture.");
      setNotification({
        type: "success",
        msg: "Detailed Architecture & BOM submitted successfully for Innovatz panel review.",
      });
      await refreshData();
    } catch (err) {
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to submit detailed architecture.") });
    } finally {
      setIsSubmittingStep2(false);
    }
  };

  // Withdraw Submission
  const handleWithdraw = async () => {
    if (!team) return;
    setIsWithdrawing(true);
    try {
      const res = await fetch("/api/teams/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      });
      const data: ApiErrorResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to withdraw submission.");
      setNotification({
        type: "error",
        msg: "Submission has been withdrawn. Contact the coordinator to resume as draft.",
      });
      await refreshData();
    } catch (err) {
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to withdraw submission.") });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Invite member
  const handleSendInvite = async () => {
    if (!team) return;
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setNotification({ type: "error", msg: "Enter a valid email address." });
      return;
    }
    if (team.members.length >= 6) {
      setNotification({ type: "error", msg: "Team is at maximum capacity (6 members)." });
      return;
    }
    setIsInviting(true);
    try {
      const res = await fetch("/api/teams/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          email: inviteEmail.toLowerCase().trim(),
          role: "MEMBER",
        }),
      });
      const data: ApiErrorResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invitation.");
      setInviteModalOpen(false);
      setInviteEmail("");
      setNotification({
        type: "success",
        msg: `Invitation dispatched to ${inviteEmail}. Member can accept from their portal.`,
      });
      await refreshData();
    } catch (err) {
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to send invitation.") });
    } finally {
      setIsInviting(false);
    }
  };

  // Transfer lead
  const handleTransferLead = async () => {
    if (!team || !newLeadId) return;
    const target = team.members.find((m) => m.userId === newLeadId);
    setIsTransferring(true);
    try {
      const res = await fetch("/api/teams/transfer-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, newLeadId }),
      });
      const data: ApiErrorResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer leadership.");
      setTransferLeadModalOpen(false);
      setNewLeadId("");
      setNotification({
        type: "success",
        msg: `Team leadership successfully transferred to ${target?.name || "the new lead"}.`,
      });
      await refreshData();
    } catch (err) {
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to transfer leadership.") });
    } finally {
      setIsTransferring(false);
    }
  };

  // Accept / decline a team invite from the guest landing
  const handleRespondInvite = async (invite: PendingInviteItem, decision: "ACCEPT" | "DECLINE") => {
    setRespondingInviteId(`${invite.token}:${decision}`);
    try {
      const res = await fetch("/api/teams/respond-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken: invite.token, decision }),
      });
      const data: ApiErrorResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond to invitation.");
      setNotification({
        type: "success",
        msg:
          decision === "ACCEPT"
            ? `You joined ${invite.team.name} (${invite.team.regCode}).`
            : `You declined the invitation from ${invite.team.name}.`,
      });
      await refreshData();
    } catch (err) {
      setNotification({ type: "error", msg: getErrorMessage(err, "Failed to respond to invitation.") });
    } finally {
      setRespondingInviteId(null);
    }
  };

  const isLead = myRole === "LEAD";
  const isShortlisted = team?.status === "SHORTLISTED" || team?.status === "INCL_INNOVATZ";
  const isChangesRequested = team?.status === "CHANGES_REQUESTED";
  const isWithdrawn = team?.status === "WITHDRAWN";

  const ideathonEvent = team?.edition?.events?.[0] ?? null;
  const deadlineLabel = formatDeadline(ideathonEvent?.submissionDeadline ?? null);
  const ideathonStageLabel = ideathonEvent?.status ? ideathonEvent.status.replace(/_/g, " ") : null;
  const editionIdeathonEvent = edition?.events?.find((e) => e.slug === "ideathon") ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Notifications */}
      {notification && (
        <Alert variant={notification.type === "success" ? "success" : "error"} title="Team Portal Update">
          {notification.msg}
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading your team data…</p>
        </div>
      )}

      {/* Load error state */}
      {!isLoading && loadError && (
        <Alert variant="error" title="Unable to Load Team Data">
          <div className="space-y-2">
            <p>{loadError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                setLoadError(null);
                loadData();
              }}
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Pending team invitations (accept / decline) */}
      {!isLoading && !loadError && pendingInvites.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900">📨 Pending Team Invitations</h2>
          {pendingInvites.map((inv) => (
            <div
              key={inv.token}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{inv.team.name}</p>
                <p className="text-xs text-slate-500 font-mono">
                  {inv.team.regCode} • Track: {inv.team.track || "—"} • Invited as {inv.role}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRespondInvite(inv, "DECLINE")}
                  disabled={respondingInviteId !== null}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleRespondInvite(inv, "ACCEPT")}
                  isLoading={respondingInviteId === `${inv.token}:ACCEPT`}
                  disabled={respondingInviteId !== null && respondingInviteId !== `${inv.token}:ACCEPT`}
                >
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guest / no-team landing with team creation */}
      {!isLoading && !loadError && !team && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Build Your HackTrack Team</h1>
            <p className="mt-1 text-sm text-slate-500">
              You are not on a team for this edition yet. Accept a pending invitation above or register a new team
              below. Solo registration is allowed.
            </p>
            {editionIdeathonEvent && (
              <p className="mt-2 text-xs text-slate-500">
                Ideathon Stage: {editionIdeathonEvent.status.replace(/_/g, " ")} • Submission Deadline:{" "}
                {formatDeadline(editionIdeathonEvent.submissionDeadline)}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600 uppercase">New Team</span>
                <h2 className="text-lg font-bold text-slate-900">Register Your Team</h2>
              </div>
              <Badge variant="info">Solo Allowed</Badge>
            </div>

            <Input
              label="Team / Idea Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Enter your team or idea name"
            />

            <Select
              label="Track Category"
              value={createTrack}
              onChange={(e) => setCreateTrack(e.target.value)}
              options={TRACK_OPTIONS}
            />

            <div>
              <label htmlFor="create-problem" className="block text-sm font-medium text-slate-700 mb-1">
                Problem Statement (optional, min 30 chars)
              </label>
              <textarea
                id="create-problem"
                rows={3}
                value={createProblem}
                onChange={(e) => setCreateProblem(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none bg-white"
                placeholder="What critical challenge or unmet need are you solving?"
              />
            </div>

            <div>
              <label htmlFor="create-solution" className="block text-sm font-medium text-slate-700 mb-1">
                Proposed Solution & Innovation (optional, min 50 chars)
              </label>
              <textarea
                id="create-solution"
                rows={4}
                value={createSolution}
                onChange={(e) => setCreateSolution(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none bg-white"
                placeholder="Describe your technical solution and how it differs from existing products..."
              />
            </div>

            <div>
              <label htmlFor="create-slides" className="block text-sm font-bold text-slate-900">
                Google Slides Shareable URL <span className="font-normal text-slate-500">(optional at creation)</span>
              </label>
              <p className="text-xs text-slate-500">
                Must be set to &quot;Anyone with the link can view&quot;. Required before final submission.
              </p>
              <input
                id="create-slides"
                type="url"
                value={createSlides}
                onChange={(e) => handleCreateSlidesChange(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none bg-white mt-1"
                placeholder="https://docs.google.com/presentation/d/YOUR_SLIDES_ID/edit?usp=sharing"
              />
              {createSlidesError && <p className="text-xs text-rose-600 font-semibold mt-1">{createSlidesError}</p>}
            </div>

            {!edition?.id && (
              <Alert variant="warning" title="Edition Context Unavailable">
                Team creation requires the edition context, which could not be loaded. Contact a coordinator for
                assistance.
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="primary" onClick={handleCreateTeam} isLoading={isCreating} disabled={!edition?.id}>
                Create Team
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Changes Requested Coordinator Banner */}
      {team && isChangesRequested && (
        <Alert variant="warning" title="⚠️ Coordinator Requested Revisions">
          <p className="font-semibold text-amber-900 mt-1">Feedback from Evaluation Coordinator:</p>
          <p className="mt-0.5 text-xs italic bg-white/70 p-2.5 rounded border border-amber-200">
            &quot;
            {team.coordinatorFeedback ||
              "The coordinator requested revisions but did not attach specific notes. Please review your submission."}
            &quot;
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Your idea submission has been unlocked for edits. Make required updates and click &quot;Submit for Review&quot;.
          </p>
        </Alert>
      )}

      {/* Withdrawn Notice Banner */}
      {team && isWithdrawn && (
        <Alert variant="error" title="Submission Withdrawn">
          This idea submission is currently marked as Withdrawn.
          <p className="mt-1 text-xs text-rose-800">
            {isLead
              ? "To resume your submission, contact the evaluation coordinator to re-open your idea for revisions."
              : "Your Team Lead can request to resume the submission via a coordinator."}
          </p>
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
                <Badge variant={getStatusBadgeVariant(team.status)}>{team.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Track: {team.track || "—"} • {team.members.length} of 6 Members (Solo Allowed) • Ideathon Deadline:{" "}
                {deadlineLabel}
                {ideathonStageLabel ? ` • Ideathon Stage: ${ideathonStageLabel}` : ""}
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

          {/* Pending team invites (sent to this team) */}
          {team.teamInvites.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase text-amber-600">Pending Invites:</span>
              {team.teamInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-1.5 text-xs"
                >
                  <span className="font-semibold text-slate-800">{inv.email}</span>
                  <span className="text-slate-500 font-mono">({inv.role})</span>
                  <Badge variant="warning" size="sm">
                    pending
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Two-Step Idea Form */}
      {team && (
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
                options={TRACK_OPTIONS}
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
                    Must be set to &quot;Anyone with the link can view&quot;. This deck renders embedded on every
                    evaluator&apos;s scoring cockpit.
                  </p>
                </div>

                <input
                  id="slides-url"
                  type="url"
                  value={slidesInput}
                  onChange={(e) => handleUpdateSlides(e.target.value)}
                  disabled={!isLead || isWithdrawn}
                  className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none bg-white"
                  placeholder="https://docs.google.com/presentation/d/YOUR_SLIDES_ID/edit?usp=sharing"
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
                          In Google Slides, click <strong>Share</strong> → change from &quot;Restricted&quot; to{" "}
                          <strong>&quot;Anyone with the link&quot;</strong> as <strong>Viewer</strong>.
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
                  <Button
                    variant="outline"
                    onClick={handleWithdraw}
                    isLoading={isWithdrawing}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    Withdraw Idea
                  </Button>
                  <Button variant="primary" onClick={handleStepOneSubmit} isLoading={isSubmittingStep1}>
                    Submit for Review
                  </Button>
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
                  Teams advancing past the Ideathon cutoff (Top teams selected for Innovatz Live Pitch) gain access to
                  submit their engineering architecture, GitHub repository, and hardware BOM.
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                <Alert variant="success" title="🎉 Congratulations! Your team is Shortlisted">
                  Your team has qualified for Innovatz. Please complete this detailed architecture specification prior
                  to panel defense.
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
                    <Button variant="primary" onClick={handleStepTwoSubmit} isLoading={isSubmittingStep2}>
                      Submit Detailed Architecture
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
            <Button onClick={handleSendInvite} isLoading={isInviting}>
              Dispatch Invite
            </Button>
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
                .map((m) => ({ value: m.userId, label: `${m.name} (${m.email})` })) || []),
            ]}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setTransferLeadModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransferLead} disabled={!newLeadId} isLoading={isTransferring}>
              Confirm Transfer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}