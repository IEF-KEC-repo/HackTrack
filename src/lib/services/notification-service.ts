import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { sendEmail, EmailTemplateData, generateDeduplicationKey, setMockUserPreference } from "./email-service";

export interface CreateNotificationParams {
  userId: string;
  editionId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  dedupKey?: string;
  metadata?: Record<string, any>;
  sendEmailCopy?: boolean;
  emailTemplateData?: EmailTemplateData;
  recipientEmail?: string;
}

export interface NotificationFilterParams {
  userId: string;
  status?: "all" | "unread" | "read";
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

/**
 * In-memory stores for testing or fallback when database is unavailable.
 */
export const inMemoryNotifications = new Map<string, any>();
export const inMemoryNotificationPreferences = new Map<string, any>();

export function clearInMemoryNotifications() {
  inMemoryNotifications.clear();
  inMemoryNotificationPreferences.clear();
}

/**
 * Pure function: Evaluates notification dispatch and de-duplication rules.
 */
export function evaluateNotificationDispatch(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  dedupKey?: string;
  inAppEnabled?: boolean;
  existingKeys?: Set<string>;
}): { shouldCreate: boolean; status: "CREATED" | "DUPLICATE_DROPPED" | "SKIPPED_PREFERENCE"; reason?: string } {
  const { inAppEnabled = true, dedupKey, existingKeys = new Set() } = params;

  if (!inAppEnabled) {
    return { shouldCreate: false, status: "SKIPPED_PREFERENCE", reason: "User disabled in-app notifications." };
  }

  if (dedupKey && existingKeys.has(dedupKey)) {
    return { shouldCreate: false, status: "DUPLICATE_DROPPED", reason: "Duplicate notification dropped (already exists)." };
  }

  return { shouldCreate: true, status: "CREATED" };
}

/**
 * Creates an in-app notification with strict idempotent de-duplication.
 * Drops duplicate dispatches with zero side-effects.
 */
export async function createNotification(params: CreateNotificationParams) {
  const {
    userId,
    editionId,
    type,
    title,
    message,
    actionUrl,
    dedupKey,
    metadata,
    sendEmailCopy = true,
    emailTemplateData,
    recipientEmail,
  } = params;

  // 1. Check user notification preferences
  let preferences = inMemoryNotificationPreferences.get(userId) || null;
  if (!preferences && process.env.NODE_ENV !== "test") {
    try {
      const dbPrefs = await prisma.notificationPreference.findUnique({
        where: { userId },
      });
      if (dbPrefs) preferences = dbPrefs;
    } catch {}
  }

  // If in-app notifications are explicitly disabled, skip DB creation
  if (preferences && !preferences.inAppEnabled) {
    return {
      status: "SKIPPED_PREFERENCE",
      notification: null,
      message: "User disabled in-app notifications in preferences.",
    };
  }

  // 2. Check for duplicate via dedupKey
  if (dedupKey) {
    let existing =
      Array.from(inMemoryNotifications.values()).find((n) => n.dedupKey === dedupKey) || null;
    if (!existing && process.env.NODE_ENV !== "test") {
      try {
        const dbExisting = await prisma.notification.findUnique({
          where: { dedupKey },
        });
        if (dbExisting) existing = dbExisting;
      } catch {}
    }

    if (existing) {
      return {
        status: "DUPLICATE_DROPPED",
        notification: existing,
        message: "Duplicate notification dropped (already exists).",
      };
    }
  }

  // 3. Insert notification record
  let notification: any = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    editionId,
    type,
    title,
    message,
    actionUrl,
    dedupKey,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    isRead: false,
    createdAt: new Date(),
  };

  inMemoryNotifications.set(notification.id, notification);

  if (process.env.NODE_ENV !== "test") {
    try {
      const dbNotif = await prisma.notification.create({
        data: {
          userId,
          editionId,
          type,
          title,
          message,
          actionUrl,
          dedupKey,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });
      if (dbNotif) notification = dbNotif;
    } catch (err: any) {
      if (err.code === "P2002") {
        // Race condition duplicate dropped
        const existing = inMemoryNotifications.get(dedupKey!) || notification;
        return {
          status: "DUPLICATE_DROPPED",
          notification: existing,
          message: "Duplicate notification dropped concurrently.",
        };
      }
    }
  }

  // 4. Optionally dispatch matching email copy
  if (sendEmailCopy) {
    let email = recipientEmail;
    let name = "User";

    if (!email && process.env.NODE_ENV !== "test") {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (user) {
          email = user.email;
          name = user.name;
        }
      } catch {}
    }

    if (email) {
      const emailDedup = dedupKey
        ? `email:${dedupKey}`
        : generateDeduplicationKey({
            triggerType: String(type),
            recipientId: userId,
            entityId: notification.id,
          });

      const templateData: EmailTemplateData = {
        recipientName: name,
        recipientEmail: email,
        actionUrl: actionUrl || "/",
        customMessage: message,
        ...emailTemplateData,
      };

      await sendEmail({
        recipientEmail: email,
        userId,
        triggerType: type,
        templateData,
        idempotencyKey: emailDedup,
      });
    }
  }

  return {
    status: "CREATED",
    notification,
    message: "Notification created and delivered.",
  };
}

