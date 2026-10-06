import { prisma } from "@/lib/prisma";
import { TeamStatus, TeamRole } from "@prisma/client";
import { validateGoogleSlidesUrl } from "./team-service";
import { recordAuditLog } from "./audit-service";

export interface StepOneIdeaInput {
  name?: string;
  track?: string;
  problemStatement: string;
  solutionAbstract: string;
  slidesUrl: string;
}

export interface StepTwoIdeaInput {
  techStack: string;
  architectureDescription: string;
  githubUrl: string;
  risksAndMitigation: string;
  hardwareBOM?: string;
}

/**
 * Submits Step 1 (Short Idea Form for Ideathon Registration).
 */
export async function submitIdeaStepOne(params: {
  teamId: string;
  userId: string;
  data: StepOneIdeaInput;
}) {
  const { teamId, userId, data } = params;

  // 1. Verify user is LEAD
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: { include: { edition: true } } },
  });

  if (!member || member.role !== TeamRole.LEAD) {
    throw new Error("Only the Team Lead can submit or update the idea registration.");
  }

  // 2. Enforce Ideathon submission deadline
  const ideathonEvent = await prisma.event.findFirst({
    where: {
      editionId: member.team.editionId,
      slug: "ideathon",
    },
  });

  if (ideathonEvent?.submissionDeadline && new Date() > ideathonEvent.submissionDeadline) {
    throw new Error("Submission deadline for Ideathon has passed. Form is locked.");
  }

  // 3. Validation checks
  if (!data.problemStatement || data.problemStatement.trim().length < 30) {
    throw new Error("Problem statement must be at least 30 characters long.");
  }

  if (!data.solutionAbstract || data.solutionAbstract.trim().length < 50) {
    throw new Error("Solution abstract must be at least 50 characters long.");
  }

  const slidesCheck = validateGoogleSlidesUrl(data.slidesUrl);
  if (!slidesCheck.valid) {
    throw new Error(slidesCheck.error);
  }

  // 4. Update Team to SUBMITTED
  return prisma.team.update({
    where: { id: teamId },
    data: {
      name: data.name ? data.name.trim() : undefined,
      track: data.track ? data.track.trim() : undefined,
      problemStatement: data.problemStatement.trim(),
      solutionAbstract: data.solutionAbstract.trim(),
      slidesUrl: data.slidesUrl.trim(),
      embedSlidesUrl: slidesCheck.embedUrl,
      status: TeamStatus.SUBMITTED,
    },
  });
}

/**
 * Submits Step 2 (Detailed Idea Form - Unlocked for Shortlisted Teams).
 */
export async function submitIdeaStepTwo(params: {
  teamId: string;
  userId: string;
  data: StepTwoIdeaInput;
}) {
  const { teamId, userId, data } = params;

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });

  if (!member || member.role !== TeamRole.LEAD) {
    throw new Error("Only the Team Lead can submit detailed architecture specifications.");
  }

  // Enforce Step 2 gating: Team must be SHORTLISTED
  if (member.team.status !== TeamStatus.SHORTLISTED && member.team.status !== TeamStatus.INCL_INNOVATZ) {
    throw new Error(
      `Step 2 detailed submission is locked. Current status: ${member.team.status}. Only Shortlisted teams can access this stage.`
    );
  }

  if (!data.techStack || data.techStack.trim() === "") {
    throw new Error("Tech stack specification is required.");
  }

  if (!data.architectureDescription || data.architectureDescription.trim().length < 40) {
    throw new Error("Architecture description must be at least 40 characters long.");
  }

  if (data.githubUrl && !data.githubUrl.startsWith("https://github.com/")) {
    throw new Error("GitHub URL must start with https://github.com/...");
  }

  return prisma.team.update({
    where: { id: teamId },
    data: {
      techStack: data.techStack.trim(),
      architectureDescription: data.architectureDescription.trim(),
      githubUrl: data.githubUrl ? data.githubUrl.trim() : null,
      risksAndMitigation: data.risksAndMitigation ? data.risksAndMitigation.trim() : null,
      hardwareBOM: data.hardwareBOM ? data.hardwareBOM.trim() : null,
    },
  });
}

