/**
 * HackTrack — one-off E2E test-data cleanup (direct Prisma, run once).
 *
 * Removes everything the §3 end-to-end lifecycle run created in the live
 * production database, and nothing else:
 *
 *   - Users whose email is on the @hacktrack-e2e.test domain
 *     (this covers both `e2e-*` and `probe-*` accounts)
 *   - The E2E teams HT26-T002 .. HT26-T006 (and any other edition team whose
 *     members are *all* @hacktrack-e2e.test accounts)
 *   - Evaluations + EvaluationScore rows (the seed creates none; every
 *     evaluation in the edition was produced by the E2E review allocator,
 *     including the 3 DRAFT evaluations hanging off the seed team HT26-T001)
 *   - EventDecision rows, AuditLog rows, Invitation rows, and every other
 *     satellite row tied to those teams/users
 *
 * Preserved untouched:
 *   - HT26-T001 (original seed team) and its members
 *   - All @hacktrack.edu seed users and their memberships
 *   - The Ideathon deadline (already restored to the seed value)
 *
 * Safety:
 *   - Aborts (no deletes) if any HT26-T00{2..6} team has a non-E2E member,
 *     or has no members at all.
 *   - Runs all deletes inside one interactive transaction (60s timeout) so a
 *     mid-way failure rolls back completely.
 *   - Set CLEANUP_DRY_RUN=1 to count without deleting (rolls back).
 *
 * This script is NOT an API endpoint. It is normally armed via the sentinel
 * file `scripts/.e2e-cleanup-armed` and executed from `scripts/vercel-build.sh`
 * on a production Vercel build (the only runtime that can reach the DB).
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const E2E_EMAIL_DOMAIN = "@hacktrack-e2e.test";
const SEED_EMAIL_DOMAIN = "@hacktrack.edu";
const E2E_TEAM_CODES = ["HT26-T002", "HT26-T003", "HT26-T004", "HT26-T005", "HT26-T006"];
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
  console.log(`[e2e-cleanup] ${line}`);
}

async function main() {
  log(`starting (dryRun=${DRY_RUN})`);

  const edition = await prisma.edition.findUnique({ where: { slug: EDITION_SLUG } });
  if (!edition) throw new Error(`Edition '${EDITION_SLUG}' not found`);
  const editionId = edition.id;

  const e2eUsers = await prisma.user.findMany({
    where: { email: { endsWith: E2E_EMAIL_DOMAIN } },
    select: { id: true, email: true },
  });
  const e2eUserIds = e2eUsers.map((u) => u.id);
  log(`E2E users found: ${e2eUsers.length}`);

  const teams = await prisma.team.findMany({
    where: { editionId },
    include: { members: { include: { user: { select: { email: true } } } } },
  });

  const isE2eOnlyTeam = (t: (typeof teams)[number]) =>
    t.members.length > 0 &&
    t.members.every((m) => m.user.email.endsWith(E2E_EMAIL_DOMAIN));

  const candidates = teams.filter((t) => E2E_TEAM_CODES.includes(t.regCode));
  for (const t of candidates) {
    if (t.members.length === 0) {
      throw new Error(`ABORT: ${t.regCode} has no members — refusing to delete blindly`);
    }
    for (const m of t.members) {
      if (!m.user.email.endsWith(E2E_EMAIL_DOMAIN)) {
        throw new Error(
          `ABORT: ${t.regCode} has non-E2E member ${m.user.email} — number collision, refusing to delete`
        );
      }
    }
  }
  const strays = teams.filter((t) => isE2eOnlyTeam(t) && !E2E_TEAM_CODES.includes(t.regCode));
  if (strays.length) {
    log(`WARNING: additional all-E2E teams not in the expected range: ${strays.map((t) => t.regCode).join(", ")}`);
  }
  const e2eTeams = [...candidates, ...strays];
  const e2eTeamIds = e2eTeams.map((t) => t.id);
  log(`E2E teams to delete: ${e2eTeams.map((t) => t.regCode).join(", ") || "(none)"}`);

  const seedTeam = teams.find((t) => t.regCode === SEED_TEAM_CODE);
  if (!seedTeam) throw new Error(`Seed team ${SEED_TEAM_CODE} not found — refusing to proceed`);

  // All evaluations in the edition are allocator-created (seed creates none),
  // including the DRAFT rows attached to the seed team.
  const evaluations = await prisma.evaluation.findMany({
    where: { event: { editionId } },
    select: { id: true },
  });
  const evaluationIds = evaluations.map((e) => e.id);

  const invitations = await prisma.invitation.findMany({
    where: { OR: [{ email: { endsWith: E2E_EMAIL_DOMAIN } }, { invitedById: { in: e2eUserIds } }] },
    select: { id: true },
  });
  const invitationIds = invitations.map((i) => i.id);

  const decisions = await prisma.eventDecision.findMany({
    where: { OR: [{ teamId: { in: e2eTeamIds } }, { decidedById: { in: e2eUserIds } }] },
    select: { id: true },
  });
  const decisionIds = decisions.map((d) => d.id);

  const auditWhere: Prisma.AuditLogWhereInput = {
    OR: [
      { actorId: { in: e2eUserIds } },
      { entityId: { in: [...e2eTeamIds, ...evaluationIds, ...invitationIds, ...decisionIds] } },
      {
        editionId,
        action: {
          in: ["EVENT_SEQUENCE_UPDATED", "NORMALIZATION_COMMITTED", "REVIEW_ALLOCATION_EXECUTED"],
        },
      },
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
            where: { OR: [{ teamId: { in: e2eTeamIds } }, { decidedById: { in: e2eUserIds } }] },
          })
        ).count;
        c.notification = (await tx.notification.deleteMany({ where: { userId: { in: e2eUserIds } } })).count;
        c.announcementRead = (
          await tx.announcementRead.deleteMany({ where: { userId: { in: e2eUserIds } } })
        ).count;
        c.notificationPreference = (
          await tx.notificationPreference.deleteMany({ where: { userId: { in: e2eUserIds } } })
        ).count;
        c.emailDeliveryLog = (
          await tx.emailDeliveryLog.deleteMany({
            where: {
              OR: [{ userId: { in: e2eUserIds } }, { recipientEmail: { endsWith: E2E_EMAIL_DOMAIN } }],
            },
          })
        ).count;
        c.announcement = (
          await tx.announcement.deleteMany({
            where: { OR: [{ authorId: { in: e2eUserIds } }, { teamId: { in: e2eTeamIds } }] },
          })
        ).count;
        c.checkIn = (
          await tx.checkIn.deleteMany({
            where: { OR: [{ teamId: { in: e2eTeamIds } }, { mentorId: { in: e2eUserIds } }] },
          })
        ).count;
        c.teamMilestone = (
          await tx.teamMilestone.deleteMany({ where: { teamId: { in: e2eTeamIds } } })
        ).count;
        c.conflictOfInterest = (
          await tx.conflictOfInterest.deleteMany({
            where: { OR: [{ evaluatorId: { in: e2eUserIds } }, { teamId: { in: e2eTeamIds } }] },
          })
        ).count;
        c.submission = (await tx.submission.deleteMany({ where: { teamId: { in: e2eTeamIds } } })).count;
        c.teamMember = (
          await tx.teamMember.deleteMany({
            where: { OR: [{ teamId: { in: e2eTeamIds } }, { userId: { in: e2eUserIds } }] },
          })
        ).count;
        c.teamInvite = (await tx.teamInvite.deleteMany({ where: { teamId: { in: e2eTeamIds } } })).count;
        c.team = (await tx.team.deleteMany({ where: { id: { in: e2eTeamIds } } })).count;
        c.invitation = (
          await tx.invitation.deleteMany({
            where: { OR: [{ email: { endsWith: E2E_EMAIL_DOMAIN } }, { invitedById: { in: e2eUserIds } }] },
          })
        ).count;
        c.passwordResetToken = (
          await tx.passwordResetToken.deleteMany({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } })
        ).count;
        c.editionMembership = (
          await tx.editionMembership.deleteMany({ where: { userId: { in: e2eUserIds } } })
        ).count;
        c.user = (await tx.user.deleteMany({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } })).count;

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
    e2eUsersRemaining: await prisma.user.count({ where: { email: { endsWith: E2E_EMAIL_DOMAIN } } }),
    seedUsersRemaining: await prisma.user.count({ where: { email: { endsWith: SEED_EMAIL_DOMAIN } } }),
    evaluationsRemaining: await prisma.evaluation.count({ where: { event: { editionId } } }),
    decisionsRemaining: await prisma.eventDecision.count({ where: { event: { editionId } } }),
    auditLogsRemaining: await prisma.auditLog.count({ where: { editionId } }),
    invitationsRemaining: await prisma.invitation.count({ where: { editionId } }),
    membershipsRemaining: await prisma.editionMembership.count({ where: { editionId } }),
    ideathonDeadline: (
      await prisma.event.findFirst({ where: { editionId, slug: "ideathon" }, select: { submissionDeadline: true } })
    )?.submissionDeadline,
  };

  console.log("=== E2E-CLEANUP RESULT BEGIN ===");
  console.log(JSON.stringify({ editionId, dryRun: DRY_RUN, deleted: counts, verify }, null, 2));
  console.log("=== E2E-CLEANUP RESULT END ===");
}

main()
  .catch((e) => {
    console.error(`[e2e-cleanup] FAILED: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
