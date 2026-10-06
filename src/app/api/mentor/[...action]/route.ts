import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getMentorAssignedTeams } from "@/lib/services/mentor-service";
import { logMentorCheckIn } from "@/lib/services/checkin-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];
  const editionSlug = req.nextUrl.searchParams.get("edition") || "ht26";

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  let mentorId = session?.userId;

  // Fallback for development/demo: if not logged in or running demo, look up seeded mentor user
  if (!mentorId) {
    const demoMentor = await prisma.user.findUnique({
      where: { email: "mentor@hacktrack.edu" },
      select: { id: true },
    });
    mentorId = demoMentor?.id;
  }

  if (!mentorId) {
    return NextResponse.json({ error: "Mentor authentication required" }, { status: 401 });
  }

  try {
    const edition = await prisma.edition.findUnique({
      where: { slug: editionSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!edition) {
      return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    }

    // ----------------------------------------------------
    // GET: MENTOR ASSIGNED TEAMS (STRICT ISOLATION)
    // ----------------------------------------------------
    if (action === "teams") {
      const assignedTeams = await getMentorAssignedTeams({
        mentorId,
        editionId: edition.id,
      });

      return NextResponse.json({
        edition,
        mentorId,
        teams: assignedTeams,
        count: assignedTeams.length,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Mentor GET Error]", error);
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

  let mentorId = session?.userId;

  if (!mentorId) {
    const demoMentor = await prisma.user.findUnique({
      where: { email: "mentor@hacktrack.edu" },
      select: { id: true },
    });
    mentorId = demoMentor?.id;
  }

  if (!mentorId) {
    return NextResponse.json({ error: "Mentor authentication required" }, { status: 401 });
  }

  try {
    // ----------------------------------------------------
    // POST: LOG MENTOR CHECK-IN & ASSESS HEALTH
    // ----------------------------------------------------
    if (action === "checkin") {
      const body = await req.json();
      const { teamId, notes, actionItems, health, meetingDate } = body;

      if (!teamId || !notes || !health) {
        return NextResponse.json(
          { error: "teamId, notes, and health (GREEN/YELLOW/RED) are required" },
          { status: 400 }
        );
      }

      const checkIn = await logMentorCheckIn({
        teamId,
        mentorId,
        meetingDate: meetingDate ? new Date(meetingDate) : new Date(),
        notes,
        actionItems,
        health,
      });

      return NextResponse.json({ success: true, checkIn });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Mentor POST Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
