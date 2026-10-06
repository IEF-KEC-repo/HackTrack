import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  createTeamCustomMilestone,
  updateMilestoneProgress,
  getTeamMilestones,
} from "@/lib/services/milestone-service";
import { submitTeamCheckIn, getTeamCheckInHistory } from "@/lib/services/checkin-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  const fallbackUserId = session?.userId;

  try {
    // ----------------------------------------------------
    // GET: MY TEAM MILESTONES & PROGRESS
    // ----------------------------------------------------
    if (action === "my-team") {
      let teamId = req.nextUrl.searchParams.get("teamId");

      if (!teamId && fallbackUserId) {
        const membership = await prisma.teamMember.findFirst({
          where: { userId: fallbackUserId },
          select: { teamId: true },
        });
        teamId = membership?.teamId || null;
      }

      if (!teamId) {
        // Fallback to first team in db for demo/testing
        const firstTeam = await prisma.team.findFirst({
          select: { id: true },
        });
        teamId = firstTeam?.id || null;
      }

      if (!teamId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          mentor: { select: { id: true, name: true, email: true } },
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      const { milestones, progress } = await getTeamMilestones(teamId);
      const { checkIns, latestCheckIn, cadence } = await getTeamCheckInHistory(teamId);

      return NextResponse.json({
        team,
        milestones,
        progress,
        latestCheckIn,
        cadence,
        checkInsCount: checkIns.length,
      });
    }

    // ----------------------------------------------------
    // GET: CHECK-IN HISTORY
    // ----------------------------------------------------
    if (action === "checkin-history") {
      const teamId = req.nextUrl.searchParams.get("teamId");
      if (!teamId) {
        return NextResponse.json({ error: "teamId required" }, { status: 400 });
      }

      const data = await getTeamCheckInHistory(teamId);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Milestones GET Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  const userId = session?.userId || "user_demo";

  try {
    // ----------------------------------------------------
    // POST: CREATE CUSTOM MILESTONE
    // ----------------------------------------------------
    if (action === "custom") {
      const body = await req.json();
      const { teamId, editionId, eventId, title, description, dueDate } = body;

      if (!teamId || !title || !dueDate) {
        return NextResponse.json(
          { error: "teamId, title, and dueDate are required" },
          { status: 400 }
        );
      }

      const milestone = await createTeamCustomMilestone({
        teamId,
        editionId: editionId || "ht26",
        eventId,
        title,
        description,
        dueDate: new Date(dueDate),
      });

      return NextResponse.json({ success: true, milestone });
    }

    // ----------------------------------------------------
    // POST: UPDATE MILESTONE PROGRESS & EVIDENCE
    // ----------------------------------------------------
    if (action === "update") {
      const body = await req.json();
      const {
        teamMilestoneId,
        status,
        evidenceType,
        evidenceUrl,
        evidenceFileId,
        evidenceNotes,
      } = body;

      if (!teamMilestoneId || !status) {
        return NextResponse.json(
          { error: "teamMilestoneId and status are required" },
          { status: 400 }
        );
      }

      const updated = await updateMilestoneProgress({
        teamMilestoneId,
        status,
        evidenceType,
        evidenceUrl,
        evidenceFileId,
        evidenceNotes,
      });

      return NextResponse.json({ success: true, milestone: updated });
    }

    // ----------------------------------------------------
    // POST: SUBMIT FORTNIGHTLY CHECK-IN
    // ----------------------------------------------------
    if (action === "checkin") {
      const body = await req.json();
      const { teamId, progressNotes, blockers, nextGoals, health, evidenceUrl } = body;

      if (!teamId || !progressNotes) {
        return NextResponse.json(
          { error: "teamId and progressNotes are required" },
          { status: 400 }
        );
      }

      const checkIn = await submitTeamCheckIn({
        teamId,
        userId,
        progressNotes,
        blockers,
        nextGoals,
        health: health || "GREEN",
        evidenceUrl,
      });

      return NextResponse.json({ success: true, checkIn });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Milestones POST Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
