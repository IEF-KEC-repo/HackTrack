import { prisma } from "@/lib/prisma";
import { ReviewType, EventStatus, EditionStatus } from "@prisma/client";
import { recordAuditLog } from "./audit-service";

export interface CloneEditionParams {
  sourceSlug: string;
  newName: string;
  newSlug: string;
  academicYear: string;
  startDate: Date;
  endDate: Date;
  actorId?: string;
}

export interface EventConfigInput {
  id?: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  reviewType: ReviewType;
  status?: EventStatus;
  submissionDeadline?: Date | null;
  evaluationDeadline?: Date | null;
}

/**
 * Clones a previous edition's event sequence, review modalities, rubrics, criteria, and scale anchors.
 */
export async function cloneEdition(params: CloneEditionParams) {
  const sourceEdition = await prisma.edition.findUnique({
    where: { slug: params.sourceSlug },
    include: {
      events: {
        orderBy: { sequenceIndex: "asc" },
        include: {
          rubrics: {
            include: { criteria: { orderBy: { sequenceOrder: "asc" } } },
          },
        },
      },
    },
  });

  if (!sourceEdition) {
    throw new Error(`Source edition with slug "${params.sourceSlug}" not found.`);
  }

  // Create new edition and duplicate events + rubrics inside a transaction
  return prisma.$transaction(async (tx) => {
    const newEdition = await tx.edition.create({
      data: {
        name: params.newName,
        slug: params.newSlug.toLowerCase().trim(),
        academicYear: params.academicYear,
        status: EditionStatus.DRAFT,
        startDate: params.startDate,
        endDate: params.endDate,
        clonedFromEditionId: sourceEdition.id,
      },
    });

    for (const sourceEvent of sourceEdition.events) {
      const createdEvent = await tx.event.create({
        data: {
          editionId: newEdition.id,
          name: sourceEvent.name,
          slug: sourceEvent.slug,
          sequenceIndex: sourceEvent.sequenceIndex,
          reviewType: sourceEvent.reviewType,
          status: EventStatus.UPCOMING,
        },
      });

      // Clone rubrics & criteria
      for (const sourceRubric of sourceEvent.rubrics) {
        const createdRubric = await tx.rubric.create({
          data: {
            eventId: createdEvent.id,
            name: sourceRubric.name,
            totalMaxPoints: sourceRubric.totalMaxPoints,
          },
        });

        for (const sourceCriterion of sourceRubric.criteria) {
          await tx.criterion.create({
            data: {
              rubricId: createdRubric.id,
              title: sourceCriterion.title,
              description: sourceCriterion.description,
              maxPoints: sourceCriterion.maxPoints,
              weightPercentage: sourceCriterion.weightPercentage,
              anchors: sourceCriterion.anchors ? JSON.parse(JSON.stringify(sourceCriterion.anchors)) : null,
              sequenceOrder: sourceCriterion.sequenceOrder,
            },
          });
        }
      }
    }

    await recordAuditLog({
      editionId: newEdition.id,
      actorId: params.actorId,
      action: "EDITION_CLONED",
      entityType: "Edition",
      entityId: newEdition.id,
      previousState: { clonedFromSlug: params.sourceSlug },
      newState: newEdition,
    });

    return newEdition;
  });
}

/**
 * Dynamically adjusts the Continuous Project Review (CPR) count (3 to 5) for an edition.
 */
