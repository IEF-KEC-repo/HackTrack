import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  computeCohortFunnel,
  getOverdueItemsSummary,
  computeScoreDistribution,
} from "@/lib/services/analytics-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];
  const editionSlug = req.nextUrl.searchParams.get("edition") || "ht26";
  const eventId = req.nextUrl.searchParams.get("eventId");

  // Check coordinator auth
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);
  const userRole = session?.editionRole || "COORDINATOR_MANAGE";

  const allowedRoles = ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW"];
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "Unauthorized. Coordinator access required." },
      { status: 403 }
    );
  }

  try {
    let editionId = editionSlug;
    if (process.env.NODE_ENV !== "test") {
      try {
        const edition = await prisma.edition.findUnique({
          where: { slug: editionSlug },
          select: { id: true },
        });
        if (edition) {
          editionId = edition.id;
        }
      } catch {
        // Fallback to editionSlug if db unreachable
      }
    }

    // ----------------------------------------------------
    // GET: COHORT FUNNEL
    // ----------------------------------------------------
    if (action === "funnel") {
      const funnel = await computeCohortFunnel(editionId);
      return NextResponse.json({
        success: true,
        funnel,
      });
    }

    // ----------------------------------------------------
    // GET: OVERDUE RADAR ITEMS
    // ----------------------------------------------------
    if (action === "overdue") {
      const overdue = await getOverdueItemsSummary(editionId);
      return NextResponse.json({
        success: true,
        overdue,
      });
    }

    // ----------------------------------------------------
    // GET: SCORE DISTRIBUTIONS
    // ----------------------------------------------------
    if (action === "scores") {
      const targetEventId = eventId || "ev_cpr";
      const distributions = await computeScoreDistribution(targetEventId);
      return NextResponse.json({
        success: true,
        distributions,
      });
    }

    return NextResponse.json({ error: `Unknown analytics action: ${action}` }, { status: 404 });
  } catch (error: any) {
    console.error("[Coordinator Analytics Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to load analytics" },
      { status: 500 }
    );
  }
}
