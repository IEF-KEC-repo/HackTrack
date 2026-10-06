import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { canMutateEventConfig } from "@/lib/permissions";
import {
  recordTeamStageDecision,
  toggleLeaderboardPublication,
  getEventDecisions,
} from "@/lib/services/decision-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];
  const eventId = req.nextUrl.searchParams.get("eventId");

  // Coordinator check
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionToken(token) : null;
  const session = toSessionContext(payload);
  const userRole = session?.editionRole || "COORDINATOR_MANAGE";

  const allowedRoles = ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW"];
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json({ error: "Coordinator access required" }, { status: 403 });
  }

  try {
    if (action === "list") {
      if (!eventId) {
        return NextResponse.json({ error: "eventId is required" }, { status: 400 });
      }
      const decisions = await getEventDecisions(eventId);
      return NextResponse.json({
        success: true,
        decisions,
      });
    }

    return NextResponse.json({ error: `Unknown decisions action: ${action}` }, { status: 404 });
  } catch (error: any) {
    console.error("[Coordinator Decisions GET Error]", error);
    return NextResponse.json({ error: error.message || "Failed to load decisions" }, { status: 500 });
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
  const userRole = session?.editionRole || "COORDINATOR_MANAGE";

  // Enforce View-Only Tier write-block
  if (!canMutateEventConfig(userRole as any)) {
    return NextResponse.json(
      {
        error: "View-only coordinators cannot record stage decisions or publish leaderboards.",
        code: "COORDINATOR_VIEW_WRITE_BLOCKED",
      },
      { status: 403 }
    );
  }

  const coordinatorId = session?.userId || "coord_manage";

  try {
    // ----------------------------------------------------
    // POST: RECORD STAGE DECISION (CONTINUE, CONDITIONAL, EXIT)
    // ----------------------------------------------------
    if (action === "record") {
      const body = await req.json();
      const {
        eventId,
        teamId,
        decision,
        notes,
        eventName,
        teamName,
        teamMembers,
      } = body;

      if (!eventId || !teamId || !decision) {
        return NextResponse.json(
          { error: "eventId, teamId, and decision are required." },
          { status: 400 }
        );
      }

      const result = await recordTeamStageDecision({
        eventId,
        teamId,
        decision,
        notes,
        decidedById: coordinatorId,
        eventName,
        teamName,
        teamMembers,
      });

      return NextResponse.json({
        success: true,
        result,
        message: `Recorded decision '${decision}' for team. Notifications dispatched.`,
      });
    }

    // ----------------------------------------------------
    // POST: PUBLISH OR UNPUBLISH LEADERBOARD
    // ----------------------------------------------------
    if (action === "publish-leaderboard") {
      const body = await req.json();
      const { eventId, publish } = body;

      if (!eventId) {
        return NextResponse.json({ error: "eventId is required." }, { status: 400 });
      }

      const result = await toggleLeaderboardPublication(
        eventId,
        Boolean(publish),
        coordinatorId
      );

      return NextResponse.json({
        success: true,
        result,
        message: result.published
          ? "Leaderboard published! Results are now visible to participants."
          : "Leaderboard unpublished. Results are now hidden from participants.",
      });
    }

    return NextResponse.json({ error: `Unknown decisions action: ${action}` }, { status: 404 });
  } catch (error: any) {
    console.error("[Coordinator Decisions POST Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to process decision" },
      { status: 500 }
    );
  }
}
