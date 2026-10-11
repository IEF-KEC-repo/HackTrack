import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isLeaderboardVisible, inMemoryLeaderboardStatus } from "@/lib/services/decision-service";
import { getEventLeaderboard } from "@/lib/services/leaderboard-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];
  const eventId = req.nextUrl.searchParams.get("eventId");
  const editionSlug = req.nextUrl.searchParams.get("edition") || "ht26";

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);
  const userRole = session?.editionRole || "PARTICIPANT";

  try {
    if (action === "results") {
      const targetEventId = eventId || null;

      // Test-mode in-memory publication status (used by vitest only).
      let isPublished = false;
      if (targetEventId && inMemoryLeaderboardStatus.has(targetEventId)) {
        isPublished = inMemoryLeaderboardStatus.get(targetEventId) || false;
      }

      // Visibility gating: coordinatoors get draft preview; everyone else only
      // sees a published leaderboard.
      const canView = isLeaderboardVisible({
        leaderboardPublished: isPublished,
        userRole,
      });

      if (!canView) {
        return NextResponse.json({
          published: false,
          eventId: targetEventId,
          eventName: "Ideathon Evaluation",
          message:
            "The official leaderboard for this event has not yet been published by coordinators.",
        });
      }

      // Real cohort only. Empty when there are no evaluations yet — never fabricated.
      const board = await getEventLeaderboard({ editionSlug, eventId: targetEventId });

      return NextResponse.json({
        published: true,
        isPublished: board.isPublished,
        eventId: board.eventId,
        eventName: board.eventName,
        rankedTeams: board.rankedTeams,
        evaluatorStats: board.evaluatorStats,
        topThree: board.rankedTeams.slice(0, 3),
        totalTeams: board.rankedTeams.length,
      });
    }

    return NextResponse.json({ error: `Unknown leaderboard action: ${action}` }, { status: 404 });
  } catch (error: any) {
    console.error("[Leaderboard Results Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve leaderboard" },
      { status: 500 }
    );
  }
}