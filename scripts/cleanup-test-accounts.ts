/**
 * HackTrack — one-off cleanup of the public self-registration verification
 * accounts (direct Prisma, run once via the production Vercel build).
 *
 * These accounts were created by manually exercising the live
 * `POST /api/auth/register-team` route while verifying the kongu.edu domain
 * gate. Naming convention: `e2e.lead.<digits>@kongu.edu`, each owning a team
 * whose members are exactly that account.
 *
 * Removes ONLY:
 *   - users matching /^e2e\.lead\.\d+@kongu\.edu$/i
 *   - every edition team whose members are non-empty and ALL such verification
 *     users (covers HT26-T002 / HT26-T003 from the first run, plus any team a
 *     later verification run created)
 *   - every satellite row tied to those users/teams (memberships, invites,
 *     notifications, audit logs, email logs, ...)
 *
 * Preserved untouched:
 *   - HT26-T001 (the original seed team) and its members
 *   - every real @kongu.edu / @hacktrack.edu account and membership
 *
 * Safety:
 *   - Aborts (no deletes) if a team is a mix of verification and non-verification
 *     members, so a cuid/regCode collision can never delete a real team.
 *   - Runs all deletes in one interactive transaction (60s) so a mid-way failure
 *     rolls back completely.
 *   - Set CLEANUP_DRY_RUN=1 to count only (the transaction rolls back).
 *
 * NOT an API endpoint. Armed via the sentinel file
 * `scripts/.test-accounts-cleanup-armed` and executed from
 * `scripts/vercel-build.sh` on a production build (the only runtime that can
 * reach the database).
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const VERIFY_EMAIL_REGEX = /^e2e\.lead\.\d+@kongu\.edu$/i;
const EDITION_SLUG = "ht26";
const SEED_TEAM_CODE = "HT26-T001";
const DRY_RUN = process.env.CLEANUP_DRY_RUN === "1";

type Counts = Record<string, number>;

/** Thrown to force a transaction rollback in dry-run mode. */
class Rollback extends Error {
  constructor(public readonly counts: Counts) {
    super("CLEANUP_DRY_RUN rollback");
  }
}

function log(line: string) {
  console.log(`[test-accounts-cleanup] ${line}`);
}

