import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  requestChangesOnIdea,
  bulkProcessTeams,
} from "@/lib/services/idea-submission-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // RBAC: Mutations require COORDINATOR_MANAGE or SUPER_ADMIN
  const isAuthorized =
    session.globalRole === "SUPER_ADMIN" || session.editionRole === "COORDINATOR_MANAGE";

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: "Forbidden: Write actions require Coordinator (Manage) or Super Admin privileges.",
        reason: "COORDINATOR_VIEW_WRITE_BLOCKED",
      },
      { status: 403 }
    );
  }

  try {
    // ----------------------------------------------------
    // ACTION: REQUEST CHANGES ON IDEA
    // ----------------------------------------------------
    if (action === "request-changes") {
      const body = await req.json();
      const { teamId, remarks } = body;

      if (!teamId || !remarks) {
        return NextResponse.json({ error: "teamId and remarks are required" }, { status: 400 });
      }

      const team = await requestChangesOnIdea({
        teamId,
        coordinatorId: session.userId,
        remarks,
      });

      return NextResponse.json({ success: true, team });
    }

    // ----------------------------------------------------
    // ACTION: BULK DECISION (SHORTLIST / REJECT)
    // ----------------------------------------------------
    if (action === "bulk-decision") {
      const body = await req.json();
      const { editionId, decision, filterType, value, selectedTeamIds, note } = body;

      if (!editionId || !decision || !filterType) {
        return NextResponse.json(
          { error: "editionId, decision (SHORTLIST|REJECT), and filterType required" },
          { status: 400 }
        );
      }

      const result = await bulkProcessTeams({
        editionId,
        coordinatorId: session.userId,
        action: decision,
        filterType,
        value: Number(value) || 0,
        selectedTeamIds: selectedTeamIds || [],
        note: note || "",
      });

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 404 });
  } catch (error: any) {
    console.error(`Coordinator Teams API Error [${action}]:`, error);
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 400 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const isCoordinator =
    session.globalRole === "SUPER_ADMIN" ||
    session.editionRole === "COORDINATOR_MANAGE" ||
    session.editionRole === "COORDINATOR_VIEW";

  if (!isCoordinator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (action === "list") {
      const editionSlug = req.nextUrl.searchParams.get("slug") || "ht26";
      const statusFilter = req.nextUrl.searchParams.get("status") || "ALL";
      const trackFilter = req.nextUrl.searchParams.get("track") || "ALL";
      const search = req.nextUrl.searchParams.get("search")?.toLowerCase().trim() || "";

      const teams = await prisma.team.findMany({
        where: {
          edition: { slug: editionSlug },
          status: statusFilter !== "ALL" ? (statusFilter as any) : undefined,
          track: trackFilter !== "ALL" ? trackFilter : undefined,
          OR: search
            ? [
                { name: { contains: search, mode: "insensitive" } },
                { regCode: { contains: search, mode: "insensitive" } },
                { members: { some: { user: { name: { contains: search, mode: "insensitive" } } } } },
              ]
            : undefined,
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          evaluations: {
            select: { rawTotalScore: true, normalizedScore: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ teams });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
