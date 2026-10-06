import { prisma } from "@/lib/prisma";
import { MilestoneSource, MilestoneStatus, EvidenceType } from "@prisma/client";

export interface ProgressSummary {
  mandatoryTotal: number;
  mandatoryCompleted: number;
  mandatoryProgressPercent: number;
  customTotal: number;
  customCompleted: number;
  totalCompleted: number;
  totalMilestones: number;
  overallProgressPercent: number;
}

export interface DueStatusSummary {
  isOverdue: boolean;
  isDueSoon: boolean;
  daysOverdue: number;
  hoursRemaining: number;
}

/**
 * Pure function: Calculates milestone progress percentages for a team.
 * Follows HackTrack rule: Progress % is based on Mandatory (Coordinator-defined) milestones.
 */
export function calculateTeamProgress(
  milestones: Array<{ source: MilestoneSource | string; status: MilestoneStatus | string }>
): ProgressSummary {
  if (!milestones || milestones.length === 0) {
    return {
      mandatoryTotal: 0,
      mandatoryCompleted: 0,
      mandatoryProgressPercent: 100, // No mandatory milestones defined yet
      customTotal: 0,
      customCompleted: 0,
      totalCompleted: 0,
      totalMilestones: 0,
      overallProgressPercent: 100,
    };
  }

  let mandatoryTotal = 0;
  let mandatoryCompleted = 0;
  let customTotal = 0;
  let customCompleted = 0;

  for (const m of milestones) {
    const isCompleted = m.status === MilestoneStatus.COMPLETED || m.status === "COMPLETED";
    if (m.source === MilestoneSource.COORDINATOR_MANDATORY || m.source === "COORDINATOR_MANDATORY") {
      mandatoryTotal++;
      if (isCompleted) mandatoryCompleted++;
    } else {
      customTotal++;
      if (isCompleted) customCompleted++;
    }
  }

  const mandatoryProgressPercent =
    mandatoryTotal > 0
      ? Math.round((mandatoryCompleted / mandatoryTotal) * 1000) / 10
      : 100;

  const totalMilestones = mandatoryTotal + customTotal;
  const totalCompleted = mandatoryCompleted + customCompleted;
  const overallProgressPercent =
    totalMilestones > 0
      ? Math.round((totalCompleted / totalMilestones) * 1000) / 10
      : 100;

  return {
    mandatoryTotal,
    mandatoryCompleted,
    mandatoryProgressPercent,
    customTotal,
    customCompleted,
    totalCompleted,
    totalMilestones,
    overallProgressPercent,
  };
}

/**
 * Pure function: Evaluates whether a milestone is overdue or due soon.
 * - OVERDUE: status != COMPLETED and now > dueDate
 * - DUE_SOON: status != COMPLETED and now <= dueDate <= now + 48 hours
 */
export function evaluateMilestoneDueStatus(
  dueDate: Date,
  status: MilestoneStatus | string,
  now: Date = new Date()
): DueStatusSummary {
  const isCompleted = status === MilestoneStatus.COMPLETED || status === "COMPLETED";

  if (isCompleted) {
    return {
      isOverdue: false,
      isDueSoon: false,
      daysOverdue: 0,
      hoursRemaining: 0,
    };
  }

  const dueTime = new Date(dueDate).getTime();
  const nowTime = now.getTime();
  const diffMs = dueTime - nowTime;

  if (diffMs < 0) {
    // Overdue
    const msOverdue = Math.abs(diffMs);
    const daysOverdue = Math.max(1, Math.ceil(msOverdue / (1000 * 60 * 60 * 24)));
    return {
      isOverdue: true,
      isDueSoon: false,
      daysOverdue,
      hoursRemaining: 0,
    };
  } else {
    // Due in future
    const hoursRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
    const isDueSoon = hoursRemaining <= 48; // Within 48 hours
    return {
      isOverdue: false,
      isDueSoon,
      daysOverdue: 0,
      hoursRemaining,
    };
  }
}

/**
 * Database operation: Coordinator defines a mandatory milestone for an event stage.
 * Automatically propagates to all active teams in the edition.
 */
