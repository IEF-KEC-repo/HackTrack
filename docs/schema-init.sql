-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "EditionRole" AS ENUM ('SUPER_ADMIN', 'COORDINATOR_MANAGE', 'COORDINATOR_VIEW', 'EVALUATOR', 'MENTOR', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('ASYNC_MULTI_REVIEWER', 'LIVE_PANEL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'REGISTRATION_OPEN', 'SUBMISSION_OPEN', 'SUBMISSION_LOCKED', 'EVALUATION_ACTIVE', 'EVALUATION_LOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('DRAFT', 'REGISTERED', 'SUBMITTED', 'CHANGES_REQUESTED', 'SHORTLISTED', 'IDEATHON_EVALUATED', 'INCL_INNOVATZ', 'CPR_ACTIVE', 'POC_QUALIFIED', 'DEMO_DAY_FINALIST', 'COMPLETED', 'ELIMINATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TeamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('LEAD', 'MEMBER');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "TeamHealth" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SLIDES_LINK_MISSING', 'MILESTONE_DUE_SOON', 'MILESTONE_OVERDUE', 'CHECKIN_DUE', 'CHECKIN_OVERDUE', 'REVIEW_ASSIGNED', 'EVALUATION_REOPENED', 'FEEDBACK_RELEASED', 'ANNOUNCEMENT', 'TEAM_INVITE', 'STAGE_DECISION');

-- CreateEnum
CREATE TYPE "StageDecision" AS ENUM ('CONTINUE', 'CONDITIONAL', 'EXIT');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED_PREFERENCE');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MilestoneSource" AS ENUM ('COORDINATOR_MANDATORY', 'TEAM_CUSTOM');

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" "EditionStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "clonedFromEditionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "role" "EditionRole" NOT NULL DEFAULT 'PARTICIPANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "reviewType" "ReviewType" NOT NULL DEFAULT 'LIVE_PANEL',
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "submissionDeadline" TIMESTAMP(3),
    "evaluationDeadline" TIMESTAMP(3),
    "evaluatorCountPerTeam" INTEGER NOT NULL DEFAULT 3,
    "feedbackReleased" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardPublished" BOOLEAN NOT NULL DEFAULT false,
    "decisionsRecorded" BOOLEAN NOT NULL DEFAULT false,
    "isCalibrationActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "regCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "track" TEXT,
    "status" "TeamStatus" NOT NULL DEFAULT 'DRAFT',
    "slidesUrl" TEXT,
    "embedSlidesUrl" TEXT,
    "mentorId" TEXT,
    "problemStatement" TEXT,
    "solutionAbstract" TEXT,
    "techStack" TEXT,
    "architectureDescription" TEXT,
    "githubUrl" TEXT,
    "risksAndMitigation" TEXT,
    "hardwareBOM" TEXT,
    "coordinatorFeedback" TEXT,
    "changesRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "slidesUrl" TEXT,
    "embedSlidesUrl" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalMaxPoints" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "weightPercentage" DOUBLE PRECISION NOT NULL,
    "anchors" JSONB,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "rawTotalScore" DOUBLE PRECISION,
    "normalizedScore" DOUBLE PRECISION,
    "generalFeedback" TEXT,
    "isCalibration" BOOLEAN NOT NULL DEFAULT false,
    "isOutlierReview" BOOLEAN NOT NULL DEFAULT false,
    "scheduledSlotStart" TIMESTAMP(3),
    "scheduledSlotEnd" TIMESTAMP(3),
    "roomOrMeetingUrl" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "eventId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMilestone" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "eventId" TEXT,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "source" "MilestoneSource" NOT NULL DEFAULT 'COORDINATOR_MANDATORY',
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "isDueSoon" BOOLEAN NOT NULL DEFAULT false,
    "evidenceUrl" TEXT,
    "evidenceNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "mentorId" TEXT,
    "meetingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "health" "TeamHealth" NOT NULL DEFAULT 'GREEN',
    "notes" TEXT,
    "actionItems" TEXT,
    "progressNotes" TEXT,
    "blockers" TEXT,
    "nextGoals" TEXT,
    "evidenceUrl" TEXT,
    "submittedByRole" TEXT NOT NULL DEFAULT 'TEAM',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "role" "EditionRole" NOT NULL DEFAULT 'PARTICIPANT',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "editionId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictOfInterest" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "reason" TEXT,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictOfInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "editionId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dedupKey" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "notifyMilestones" BOOLEAN NOT NULL DEFAULT true,
    "notifyCheckIns" BOOLEAN NOT NULL DEFAULT true,
    "notifyEvaluations" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "targetRole" "EditionRole",
    "eventId" TEXT,
    "teamId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryLog" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDecision" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "decision" "StageDecision" NOT NULL,
    "notes" TEXT,
    "decidedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Edition_slug_key" ON "Edition"("slug");

-- CreateIndex
CREATE INDEX "Edition_status_idx" ON "Edition"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "EditionMembership_editionId_role_idx" ON "EditionMembership"("editionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "EditionMembership_userId_editionId_key" ON "EditionMembership"("userId", "editionId");

-- CreateIndex
CREATE INDEX "Event_editionId_status_idx" ON "Event"("editionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Event_editionId_sequenceIndex_key" ON "Event"("editionId", "sequenceIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Event_editionId_slug_key" ON "Event"("editionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_regCode_key" ON "Team"("regCode");

-- CreateIndex
CREATE INDEX "Team_editionId_status_idx" ON "Team"("editionId", "status");

-- CreateIndex
CREATE INDEX "Team_regCode_idx" ON "Team"("regCode");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamInvite_teamId_idx" ON "TeamInvite"("teamId");

-- CreateIndex
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");

-- CreateIndex
CREATE INDEX "TeamInvite_token_idx" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "Submission_eventId_status_idx" ON "Submission"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_teamId_eventId_roundNumber_key" ON "Submission"("teamId", "eventId", "roundNumber");

-- CreateIndex
CREATE INDEX "Rubric_eventId_idx" ON "Rubric"("eventId");

-- CreateIndex
CREATE INDEX "Criterion_rubricId_idx" ON "Criterion"("rubricId");

-- CreateIndex
CREATE INDEX "Evaluation_eventId_status_idx" ON "Evaluation"("eventId", "status");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatorId_idx" ON "Evaluation"("evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_eventId_teamId_evaluatorId_key" ON "Evaluation"("eventId", "teamId", "evaluatorId");

-- CreateIndex
CREATE INDEX "EvaluationScore_evaluationId_idx" ON "EvaluationScore"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_evaluationId_criterionId_key" ON "EvaluationScore"("evaluationId", "criterionId");

-- CreateIndex
CREATE INDEX "Milestone_editionId_idx" ON "Milestone"("editionId");

-- CreateIndex
CREATE INDEX "TeamMilestone_teamId_status_idx" ON "TeamMilestone"("teamId", "status");

-- CreateIndex
CREATE INDEX "TeamMilestone_editionId_idx" ON "TeamMilestone"("editionId");

-- CreateIndex
CREATE INDEX "TeamMilestone_dueDate_idx" ON "TeamMilestone"("dueDate");

-- CreateIndex
CREATE INDEX "CheckIn_teamId_idx" ON "CheckIn"("teamId");

-- CreateIndex
CREATE INDEX "CheckIn_mentorId_idx" ON "CheckIn"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_editionId_idx" ON "Invitation"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "AuditLog_editionId_idx" ON "AuditLog"("editionId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ConflictOfInterest_editionId_idx" ON "ConflictOfInterest"("editionId");

-- CreateIndex
CREATE INDEX "ConflictOfInterest_evaluatorId_idx" ON "ConflictOfInterest"("evaluatorId");

-- CreateIndex
CREATE INDEX "ConflictOfInterest_teamId_idx" ON "ConflictOfInterest"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictOfInterest_evaluatorId_teamId_key" ON "ConflictOfInterest"("evaluatorId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_editionId_idx" ON "Notification"("editionId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "Announcement_editionId_publishedAt_idx" ON "Announcement"("editionId", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_targetRole_idx" ON "Announcement"("targetRole");

-- CreateIndex
CREATE INDEX "Announcement_eventId_idx" ON "Announcement"("eventId");

-- CreateIndex
CREATE INDEX "Announcement_teamId_idx" ON "Announcement"("teamId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryLog_idempotencyKey_key" ON "EmailDeliveryLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_recipientEmail_idx" ON "EmailDeliveryLog"("recipientEmail");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_triggerType_idx" ON "EmailDeliveryLog"("triggerType");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_status_idx" ON "EmailDeliveryLog"("status");

-- CreateIndex
CREATE INDEX "EventDecision_eventId_decision_idx" ON "EventDecision"("eventId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "EventDecision_eventId_teamId_key" ON "EventDecision"("eventId", "teamId");

-- AddForeignKey
ALTER TABLE "EditionMembership" ADD CONSTRAINT "EditionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditionMembership" ADD CONSTRAINT "EditionMembership_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMilestone" ADD CONSTRAINT "TeamMilestone_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMilestone" ADD CONSTRAINT "TeamMilestone_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMilestone" ADD CONSTRAINT "TeamMilestone_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMilestone" ADD CONSTRAINT "TeamMilestone_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictOfInterest" ADD CONSTRAINT "ConflictOfInterest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDecision" ADD CONSTRAINT "EventDecision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDecision" ADD CONSTRAINT "EventDecision_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDecision" ADD CONSTRAINT "EventDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


