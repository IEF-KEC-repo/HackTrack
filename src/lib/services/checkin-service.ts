import { prisma } from "@/lib/prisma";
import { TeamHealth } from "@prisma/client";

export type CheckInCadenceStatus = "ON_TRACK" | "CHECKIN_DUE" | "CHECKIN_OVERDUE";

export interface CadenceSummary {
  daysSinceLastCheckIn: number | null;
  status: CheckInCadenceStatus;
  isOverdue: boolean;
  daysOverdue: number;
  daysRemaining: number;
  message: string;
}

/**
 * Pure function: Evaluates team check-in cadence against the 14-day fortnightly standard.
 */
export function evaluateCheckInCadence(
  lastCheckInDate: Date | null,
  now: Date = new Date(),
  cadenceDays: number = 14
): CadenceSummary {
  if (!lastCheckInDate) {
    return {
      daysSinceLastCheckIn: null,
      status: "CHECKIN_DUE",
      isOverdue: false,
      daysOverdue: 0,
      daysRemaining: 0,
      message: "Initial fortnightly check-in is pending.",
    };
  }

  const lastTime = new Date(lastCheckInDate).getTime();
  const nowTime = now.getTime();
  const elapsedMs = Math.max(0, nowTime - lastTime);
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  if (elapsedDays > cadenceDays) {
    const daysOverdue = elapsedDays - cadenceDays;
    return {
      daysSinceLastCheckIn: elapsedDays,
      status: "CHECKIN_OVERDUE",
      isOverdue: true,
      daysOverdue,
      daysRemaining: 0,
      message: `Fortnightly check-in is overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}.`,
    };
  }

  const daysRemaining = cadenceDays - elapsedDays;
  if (elapsedDays >= 10) {
    return {
      daysSinceLastCheckIn: elapsedDays,
      status: "CHECKIN_DUE",
      isOverdue: false,
      daysOverdue: 0,
      daysRemaining,
      message: `Next check-in due soon (in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}).`,
    };
  }

  return {
    daysSinceLastCheckIn: elapsedDays,
    status: "ON_TRACK",
    isOverdue: false,
    daysOverdue: 0,
    daysRemaining,
    message: `Check-in on track. Next review in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}.`,
  };
}

/**
 * Database operation: Team submits their fortnightly self-report.
 */
export async function submitTeamCheckIn(params: {
  teamId: string;
  userId: string;
  progressNotes: string;
  blockers?: string;
  nextGoals?: string;
  health: TeamHealth;
  evidenceUrl?: string;
}) {
  const { teamId, userId, progressNotes, blockers, nextGoals, health, evidenceUrl } = params;

  if (!progressNotes || progressNotes.trim().length === 0) {
    throw new Error("Progress summary cannot be empty.");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { mentorId: true, editionId: true },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  const checkIn = await prisma.checkIn.create({
    data: {
      teamId,
      mentorId: team.mentorId,
      meetingDate: new Date(),
      health,
      notes: progressNotes.trim(),
      progressNotes: progressNotes.trim(),
      blockers: blockers?.trim(),
      nextGoals: nextGoals?.trim(),
      evidenceUrl: evidenceUrl?.trim(),
      submittedByRole: "TEAM",
      submittedAt: new Date(),
    },
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      editionId: team.editionId,
      actorId: userId,
      action: "TEAM_CHECKIN_SUBMITTED",
      entityType: "CheckIn",
      entityId: checkIn.id,
      newState: JSON.stringify({ teamId, health }),
    },
  });

  return checkIn;
}

/**
 * Database operation: Mentor logs meeting notes and sets official team health rating.
 */
export async function logMentorCheckIn(params: {
  teamId: string;
  mentorId: string;
  meetingDate?: Date;
  notes: string;
  actionItems?: string;
  health: TeamHealth;
}) {
  const { teamId, mentorId, meetingDate = new Date(), notes, actionItems, health } = params;

  if (!notes || notes.trim().length === 0) {
    throw new Error("Meeting notes cannot be empty.");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, mentorId: true, editionId: true },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  if (team.mentorId !== mentorId) {
    throw new Error("Unauthorized: You are not the assigned mentor for this team.");
  }

  const checkIn = await prisma.checkIn.create({
    data: {
      teamId,
      mentorId,
      meetingDate,
      health,
      notes: notes.trim(),
      actionItems: actionItems?.trim(),
      submittedByRole: "MENTOR",
      submittedAt: new Date(),
      reviewedAt: new Date(),
    },
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      editionId: team.editionId,
      actorId: mentorId,
      action: "MENTOR_CHECKIN_LOGGED",
      entityType: "CheckIn",
      entityId: checkIn.id,
      newState: JSON.stringify({ teamId, health, meetingDate }),
    },
  });

  return checkIn;
}

/**
 * Database operation: Retrieves all check-ins for a team with evaluated cadence.
 */
export async function getTeamCheckInHistory(teamId: string, now: Date = new Date()) {
  const checkIns = await prisma.checkIn.findMany({
    where: { teamId },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const latestCheckIn = checkIns[0];
  const cadence = evaluateCheckInCadence(
    latestCheckIn ? latestCheckIn.createdAt : null,
    now
  );

  return {
    checkIns,
    latestCheckIn,
    cadence,
  };
}
