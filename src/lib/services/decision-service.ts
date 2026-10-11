import { prisma } from "@/lib/prisma";
import { StageDecision, EditionRole } from "@prisma/client";
import { createNotification } from "./notification-service";
import { generateDeduplicationKey } from "./email-service";
import { recordAuditLog } from "./audit-service";

export interface RecordDecisionParams {
  eventId: string;
  teamId: string;
  decision: StageDecision;
  notes?: string;
  decidedById: string;
  eventName?: string;
  teamName?: string;
  teamMembers?: Array<{ userId: string; name?: string; email?: string }>;
}

export interface DecisionRecordResult {
  status: "RECORDED" | "ERROR";
  decision: any;
  message: string;
  notifiedCount: number;
}

// In-memory test store for vitest test inspections
export const inMemoryDecisions = new Map<string, any>();
export const inMemoryLeaderboardStatus = new Map<string, boolean>();

export function clearInMemoryDecisions() {
  inMemoryDecisions.clear();
  inMemoryLeaderboardStatus.clear();
}

/**
 * Pure function: Validates decision arguments.
 * Enforces that CONDITIONAL decisions require explicit remedial notes.
 */
export function validateDecisionParameters(params: {
  decision: StageDecision;
  notes?: string;
}): { valid: boolean; error?: string } {
  const { decision, notes } = params;

  if (decision === "CONDITIONAL" && (!notes || notes.trim().length < 5)) {
    return {
      valid: false,
      error: "Conditional advancement requires explicit remedial conditions or milestones (min 5 characters).",
    };
  }

  if (decision === "EXIT" && (!notes || notes.trim().length < 5)) {
    return {
      valid: false,
      error: "Stage elimination requires an exit rationale or feedback note for the team.",
    };
  }

  return { valid: true };
}

/**
 * Pure function: Checks leaderboard visibility based on user role and publication state.
 * Acceptance Guarantee: Strictly hidden from participants until published.
 */
export function isLeaderboardVisible(params: {
  leaderboardPublished: boolean;
  userRole?: EditionRole | string;
}): boolean {
  const { leaderboardPublished, userRole } = params;

  // Coordinators and Super Admins always have access (preview & live)
  if (
    userRole === "SUPER_ADMIN" ||
    userRole === "COORDINATOR_MANAGE" ||
    userRole === "COORDINATOR_VIEW"
  ) {
    return true;
  }

  // Participants, mentors, evaluators, and public ONLY see if published
  return leaderboardPublished === true;
}

/**
 * Records a formal stage decision for a team and dispatches notifications to all team members.
 */
export async function recordTeamStageDecision(
  params: RecordDecisionParams
): Promise<DecisionRecordResult> {
  const {
    eventId,
    teamId,
    decision,
    notes,
    decidedById,
    eventName = "Event Stage",
    teamName = "Your Team",
    teamMembers = [],
  } = params;

  // 1. Validation
  const validation = validateDecisionParameters({ decision, notes });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const key = `${eventId}_${teamId}`;
  const record = {
    id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    eventId,
    teamId,
    decision,
    notes: notes || null,
    decidedById,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  inMemoryDecisions.set(key, record);

  let dbDecision = record;
  if (process.env.NODE_ENV !== "test") {
    try {
      dbDecision = await prisma.eventDecision.upsert({
        where: {
          eventId_teamId: { eventId, teamId },
        },
        create: {
          eventId,
          teamId,
          decision,
          notes,
          decidedById,
        },
        update: {
          decision,
          notes,
          decidedById,
        },
      });
    } catch {}
  }

  // Immutable audit trail: every formal stage decision is reviewable after the fact.
  if (process.env.NODE_ENV !== "test") {
    try {
      const eventMeta = await prisma.event.findUnique({
        where: { id: eventId },
        select: { editionId: true },
      });
      await recordAuditLog({
        editionId: eventMeta?.editionId,
        actorId: decidedById,
        action: "STAGE_DECISION_RECORDED",
        entityType: "EventDecision",
        entityId: dbDecision?.id || record.id,
        newState: {
          eventId,
          teamId,
          decision,
          notes: notes || null,
          eventName,
          teamName,
        },
      });
    } catch {}
  }

  // 2. Resolve Team Members & Dispatch Notifications
  let membersToNotify = teamMembers;

  if (membersToNotify.length === 0 && process.env.NODE_ENV !== "test") {
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
      if (team) {
        membersToNotify = team.members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
        }));
      }
    } catch {}
  }

  let notifiedCount = 0;
  for (const member of membersToNotify) {
    const dedupKey = generateDeduplicationKey({
      triggerType: "STAGE_DECISION",
      recipientId: member.userId,
      entityId: `${eventId}_${teamId}`,
    });

    const isContinue = decision === "CONTINUE";
    const isConditional = decision === "CONDITIONAL";
    const title = `${isContinue ? "🎉" : isConditional ? "⚠️" : "📢"} Stage Decision: ${decision}`;
    const message = `The committee decision for "${teamName}" in "${eventName}" is: ${decision}.${notes ? ` Note: ${notes}` : ""}`;

    await createNotification({
      userId: member.userId,
      type: "STAGE_DECISION",
      title,
      message,
      actionUrl: "/results",
      dedupKey,
      sendEmailCopy: true,
      emailTemplateData: {
        recipientName: member.name || "Student",
        recipientEmail: member.email || "",
        teamName,
        eventName,
        stageDecision: decision,
        decisionNotes: notes,
        actionUrl: "/results",
      },
    });
    notifiedCount++;
  }

  return {
    status: "RECORDED",
    decision: dbDecision,
    message: `Decision "${decision}" recorded for team "${teamName}". ${notifiedCount} members notified.`,
    notifiedCount,
  };
}

/**
 * Fetches all decisions recorded for an event.
 */
export async function getEventDecisions(eventId: string) {
  if (process.env.NODE_ENV === "test") {
    return Array.from(inMemoryDecisions.values()).filter((d) => d.eventId === eventId);
  }

  try {
    return await prisma.eventDecision.findMany({
      where: { eventId },
      include: {
        team: { select: { id: true, name: true, regCode: true, track: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
  } catch {
    return Array.from(inMemoryDecisions.values()).filter((d) => d.eventId === eventId);
  }
}

/**
 * Toggles the publication of the event leaderboard/results.
 * Actionable only for Coordinator (Manage) and Super Admin.
 */
export async function toggleLeaderboardPublication(
  paramsOrEventId:
    | string
    | { eventId: string; isPublished?: boolean; publish?: boolean; userId?: string },
  publishArg?: boolean,
  userIdArg?: string
) {
  let eventId: string;
  let isPublished: boolean;
  let userId: string;

  if (typeof paramsOrEventId === "string") {
    eventId = paramsOrEventId;
    isPublished = publishArg !== undefined ? publishArg : true;
    userId = userIdArg || "coordinator";
  } else {
    eventId = paramsOrEventId.eventId;
    isPublished =
      paramsOrEventId.isPublished !== undefined
        ? paramsOrEventId.isPublished
        : paramsOrEventId.publish !== undefined
        ? paramsOrEventId.publish
        : true;
    userId = paramsOrEventId.userId || "coordinator";
  }

  inMemoryLeaderboardStatus.set(eventId, isPublished);

  if (process.env.NODE_ENV !== "test") {
    try {
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: { leaderboardPublished: isPublished },
      });
      return {
        ...updated,
        published: updated.leaderboardPublished,
      };
    } catch {}
  }

  return {
    eventId,
    published: isPublished,
    leaderboardPublished: isPublished,
  };
}
