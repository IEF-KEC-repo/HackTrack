import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  cloneEdition,
  setContinuousProjectReviewCount,
  updateEventSequence,
} from "@/lib/services/edition-service";
import { saveRubricWithCriteria } from "@/lib/services/rubric-service";
import { executeBulkUserImport } from "@/lib/services/csv-import-service";
import { getAuditLogs, recordAuditLog } from "@/lib/services/audit-service";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  // 1. Authenticate session
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // 2. Authorize Coordinator Manage / Super Admin
  const isAuthorized =
    session.globalRole === "SUPER_ADMIN" || session.editionRole === "COORDINATOR_MANAGE";

  if (!isAuthorized) {
    return NextResponse.json(
      {
        error: "Forbidden: Write access requires Coordinator (Manage) or Super Admin privileges.",
        reason: "COORDINATOR_VIEW_WRITE_BLOCKED",
      },
      { status: 403 }
    );
  }

  try {
    // ----------------------------------------------------
    // ACTION: CLONE EDITION
    // ----------------------------------------------------
    if (action === "clone-edition") {
      const body = await req.json();
      const { sourceSlug, newName, newSlug, academicYear, startDate, endDate } = body;

      if (!sourceSlug || !newName || !newSlug) {
        return NextResponse.json({ error: "Missing required edition fields" }, { status: 400 });
      }

      const cloned = await cloneEdition({
        sourceSlug,
        newName,
        newSlug,
        academicYear: academicYear || "2026-2027",
        startDate: new Date(startDate || Date.now()),
        endDate: new Date(endDate || Date.now() + 120 * 24 * 60 * 60 * 1000),
        actorId: session.userId,
      });

      return NextResponse.json({ success: true, edition: cloned });
    }

    // ----------------------------------------------------
    // ACTION: SET CPR COUNT (3 TO 5)
    // ----------------------------------------------------
    if (action === "set-cpr-count") {
      const body = await req.json();
      const { editionId, cprCount } = body;

      if (!editionId || !cprCount) {
        return NextResponse.json({ error: "editionId and cprCount required" }, { status: 400 });
      }

      const events = await setContinuousProjectReviewCount({
        editionId,
        cprCount: Number(cprCount) as 3 | 4 | 5,
        actorId: session.userId,
      });

      return NextResponse.json({ success: true, events });
    }

    // ----------------------------------------------------
    // ACTION: UPDATE EVENT SEQUENCE
    // ----------------------------------------------------
    if (action === "update-events") {
      const body = await req.json();
      const { editionId, events } = body;

      if (!editionId || !Array.isArray(events)) {
        return NextResponse.json({ error: "editionId and events array required" }, { status: 400 });
      }

      const updated = await updateEventSequence({
        editionId,
        events,
        actorId: session.userId,
      });

      return NextResponse.json({ success: true, events: updated });
    }

    // ----------------------------------------------------
    // ACTION: SAVE RUBRIC WITH SCALE ANCHORS
    // ----------------------------------------------------
    if (action === "save-rubric") {
      const body = await req.json();
      const { eventId, name, criteria, editionId } = body;

      if (!eventId || !name || !Array.isArray(criteria)) {
        return NextResponse.json({ error: "Missing required rubric fields" }, { status: 400 });
      }

      const saved = await saveRubricWithCriteria({
        eventId,
        name,
        criteria,
        editionId,
        actorId: session.userId,
      });

      return NextResponse.json({ success: true, rubric: saved });
    }

    // ----------------------------------------------------
    // ACTION: BULK IMPORT USERS VIA CSV
    // ----------------------------------------------------
    if (action === "bulk-import-users") {
      const body = await req.json();
      const { editionId, csvContent } = body;

      if (!editionId || !csvContent) {
        return NextResponse.json(
          { error: "editionId and csvContent are required" },
          { status: 400 }
        );
      }

      const report = await executeBulkUserImport({
        editionId,
        csvContent,
        actorId: session.userId,
      });

      return NextResponse.json({ success: true, report });
    }

    // ----------------------------------------------------
    // ACTION: ASSIGN ROLE & ISSUE INVITATION
    // ----------------------------------------------------
    if (action === "assign-role") {
      const body = await req.json();
      const { editionId, email, role } = body;

      if (!editionId || !email || !role) {
        return NextResponse.json({ error: "Missing required role fields" }, { status: 400 });
      }

      const token = `inv_${crypto.randomBytes(24).toString("hex")}`;
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const invitation = await prisma.invitation.upsert({
        where: { token },
        update: { role, expiresAt },
        create: {
          editionId,
          email: email.toLowerCase().trim(),
          role,
          token,
          expiresAt,
          invitedById: session.userId,
        },
      });

      await recordAuditLog({
        editionId,
        actorId: session.userId,
        action: "ROLE_INVITATION_ISSUED",
        entityType: "Invitation",
        entityId: invitation.id,
        newState: { email, role, token },
      });

      return NextResponse.json({ success: true, invitation });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 404 });
  } catch (error: any) {
    console.error(`Coordinator API Error [${action}]:`, error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
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

  // Read actions are accessible to BOTH Coordinator tiers
  const isCoordinator =
    session.globalRole === "SUPER_ADMIN" ||
    session.editionRole === "COORDINATOR_MANAGE" ||
    session.editionRole === "COORDINATOR_VIEW";

  if (!isCoordinator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (action === "audit-logs") {
      const editionId = req.nextUrl.searchParams.get("editionId") || undefined;
      const logs = await getAuditLogs(editionId);
      return NextResponse.json({ logs });
    }

    if (action === "edition-data") {
      const slug = req.nextUrl.searchParams.get("slug") || "ht26";
      const edition = await prisma.edition.findUnique({
        where: { slug },
        include: {
          events: {
            orderBy: { sequenceIndex: "asc" },
            include: {
              rubrics: {
                include: { criteria: { orderBy: { sequenceOrder: "asc" } } },
              },
            },
          },
          memberships: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          invitations: {
            orderBy: { createdAt: "desc" },
            take: 100,
          },
        },
      });

      return NextResponse.json({ edition });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
