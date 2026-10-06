import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUserPreferences,
  updateUserPreferences,
} from "@/lib/services/notification-service";

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

  try {
    // ----------------------------------------------------
    // GET: NOTIFICATIONS LIST
    // ----------------------------------------------------
    if (action === "list") {
      const status = req.nextUrl.searchParams.get("status") as "all" | "unread" | "read" | null;
      const type = req.nextUrl.searchParams.get("type") as any;
      const limit = Number(req.nextUrl.searchParams.get("limit") || 20);
      const offset = Number(req.nextUrl.searchParams.get("offset") || 0);

      const result = await getUserNotifications({
        userId,
        status: status || "all",
        type: type || undefined,
        limit,
        offset,
      });

      return NextResponse.json(result);
    }

    // ----------------------------------------------------
    // GET: USER PREFERENCES
    // ----------------------------------------------------
    if (action === "preferences") {
      const preferences = await getUserPreferences(userId);
      return NextResponse.json({ preferences });
    }

    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  } catch (err: any) {
    console.error("[Notifications API GET Error]", err);
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
    // POST: MARK SINGLE NOTIFICATION AS READ
    // ----------------------------------------------------
    if (action === "mark-read") {
      const body = await req.json();
      const { notificationId } = body;

      if (!notificationId) {
        return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
      }

      const updated = await markNotificationRead({ notificationId, userId });
      return NextResponse.json({ success: true, notification: updated });
    }

    // ----------------------------------------------------
    // POST: MARK ALL AS READ
    // ----------------------------------------------------
    if (action === "mark-all-read") {
      const result = await markAllNotificationsRead(userId);
      return NextResponse.json({ success: true, count: result.count });
    }

    // ----------------------------------------------------
    // POST: UPDATE USER PREFERENCES
    // ----------------------------------------------------
    if (action === "preferences") {
      const body = await req.json();
      const updated = await updateUserPreferences(userId, body);
      return NextResponse.json({ success: true, preferences: updated });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 404 });
  } catch (err: any) {
    console.error("[Notifications API POST Error]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
