import { prisma } from "@/lib/prisma";
import { evaluateMilestoneDueStatus } from "./milestone-service";
import { evaluateCheckInCadence } from "./checkin-service";

export interface MilestoneJobReport {
  scannedMilestones: number;
  updatedMilestones: number;
  overdueMilestones: number;
  dueSoonMilestones: number;
  scannedTeams: number;
  overdueCheckInTeams: number;
  flaggedTeams: Array<{
    teamId: string;
    regCode: string;
    name: string;
    reason: string;
  }>;
}

/**
 * Scheduled Alert Job: Scans all milestones in an edition, updates isOverdue and isDueSoon flags,
 * evaluates fortnightly check-in cadences, and returns a detailed status report.
 */
export async function runMilestoneAlertsJob(params: {
  editionId: string;
  now?: Date;
  actorId?: string;
}): Promise<MilestoneJobReport> {
  const { editionId, now = new Date(), actorId = "SYSTEM_CRON" } = params;

  // 1. Fetch all milestones for the edition
  const milestones = await prisma.teamMilestone.findMany({
    where: { editionId },
    select: {
      id: true,
      teamId: true,
      dueDate: true,
      status: true,
      isOverdue: true,
      isDueSoon: true,
      team: { select: { id: true, regCode: true, name: true } },
    },
  });

  let updatedMilestones = 0;
  let overdueMilestones = 0;
  let dueSoonMilestones = 0;
  const flaggedTeamsMap = new Map<string, { teamId: string; regCode: string; name: string; reason: string }>();

  for (const m of milestones) {
    const dueInfo = evaluateMilestoneDueStatus(m.dueDate, m.status, now);

    if (dueInfo.isOverdue) overdueMilestones++;
    if (dueInfo.isDueSoon) dueSoonMilestones++;

    if (m.isOverdue !== dueInfo.isOverdue || m.isDueSoon !== dueInfo.isDueSoon) {
      await prisma.teamMilestone.update({
        where: { id: m.id },
        data: {
          isOverdue: dueInfo.isOverdue,
          isDueSoon: dueInfo.isDueSoon,
        },
      });
      updatedMilestones++;
    }

    if (dueInfo.isOverdue && m.team) {
      flaggedTeamsMap.set(m.team.id, {
        teamId: m.team.id,
        regCode: m.team.regCode,
        name: m.team.name,
        reason: `Overdue milestone (${dueInfo.daysOverdue} days past due)`,
      });
    }
  }

  // 2. Scan Teams for Fortnightly Check-In Cadence
  const teams = await prisma.team.findMany({
    where: { editionId },
    select: {
      id: true,
      regCode: true,
      name: true,
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  let overdueCheckInTeams = 0;
  for (const team of teams) {
    const latestDate = team.checkIns[0]?.createdAt || null;
    const cadence = evaluateCheckInCadence(latestDate, now);

    if (cadence.status === "CHECKIN_OVERDUE") {
      overdueCheckInTeams++;
      const existing = flaggedTeamsMap.get(team.id);
      if (existing) {
        existing.reason += ` & Check-in overdue (${cadence.daysOverdue} days)`;
      } else {
        flaggedTeamsMap.set(team.id, {
          teamId: team.id,
          regCode: team.regCode,
          name: team.name,
          reason: `Fortnightly check-in overdue (${cadence.daysOverdue} days)`,
        });
      }
    }
  }

  const report: MilestoneJobReport = {
    scannedMilestones: milestones.length,
    updatedMilestones,
    overdueMilestones,
    dueSoonMilestones,
    scannedTeams: teams.length,
    overdueCheckInTeams,
    flaggedTeams: Array.from(flaggedTeamsMap.values()),
  };

  // 3. Record Audit Log
  await prisma.auditLog.create({
    data: {
      editionId,
      actorId,
      action: "MILESTONE_ALERTS_JOB_EXECUTED",
      entityType: "Edition",
      entityId: editionId,
      newState: JSON.stringify({
        scannedMilestones: report.scannedMilestones,
        overdueMilestones: report.overdueMilestones,
        dueSoonMilestones: report.dueSoonMilestones,
        overdueCheckInTeams: report.overdueCheckInTeams,
      }),
    },
  });

  return report;
}
