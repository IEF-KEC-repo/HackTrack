import { prisma } from "@/lib/prisma";
import { EditionRole } from "@prisma/client";
import { calculateTeamProgress, evaluateMilestoneDueStatus } from "./milestone-service";
import { evaluateCheckInCadence } from "./checkin-service";

/**
 * Coordinator operation: Assigns or reassigns a mentor to a team.
 */
export async function assignMentorToTeam(params: {
  teamId: string;
  mentorId: string | null;
  coordinatorId: string;
}) {
  const { teamId, mentorId, coordinatorId } = params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, regCode: true, mentorId: true, editionId: true },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  if (mentorId) {
    // Verify target user has MENTOR role in this edition
    const mentorMembership = await prisma.editionMembership.findUnique({
      where: {
        userId_editionId: { userId: mentorId, editionId: team.editionId },
      },
      include: { user: true },
    });

    if (!mentorMembership || mentorMembership.role !== EditionRole.MENTOR) {
      throw new Error("Target user is not registered as a Mentor for this edition.");
    }
  }

  const updatedTeam = await prisma.team.update({
    where: { id: teamId },
    data: { mentorId },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
    },
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      editionId: team.editionId,
      actorId: coordinatorId,
      action: "MENTOR_ASSIGNED",
      entityType: "Team",
      entityId: team.id,
      previousState: JSON.stringify({ mentorId: team.mentorId }),
      newState: JSON.stringify({ mentorId }),
    },
  });

  return updatedTeam;
}

/**
 * Mentor query: Fetches ONLY teams assigned to the specified mentor.
 * Enforces strict mentor isolation — mentors have zero visibility into other teams.
 */
export async function getMentorAssignedTeams(params: {
  mentorId: string;
  editionId: string;
  now?: Date;
}) {
  const { mentorId, editionId, now = new Date() } = params;

  // Strict WHERE constraint: mentorId MUST match
  const teams = await prisma.team.findMany({
    where: {
      mentorId,
      editionId,
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      teamMilestones: {
        orderBy: { dueDate: "asc" },
      },
      checkIns: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return teams.map((team) => {
    const milestonesWithDue = team.teamMilestones.map((m) => {
      const dueInfo = evaluateMilestoneDueStatus(m.dueDate, m.status, now);
      return {
        ...m,
        isOverdue: dueInfo.isOverdue,
        isDueSoon: dueInfo.isDueSoon,
        daysOverdue: dueInfo.daysOverdue,
      };
    });

    const progress = calculateTeamProgress(team.teamMilestones);
    const overdueCount = milestonesWithDue.filter((m) => m.isOverdue).length;

    const latestCheckIn = team.checkIns[0] || null;
    const cadence = evaluateCheckInCadence(
      latestCheckIn ? latestCheckIn.createdAt : null,
      now
    );

    return {
      id: team.id,
      regCode: team.regCode,
      name: team.name,
      track: team.track,
      status: team.status,
      members: team.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      milestones: milestonesWithDue,
      progress,
      overdueCount,
      checkIns: team.checkIns,
      latestCheckIn,
      cadence,
      currentHealth: latestCheckIn?.health || "GREEN",
    };
  });
}
