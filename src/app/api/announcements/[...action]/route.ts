import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { canMutateEventConfig } from "@/lib/permissions";
import {
  publishAnnouncement,
  getAudienceAnnouncements,
  markAnnouncementAsRead,
  getAnnouncementAnalytics,
} from "@/lib/services/announcement-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = session.userId;
  const editionSlug = req.nextUrl.searchParams.get("edition") || "ht26";

  try {
    const edition = await prisma.edition.findUnique({
      where: { slug: editionSlug },
      select: { id: true },
    });

    if (!edition) {
      return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    }

    // ----------------------------------------------------
    // GET: AUDIENCE FEED (Strict Zero Leakage)
    // ----------------------------------------------------
    if (action === "feed") {
      const announcements = await getAudienceAnnouncements({
        userId,
        editionId: edition.id,
        userRole: session.editionRole,
      });

      return NextResponse.json({ announcements });
    }

    // ----------------------------------------------------
    // GET: ANNOUNCEMENT READ ANALYTICS (Coordinators)
    // ----------------------------------------------------
    if (action === "analytics") {
      const announcementId = req.nextUrl.searchParams.get("id");
      if (!announcementId) {
        return NextResponse.json({ error: "Announcement id is required" }, { status: 400 });
      }

      // Check coordinator access
      const isCoordinator =
        session.globalRole === "SUPER_ADMIN" ||
        session.editionRole === "COORDINATOR_MANAGE" ||
        session.editionRole === "COORDINATOR_VIEW";

      if (!isCoordinator) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const analytics = await getAnnouncementAnalytics(announcementId);
      return NextResponse.json(analytics);
    }

    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  } catch (err: any) {
    console.error("[Announcements API GET Error]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
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

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const userId = session.userId;

  try {
    // ----------------------------------------------------
    // POST: MARK ANNOUNCEMENT AS READ
    // ----------------------------------------------------
    if (action === "read") {
      const body = await req.json();
      const { announcementId } = body;

      if (!announcementId) {
        return NextResponse.json({ error: "announcementId is required" }, { status: 400 });
      }

      const readReceipt = await markAnnouncementAsRead({ announcementId, userId });
      return NextResponse.json({ success: true, readReceipt });
    }

    // ----------------------------------------------------
    // POST: PUBLISH ANNOUNCEMENT (Coordinator Manage / Super Admin)
    // ----------------------------------------------------
    if (action === "create") {
      // Guard view-only coordinators
      if (!canMutateEventConfig(session.editionRole)) {
        return NextResponse.json(
          {
            error: "View-only coordinators cannot publish announcements.",
            reason: "COORDINATOR_VIEW_WRITE_BLOCKED",
          },
          { status: 403 }
        );
      }

      const body = await req.json();
      const {
        editionId,
        title,
        content,
        priority,
        pinned,
        targetRole,
        eventId,
        teamId,
      } = body;

      if (!editionId || !title || !content) {
        return NextResponse.json(
          { error: "editionId, title, and content are required." },
          { status: 400 }
        );
      }

      const result = await publishAnnouncement({
        editionId,
        authorId: userId,
        title: title.trim(),
        content: content.trim(),
        priority: priority || "NORMAL",
        pinned: Boolean(pinned),
        targetRole: targetRole || null,
        eventId: eventId || null,
        teamId: teamId || null,
      });

      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 404 });
  } catch (err: any) {
    console.error("[Announcements API POST Error]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