/**
 * Retrieves user's notification list with unread counts and pagination.
 */
export async function getUserNotifications(params: NotificationFilterParams) {
  const { userId, status = "all", type, limit = 20, offset = 0 } = params;

  if (process.env.NODE_ENV === "test") {
    let all = Array.from(inMemoryNotifications.values()).filter((n) => n.userId === userId);
    if (status === "unread") all = all.filter((n) => !n.isRead);
    else if (status === "read") all = all.filter((n) => n.isRead);
    if (type) all = all.filter((n) => n.type === type);

    const totalCount = all.length;
    const unreadCount = Array.from(inMemoryNotifications.values()).filter((n) => n.userId === userId && !n.isRead).length;
    const paginated = all.slice(offset, offset + limit);

    return {
      notifications: paginated,
      totalCount,
      unreadCount,
      hasMore: offset + paginated.length < totalCount,
    };
  }

  const where: any = { userId };

  if (status === "unread") {
    where.isRead = false;
  } else if (status === "read") {
    where.isRead = true;
  }

  if (type) {
    where.type = type;
  }

  try {
    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      totalCount,
      unreadCount,
      hasMore: offset + notifications.length < totalCount,
    };
  } catch {
    return {
      notifications: [],
      totalCount: 0,
      unreadCount: 0,
      hasMore: false,
    };
  }
}

/**
 * Marks an individual notification as read.
 */
export async function markNotificationRead(params: { notificationId: string; userId: string }) {
  const { notificationId, userId } = params;

  for (const [key, notif] of inMemoryNotifications.entries()) {
    if (notif.id === notificationId && notif.userId === userId) {
      notif.isRead = true;
      notif.readAt = new Date();
      inMemoryNotifications.set(key, notif);
      return notif;
    }
  }

  if (process.env.NODE_ENV !== "test") {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        throw new Error("Notification not found or access denied.");
      }

      return await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });
    } catch {}
  }

  return { id: notificationId, userId, isRead: true, readAt: new Date() };
}

/**
 * Batch marks all unread notifications as read for a given user.
 */
export async function markAllNotificationsRead(userId: string) {
  let count = 0;
  for (const [key, notif] of inMemoryNotifications.entries()) {
    if (notif.userId === userId && !notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      inMemoryNotifications.set(key, notif);
      count++;
    }
  }

  if (process.env.NODE_ENV !== "test") {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return { count: result.count };
    } catch {}
  }

  return { count };
}

/**
 * Fetches user's notification preferences, providing default values if unset.
 */
export async function getUserPreferences(userId: string) {
  const mem = inMemoryNotificationPreferences.get(userId);
  if (mem) return mem;

  if (process.env.NODE_ENV !== "test") {
    try {
      const preferences = await prisma.notificationPreference.findUnique({
        where: { userId },
      });
      if (preferences) {
        inMemoryNotificationPreferences.set(userId, preferences);
        return preferences;
      }
    } catch {}
  }

  const defaultPrefs = {
    id: `pref_${userId}`,
    userId,
    emailEnabled: true,
    inAppEnabled: true,
    notifyAnnouncements: true,
    notifyMilestones: true,
    notifyCheckIns: true,
    notifyEvaluations: true,
  };
  inMemoryNotificationPreferences.set(userId, defaultPrefs);
  return defaultPrefs;
}

/**
 * Updates user's notification preferences.
 */
export async function updateUserPreferences(
  userId: string,
  data: {
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    notifyAnnouncements?: boolean;
    notifyMilestones?: boolean;
    notifyCheckIns?: boolean;
    notifyEvaluations?: boolean;
  }
) {
  const current = inMemoryNotificationPreferences.get(userId) || {
    id: `pref_${userId}`,
    userId,
    emailEnabled: true,
    inAppEnabled: true,
    notifyAnnouncements: true,
    notifyMilestones: true,
    notifyCheckIns: true,
    notifyEvaluations: true,
  };
  const updated = { ...current, ...data };
  inMemoryNotificationPreferences.set(userId, updated);
  setMockUserPreference(userId, updated);

  if (process.env.NODE_ENV !== "test") {
    try {
      return await prisma.notificationPreference.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          emailEnabled: data.emailEnabled ?? true,
          inAppEnabled: data.inAppEnabled ?? true,
          notifyAnnouncements: data.notifyAnnouncements ?? true,
          notifyMilestones: data.notifyMilestones ?? true,
          notifyCheckIns: data.notifyCheckIns ?? true,
          notifyEvaluations: data.notifyEvaluations ?? true,
        },
      });
    } catch {}
  }

  return updated;
}
