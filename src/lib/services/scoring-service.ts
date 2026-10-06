import { prisma } from "@/lib/prisma";
import { EvaluationStatus } from "@prisma/client";

export interface RubricCriterionItem {
  id: string;
  title?: string;
  maxPoints: number;
  weightPercentage: number;
}

export interface ScoreCalculationResult {
  totalScore: number;
  weightedScores: Record<string, number>;
  isValid: boolean;
  errors?: string[];
}

/**
 * Pure function: Calculates weighted composite rubric score.
 * Formula: Sum over criteria of (score / maxPoints * weightPercentage).
 */
export function calculateWeightedRubricScore(
  criteria: RubricCriterionItem[],
  scores: Record<string, number>
): ScoreCalculationResult {
  if (!criteria || criteria.length === 0) {
    return { totalScore: 0, weightedScores: {}, isValid: true };
  }

  let totalScore = 0;
  const weightedScores: Record<string, number> = {};
  const errors: string[] = [];

  for (const c of criteria) {
    const rawVal = scores[c.id];
    if (rawVal === undefined || rawVal === null || isNaN(rawVal)) {
      errors.push(`Missing score for criterion ${c.id}`);
      continue;
    }

    if (rawVal < 0 || rawVal > c.maxPoints) {
      errors.push(`Score ${rawVal} for criterion ${c.id} is outside allowed range [0, ${c.maxPoints}]`);
    }

    const clampedScore = Math.max(0, Math.min(c.maxPoints, rawVal));
    const weighted = (clampedScore / c.maxPoints) * c.weightPercentage;
    weightedScores[c.id] = Math.round(weighted * 100) / 100;
    totalScore += weighted;
  }

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    weightedScores,
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Pure function: Validates evaluation readiness for final submission.
 */
export function validateEvaluationSubmission(params: {
  criteria: RubricCriterionItem[];
  scores: Record<string, number>;
  generalFeedback?: string | null;
  minFeedbackLength?: number;
}): { valid: boolean; errors: string[] } {
  const { criteria, scores, generalFeedback, minFeedbackLength = 20 } = params;
  const errors: string[] = [];

  // 1. Verify all criteria are scored
  for (const c of criteria) {
    const s = scores[c.id];
    if (s === undefined || s === null || isNaN(s)) {
      errors.push(`Criterion ${c.id} requires a valid score.`);
    } else if (s < 0 || s > c.maxPoints) {
      errors.push(`Criterion ${c.id} score (${s}) exceeds allowed bounds [0, ${c.maxPoints}].`);
    }
  }

  // 2. Verify qualitative feedback length
  const feedbackTrimmed = generalFeedback?.trim() || "";
  if (feedbackTrimmed.length < minFeedbackLength) {
    errors.push(
      `Qualitative feedback must be at least ${minFeedbackLength} characters long (currently ${feedbackTrimmed.length}).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Database operation: Evaluator saves an evaluation draft (auto-save or manual).
 */
export async function saveEvaluationDraft(params: {
  evaluationId: string;
  evaluatorId: string;
  scores: Record<string, number>;
  criterionFeedback?: Record<string, string>;
  generalFeedback?: string;
}) {
  const { evaluationId, evaluatorId, scores, criterionFeedback = {}, generalFeedback } = params;

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      event: {
        include: {
          rubrics: {
            include: { criteria: true },
          },
        },
      },
    },
  });

  if (!evaluation) throw new Error("Evaluation record not found.");
  if (evaluation.evaluatorId !== evaluatorId) {
    throw new Error("Unauthorized: You are not the assigned evaluator for this record.");
  }
  if (evaluation.status === EvaluationStatus.SUBMITTED) {
    throw new Error("Cannot edit a locked evaluation. Request coordinator to reopen if changes are needed.");
  }

  const rubric = evaluation.event.rubrics[0];
  const criteria = rubric ? rubric.criteria : [];
  const calc = calculateWeightedRubricScore(criteria, scores);

  // Upsert individual criterion scores
  for (const [criterionId, scoreVal] of Object.entries(scores)) {
    await prisma.evaluationScore.upsert({
      where: {
        evaluationId_criterionId: { evaluationId, criterionId },
      },
      update: {
        score: scoreVal,
        feedback: criterionFeedback[criterionId] || null,
      },
      create: {
        evaluationId,
        criterionId,
        score: scoreVal,
        feedback: criterionFeedback[criterionId] || null,
      },
    });
  }

  // Update evaluation draft
  return await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      rawTotalScore: calc.totalScore,
      generalFeedback,
      status: EvaluationStatus.DRAFT,
    },
  });
}

/**
 * Database operation: Evaluator submits final evaluation, locking it from further edits.
 */
export async function submitFinalEvaluation(params: {
  evaluationId: string;
  evaluatorId: string;
  scores: Record<string, number>;
  criterionFeedback?: Record<string, string>;
  generalFeedback: string;
}) {
  const { evaluationId, evaluatorId, scores, criterionFeedback = {}, generalFeedback } = params;

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      team: { select: { id: true, name: true, regCode: true, editionId: true } },
      event: {
        include: {
          rubrics: {
            include: { criteria: true },
          },
        },
      },
    },
  });

  if (!evaluation) throw new Error("Evaluation record not found.");
  if (evaluation.evaluatorId !== evaluatorId) {
    throw new Error("Unauthorized: You are not the assigned evaluator for this record.");
  }
  if (evaluation.status === EvaluationStatus.SUBMITTED) {
    throw new Error("Evaluation is already finalized and submitted.");
  }

  const rubric = evaluation.event.rubrics[0];
  const criteria = rubric ? rubric.criteria : [];

  // Validate completion
  const validation = validateEvaluationSubmission({
    criteria,
    scores,
    generalFeedback,
  });

  if (!validation.valid) {
    throw new Error(`Submission blocked: ${validation.errors.join("; ")}`);
  }

  const calc = calculateWeightedRubricScore(criteria, scores);

  // Persist scores
  for (const [criterionId, scoreVal] of Object.entries(scores)) {
    await prisma.evaluationScore.upsert({
      where: {
        evaluationId_criterionId: { evaluationId, criterionId },
      },
      update: {
        score: scoreVal,
        feedback: criterionFeedback[criterionId] || null,
      },
      create: {
        evaluationId,
        criterionId,
        score: scoreVal,
        feedback: criterionFeedback[criterionId] || null,
      },
    });
  }

  // Lock evaluation
  const updated = await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      rawTotalScore: calc.totalScore,
      generalFeedback,
      status: EvaluationStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      editionId: evaluation.team.editionId,
      actorId: evaluatorId,
      action: "EVALUATION_SUBMITTED",
      entityType: "Evaluation",
      entityId: evaluationId,
      newState: JSON.stringify({
        teamCode: evaluation.team.regCode,
        rawScore: calc.totalScore,
        submittedAt: updated.submittedAt,
      }),
    },
  });

  return updated;
}

/**
 * Database operation: Coordinator (Manage) reopens a locked/submitted evaluation for revision.
 * Strictly audited.
 */
export async function reopenEvaluation(params: {
  evaluationId: string;
  coordinatorId: string;
  reason: string;
}) {
  const { evaluationId, coordinatorId, reason } = params;

  if (!reason || reason.trim().length === 0) {
    throw new Error("A justification reason is required to reopen an evaluation.");
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      team: { select: { id: true, regCode: true, editionId: true } },
    },
  });

  if (!evaluation) throw new Error("Evaluation record not found.");

  const updated = await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      status: EvaluationStatus.DRAFT,
      reopenedAt: new Date(),
      reopenedById: coordinatorId,
      reopenReason: reason.trim(),
    },
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      editionId: evaluation.team.editionId,
      actorId: coordinatorId,
      action: "EVALUATION_REOPENED",
      entityType: "Evaluation",
      entityId: evaluationId,
      previousState: JSON.stringify({ status: EvaluationStatus.SUBMITTED }),
      newState: JSON.stringify({
        status: EvaluationStatus.DRAFT,
        reopenedAt: updated.reopenedAt,
        reopenReason: reason.trim(),
      }),
    },
  });

  return updated;
}