export async function setContinuousProjectReviewCount(params: {
  editionId: string;
  cprCount: 3 | 4 | 5;
  actorId?: string;
}) {
  const { editionId, cprCount, actorId } = params;

  if (cprCount < 3 || cprCount > 5) {
    throw new Error("Continuous Project Review count must be between 3 and 5.");
  }

  return prisma.$transaction(async (tx) => {
    const allEvents = await tx.event.findMany({
      where: { editionId },
      orderBy: { sequenceIndex: "asc" },
      include: { submissions: true },
    });

    const cprEvents = allEvents.filter((e) => e.slug.startsWith("cpr-"));
    const currentCprCount = cprEvents.length;

    // If shrinking CPR count, safeguard against deleting stages with active submissions
    if (cprCount < currentCprCount) {
      const eventsToRemove = cprEvents.slice(cprCount);
      for (const ev of eventsToRemove) {
        if (ev.submissions.length > 0) {
          throw new Error(
            `Cannot reduce CPR count: Stage "${ev.name}" has ${ev.submissions.length} existing submission(s).`
          );
        }
      }

      for (const ev of eventsToRemove) {
        await tx.event.delete({ where: { id: ev.id } });
      }
    }

    // If growing CPR count, create the additional CPR stages
    if (cprCount > currentCprCount) {
      for (let i = currentCprCount + 1; i <= cprCount; i++) {
        await tx.event.create({
          data: {
            editionId,
            name: `Continuous Project Review ${i} (CPR ${i})`,
            slug: `cpr-${i}`,
            sequenceIndex: 2 + i, // Temporary index; resequencing follows
            reviewType: ReviewType.LIVE_PANEL,
            status: EventStatus.UPCOMING,
          },
        });
      }
    }

    // Re-fetch and re-sequence all events cleanly
    const refreshedEvents = await tx.event.findMany({
      where: { editionId },
      orderBy: { sequenceIndex: "asc" },
    });

    // Standard ordering: Ideathon (1) -> Innovatz (2) -> CPRs (3..3+N) -> POC -> Demo Day -> Any Others
    const ideathon = refreshedEvents.filter((e) => e.slug === "ideathon");
    const innovatz = refreshedEvents.filter((e) => e.slug === "innovatz");
    const cprs = refreshedEvents
      .filter((e) => e.slug.startsWith("cpr-"))
      .sort((a, b) => {
        const numA = parseInt(a.slug.replace("cpr-", "")) || 0;
        const numB = parseInt(b.slug.replace("cpr-", "")) || 0;
        return numA - numB;
      });
    const poc = refreshedEvents.filter((e) => e.slug === "poc");
    const demoDay = refreshedEvents.filter((e) => e.slug === "demo-day");
    const others = refreshedEvents.filter(
      (e) => !["ideathon", "innovatz", "poc", "demo-day"].includes(e.slug) && !e.slug.startsWith("cpr-")
    );

    const orderedList = [...ideathon, ...innovatz, ...cprs, ...poc, ...demoDay, ...others];

    // Resequence sequentially 1..N
    for (let index = 0; index < orderedList.length; index++) {
      await tx.event.update({
        where: { id: orderedList[index].id },
        data: { sequenceIndex: index + 1 },
      });
    }

    await recordAuditLog({
      editionId,
      actorId,
      action: "CPR_COUNT_UPDATED",
      entityType: "Edition",
      entityId: editionId,
      previousState: { previousCprCount: currentCprCount },
      newState: { newCprCount: cprCount },
    });

    return tx.event.findMany({
      where: { editionId },
      orderBy: { sequenceIndex: "asc" },
    });
  });
}

/**
 * Reorders or renames events in an edition pipeline.
 */
export async function updateEventSequence(params: {
  editionId: string;
  events: EventConfigInput[];
  actorId?: string;
}) {
  const { editionId, events, actorId } = params;

  return prisma.$transaction(async (tx) => {
    const existingEvents = await tx.event.findMany({ where: { editionId } });

    // Use a negative offset temporarily to prevent unique constraint conflicts on (editionId, sequenceIndex)
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.id) {
        await tx.event.update({
          where: { id: ev.id },
          data: { sequenceIndex: -(i + 1) },
        });
      }
    }

    // Apply new sequence indices and names
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.id) {
        await tx.event.update({
          where: { id: ev.id },
          data: {
            name: ev.name,
            sequenceIndex: i + 1,
            reviewType: ev.reviewType,
            submissionDeadline: ev.submissionDeadline,
            evaluationDeadline: ev.evaluationDeadline,
          },
        });
      }
    }

    const updatedEvents = await tx.event.findMany({
      where: { editionId },
      orderBy: { sequenceIndex: "asc" },
    });

    await recordAuditLog({
      editionId,
      actorId,
      action: "EVENT_SEQUENCE_UPDATED",
      entityType: "Edition",
      entityId: editionId,
      previousState: existingEvents,
      newState: updatedEvents,
    });

    return updatedEvents;
  });
}