/**
 * Withdraws a team submission.
 */
export async function withdrawSubmission(params: { teamId: string; userId: string }) {
  const { teamId, userId } = params;

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });

  if (!member || member.role !== TeamRole.LEAD) {
    throw new Error("Only the Team Lead can withdraw the submission.");
  }

  return prisma.team.update({
    where: { id: teamId },
    data: { status: TeamStatus.WITHDRAWN },
  });
}

/**
 * Reverts a withdrawn team back to DRAFT before deadline.
 */
export async function revertWithdrawalToDraft(params: { teamId: string; userId: string }) {
  const { teamId, userId } = params;

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });

  if (!member || member.role !== TeamRole.LEAD) {
    throw new Error("Only the Team Lead can resume draft status.");
  }

  return prisma.team.update({
    where: { id: teamId },
    data: { status: TeamStatus.DRAFT },
  });
}

/**
 * Coordinator (Manage) Request-Changes Flow: Unlocks submission with feedback remarks.
 */
export async function requestChangesOnIdea(params: {
  teamId: string;
  coordinatorId: string;
  remarks: string;
}) {
  const { teamId, coordinatorId, remarks } = params;

  if (!remarks || remarks.trim().length < 10) {
    throw new Error("Feedback remarks must be at least 10 characters long.");
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team not found.");

  const updatedTeam = await prisma.team.update({
    where: { id: teamId },
    data: {
      status: TeamStatus.CHANGES_REQUESTED,
      coordinatorFeedback: remarks.trim(),
      changesRequestedAt: new Date(),
    },
  });

  await recordAuditLog({
    editionId: team.editionId,
    actorId: coordinatorId,
    action: "CHANGES_REQUESTED",
    entityType: "Team",
    entityId: teamId,
    previousState: { status: team.status },
    newState: { status: TeamStatus.CHANGES_REQUESTED, feedback: remarks },
  });

  return updatedTeam;
}

/**
 * Bulk Shortlist or Reject teams (by Top N, Top Percentage, or explicit selection).
 */
export async function bulkProcessTeams(params: {
  editionId: string;
  coordinatorId: string;
  action: "SHORTLIST" | "REJECT";
  filterType: "TOP_N" | "PERCENTAGE" | "SELECTED";
  value?: number;
  selectedTeamIds?: string[];
  note: string;
}) {
  const { editionId, coordinatorId, action, filterType, value = 0, selectedTeamIds = [], note } = params;

  // 1. Fetch eligible candidate teams in SUBMITTED state
  const candidateTeams = await prisma.team.findMany({
    where: {
      editionId,
      status: { in: [TeamStatus.SUBMITTED, TeamStatus.CHANGES_REQUESTED, TeamStatus.SHORTLISTED] },
    },
    orderBy: { createdAt: "asc" },
  });

  let targetTeamIds: string[] = [];

  if (filterType === "SELECTED") {
    targetTeamIds = selectedTeamIds;
  } else if (filterType === "TOP_N") {
    targetTeamIds = candidateTeams.slice(0, Math.max(0, value)).map((t) => t.id);
  } else if (filterType === "PERCENTAGE") {
    const countToTake = Math.ceil((candidateTeams.length * Math.min(100, Math.max(0, value))) / 100);
    targetTeamIds = candidateTeams.slice(0, countToTake).map((t) => t.id);
  }

  if (targetTeamIds.length === 0) {
    return { count: 0, updatedIds: [] };
  }

  const targetStatus = action === "SHORTLIST" ? TeamStatus.SHORTLISTED : TeamStatus.ELIMINATED;

  // 2. Batch update target teams
  await prisma.team.updateMany({
    where: { id: { in: targetTeamIds } },
    data: {
      status: targetStatus,
      coordinatorFeedback: note.trim() || undefined,
    },
  });

  await recordAuditLog({
    editionId,
    actorId: coordinatorId,
    action: `BULK_TEAMS_${action}`,
    entityType: "Team",
    entityId: editionId,
    newState: {
      action,
      filterType,
      targetCount: targetTeamIds.length,
      note,
    },
  });

  return {
    count: targetTeamIds.length,
    updatedIds: targetTeamIds,
  };
}