async function main() {
  log(`starting (dryRun=${DRY_RUN})`);

  const edition = await prisma.edition.findUnique({ where: { slug: EDITION_SLUG } });
  if (!edition) throw new Error(`Edition '${EDITION_SLUG}' not found`);
  const editionId = edition.id;

  const verifyUsers = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  const verifyMatches = verifyUsers.filter((u) => VERIFY_EMAIL_REGEX.test(u.email));
  const verifyUserIds = verifyMatches.map((u) => u.id);
  const verifyEmailSet = new Set(verifyMatches.map((u) => u.email.toLowerCase()));
  log(`verification users found: ${verifyMatches.length} [${verifyMatches.map((u) => u.email).join(", ")}]`);

  const teams = await prisma.team.findMany({
    where: { editionId },
    include: { members: { include: { user: { select: { email: true } } } } },
  });

  const targetTeams: typeof teams = [];
  for (const t of teams) {
    if (t.members.length === 0) continue;
    const memberEmails = t.members.map((m) => m.user.email.toLowerCase());
    const verifyMembers = memberEmails.filter((e) => verifyEmailSet.has(e));
    if (verifyMembers.length === 0) continue;
    if (verifyMembers.length !== memberEmails.length) {
      throw new Error(
        `ABORT: ${t.regCode} mixes verification members (${verifyMembers.join(", ")}) with real members — refusing to delete`
      );
    }
    targetTeams.push(t);
  }
  const targetTeamIds = targetTeams.map((t) => t.id);
  log(`teams to delete: ${targetTeams.map((t) => t.regCode).join(", ") || "(none)"} ` +
    `[${targetTeams.map((t) => `${t.regCode}=${t.name}`).join(", ")}]`);

  const seedTeam = teams.find((t) => t.regCode === SEED_TEAM_CODE);
  if (!seedTeam) throw new Error(`Seed team ${SEED_TEAM_CODE} not found — refusing to proceed`);

  const evaluations = await prisma.evaluation.findMany({
    where: { teamId: { in: targetTeamIds } },
    select: { id: true },
  });
  const evaluationIds = evaluations.map((e) => e.id);

  const invitations = await prisma.invitation.findMany({
    where: {
      OR: [{ email: { in: [...verifyEmailSet] } }, { invitedById: { in: verifyUserIds } }],
    },
    select: { id: true },
  });
  const invitationIds = invitations.map((i) => i.id);

  const decisions = await prisma.eventDecision.findMany({
    where: { OR: [{ teamId: { in: targetTeamIds } }, { decidedById: { in: verifyUserIds } }] },
    select: { id: true },
  });
  const decisionIds = decisions.map((d) => d.id);

  const auditWhere: Prisma.AuditLogWhereInput = {
    OR: [
      { actorId: { in: verifyUserIds } },
      { entityId: { in: [...targetTeamIds, ...evaluationIds, ...invitationIds, ...decisionIds, ...verifyUserIds] } },
    ],
  };

  let counts: Counts;
  try {
    counts = await prisma.$transaction(
      async (tx) => {
        const c: Counts = {};
        c.auditLog = (await tx.auditLog.deleteMany({ where: auditWhere })).count;
        c.evaluationScore = (
          await tx.evaluationScore.deleteMany({ where: { evaluationId: { in: evaluationIds } } })
        ).count;
        c.evaluation = (await tx.evaluation.deleteMany({ where: { id: { in: evaluationIds } } })).count;
        c.eventDecision = (
          await tx.eventDecision.deleteMany({
            where: { OR: [{ teamId: { in: targetTeamIds } }, { decidedById: { in: verifyUserIds } }] },
          })
        ).count;
        c.notification = (await tx.notification.deleteMany({ where: { userId: { in: verifyUserIds } } })).count;
        c.announcementRead = (
          await tx.announcementRead.deleteMany({ where: { userId: { in: verifyUserIds } } })
        ).count;
        c.notificationPreference = (
          await tx.notificationPreference.deleteMany({ where: { userId: { in: verifyUserIds } } })
        ).count;
        c.emailDeliveryLog = (
          await tx.emailDeliveryLog.deleteMany({
            where: {
              OR: [
                { userId: { in: verifyUserIds } },
                { recipientEmail: { in: [...verifyEmailSet] } },
              ],
            },
          })
        ).count;
        c.announcement = (
          await tx.announcement.deleteMany({
            where: { OR: [{ authorId: { in: verifyUserIds } }, { teamId: { in: targetTeamIds } }] },
          })
        ).count;
        c.checkIn = (
          await tx.checkIn.deleteMany({
            where: { OR: [{ teamId: { in: targetTeamIds } }, { mentorId: { in: verifyUserIds } }] },
          })
        ).count;
        c.teamMilestone = (
          await tx.teamMilestone.deleteMany({ where: { teamId: { in: targetTeamIds } } })
        ).count;
        c.conflictOfInterest = (
          await tx.conflictOfInterest.deleteMany({
            where: { OR: [{ evaluatorId: { in: verifyUserIds } }, { teamId: { in: targetTeamIds } }] },
          })
        ).count;
        c.submission = (await tx.submission.deleteMany({ where: { teamId: { in: targetTeamIds } } })).count;
        c.teamMember = (
          await tx.teamMember.deleteMany({
            where: { OR: [{ teamId: { in: targetTeamIds } }, { userId: { in: verifyUserIds } }] },
          })
        ).count;
        c.teamInvite = (await tx.teamInvite.deleteMany({ where: { teamId: { in: targetTeamIds } } })).count;
        c.team = (await tx.team.deleteMany({ where: { id: { in: targetTeamIds } } })).count;
        c.invitation = (
          await tx.invitation.deleteMany({
            where: {
              OR: [{ email: { in: [...verifyEmailSet] } }, { invitedById: { in: verifyUserIds } }],
            },
          })
        ).count;
        c.passwordResetToken = (
          await tx.passwordResetToken.deleteMany({ where: { email: { in: [...verifyEmailSet] } } })
        ).count;
        c.editionMembership = (
          await tx.editionMembership.deleteMany({ where: { userId: { in: verifyUserIds } } })
        ).count;
        c.user = (await tx.user.deleteMany({ where: { id: { in: verifyUserIds } } })).count;

        if (DRY_RUN) throw new Rollback(c);
        return c;
      },
      { timeout: 60000, maxWait: 15000 }
    );
  } catch (e) {
    if (e instanceof Rollback) {
      counts = e.counts;
      log("DRY RUN — transaction rolled back, nothing deleted");
    } else {
      throw e;
    }
  }

  const verify = {
    teamsRemaining: (
      await prisma.team.findMany({
        where: { editionId },
        select: { regCode: true, name: true },
        orderBy: { regCode: "asc" },
      })
    ).map((t) => t.regCode),
    seedTeamMembers: (
      await prisma.teamMember.findMany({
        where: { teamId: seedTeam.id },
        include: { user: { select: { email: true } } },
      })
    ).map((m) => m.user.email),
    verificationUsersRemaining: (
      await prisma.user.findMany({ select: { email: true } })
    ).filter((u) => VERIFY_EMAIL_REGEX.test(u.email)).length,
    totalUsersRemaining: await prisma.user.count(),
    membershipsRemaining: await prisma.editionMembership.count({ where: { editionId } }),
  };

  console.log("=== TEST-ACCOUNTS-CLEANUP RESULT BEGIN ===");
  console.log(JSON.stringify({ editionId, dryRun: DRY_RUN, deleted: counts, verify }, null, 2));
  console.log("=== TEST-ACCOUNTS-CLEANUP RESULT END ===");
}

main()
  .catch((e) => {
    console.error(`[test-accounts-cleanup] FAILED: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
