import { prisma } from "@/lib/prisma";
import { createNotification } from "./notification-service";
import { generateDeduplicationKey } from "./email-service";

export interface ReminderJobResult {
  editionId: string;
  slidesRemindersSent: number;
  milestoneDueSoonSent: number;
  milestoneOverdueSent: number;
  checkInRemindersSent: number;
  evaluatorRemindersSent: number;
  totalDispatched: number;
  duplicatesSkipped: number;
  timestamp: string;
}

/**
 * Scheduled job: Scans database for reminder triggers matching the Section 7 matrix.
 * Enforces idempotent deduplication to ensure exactly one notification per recipient per cycle.
 */
export async function scanAndDispatchReminders(params: {
  editionId: string;
  now?: Date;
}): Promise<ReminderJobResult> {
  const { editionId, now = new Date() } = params;
  const cycleDateStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD" daily deduplication boundary

  let slidesRemindersSent = 0;
  let milestoneDueSoonSent = 0;
  let milestoneOverdueSent = 0;
  let checkInRemindersSent = 0;
  let evaluatorRemindersSent = 0;
  let duplicatesSkipped = 0;

  // ----------------------------------------------------
  // 1. SLIDES-LINK-NOT-SHARED REMINDER (Section 7 Trigger 1)
  // ----------------------------------------------------
  // Identify active events with submissions open
  const activeSubmissionEvents = await prisma.event.findMany({
    where: {
      editionId,
      status: { in: ["SUBMISSION_OPEN", "REGISTRATION_OPEN"] },
    },
  });

  if (activeSubmissionEvents.length > 0) {
    // Find all teams without an active embeddable slides URL
    const teamsWithoutSlides = await prisma.team.findMany({
      where: {
        editionId,
        OR: [{ slidesUrl: null }, { slidesUrl: "" }, { embedSlidesUrl: null }],
      },
      include: {
        members: { select: { userId: true, user: { select: { email: true, name: true } } } },
      },
    });

    for (const team of teamsWithoutSlides) {
      for (const ev of activeSubmissionEvents) {
        for (const member of team.members) {
          const dedupKey = generateDeduplicationKey({
            triggerType: "SLIDES_LINK_MISSING",
            recipientId: member.userId,
            entityId: `${team.id}_${ev.id}`,
            windowOrDate: cycleDateStr,
          });

          const result = await createNotification({
            userId: member.userId,
            editionId,
            type: "SLIDES_LINK_MISSING",
            title: `⚠️ Action Required: Submit Google Slides Deck for ${team.name}`,
            message: `Your team "${team.name}" (${team.regCode}) has not submitted an embeddable Google Slides deck for ${ev.name}. Ensure sharing is set to "Anyone with the link can view".`,
            actionUrl: "/team",
            dedupKey,
            sendEmailCopy: true,
            emailTemplateData: {
              recipientName: member.user.name,
              recipientEmail: member.user.email,
              teamName: team.name,
              regCode: team.regCode,
              eventName: ev.name,
              actionUrl: "/team",
            },
          });

          if (result.status === "CREATED") {
            slidesRemindersSent++;
          } else if (result.status === "DUPLICATE_DROPPED") {
            duplicatesSkipped++;
          }
        }
      }
    }
  }

  // ----------------------------------------------------
  // 2. MILESTONE DUE SOON (48 Hours) & OVERDUE (Triggers 2 & 3)
  // ----------------------------------------------------
  const fortyEightHoursAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const pendingMilestones = await prisma.teamMilestone.findMany({
    where: {
      team: { editionId },
      status: { not: "COMPLETED" },
    },
    include: {
      team: {
        include: {
          members: { select: { userId: true, user: { select: { email: true, name: true } } } },
          mentor: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  for (const ms of pendingMilestones) {
    const isOverdue = ms.dueDate < now;
    const isDueSoon = !isOverdue && ms.dueDate <= fortyEightHoursAhead;

    if (isDueSoon) {
      // Trigger: MILESTONE_DUE_SOON
      for (const member of ms.team.members) {
        const dedupKey = generateDeduplicationKey({
          triggerType: "MILESTONE_DUE_SOON",
          recipientId: member.userId,
          entityId: ms.id,
          windowOrDate: cycleDateStr,
        });

        const res = await createNotification({
          userId: member.userId,
          editionId,
          type: "MILESTONE_DUE_SOON",
          title: `⏰ Milestone Due Soon: ${ms.title}`,
          message: `Deliverable "${ms.title}" for team "${ms.team.name}" is due within 48 hours (${ms.dueDate.toLocaleDateString()}).`,
          actionUrl: "/team/milestones",
          dedupKey,
          sendEmailCopy: true,
          emailTemplateData: {
            recipientName: member.user.name,
            recipientEmail: member.user.email,
            teamName: ms.team.name,
            milestoneTitle: ms.title,
            dueDate: ms.dueDate.toLocaleDateString(),
            actionUrl: "/team/milestones",
          },
        });

        if (res.status === "CREATED") milestoneDueSoonSent++;
        else if (res.status === "DUPLICATE_DROPPED") duplicatesSkipped++;
      }
    } else if (isOverdue) {
      // Trigger: MILESTONE_OVERDUE (Notify Team + Mentor)
      const daysOverdue = Math.max(
        1,
        Math.floor((now.getTime() - ms.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // 1. Notify Members
      for (const member of ms.team.members) {
        const dedupKey = generateDeduplicationKey({
          triggerType: "MILESTONE_OVERDUE",
          recipientId: member.userId,
          entityId: ms.id,
          windowOrDate: cycleDateStr,
        });

        const res = await createNotification({
          userId: member.userId,
          editionId,
          type: "MILESTONE_OVERDUE",
          title: `🚨 Milestone Overdue: ${ms.title}`,
          message: `Deliverable "${ms.title}" for team "${ms.team.name}" is now ${daysOverdue} days overdue.`,
          actionUrl: "/team/milestones",
          dedupKey,
          sendEmailCopy: true,
          emailTemplateData: {
            recipientName: member.user.name,
            recipientEmail: member.user.email,
            teamName: ms.team.name,
            milestoneTitle: ms.title,
            daysOverdue,
            actionUrl: "/team/milestones",
          },
        });

        if (res.status === "CREATED") milestoneOverdueSent++;
        else if (res.status === "DUPLICATE_DROPPED") duplicatesSkipped++;
      }

      // 2. Notify Assigned Mentor
      if (ms.team.mentor) {
        const mentorDedup = generateDeduplicationKey({
          triggerType: "MILESTONE_OVERDUE_MENTOR",
          recipientId: ms.team.mentor.id,
          entityId: ms.id,
          windowOrDate: cycleDateStr,
        });

        const res = await createNotification({
          userId: ms.team.mentor.id,
          editionId,
          type: "MILESTONE_OVERDUE",
          title: `⚠️ Mentee Deliverable Overdue: ${ms.team.name}`,
          message: `Your mentee team "${ms.team.name}" has an overdue deliverable: "${ms.title}" (${daysOverdue} days late).`,
          actionUrl: "/mentor",
          dedupKey: mentorDedup,
          sendEmailCopy: true,
          emailTemplateData: {
            recipientName: ms.team.mentor.name,
            recipientEmail: ms.team.mentor.email,
            teamName: ms.team.name,
            milestoneTitle: ms.title,
            daysOverdue,
            actionUrl: "/mentor",
          },
        });

        if (res.status === "CREATED") milestoneOverdueSent++;
        else if (res.status === "DUPLICATE_DROPPED") duplicatesSkipped++;
      }
    }
  }

  // ----------------------------------------------------
  // 3. FORTNIGHTLY CHECK-IN CADENCE (Section 7 Trigger 4)
  // ----------------------------------------------------
  const teamsWithMentors = await prisma.team.findMany({
    where: {
      editionId,
      mentorId: { not: null },
    },
    include: {
      mentor: { select: { id: true, email: true, name: true } },
      members: {
        where: { role: "LEAD" },
        select: { userId: true, user: { select: { email: true, name: true } } },
      },
      checkIns: {
        orderBy: { meetingDate: "desc" },
        take: 1,
      },
    },
  });

  for (const team of teamsWithMentors) {
    const lastCheckIn = team.checkIns[0];
    const lastDate = lastCheckIn ? lastCheckIn.meetingDate : team.createdAt;
    const elapsedDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (elapsedDays >= 10) {
      const isOverdue = elapsedDays >= 14;
      const triggerType = isOverdue ? "CHECKIN_OVERDUE" : "CHECKIN_DUE";

      // 1. Notify Mentor
      if (team.mentor) {
        const mentorDedup = generateDeduplicationKey({
          triggerType,
          recipientId: team.mentor.id,
          entityId: team.id,
          windowOrDate: cycleDateStr,
        });

        const res = await createNotification({
          userId: team.mentor.id,
          editionId,
          type: triggerType,
          title: isOverdue
            ? `⚠️ Fortnightly Check-In Overdue: ${team.name}`
            : `📅 Fortnightly Check-In Due: ${team.name}`,
          message: `It has been ${elapsedDays} days since the last check-in for "${team.name}". Please log notes.`,
          actionUrl: "/mentor",
          dedupKey: mentorDedup,
          sendEmailCopy: true,
          emailTemplateData: {
            recipientName: team.mentor.name,
            recipientEmail: team.mentor.email,
            teamName: team.name,
            actionUrl: "/mentor",
          },
        });

        if (res.status === "CREATED") checkInRemindersSent++;
        else if (res.status === "DUPLICATE_DROPPED") duplicatesSkipped++;
      }

      // 2. Notify Team Lead
      const teamLead = team.members[0];
      if (teamLead) {
        const leadDedup = generateDeduplicationKey({
          triggerType,
          recipientId: teamLead.userId,
          entityId: team.id,
          windowOrDate: cycleDateStr,
        });

        const res = await createNotification({
          userId: teamLead.userId,
          editionId,
          type: triggerType,
          title: isOverdue
            ? "⚠️ Fortnightly Mentor Check-In Overdue"
            : "📅 Fortnightly Mentor Check-In Due",
          message: `It has been ${elapsedDays} days since your last recorded check-in meeting with your mentor.`,
          actionUrl: "/team",
          dedupKey: leadDedup,
          sendEmailCopy: true,
          emailTemplateData: {
            recipientName: teamLead.user.name,
            recipientEmail: teamLead.user.email,
            teamName: team.name,
            actionUrl: "/team",
          },
        });

        if (res.status === "CREATED") checkInRemindersSent++;
        else if (res.status === "DUPLICATE_DROPPED") duplicatesSkipped++;
      }
    }
  }

  // ----------------------------------------------------
  // 4. EVALUATOR PENDING QUEUE (Section 7 Trigger 5 follow-up)
  // ----------------------------------------------------
  const pendingEvaluations = await prisma.evaluation.findMany({
    where: {
      status: "DRAFT",
      event: { editionId, status: "EVALUATION_ACTIVE" },
    },
    include: {
      evaluator: { select: { id: true, name: true, email: true } },
      event: { select: { id: true, name: true } },
    },
  });

  // Group by evaluator
  const pendingByEvaluator = new Map<string, { evaluator: any; event: any; count: number }>();
  for (const pe of pendingEvaluations) {
    const key = `${pe.evaluatorId}_${pe.eventId}`;
    const curr = pendingByEvaluator.get(key) || { evaluator: pe.evaluator, event: pe.event, count: 0 };
    curr.count++;
    pendingByEvaluator.set(key, curr);
  }

  for (const item of Array.from(pendingByEvaluator.values())) {
    const dedupKey = generateDeduplicationKey({
      triggerType: "EVALUATOR_QUEUE_REMINDER",
      recipientId: item.evaluator.id,
      entityId: item.event.id,
      windowOrDate: cycleDateStr,
    });

    const res = await createNotification({
      userId: item.evaluator.id,
      editionId,
      type: "REVIEW_ASSIGNED",
      title: `📋 Reminder: ${item.count} Pending Evaluations for ${item.event.name}`,
      message: `You have ${item.count} evaluations remaining in your queue for ${item.event.name}. Please complete scoring in your cockpit.`,
      actionUrl: "/evaluator",
      dedupKey,
      sendEmailCopy: true,
      emailTemplateData: {
        recipientName: item.evaluator.name,
        recipientEmail: item.evaluator.email,
        eventName: item.event.name,
        evaluatorCount: item.count,
        actionUrl: "/evaluator",
      },
    });

    if (res.status === "CREATED") evaluatorRemindersSent++;
    else if (res.status === "DUPLICATE_DROPPED") duplicatesSkipped++;
  }

  const totalDispatched =
    slidesRemindersSent +
    milestoneDueSoonSent +
    milestoneOverdueSent +
    checkInRemindersSent +
    evaluatorRemindersSent;

  return {
    editionId,
    slidesRemindersSent,
    milestoneDueSoonSent,
    milestoneOverdueSent,
    checkInRemindersSent,
    evaluatorRemindersSent,
    totalDispatched,
    duplicatesSkipped,
    timestamp: now.toISOString(),
  };
}

export interface ReminderEvaluationCandidate {
  teams: Array<{
    id: string;
    name: string;
    editionId?: string;
    regCode?: string | null;
    slidesUrl?: string | null;
    embedSlidesUrl?: string | null;
    members: Array<{ userId: string; name?: string; email?: string; role?: string }>;
    mentor?: { id: string; name?: string; email?: string } | null;
    createdAt?: Date;
  }>;
  milestones?: Array<{
    id: string;
    teamId: string;
    title: string;
    dueDate: Date | string;
    status: string;
  }>;
  checkIns?: Array<{
    id?: string;
    teamId: string;
    meetingDate: Date | string;
  }>;
  evaluations?: Array<{
    id: string;
    evaluatorId: string;
    evaluatorName?: string;
    evaluatorEmail?: string;
    eventId: string;
    eventName: string;
    status: string;
  }>;
  activeEvents?: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  now?: Date;
}

export interface EvaluatedReminder {
  triggerType:
    | "SLIDES_LINK_MISSING"
    | "MILESTONE_DUE_SOON"
    | "MILESTONE_OVERDUE"
    | "CHECKIN_DUE"
    | "CHECKIN_OVERDUE"
    | "EVALUATOR_QUEUE_REMINDER";
  recipientId: string;
  recipientEmail?: string;
  recipientName?: string;
  entityId: string;
  dedupKey: string;
  title: string;
  message: string;
  actionUrl: string;
  metadata?: Record<string, any>;
}

/**
 * Pure Function: Evaluates reminder matrix triggers matching Section 7.
 * Computes deterministic deduplication keys and recipients for:
 * 1. Missing or unshared Google Slides links
 * 2. Milestones due in <= 48 hours
 * 3. Overdue deliverables (alerting team + mentor)
 * 4. Fortnightly mentor check-in cadence (10-14 days)
 * 5. Pending evaluator queues
 */
export function evaluateReminderTriggers(params: ReminderEvaluationCandidate): EvaluatedReminder[] {
  const { teams = [], milestones = [], checkIns = [], evaluations = [], activeEvents = [] } = params;
  const now = params.now ? new Date(params.now) : new Date();
  const cycleDateStr = now.toISOString().split("T")[0];
  const reminders: EvaluatedReminder[] = [];

  // 1. SLIDES-LINK-NOT-SHARED REMINDERS
  const submissionEvents =
    activeEvents.length > 0
      ? activeEvents.filter((ev) => ev.status === "SUBMISSION_OPEN" || ev.status === "REGISTRATION_OPEN")
      : [{ id: "ev_active_submission", name: "Current Submission Stage", status: "SUBMISSION_OPEN" }];

  if (submissionEvents.length > 0) {
    for (const team of teams) {
      const hasValidSlides = Boolean(
        team.slidesUrl &&
        team.slidesUrl.trim() !== "" &&
        team.embedSlidesUrl &&
        team.embedSlidesUrl.trim() !== ""
      );

      if (!hasValidSlides) {
        for (const ev of submissionEvents) {
          for (const member of team.members) {
            const dedupKey = generateDeduplicationKey({
              triggerType: "SLIDES_LINK_MISSING",
              recipientId: member.userId,
              entityId: `${team.id}_${ev.id}`,
              windowOrDate: cycleDateStr,
            });

            reminders.push({
              triggerType: "SLIDES_LINK_MISSING",
              recipientId: member.userId,
              recipientEmail: member.email,
              recipientName: member.name,
              entityId: `${team.id}_${ev.id}`,
              dedupKey,
              title: `⚠️ Action Required: Submit Google Slides Deck for ${team.name}`,
              message: `Your team "${team.name}" (${team.regCode || "TEAM"}) has not submitted an embeddable Google Slides deck for ${ev.name}. Ensure sharing is set to "Anyone with the link can view".`,
              actionUrl: "/team",
              metadata: {
                teamId: team.id,
                eventId: ev.id,
                regCode: team.regCode,
              },
            });
          }
        }
      }
    }
  }

  // 2. MILESTONES DUE SOON (48h) & OVERDUE
  const fortyEightHoursAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  for (const ms of milestones) {
    if (ms.status === "COMPLETED") continue;

    const dueDate = new Date(ms.dueDate);
    const team = teams.find((t) => t.id === ms.teamId);
    if (!team) continue;

    const isOverdue = dueDate.getTime() < now.getTime();
    const isDueSoon = !isOverdue && dueDate.getTime() <= fortyEightHoursAhead.getTime();

    if (isDueSoon) {
      for (const member of team.members) {
        const dedupKey = generateDeduplicationKey({
          triggerType: "MILESTONE_DUE_SOON",
          recipientId: member.userId,
          entityId: ms.id,
          windowOrDate: cycleDateStr,
        });

        reminders.push({
          triggerType: "MILESTONE_DUE_SOON",
          recipientId: member.userId,
          recipientEmail: member.email,
          recipientName: member.name,
          entityId: ms.id,
          dedupKey,
          title: `⏰ Milestone Due Soon: ${ms.title}`,
          message: `Deliverable "${ms.title}" for team "${team.name}" is due within 48 hours.`,
          actionUrl: "/team/milestones",
          metadata: {
            milestoneId: ms.id,
            teamId: team.id,
            dueDate: dueDate.toISOString(),
          },
        });
      }
    } else if (isOverdue) {
      const daysOverdue = Math.max(
        1,
        Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Members
      for (const member of team.members) {
        const dedupKey = generateDeduplicationKey({
          triggerType: "MILESTONE_OVERDUE",
          recipientId: member.userId,
          entityId: ms.id,
          windowOrDate: cycleDateStr,
        });

        reminders.push({
          triggerType: "MILESTONE_OVERDUE",
          recipientId: member.userId,
          recipientEmail: member.email,
          recipientName: member.name,
          entityId: ms.id,
          dedupKey,
          title: `🚨 Milestone Overdue: ${ms.title}`,
          message: `Deliverable "${ms.title}" for team "${team.name}" is now ${daysOverdue} days overdue.`,
          actionUrl: "/team/milestones",
          metadata: {
            milestoneId: ms.id,
            teamId: team.id,
            daysOverdue,
          },
        });
      }

      // Mentor
      if (team.mentor) {
        const mentorDedup = generateDeduplicationKey({
          triggerType: "MILESTONE_OVERDUE",
          recipientId: team.mentor.id,
          entityId: ms.id,
          windowOrDate: cycleDateStr,
        });

        reminders.push({
          triggerType: "MILESTONE_OVERDUE",
          recipientId: team.mentor.id,
          recipientEmail: team.mentor.email,
          recipientName: team.mentor.name,
          entityId: ms.id,
          dedupKey: mentorDedup,
          title: `⚠️ Mentee Deliverable Overdue: ${team.name}`,
          message: `Your mentee team "${team.name}" has an overdue deliverable: "${ms.title}" (${daysOverdue} days late).`,
          actionUrl: "/mentor",
          metadata: {
            milestoneId: ms.id,
            teamId: team.id,
            daysOverdue,
          },
        });
      }
    }
  }

  // 3. FORTNIGHTLY CHECK-IN CADENCE (10-14 DAYS)
  for (const team of teams) {
    if (!team.mentor) continue;

    const teamCheckIns = checkIns
      .filter((c) => c.teamId === team.id)
      .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());

    const lastMeetingDate =
      teamCheckIns.length > 0
        ? new Date(teamCheckIns[0].meetingDate)
        : team.createdAt
        ? new Date(team.createdAt)
        : new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    const elapsedDays = Math.floor(
      (now.getTime() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (elapsedDays >= 10) {
      const isOverdue = elapsedDays >= 14;
      const triggerType = isOverdue ? "CHECKIN_OVERDUE" : "CHECKIN_DUE";

      // Mentor reminder
      const mentorDedup = generateDeduplicationKey({
        triggerType,
        recipientId: team.mentor.id,
        entityId: team.id,
        windowOrDate: cycleDateStr,
      });

      reminders.push({
        triggerType,
        recipientId: team.mentor.id,
        recipientEmail: team.mentor.email,
        recipientName: team.mentor.name,
        entityId: team.id,
        dedupKey: mentorDedup,
        title: isOverdue
          ? `⚠️ Fortnightly Check-In Overdue: ${team.name}`
          : `📅 Fortnightly Check-In Due: ${team.name}`,
        message: `It has been ${elapsedDays} days since the last check-in for "${team.name}".`,
        actionUrl: "/mentor",
        metadata: {
          teamId: team.id,
          elapsedDays,
        },
      });

      // Team Lead reminder
      const teamLead =
        team.members.find((m) => m.role === "LEAD") || team.members[0];
      if (teamLead) {
        const leadDedup = generateDeduplicationKey({
          triggerType,
          recipientId: teamLead.userId,
          entityId: team.id,
          windowOrDate: cycleDateStr,
        });

        reminders.push({
          triggerType,
          recipientId: teamLead.userId,
          recipientEmail: teamLead.email,
          recipientName: teamLead.name,
          entityId: team.id,
          dedupKey: leadDedup,
          title: isOverdue
            ? "⚠️ Fortnightly Mentor Check-In Overdue"
            : "📅 Fortnightly Mentor Check-In Due",
          message: `It has been ${elapsedDays} days since your last recorded check-in meeting with your mentor.`,
          actionUrl: "/team",
          metadata: {
            teamId: team.id,
            elapsedDays,
          },
        });
      }
    }
  }

  // 4. EVALUATOR PENDING QUEUE REMINDERS
  const pendingByEvaluator = new Map<
    string,
    { evaluatorId: string; evaluatorName?: string; evaluatorEmail?: string; eventId: string; eventName: string; count: number }
  >();

  for (const pe of evaluations) {
    if (pe.status !== "DRAFT") continue;
    const key = `${pe.evaluatorId}_${pe.eventId}`;
    const curr = pendingByEvaluator.get(key) || {
      evaluatorId: pe.evaluatorId,
      evaluatorName: pe.evaluatorName,
      evaluatorEmail: pe.evaluatorEmail,
      eventId: pe.eventId,
      eventName: pe.eventName,
      count: 0,
    };
    curr.count++;
    pendingByEvaluator.set(key, curr);
  }

  for (const item of Array.from(pendingByEvaluator.values())) {
    const dedupKey = generateDeduplicationKey({
      triggerType: "EVALUATOR_QUEUE_REMINDER",
      recipientId: item.evaluatorId,
      entityId: item.eventId,
      windowOrDate: cycleDateStr,
    });

    reminders.push({
      triggerType: "EVALUATOR_QUEUE_REMINDER",
      recipientId: item.evaluatorId,
      recipientEmail: item.evaluatorEmail,
      recipientName: item.evaluatorName,
      entityId: item.eventId,
      dedupKey,
      title: `📋 Reminder: ${item.count} Pending Evaluations for ${item.eventName}`,
      message: `You have ${item.count} evaluations remaining in your queue for ${item.eventName}.`,
      actionUrl: "/evaluator",
      metadata: {
        eventId: item.eventId,
        count: item.count,
      },
    });
  }

  return reminders;
}
