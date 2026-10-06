import { describe, it, expect, beforeEach } from "vitest";
import {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUserPreferences,
  updateUserPreferences,
  evaluateNotificationDispatch,
  inMemoryNotifications,
  clearInMemoryNotifications,
} from "./notification-service";
import {
  renderEmailTemplate,
  sendEmail,
  generateDeduplicationKey,
  evaluateEmailDispatch,
  inMemoryDispatchedEmails,
  clearInMemoryEmailQueue,
} from "./email-service";
import {
  publishAnnouncement,
  getAudienceAnnouncements,
  markAnnouncementAsRead,
  getAnnouncementAnalytics,
  isUserInAudience,
  filterAnnouncementsForAudience,
  clearInMemoryAnnouncements,
} from "./announcement-service";
import {
  evaluateReminderTriggers,
  ReminderEvaluationCandidate,
} from "./reminder-job-service";

describe("Notification Centre, Email Delivery & Announcements Subsystem", () => {
  beforeEach(() => {
    clearInMemoryEmailQueue();
    clearInMemoryNotifications();
    clearInMemoryAnnouncements();
  });

  // ----------------------------------------------------
  // 1. EMAIL TEMPLATE RENDERING (SECTION 7 TRIGGERS)
  // ----------------------------------------------------
  describe("Section 7 Email Template Engine (renderEmailTemplate)", () => {
    it("renders Slides-Link-Not-Shared urgent reminder template", () => {
      const rendered = renderEmailTemplate("SLIDES_LINK_MISSING", {
        recipientName: "Alice Lead",
        recipientEmail: "alice@college.edu",
        teamName: "QuantumForge",
        regCode: "HT26-T001",
        eventName: "Ideathon",
        actionUrl: "/team",
      });

      expect(rendered.subject).toContain("Google Slides Deck Missing or Inaccessible");
      expect(rendered.subject).toContain("QuantumForge");
      expect(rendered.text).toContain("Anyone with the link can view");
      expect(rendered.html).toContain("QuantumForge");
      expect(rendered.html).toContain("/team");
    });

    it("renders Milestone Due Soon (48 Hours) template", () => {
      const rendered = renderEmailTemplate("MILESTONE_DUE_SOON", {
        recipientName: "Bob Dev",
        recipientEmail: "bob@college.edu",
        teamName: "NeuralMesh",
        milestoneTitle: "System Architecture & API Contracts",
        dueDate: "2026-10-15",
        actionUrl: "/team/milestones",
      });

      expect(rendered.subject).toContain("Milestone Due in 48 Hours");
      expect(rendered.subject).toContain("System Architecture & API Contracts");
      expect(rendered.text).toContain("2026-10-15");
      expect(rendered.html).toContain("/team/milestones");
    });

    it("renders Milestone Overdue template", () => {
      const rendered = renderEmailTemplate("MILESTONE_OVERDUE", {
        recipientName: "Charlie Hacker",
        recipientEmail: "charlie@college.edu",
        teamName: "VeriChain",
        milestoneTitle: "Core Feature Implementation",
        daysOverdue: 3,
        actionUrl: "/team/milestones",
      });

      expect(rendered.subject).toContain("OVERDUE: Deliverable Past Deadline");
      expect(rendered.text).toContain("3 days overdue");
    });

    it("renders Fortnightly Check-In reminder template", () => {
      const rendered = renderEmailTemplate("CHECKIN_DUE", {
        recipientName: "Prof. Alan Turing",
        recipientEmail: "mentor@college.edu",
        teamName: "TerraPulse",
        actionUrl: "/mentor",
      });

      expect(rendered.subject).toContain("Fortnightly Mentor Check-In Reminder");
      expect(rendered.text).toContain("TerraPulse");
      expect(rendered.html).toContain("/mentor");
    });

    it("renders Review Assignment notification template", () => {
      const rendered = renderEmailTemplate("REVIEW_ASSIGNED", {
        recipientName: "Dr. Victor Vance",
        recipientEmail: "vance@evaluation.hacktrack.edu",
        eventName: "Ideathon",
        evaluatorCount: 15,
        actionUrl: "/evaluator",
      });

      expect(rendered.subject).toContain("New Review Assignments Available");
      expect(rendered.html).toContain("Ideathon");
      expect(rendered.text).toContain("15");
    });

    it("renders Evaluation Reopened notification template", () => {
      const rendered = renderEmailTemplate("EVALUATION_REOPENED", {
        recipientName: "Dr. Victor Vance",
        recipientEmail: "vance@evaluation.hacktrack.edu",
        teamName: "QuantumForge",
        reopenReason: "Evaluator inadvertently scored wrong criterion",
        actionUrl: "/evaluator",
      });

      expect(rendered.subject).toContain("Evaluation Reopened for Revision");
      expect(rendered.html).toContain("Evaluator inadvertently scored wrong criterion");
    });

    it("renders Feedback Released notification template", () => {
      const rendered = renderEmailTemplate("FEEDBACK_RELEASED", {
        recipientName: "Alice Lead",
        recipientEmail: "alice@college.edu",
        eventName: "Ideathon",
        actionUrl: "/team",
      });

      expect(rendered.subject).toContain("Evaluation Results & Rubric Feedback Published");
      expect(rendered.html).toContain("Ideathon");
    });

    it("renders Announcement notification template for urgent and normal priorities", () => {
      const urgent = renderEmailTemplate("ANNOUNCEMENT", {
        recipientName: "Student",
        recipientEmail: "student@college.edu",
        announcementTitle: "Server Outage Maintenance",
        announcementContent: "Maintenance window from 2 AM to 4 AM.",
        announcementPriority: "URGENT",
      });
      expect(urgent.subject).toContain("🚨 URGENT: Server Outage Maintenance");

      const normal = renderEmailTemplate("ANNOUNCEMENT", {
        recipientName: "Student",
        recipientEmail: "student@college.edu",
        announcementTitle: "Workshop Announcement",
        announcementContent: "Cloud workshop tomorrow.",
        announcementPriority: "NORMAL",
      });
      expect(normal.subject).toContain("📢 Workshop Announcement");
    });

    it("renders Team Invite notification template", () => {
      const rendered = renderEmailTemplate("TEAM_INVITE", {
        recipientName: "Candidate",
        recipientEmail: "cand@college.edu",
        inviterName: "Alice Lead",
        teamName: "QuantumForge",
        inviteToken: "tok_invite_123",
        actionUrl: "/join?token=tok_invite_123",
      });
      expect(rendered.subject).toContain("Invitation to Join Team");
      expect(rendered.subject).toContain("QuantumForge");
      expect(rendered.html).toContain("Alice Lead");
      expect(rendered.text).toContain("tok_invite_123");
    });
  });

  // ----------------------------------------------------
  // 2. IDEMPOTENT DE-DUPLICATION & EXACTLY-ONCE DELIVERY
  // ----------------------------------------------------
  describe("Idempotent De-Duplication Engine (Acceptance: Exactly One per Recipient)", () => {
    it("generates deterministic deduplication keys from trigger parameters", () => {
      const key1 = generateDeduplicationKey({
        triggerType: "SLIDES_LINK_MISSING",
        recipientId: "user_123",
        entityId: "team_456",
        windowOrDate: "2026-10-01",
      });

      const key2 = generateDeduplicationKey({
        triggerType: "SLIDES_LINK_MISSING",
        recipientId: "user_123",
        entityId: "team_456",
        windowOrDate: "2026-10-01",
      });

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(36);
    });

    it("guarantees duplicate triggers are dropped and produces exactly one notification per recipient", async () => {
      const dedupKey = `test_dedup_${Date.now()}_${Math.random()}`;

      // First Dispatch: Must succeed and create
      const firstResult = await createNotification({
        userId: "test_user_idempotent",
        type: "SLIDES_LINK_MISSING",
        title: "Test Notification",
        message: "Unique trigger message",
        dedupKey,
        sendEmailCopy: false,
      });

      expect(firstResult.status).toBe("CREATED");
      expect(firstResult.notification).toBeDefined();

      // Second Dispatch (identical dedupKey): Must be dropped as duplicate
      const secondResult = await createNotification({
        userId: "test_user_idempotent",
        type: "SLIDES_LINK_MISSING",
        title: "Test Notification (Duplicate)",
        message: "Unique trigger message",
        dedupKey,
        sendEmailCopy: false,
      });

      expect(secondResult.status).toBe("DUPLICATE_DROPPED");
      expect(secondResult.notification?.id).toBe(firstResult.notification?.id);

      // Verify stored record for this dedupKey is strictly 1
      const notifs = Array.from(inMemoryNotifications.values()).filter(
        (n) => n.dedupKey === dedupKey
      );
      expect(notifs).toHaveLength(1);
      expect(notifs[0].id).toBe(firstResult.notification?.id);
    });

    it("guarantees idempotent email dispatch via EmailDeliveryLog", async () => {
      const emailIdempotencyKey = `email_dedup_${Date.now()}_${Math.random()}`;

      const params = {
        recipientEmail: "test@college.edu",
        triggerType: "MILESTONE_DUE_SOON" as const,
        templateData: {
          recipientName: "Test User",
          recipientEmail: "test@college.edu",
          milestoneTitle: "Architecture Review",
        },
        idempotencyKey: emailIdempotencyKey,
      };

      // 1st Send: Dispatches and logs
      const res1 = await sendEmail(params);
      expect(res1.status).toBe("SENT");
      expect(inMemoryDispatchedEmails).toHaveLength(1);

      // 2nd Send (same idempotency key): Dropped with ALREADY_DISPATCHED
      const res2 = await sendEmail(params);
      expect(res2.skippedReason).toBe("ALREADY_DISPATCHED");
      // Memory store still has only 1 email
      expect(inMemoryDispatchedEmails).toHaveLength(1);
    });

    it("evaluates email dispatch rules purely via evaluateEmailDispatch", () => {
      const existingKeys = new Set(["email:already_sent_key"]);

      // Already sent -> blocked
      const res1 = evaluateEmailDispatch({
        triggerType: "MILESTONE_DUE_SOON",
        idempotencyKey: "email:already_sent_key",
        existingKeys,
      });
      expect(res1.shouldSend).toBe(false);
      expect(res1.reason).toBe("ALREADY_DISPATCHED");

      // Fresh key -> allowed
      const res2 = evaluateEmailDispatch({
        triggerType: "MILESTONE_DUE_SOON",
        idempotencyKey: "email:fresh_key",
        existingKeys,
      });
      expect(res2.shouldSend).toBe(true);
      expect(res2.status).toBe("SENT");
    });

    it("evaluates notification dispatch rules purely via evaluateNotificationDispatch", () => {
      const existingKeys = new Set(["notif_key_1"]);

      // Duplicate -> dropped
      const res1 = evaluateNotificationDispatch({
        userId: "usr_1",
        type: "SLIDES_LINK_MISSING",
        title: "Title",
        message: "Msg",
        dedupKey: "notif_key_1",
        existingKeys,
      });
      expect(res1.shouldCreate).toBe(false);
      expect(res1.status).toBe("DUPLICATE_DROPPED");

      // Fresh -> created
      const res2 = evaluateNotificationDispatch({
        userId: "usr_1",
        type: "SLIDES_LINK_MISSING",
        title: "Title",
        message: "Msg",
        dedupKey: "notif_key_2",
        existingKeys,
      });
      expect(res2.shouldCreate).toBe(true);
      expect(res2.status).toBe("CREATED");
    });
  });

  // ----------------------------------------------------
  // 3. AUDIENCE TARGETING & ZERO-LEAKAGE GUARANTEE
  // ----------------------------------------------------
  describe("Targeted Announcements (Acceptance: Never Leaks to Wrong Audience)", () => {
    const testEditionId = "ed_test_targeting";
    const testAuthorId = "usr_author";

    it("delivers announcements targeted to EVALUATOR exclusively to evaluators (strictly blocks participants)", async () => {
      // Create announcement targeted to EVALUATOR only
      const publishResult = await publishAnnouncement({
        editionId: testEditionId,
        authorId: testAuthorId,
        title: "Confidential Evaluator Briefing",
        content: "Scoring rubrics have been weighted with 35% on technical architecture.",
        priority: "NORMAL",
        targetRole: "EVALUATOR",
      });

      expect(publishResult.announcement).toBeDefined();
      const annId = publishResult.announcement.id;

      // 1. Evaluator queries announcements -> MUST receive it
      const evaluatorFeed = await getAudienceAnnouncements({
        userId: "evaluator_user_1",
        editionId: testEditionId,
        userRole: "EVALUATOR",
      });
      const foundInEvaluator = evaluatorFeed.find((a) => a.id === annId);
      expect(foundInEvaluator).toBeDefined();
      expect(foundInEvaluator?.title).toBe("Confidential Evaluator Briefing");

      // 2. Participant queries announcements -> MUST NOT receive it (Zero Leakage)
      const participantFeed = await getAudienceAnnouncements({
        userId: "participant_user_1",
        editionId: testEditionId,
        userRole: "PARTICIPANT",
      });
      const foundInParticipant = participantFeed.find((a) => a.id === annId);
      expect(foundInParticipant).toBeUndefined();

      // 3. Mentor queries announcements -> MUST NOT receive it (Zero Leakage)
      const mentorFeed = await getAudienceAnnouncements({
        userId: "mentor_user_1",
        editionId: testEditionId,
        userRole: "MENTOR",
      });
      const foundInMentor = mentorFeed.find((a) => a.id === annId);
      expect(foundInMentor).toBeUndefined();
    });

    it("broadcasts general announcements (targetRole: null) to all roles", async () => {
      const publishResult = await publishAnnouncement({
        editionId: testEditionId,
        authorId: testAuthorId,
        title: "Campus Welcome & Opening Ceremony",
        content: "The opening ceremony begins in the main auditorium at 10:00 AM.",
        priority: "NORMAL",
        targetRole: null, // Broadcast to all
      });

      const annId = publishResult.announcement.id;

      const participantFeed = await getAudienceAnnouncements({
        userId: "participant_user_1",
        editionId: testEditionId,
        userRole: "PARTICIPANT",
      });
      expect(participantFeed.find((a) => a.id === annId)).toBeDefined();

      const evaluatorFeed = await getAudienceAnnouncements({
        userId: "evaluator_user_1",
        editionId: testEditionId,
        userRole: "EVALUATOR",
      });
      expect(evaluatorFeed.find((a) => a.id === annId)).toBeDefined();
    });

    it("evaluates audience targeting strictly via isUserInAudience pure function", () => {
      const announcement = {
        id: "ann_1",
        editionId: "ed_2026",
        title: "Lead Briefing",
        content: "Only for Team 42",
        priority: "NORMAL" as const,
        pinned: false,
        targetRole: "PARTICIPANT" as const,
        teamId: "team_42",
        eventId: "ev_ideathon",
        publishedAt: new Date(),
        authorName: "Coordinator",
      };

      // Member of Team 42 in Ideathon -> MATCH
      expect(
        isUserInAudience(announcement, {
          userId: "usr_lead",
          editionId: "ed_2026",
          userRole: "PARTICIPANT",
          teamId: "team_42",
        })
      ).toBe(true);

      // Wrong team -> BLOCKED (Zero Leakage)
      expect(
        isUserInAudience(announcement, {
          userId: "usr_other",
          editionId: "ed_2026",
          userRole: "PARTICIPANT",
          teamId: "team_99",
        })
      ).toBe(false);

      // Wrong role (Evaluator on Team 42) -> BLOCKED
      expect(
        isUserInAudience(announcement, {
          userId: "usr_eval",
          editionId: "ed_2026",
          userRole: "EVALUATOR",
          teamId: "team_42",
        })
      ).toBe(false);

      // Super Admin -> ALWAYS MATCHES
      expect(
        isUserInAudience(announcement, {
          userId: "usr_admin",
          editionId: "ed_2026",
          userRole: "SUPER_ADMIN",
        })
      ).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 4. ANNOUNCEMENT READ TRACKING & ANALYTICS
  // ----------------------------------------------------
  describe("Announcement Read Tracking & Receipts", () => {
    it("tracks user read confirmations and calculates engagement analytics", async () => {
      const pub = await publishAnnouncement({
        editionId: "ed_test_read",
        authorId: "author_read",
        title: "Testing Read Receipts",
        content: "Please read and acknowledge.",
        priority: "NORMAL",
      });

      const annId = pub.announcement.id;

      // Mark read by User 1
      const receipt = await markAnnouncementAsRead({
        announcementId: annId,
        userId: "usr_reader_1",
      });

      expect(receipt.announcementId).toBe(annId);
      expect(receipt.userId).toBe("usr_reader_1");

      // Verify user's feed reflects isRead: true
      const feed = await getAudienceAnnouncements({
        userId: "usr_reader_1",
        editionId: "ed_test_read",
        userRole: "PARTICIPANT",
      });

      const ann = feed.find((a) => a.id === annId);
      expect(ann?.isRead).toBe(true);
      expect(ann?.readAt).toBeDefined();

      // Another user has isRead: false
      const unreadFeed = await getAudienceAnnouncements({
        userId: "usr_unread_2",
        editionId: "ed_test_read",
        userRole: "PARTICIPANT",
      });
      const unreadAnn = unreadFeed.find((a) => a.id === annId);
      expect(unreadAnn?.isRead).toBe(false);

      // Analytics calculation
      const analytics = await getAnnouncementAnalytics(annId);
      expect(analytics.readCount).toBe(1);
      expect(analytics.readers).toHaveLength(1);
      expect(analytics.readers[0].userId).toBe("usr_reader_1");
    });
  });

  // ----------------------------------------------------
  // 5. SECTION 7 REMINDER MATRIX ENGINE (evaluateReminderTriggers)
  // ----------------------------------------------------
  describe("Section 7 Scheduled Reminder Matrix Engine (evaluateReminderTriggers)", () => {
    const fixedNow = new Date("2026-10-10T12:00:00Z");

    const sampleCandidate: ReminderEvaluationCandidate = {
      now: fixedNow,
      activeEvents: [
        { id: "ev_ideathon", name: "Ideathon Round", status: "SUBMISSION_OPEN" },
      ],
      teams: [
        {
          id: "team_no_slides",
          name: "AlphaTeam",
          regCode: "HT26-001",
          slidesUrl: null, // MISSING SLIDES!
          embedSlidesUrl: null,
          members: [
            { userId: "lead_alpha", name: "Alice", email: "alice@test.edu", role: "LEAD" },
            { userId: "member_alpha", name: "Bob", email: "bob@test.edu", role: "MEMBER" },
          ],
          mentor: { id: "mentor_1", name: "Prof. Oak", email: "oak@test.edu" },
        },
        {
          id: "team_with_slides",
          name: "BetaTeam",
          regCode: "HT26-002",
          slidesUrl: "https://docs.google.com/presentation/d/123/edit",
          embedSlidesUrl: "https://docs.google.com/presentation/d/123/embed",
          members: [
            { userId: "lead_beta", name: "Charlie", email: "charlie@test.edu", role: "LEAD" },
          ],
          mentor: { id: "mentor_2", name: "Prof. Elm", email: "elm@test.edu" },
        },
      ],
      milestones: [
        {
          id: "ms_due_soon",
          teamId: "team_with_slides",
          title: "System Architecture Proposal",
          dueDate: new Date(fixedNow.getTime() + 24 * 60 * 60 * 1000), // Due in 24 hours (within 48h!)
          status: "IN_PROGRESS",
        },
        {
          id: "ms_overdue",
          teamId: "team_no_slides",
          title: "Initial Feasibility Study",
          dueDate: new Date(fixedNow.getTime() - 48 * 60 * 60 * 1000), // 2 days overdue!
          status: "NOT_STARTED",
        },
        {
          id: "ms_completed",
          teamId: "team_no_slides",
          title: "Onboarding Checklist",
          dueDate: new Date(fixedNow.getTime() + 10 * 60 * 60 * 1000),
          status: "COMPLETED", // Should NOT generate any reminder
        },
      ],
      checkIns: [
        {
          teamId: "team_no_slides",
          meetingDate: new Date(fixedNow.getTime() - 11 * 24 * 60 * 60 * 1000), // 11 days ago -> CHECKIN_DUE
        },
        {
          teamId: "team_with_slides",
          meetingDate: new Date(fixedNow.getTime() - 16 * 24 * 60 * 60 * 1000), // 16 days ago -> CHECKIN_OVERDUE
        },
      ],
      evaluations: [
        {
          id: "eval_draft_1",
          evaluatorId: "evaluator_x",
          evaluatorName: "Dr. Xavier",
          evaluatorEmail: "xavier@test.edu",
          eventId: "ev_ideathon",
          eventName: "Ideathon Round",
          status: "DRAFT",
        },
        {
          id: "eval_draft_2",
          evaluatorId: "evaluator_x",
          evaluatorName: "Dr. Xavier",
          evaluatorEmail: "xavier@test.edu",
          eventId: "ev_ideathon",
          eventName: "Ideathon Round",
          status: "DRAFT",
        },
      ],
    };

    it("evaluates Slides-Link-Not-Shared reminder: notifies all members of teams missing slides", () => {
      const reminders = evaluateReminderTriggers(sampleCandidate);

      const slidesReminders = reminders.filter((r) => r.triggerType === "SLIDES_LINK_MISSING");
      // AlphaTeam has 2 members -> 2 reminders generated
      expect(slidesReminders).toHaveLength(2);
      expect(slidesReminders.map((r) => r.recipientId)).toContain("lead_alpha");
      expect(slidesReminders.map((r) => r.recipientId)).toContain("member_alpha");
      expect(slidesReminders[0].actionUrl).toBe("/team");
      expect(slidesReminders[0].title).toContain("Google Slides Deck");

      // BetaTeam has slides -> ZERO slides reminders generated
      const betaSlides = slidesReminders.filter((r) => r.metadata?.teamId === "team_with_slides");
      expect(betaSlides).toHaveLength(0);
    });

    it("evaluates Milestone Due Soon (48h) and Milestone Overdue triggers", () => {
      const reminders = evaluateReminderTriggers(sampleCandidate);

      // Milestone Due Soon (in 24h)
      const dueSoon = reminders.filter((r) => r.triggerType === "MILESTONE_DUE_SOON");
      expect(dueSoon).toHaveLength(1); // lead_beta
      expect(dueSoon[0].recipientId).toBe("lead_beta");
      expect(dueSoon[0].title).toContain("System Architecture Proposal");

      // Milestone Overdue (2 days late) -> Notifies team members AND assigned mentor
      const overdue = reminders.filter((r) => r.triggerType === "MILESTONE_OVERDUE");
      // 2 members (lead_alpha, member_alpha) + 1 mentor (mentor_1) = 3
      expect(overdue).toHaveLength(3);
      expect(overdue.map((r) => r.recipientId)).toContain("lead_alpha");
      expect(overdue.map((r) => r.recipientId)).toContain("member_alpha");
      expect(overdue.map((r) => r.recipientId)).toContain("mentor_1");

      // Completed milestone generates 0 reminders
      const completedReminders = reminders.filter(
        (r) => r.metadata?.milestoneId === "ms_completed"
      );
      expect(completedReminders).toHaveLength(0);
    });

    it("evaluates Fortnightly Check-in cadence (10-14 days due, >=14 days overdue)", () => {
      const reminders = evaluateReminderTriggers(sampleCandidate);

      // 11 days ago -> CHECKIN_DUE (Notifies mentor_1 and lead_alpha)
      const checkInDue = reminders.filter((r) => r.triggerType === "CHECKIN_DUE");
      expect(checkInDue).toHaveLength(2);
      expect(checkInDue.map((r) => r.recipientId)).toContain("mentor_1");
      expect(checkInDue.map((r) => r.recipientId)).toContain("lead_alpha");

      // 16 days ago -> CHECKIN_OVERDUE (Notifies mentor_2 and lead_beta)
      const checkInOverdue = reminders.filter((r) => r.triggerType === "CHECKIN_OVERDUE");
      expect(checkInOverdue).toHaveLength(2);
      expect(checkInOverdue.map((r) => r.recipientId)).toContain("mentor_2");
      expect(checkInOverdue.map((r) => r.recipientId)).toContain("lead_beta");
    });

    it("evaluates Evaluator Pending Queue reminders", () => {
      const reminders = evaluateReminderTriggers(sampleCandidate);

      const evalReminders = reminders.filter((r) => r.triggerType === "EVALUATOR_QUEUE_REMINDER");
      expect(evalReminders).toHaveLength(1);
      expect(evalReminders[0].recipientId).toBe("evaluator_x");
      expect(evalReminders[0].title).toContain("2 Pending Evaluations");
      expect(evalReminders[0].actionUrl).toBe("/evaluator");
    });
  });

  // ----------------------------------------------------
  // 6. USER PREFERENCES ENFORCEMENT
  // ----------------------------------------------------
  describe("User Preferences Engine", () => {
    it("skips email delivery when user disables email notifications in preferences", async () => {
      const userId = `usr_pref_${Date.now()}`;

      // Update preferences: email disabled
      await updateUserPreferences(userId, { emailEnabled: false });

      const res = await sendEmail({
        recipientEmail: "disabled@college.edu",
        userId,
        triggerType: "MILESTONE_DUE_SOON",
        templateData: {
          recipientName: "Opt Out User",
          recipientEmail: "disabled@college.edu",
        },
        idempotencyKey: `pref_test_${Date.now()}`,
      });

      expect(res.status).toBe("SKIPPED_PREFERENCE");
      expect(res.skippedReason).toBe("GLOBAL_EMAIL_DISABLED");
    });

    it("skips category-muted email notifications while permitting URGENT announcements", async () => {
      const userId = `usr_cat_${Date.now()}`;

      // User mutes milestone emails, but keeps announcements active
      await updateUserPreferences(userId, {
        emailEnabled: true,
        notifyMilestones: false,
        notifyAnnouncements: true,
      });

      // 1. Milestone email -> Skipped
      const msRes = await sendEmail({
        recipientEmail: "muted@college.edu",
        userId,
        triggerType: "MILESTONE_DUE_SOON",
        templateData: { recipientName: "User", recipientEmail: "muted@college.edu" },
        idempotencyKey: `ms_muted_${Date.now()}`,
      });
      expect(msRes.status).toBe("SKIPPED_PREFERENCE");
      expect(msRes.skippedReason).toBe("MILESTONES_MUTED");

      // 2. Urgent Announcement -> Delivered
      const annRes = await sendEmail({
        recipientEmail: "muted@college.edu",
        userId,
        triggerType: "ANNOUNCEMENT",
        templateData: {
          recipientName: "User",
          recipientEmail: "muted@college.edu",
          announcementTitle: "Emergency Campus Evacuation",
          announcementPriority: "URGENT",
        },
        idempotencyKey: `ann_urgent_${Date.now()}`,
      });
      expect(annRes.status).toBe("SENT");
    });

    it("skips in-app notification when inAppEnabled is toggled false", async () => {
      const userId = `usr_no_inapp_${Date.now()}`;
      await updateUserPreferences(userId, { inAppEnabled: false });

      const result = await createNotification({
        userId,
        type: "MILESTONE_DUE_SOON",
        title: "Test",
        message: "Test",
        sendEmailCopy: false,
      });

      expect(result.status).toBe("SKIPPED_PREFERENCE");
      expect(result.notification).toBeNull();
    });
  });

  // ----------------------------------------------------
  // 7. IN-APP NOTIFICATION CENTRE ACTIONS
  // ----------------------------------------------------
  describe("In-App Notification Centre Actions", () => {
    it("manages user notifications: list, unread count, and read status transitions", async () => {
      const userId = "usr_inbox_test";

      // 1. Create two unread notifications
      await createNotification({
        userId,
        type: "ANNOUNCEMENT",
        title: "Notif 1",
        message: "Message 1",
        sendEmailCopy: false,
      });
      const notif2 = await createNotification({
        userId,
        type: "MILESTONE_DUE_SOON",
        title: "Notif 2",
        message: "Message 2",
        sendEmailCopy: false,
      });

      // 2. Fetch list -> count is 2
      const initialList = await getUserNotifications({ userId, status: "unread" });
      expect(initialList.unreadCount).toBe(2);
      expect(initialList.notifications).toHaveLength(2);

      // 3. Mark single notification as read
      await markNotificationRead({
        notificationId: notif2.notification!.id,
        userId,
      });

      const afterOneRead = await getUserNotifications({ userId, status: "unread" });
      expect(afterOneRead.unreadCount).toBe(1);

      // 4. Batch mark all as read
      await markAllNotificationsRead(userId);
      const afterAllRead = await getUserNotifications({ userId, status: "unread" });
      expect(afterAllRead.unreadCount).toBe(0);
    });
  });
});
