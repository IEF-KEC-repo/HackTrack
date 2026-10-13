import { PrismaClient, GlobalRole, EditionRole, EditionStatus, ReviewType, EventStatus, TeamStatus, TeamRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting HackTrack database seeding...");

  // 1. Password Hash for test users: "Password123!"
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("Password123!", salt);

  // 2. Upsert Edition: HackTrack 2026
  const edition = await prisma.edition.upsert({
    where: { slug: "ht26" },
    update: {},
    create: {
      name: "HackTrack 2026",
      slug: "ht26",
      academicYear: "2025-2026",
      status: EditionStatus.ACTIVE,
      startDate: new Date("2026-08-01T09:00:00Z"),
      endDate: new Date("2026-11-30T18:00:00Z"),
    },
  });
  console.log(`✅ Edition ready: ${edition.name} (${edition.slug})`);

  // 3. Create Core Event Sequence (Configurable 7 stages)
  const eventStages = [
    {
      name: "Ideathon",
      slug: "ideathon",
      sequenceIndex: 1,
      reviewType: ReviewType.ASYNC_MULTI_REVIEWER,
      status: EventStatus.SUBMISSION_OPEN,
      submissionDeadline: new Date("2026-08-25T23:59:59Z"),
      evaluationDeadline: new Date("2026-09-02T23:59:59Z"),
    },
    {
      name: "Innovatz",
      slug: "innovatz",
      sequenceIndex: 2,
      reviewType: ReviewType.LIVE_PANEL,
      status: EventStatus.UPCOMING,
      submissionDeadline: new Date("2026-09-15T23:59:59Z"),
      evaluationDeadline: new Date("2026-09-18T23:59:59Z"),
    },
    {
      name: "Continuous Project Review 1 (CPR 1)",
      slug: "cpr-1",
      sequenceIndex: 3,
      reviewType: ReviewType.LIVE_PANEL,
      status: EventStatus.UPCOMING,
      submissionDeadline: new Date("2026-10-01T23:59:59Z"),
      evaluationDeadline: new Date("2026-10-05T23:59:59Z"),
    },
    {
      name: "Continuous Project Review 2 (CPR 2)",
      slug: "cpr-2",
      sequenceIndex: 4,
      reviewType: ReviewType.LIVE_PANEL,
      status: EventStatus.UPCOMING,
      submissionDeadline: new Date("2026-10-20T23:59:59Z"),
      evaluationDeadline: new Date("2026-10-25T23:59:59Z"),
    },
    {
      name: "Continuous Project Review 3 (CPR 3)",
      slug: "cpr-3",
      sequenceIndex: 5,
      reviewType: ReviewType.LIVE_PANEL,
      status: EventStatus.UPCOMING,
      submissionDeadline: new Date("2026-11-05T23:59:59Z"),
      evaluationDeadline: new Date("2026-11-10T23:59:59Z"),
    },
    {
      name: "Proof of Concept (POC)",
      slug: "poc",
      sequenceIndex: 6,
      reviewType: ReviewType.LIVE_PANEL,
      status: EventStatus.UPCOMING,
      submissionDeadline: new Date("2026-11-20T23:59:59Z"),
      evaluationDeadline: new Date("2026-11-22T23:59:59Z"),
    },
    {
      name: "Demo Day",
      slug: "demo-day",
      sequenceIndex: 7,
      reviewType: ReviewType.LIVE_PANEL,
      status: EventStatus.UPCOMING,
      submissionDeadline: new Date("2026-11-28T23:59:59Z"),
      evaluationDeadline: new Date("2026-11-30T18:00:00Z"),
    },
  ];

  const createdEvents = [];
  for (const stg of eventStages) {
    const ev = await prisma.event.upsert({
      where: {
        editionId_slug: { editionId: edition.id, slug: stg.slug },
      },
      update: {},
      create: {
        editionId: edition.id,
        name: stg.name,
        slug: stg.slug,
        sequenceIndex: stg.sequenceIndex,
        reviewType: stg.reviewType,
        status: stg.status,
        submissionDeadline: stg.submissionDeadline,
        evaluationDeadline: stg.evaluationDeadline,
      },
    });
    createdEvents.push(ev);
  }
  console.log(`✅ Configured ${createdEvents.length} sequential event stages`);

  // 4. Create Weighted Rubric for Ideathon (Stage 1)
  const ideathonEvent = createdEvents[0];
  const rubric = await prisma.rubric.create({
    data: {
      eventId: ideathonEvent.id,
      name: "Ideathon Scoring Rubric",
      totalMaxPoints: 100.0,
      criteria: {
        create: [
          {
            title: "Problem Statement & Relevance",
            description: "Clarity of problem definition, societal or industry impact.",
            maxPoints: 25.0,
            weightPercentage: 25.0,
            sequenceOrder: 1,
          },
          {
            title: "Technical Feasibility & Architecture",
            description: "Viability of proposed engineering approach and tech stack.",
            maxPoints: 30.0,
            weightPercentage: 30.0,
            sequenceOrder: 2,
          },
          {
            title: "Innovation & Originality",
            description: "Novelty of approach compared to existing solutions.",
            maxPoints: 25.0,
            weightPercentage: 25.0,
            sequenceOrder: 3,
          },
          {
            title: "Presentation & Deck Quality",
            description: "Structure, visual clarity, and rigor of the Google Slides deck.",
            maxPoints: 20.0,
            weightPercentage: 20.0,
            sequenceOrder: 4,
          },
        ],
      },
    },
  });
  console.log(`✅ Created weighted rubric for Ideathon with 4 criteria (Sum: 100%)`);

  // 5. Create Sample Users across each Role
  const usersToSeed = [
    {
      email: "superadmin@hacktrack.edu",
      name: "Dr. Evelyn Reed",
      globalRole: GlobalRole.SUPER_ADMIN,
      editionRole: EditionRole.SUPER_ADMIN,
    },
    {
      email: "coord.manage@hacktrack.edu",
      name: "Marcus Vance",
      globalRole: GlobalRole.USER,
      editionRole: EditionRole.COORDINATOR_MANAGE,
    },
    {
      email: "coord.view@hacktrack.edu",
      name: "Dean Sarah Jenkins",
      globalRole: GlobalRole.USER,
      editionRole: EditionRole.COORDINATOR_VIEW,
    },
    {
      email: "evaluator@hacktrack.edu",
      name: "Alex Rivera",
      globalRole: GlobalRole.USER,
      editionRole: EditionRole.EVALUATOR,
    },
    {
      email: "mentor@hacktrack.edu",
      name: "Prof. Alan Turing",
      globalRole: GlobalRole.USER,
      editionRole: EditionRole.MENTOR,
    },
    {
      email: "lead@hacktrack.edu",
      name: "Priya Sharma",
      globalRole: GlobalRole.USER,
      editionRole: EditionRole.PARTICIPANT,
    },
    {
      email: "member@hacktrack.edu",
      name: "Liam O'Connor",
      globalRole: GlobalRole.USER,
      editionRole: EditionRole.PARTICIPANT,
    },
  ];

  const seededUsers: Record<string, any> = {};

  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        globalRole: u.globalRole,
        isVerified: true,
      },
    });

    await prisma.editionMembership.upsert({
      where: {
        userId_editionId: { userId: user.id, editionId: edition.id },
      },
      update: { role: u.editionRole },
      create: {
        userId: user.id,
        editionId: edition.id,
        role: u.editionRole,
      },
    });

    seededUsers[u.email] = user;
    console.log(`👤 Seeded User: ${u.name} [${u.editionRole}] <${u.email}>`);
  }

  // 6. Create Sample Team with Registration Code HT26-T001
  const teamLead = seededUsers["lead@hacktrack.edu"];
  const teamMember = seededUsers["member@hacktrack.edu"];
  const mentorUser = seededUsers["mentor@hacktrack.edu"];

  // Real, publicly viewable deck (YC seed deck template) so the demo embed renders.
  // NOTE: the previous value pointed at Google's API-docs sample id, which is not a
  // public file and returns HTTP 404 ("file does not exist") inside the iframe.
  const slidesUrl = "https://docs.google.com/presentation/d/1wvlvQBOPtmIbN3I7onp--7X5RzEJFp_ajQlasrEagho/edit?usp=sharing";
  const embedSlidesUrl = "https://docs.google.com/presentation/d/1wvlvQBOPtmIbN3I7onp--7X5RzEJFp_ajQlasrEagho/embed?start=false&loop=false&delayms=3000";

  const sampleTeam = await prisma.team.upsert({
    where: { regCode: "HT26-T001" },
    // Repair the demo deck link on re-seed so databases that were seeded with the
    // old (dead) presentation id also stop rendering Google's 404 page in the preview.
    update: { slidesUrl, embedSlidesUrl },
    create: {
      editionId: edition.id,
      regCode: "HT26-T001",
      name: "QuantumForge",
      track: "AI/ML & Edge Computing",
      status: TeamStatus.SUBMITTED,
      slidesUrl,
      embedSlidesUrl,
      mentorId: mentorUser.id,
      members: {
        create: [
          { userId: teamLead.id, role: TeamRole.LEAD },
          { userId: teamMember.id, role: TeamRole.MEMBER },
        ],
      },
    },
  });

  console.log(`🚀 Seeded Sample Team: ${sampleTeam.name} (${sampleTeam.regCode}) with Lead and Member`);
  console.log("✨ HackTrack Database Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