export async function createCoordinatorMilestone(params: {
  editionId: string;
  eventId?: string;
  title: string;
  description?: string;
  dueDate: Date;
  coordinatorId: string;
}) {
  const { editionId, eventId, title, description, dueDate, coordinatorId } = params;

  if (!title || title.trim().length === 0) {
    throw new Error("Milestone title cannot be empty.");
  }

  // 1. Create parent Milestone template
  const milestone = await prisma.milestone.create({
    data: {
      editionId,
      eventId,
      title: title.trim(),
      description: description?.trim(),
      dueDate,
      isRequired: true,
    },
  });

  // 2. Fetch all teams in the edition
  const teams = await prisma.team.findMany({
    where: { editionId },
    select: { id: true },
  });

  // 3. Instantiate TeamMilestone for each team
  if (teams.length > 0) {
    await prisma.teamMilestone.createMany({
      data: teams.map((t) => ({
        teamId: t.id,
        editionId,
        eventId,
        milestoneId: milestone.id,
        title: title.trim(),
        description: description?.trim(),
        dueDate,
        source: MilestoneSource.COORDINATOR_MANDATORY,
        status: MilestoneStatus.NOT_STARTED,
      })),
    });
  }

  // 4. Audit Log
  await prisma.auditLog.create({
    data: {
      editionId,
      actorId: coordinatorId,
      action: "MANDATORY_MILESTONE_CREATED",
      entityType: "Milestone",
      entityId: milestone.id,
      newState: JSON.stringify({ title, eventId, dueDate, propagatedToTeams: teams.length }),
    },
  });

  return milestone;
}

/**
 * Database operation: Team creates a custom rolling milestone.
 */
export async function createTeamCustomMilestone(params: {
  teamId: string;
  editionId: string;
  eventId?: string;
  title: string;
  description?: string;
  dueDate: Date;
}) {
  const { teamId, editionId, eventId, title, description, dueDate } = params;

  if (!title || title.trim().length === 0) {
    throw new Error("Milestone title cannot be empty.");
  }

  return await prisma.teamMilestone.create({
    data: {
      teamId,
      editionId,
      eventId,
      title: title.trim(),
      description: description?.trim(),
      dueDate,
      source: MilestoneSource.TEAM_CUSTOM,
      status: MilestoneStatus.NOT_STARTED,
    },
  });
}

/**
 * Database operation: Updates milestone progress and attaches evidence (Link or File).
 */
export async function updateMilestoneProgress(params: {
  teamMilestoneId: string;
  status: MilestoneStatus;
  evidenceType?: EvidenceType;
  evidenceUrl?: string;
  evidenceFileId?: string;
  evidenceNotes?: string;
}) {
  const { teamMilestoneId, status, evidenceType, evidenceUrl, evidenceFileId, evidenceNotes } =
    params;

  const milestone = await prisma.teamMilestone.findUnique({
    where: { id: teamMilestoneId },
  });

  if (!milestone) {
    throw new Error("Team milestone not found.");
  }

  const completedAt =
    status === MilestoneStatus.COMPLETED
      ? milestone.completedAt || new Date()
      : null;

  return await prisma.teamMilestone.update({
    where: { id: teamMilestoneId },
    data: {
      status,
      evidenceType: evidenceType || milestone.evidenceType,
      evidenceUrl: evidenceUrl !== undefined ? evidenceUrl : milestone.evidenceUrl,
      evidenceFileId: evidenceFileId !== undefined ? evidenceFileId : milestone.evidenceFileId,
      evidenceNotes: evidenceNotes !== undefined ? evidenceNotes : milestone.evidenceNotes,
      completedAt,
      isOverdue: status === MilestoneStatus.COMPLETED ? false : milestone.isOverdue,
      isDueSoon: status === MilestoneStatus.COMPLETED ? false : milestone.isDueSoon,
    },
    include: {
      evidenceFile: true,
      event: { select: { id: true, name: true, slug: true, uploadsEnabled: true } },
    },
  });
}

/**
 * Database operation: Retrieves all milestones for a team with evaluated due statuses and progress metrics.
 */
export async function getTeamMilestones(teamId: string, now: Date = new Date()) {
  const milestones = await prisma.teamMilestone.findMany({
    where: { teamId },
    include: {
      evidenceFile: true,
      event: { select: { id: true, name: true, slug: true, uploadsEnabled: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const milestonesWithDueStatus = milestones.map((m) => {
    const dueInfo = evaluateMilestoneDueStatus(m.dueDate, m.status, now);
    return {
      ...m,
      isOverdue: dueInfo.isOverdue,
      isDueSoon: dueInfo.isDueSoon,
      daysOverdue: dueInfo.daysOverdue,
      hoursRemaining: dueInfo.hoursRemaining,
    };
  });

  const progress = calculateTeamProgress(milestones);

  return {
    milestones: milestonesWithDueStatus,
    progress,
  };
}
