import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "./audit-service";

export interface ScaleAnchor {
  level: number;
  label: string;
  description: string;
}

export interface CriterionInput {
  id?: string;
  title: string;
  description?: string;
  maxPoints: number;
  weightPercentage: number;
  sequenceOrder: number;
  anchors?: ScaleAnchor[];
}

export interface RubricValidationResult {
  valid: boolean;
  totalWeight: number;
  errors: string[];
}

/**
 * Validates criteria weights sum strictly to 100% and checks anchor definitions.
 */
export function validateRubricCriteria(criteria: CriterionInput[]): RubricValidationResult {
  const errors: string[] = [];

  if (!criteria || criteria.length === 0) {
    return {
      valid: false,
      totalWeight: 0,
      errors: ["At least one criterion is required for the rubric."],
    };
  }

  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weightPercentage) || 0), 0);
  const roundedWeight = Math.round(totalWeight * 100) / 100;

  if (Math.abs(roundedWeight - 100.0) > 0.001) {
    errors.push(
      `Criterion weights must sum to exactly 100.0%. Current sum: ${roundedWeight}%.`
    );
  }

  criteria.forEach((c, idx) => {
    if (!c.title || c.title.trim() === "") {
      errors.push(`Criterion #${idx + 1} has an empty title.`);
    }
    if (c.maxPoints <= 0) {
      errors.push(`Criterion "${c.title || `#${idx + 1}`}" must have maxPoints > 0.`);
    }
    if (c.weightPercentage <= 0) {
      errors.push(`Criterion "${c.title || `#${idx + 1}`}" must have weightPercentage > 0.`);
    }
    if (c.anchors && c.anchors.length > 0) {
      for (const a of c.anchors) {
        if (!a.label || a.label.trim() === "") {
          errors.push(`Scale anchor Level ${a.level} on "${c.title}" requires a label.`);
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    totalWeight: roundedWeight,
    errors,
  };
}

/**
 * Saves or updates a Rubric and its criteria with scale level anchors.
 */
export async function saveRubricWithCriteria(params: {
  eventId: string;
  name: string;
  criteria: CriterionInput[];
  actorId?: string;
  editionId?: string;
}) {
  const validation = validateRubricCriteria(params.criteria);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  // Find existing rubric for event
  const existingRubric = await prisma.rubric.findFirst({
    where: { eventId: params.eventId },
    include: { criteria: true },
  });

  // Execute in transaction
  return prisma.$transaction(async (tx) => {
    let rubricId: string;

    if (existingRubric) {
      rubricId = existingRubric.id;
      await tx.rubric.update({
        where: { id: rubricId },
        data: { name: params.name },
      });
      // Delete existing criteria to replace with new criteria set
      await tx.criterion.deleteMany({
        where: { rubricId },
      });
    } else {
      const created = await tx.rubric.create({
        data: {
          eventId: params.eventId,
          name: params.name,
          totalMaxPoints: 100.0,
        },
      });
      rubricId = created.id;
    }

    // Create new criteria
    for (const c of params.criteria) {
      await tx.criterion.create({
        data: {
          rubricId,
          title: c.title,
          description: c.description,
          maxPoints: c.maxPoints,
          weightPercentage: c.weightPercentage,
          sequenceOrder: c.sequenceOrder,
          anchors: c.anchors ? JSON.parse(JSON.stringify(c.anchors)) : null,
        },
      });
    }

    const updatedRubric = await tx.rubric.findUnique({
      where: { id: rubricId },
      include: { criteria: { orderBy: { sequenceOrder: "asc" } } },
    });

    if (params.editionId) {
      await recordAuditLog({
        editionId: params.editionId,
        actorId: params.actorId,
        action: "RUBRIC_CONFIGURED",
        entityType: "Rubric",
        entityId: rubricId,
        previousState: existingRubric,
        newState: updatedRubric,
      });
    }

    return updatedRubric;
  });
}
