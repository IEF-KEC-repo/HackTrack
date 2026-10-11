import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { canMutateEventConfig } from "@/lib/permissions";
import {
  createCoordinatorMilestone,
  calculateTeamProgress,
  evaluateMilestoneDueStatus,
} from "@/lib/services/milestone-service";
import { evaluateCheckInCadence } from "@/lib/services/checkin-service";
import { assignMentorToTeam } from "@/lib/services/mentor-service";
import { runMilestoneAlertsJob } from "@/lib/services/milestone-job-service";
import { EditionRole } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];
  const editionSlug = req.nextUrl.searchParams.get("edition") || "ht26";

  try {
    const edition = await prisma.edition.findUnique({
      where: { slug: editionSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!edition) {
      return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    }

    // ----------------------------------------------------
    // GET: COHORT PROGRESS, MILESTONES & MENTOR ASSIGNMENTS
    // ----------------------------------------------------
    if (action === "cohort") {
      const now = new Date();

      // 1. Fetch Teams with Milestones, CheckIns, and Mentor
      const teams = await prisma.team.findMany({
        where: { editionId: edition.id },
        include: {
          mentor: { select: { id: true, name: true, email: true } },
          teamMilestones: {
            orderBy: { dueDate: "asc" },
          },
          checkIns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { mentor: { select: { id: true, name: true } } },
          },
        },
        orderBy: { regCode: "asc" },
      });

      // 2. Fetch Events for this edition
      const events = await prisma.event.findMany({
        where: { editionId: edition.id },
        select: {
          id: true,
          name: true,
          slug: true,
          sequenceIndex: true,
          status: true,
        },
        orderBy: { sequenceIndex: "asc" },
      });

      // 3. Fetch Mentors in this Edition
      const mentorMemberships = await prisma.editionMembership.findMany({
        where: { editionId: edition.id, role: EditionRole.MENTOR },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      const availableMentors = mentorMemberships.map((m) => m.user);

      // 4. Calculate Cohort Metrics
      let totalMandatorySum = 0;
      let totalMandatoryCompletedSum = 0;
      let totalOverdueMilestones = 0;
      let redHealthCount = 0;
      let overdueCheckInCount = 0;

      const cohortTeams = teams.map((team) => {
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

        totalMandatorySum += progress.mandatoryTotal;
        totalMandatoryCompletedSum += progress.mandatoryCompleted;
        totalOverdueMilestones += overdueCount;

        const latestCheckIn = team.checkIns[0] || null;
        const cadence = evaluateCheckInCadence(
          latestCheckIn ? latestCheckIn.createdAt : null,
          now
        );

        if (latestCheckIn?.health === "RED") {
          redHealthCount++;
        }
        if (cadence.status === "CHECKIN_OVERDUE") {
          overdueCheckInCount++;
        }

        return {
          id: team.id,
          regCode: team.regCode,
          name: team.name,
          track: team.track,
          status: team.status,
          mentor: team.mentor,
          progress,
          overdueCount,
          latestCheckIn,
          cadence,
          currentHealth: latestCheckIn?.health || "GREEN",
          milestones: milestonesWithDue,
        };
      });

      const averageProgress =
        totalMandatorySum > 0
          ? Math.round((totalMandatoryCompletedSum / totalMandatorySum) * 1000) / 10
          : 100;

      return NextResponse.json({
        edition,
        events,
        availableMentors,
        cohortTeams,
        summary: {
          totalTeams: teams.length,
          averageProgress,
          totalOverdueMilestones,
          redHealthCount,
          overdueCheckInCount,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Coordinator Progress GET Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  // Check Role & View-Only Guard
  const userRole = session?.editionRole || "COORDINATOR_MANAGE";

  if (!canMutateEventConfig(userRole as any)) {
    return NextResponse.json(
      {
        error: "View-only coordinators cannot perform modifications or triggers.",
        code: "COORDINATOR_VIEW_WRITE_BLOCKED",
      },
      { status: 403 }
    );
  }

  const coordinatorId = session?.userId || "coord_manage";

  try {
    // ----------------------------------------------------
    // POST: DEFINE MANDATORY MILESTONE (Per Event Stage)
    // ----------------------------------------------------
    if (action === "define-milestone") {
      const body = await req.json();
      const { editionId, eventId, title, description, dueDate } = body;

      if (!editionId || !title || !dueDate) {
        return NextResponse.json(
          { error: "editionId, title, and dueDate are required" },
          { status: 400 }
        );
      }

      const milestone = await createCoordinatorMilestone({
        editionId,
        eventId,
        title,
        description,
        dueDate: new Date(dueDate),
        coordinatorId,
      });

      return NextResponse.json({ success: true, milestone });
    }

    // ----------------------------------------------------
    // POST: ASSIGN MENTOR TO TEAM
    // ----------------------------------------------------
    if (action === "assign-mentor") {
      const body = await req.json();
      const { teamId, mentorId } = body;

      if (!teamId) {
        return NextResponse.json({ error: "teamId is required" }, { status: 400 });
      }

      const updatedTeam = await assignMentorToTeam({
        teamId,
        mentorId: mentorId || null,
        coordinatorId,
      });

      return NextResponse.json({ success: true, team: updatedTeam });
    }

    // ----------------------------------------------------
    // POST: RUN OVERDUE & DUE-SOON ALERTS SCANNER JOB
    // ----------------------------------------------------
    if (action === "run-alerts-job") {
      const body = await req.json();
      const editionId = body.editionId || "ht26";

      const report = await runMilestoneAlertsJob({
        editionId,
        actorId: coordinatorId,
      });

      return NextResponse.json({ success: true, report });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Coordinator Progress POST Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
