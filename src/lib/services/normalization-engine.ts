import { prisma } from "@/lib/prisma";

export interface EvaluationRecord {
  id: string;
  teamId: string;
  evaluatorId: string;
  rawScore: number;
  status: string;
}

export interface EvaluatorStats {
  evaluatorId: string;
  count: number;
  mean: number;
  stdDev: number;
  harshness: "HARSH" | "MODERATE" | "GENEROUS";
}

export interface TeamScoreSummary {
  teamId: string;
  rawAverage: number;
  normalizedScore: number;
  displayScore?: number;
  reviewerScores: Array<{
    evaluatorId: string;
    rawScore: number;
    normalizedScore: number;
  }>;
  reviewerStdDev: number;
  scoreRange: number;
  isOutlier: boolean;
  needsExtraReview: boolean;
  outlierReason?: string;
  primaryCriterionScore?: number;
  submissionTimestamp?: number;
}

export interface NormalizationOutput {
  evaluatorStats: Record<string, EvaluatorStats>;
  teamSummaries: Record<string, TeamScoreSummary>;
  rankedTeams: Array<TeamScoreSummary & { rank: number; rawRank: number; rankShift: number }>;
}

/**
 * Pure statistical function: Computes per-evaluator Z-score normalization (ADR-006 & Decision D-01).
 * Standardizes raw scores to cohort baseline: Mean = 50.0, StdDev = 15.0.
 */
export function computeZScoreNormalization(params: {
  evaluations: EvaluationRecord[];
  baselineMean?: number;
  baselineStdDev?: number;
  outlierStdDevThreshold?: number;
  outlierRangeThreshold?: number;
  primaryCriterionScores?: Record<string, number>; // teamId -> primary criterion score
  submissionTimestamps?: Record<string, number>; // teamId -> epoch ms
  evaluatorStatsOverride?: Record<string, { mean: number; stdDev: number; count?: number; harshness?: "HARSH" | "MODERATE" | "GENEROUS" }>;
}): NormalizationOutput {
  const {
    evaluations,
    baselineMean = 50.0,
    baselineStdDev = 15.0,
    outlierStdDevThreshold = 15.0,
    outlierRangeThreshold = 20.0,
    primaryCriterionScores = {},
    submissionTimestamps = {},
    evaluatorStatsOverride,
  } = params;

  // 1. Group submitted evaluations by evaluator
  const byEvaluator: Record<string, number[]> = {};
  for (const ev of evaluations) {
    if (ev.status !== "SUBMITTED" && ev.status !== "COMPLETED") continue;
    if (ev.rawScore === undefined || ev.rawScore === null || isNaN(ev.rawScore)) continue;

    if (!byEvaluator[ev.evaluatorId]) {
      byEvaluator[ev.evaluatorId] = [];
    }
    byEvaluator[ev.evaluatorId].push(ev.rawScore);
  }

  // 2. Compute mean and sample standard deviation per evaluator
  const evaluatorStats: Record<string, EvaluatorStats> = {};
  for (const [evaluatorId, scores] of Object.entries(byEvaluator)) {
    const count = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / count;

    let stdDev = 0;
    if (count > 1) {
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / (count - 1);
      stdDev = Math.sqrt(variance);
    }

    let harshness: "HARSH" | "MODERATE" | "GENEROUS" = "MODERATE";
    if (mean < 68.0) harshness = "HARSH";
    else if (mean > 82.0) harshness = "GENEROUS";

    evaluatorStats[evaluatorId] = {
      evaluatorId,
      count,
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      harshness,
    };
  }

  // If explicit evaluator stats override is provided (e.g. calibration baseline or unit test)
  if (evaluatorStatsOverride) {
    for (const [evaluatorId, override] of Object.entries(evaluatorStatsOverride)) {
      evaluatorStats[evaluatorId] = {
        evaluatorId,
        count: override.count || evaluatorStats[evaluatorId]?.count || 1,
        mean: override.mean,
        stdDev: override.stdDev,
        harshness: override.harshness || evaluatorStats[evaluatorId]?.harshness || "MODERATE",
      };
    }
  }

  // 3. Normalize individual scores and group by team
  const byTeam: Record<
    string,
    Array<{ evaluatorId: string; rawScore: number; normalizedScore: number }>
  > = {};

  for (const ev of evaluations) {
    if (ev.status !== "SUBMITTED" && ev.status !== "COMPLETED") continue;
    if (ev.rawScore === undefined || ev.rawScore === null || isNaN(ev.rawScore)) continue;

    const stats = evaluatorStats[ev.evaluatorId];
    let normScore = baselineMean;

    if (stats) {
      if (stats.stdDev > 0) {
        const z = (ev.rawScore - stats.mean) / stats.stdDev;
        normScore = baselineMean + z * baselineStdDev;
      } else {
        // Zero standard deviation fallback
        normScore = baselineMean + (ev.rawScore - stats.mean);
      }
    }

    // Clamp score to [0, 100]
    normScore = Math.max(0, Math.min(100, Math.round(normScore * 10) / 10));

    if (!byTeam[ev.teamId]) {
      byTeam[ev.teamId] = [];
    }
    byTeam[ev.teamId].push({
      evaluatorId: ev.evaluatorId,
      rawScore: ev.rawScore,
      normalizedScore: normScore,
    });
  }

  // 4. Compute Team Summaries and Outlier Detection
  const teamSummaries: Record<string, TeamScoreSummary> = {};

  for (const [teamId, reviewerScores] of Object.entries(byTeam)) {
    const rawScores = reviewerScores.map((r) => r.rawScore);
    const normScores = reviewerScores.map((r) => r.normalizedScore);

    const rawAverage =
      rawScores.length > 0
        ? Math.round((rawScores.reduce((a, b) => a + b, 0) / rawScores.length) * 10) / 10
        : 0;

    const normalizedScore =
      normScores.length > 0
        ? Math.round((normScores.reduce((a, b) => a + b, 0) / normScores.length) * 10) / 10
        : 0;

    // Reviewer divergence std dev
    let reviewerStdDev = 0;
    if (rawScores.length > 1) {
      const meanRaw = rawAverage;
      const variance =
        rawScores.reduce((sum, s) => sum + Math.pow(s - meanRaw, 2), 0) / (rawScores.length - 1);
      reviewerStdDev = Math.round(Math.sqrt(variance) * 10) / 10;
    }

    const minScore = Math.min(...rawScores);
    const maxScore = Math.max(...rawScores);
    const scoreRange = Math.round((maxScore - minScore) * 10) / 10;

    const isHighStdDev = reviewerStdDev > outlierStdDevThreshold;
    const isHighRange = scoreRange >= outlierRangeThreshold;
    const isOutlier = isHighStdDev || isHighRange;

    let outlierReason: string | undefined;
    if (isHighStdDev && isHighRange) {
      outlierReason = `Reviewer standard deviation (${reviewerStdDev}) exceeds threshold (${outlierStdDevThreshold}) and score spread (${scoreRange}) >= ${outlierRangeThreshold} pts.`;
    } else if (isHighStdDev) {
      outlierReason = `Reviewer standard deviation (${reviewerStdDev}) exceeds threshold (${outlierStdDevThreshold}).`;
    } else if (isHighRange) {
      outlierReason = `Reviewer score difference between highest (${maxScore}) and lowest (${minScore}) is ${scoreRange} pts.`;
    }

    teamSummaries[teamId] = {
      teamId,
      rawAverage,
      normalizedScore,
      reviewerScores,
      reviewerStdDev,
      scoreRange,
      isOutlier,
      needsExtraReview: isOutlier,
      outlierReason,
      primaryCriterionScore: primaryCriterionScores[teamId] || 0,
      submissionTimestamp: submissionTimestamps[teamId] || 0,
    };
  }

  // 5. Rank Teams & Apply Tie-Breaking Protocols
  const rankedList = Object.values(teamSummaries);

  // Raw Ranks
  const byRaw = [...rankedList].sort((a, b) => b.rawAverage - a.rawAverage);
  const rawRankMap = new Map<string, number>();
  byRaw.forEach((t, i) => rawRankMap.set(t.teamId, i + 1));

  // Compute per-event display scores (min-max of normalizedScore, display-only)
  const normVals = rankedList.map((t) => t.normalizedScore);
  const minNorm = normVals.length ? Math.min(...normVals) : 0;
  const maxNorm = normVals.length ? Math.max(...normVals) : 100;
  const denom = maxNorm - minNorm;
  for (const t of rankedList) {
    let ds = t.normalizedScore;
    if (denom > 0) {
      ds = ((t.normalizedScore - minNorm) / denom) * 100;
    } else {
      ds = 100;
    }
    t.displayScore = Math.round(ds * 10) / 10;
  }

  // Normalized Ranks with Section 4.1 Tie-Breaking Logic
  const byNorm = [...rankedList].sort((a, b) => {
    // 0. Primary Sort: Normalized Score (Descending)
    if (b.normalizedScore !== a.normalizedScore) {
      return b.normalizedScore - a.normalizedScore;
    }

    // 1. Tie-Break 1: Primary Criterion Score (Highest-weighted criterion, Descending)
    const critA = a.primaryCriterionScore || 0;
    const critB = b.primaryCriterionScore || 0;
    if (critB !== critA) {
      return critB - critA;
    }

    // 2. Tie-Break 2: Reviewer Consensus (Lower variance/stdDev wins, Ascending)
    if (a.reviewerStdDev !== b.reviewerStdDev) {
      return a.reviewerStdDev - b.reviewerStdDev;
    }

    // 3. Tie-Break 3: Milestone Velocity (Earlier submission timestamp wins, Ascending)
    const timeA = a.submissionTimestamp || Number.MAX_SAFE_INTEGER;
    const timeB = b.submissionTimestamp || Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return 0;
  });

  const rankedTeams = byNorm.map((t, index) => {
    const normRank = index + 1;
    const rawRank = rawRankMap.get(t.teamId) || normRank;
    const rankShift = rawRank - normRank; // positive = climbed after normalization

    return {
      ...t,
      rank: normRank,
      rawRank,
      rankShift,
    };
  });

  return {
    evaluatorStats,
    teamSummaries,
    rankedTeams,
  };
}

// Test helper to compute display scores per event (monotonic transform)
export function computeDisplayScoresPerEvent(normalizedScores: number[]): number[] {
  if (normalizedScores.length === 0) return [];
  const minNorm = Math.min(...normalizedScores);
  const maxNorm = Math.max(...normalizedScores);
  const denom = maxNorm - minNorm;
  return normalizedScores.map((s) => {
    const ds = denom > 0 ? ((s - minNorm) / denom) * 100 : 100;
    return Math.round(ds * 10) / 10;
  });
}

/**
 * Pure function: Detects outlier divergence across reviewers and determines if an extra review is required.
 */
export function detectOutliersAndTriggerExtraReview(params: {
  rawScores: number[];
  thresholdStdDev?: number;
  thresholdRange?: number;
}): { isOutlier: boolean; stdDev: number; scoreRange: number; needsExtraReview: boolean; reason?: string } {
  const { rawScores, thresholdStdDev = 15.0, thresholdRange = 20.0 } = params;

  if (!rawScores || rawScores.length < 2) {
    return { isOutlier: false, stdDev: 0, scoreRange: 0, needsExtraReview: false };
  }

  const mean = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
  const variance =
    rawScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / (rawScores.length - 1);
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);
  const scoreRange = Math.round((max - min) * 10) / 10;

  const isHighStdDev = stdDev > thresholdStdDev;
  const isHighRange = scoreRange >= thresholdRange;
  const isOutlier = isHighStdDev || isHighRange;

  let reason: string | undefined;
  if (isOutlier) {
    reason = `Reviewer variance (std dev: ${stdDev}, range: ${scoreRange} pts) exceeds tolerance. Extra review triggered.`;
  }

  return {
    isOutlier,
    stdDev,
    scoreRange,
    needsExtraReview: isOutlier,
    reason,
  };
}

/**
 * Pure function: Applies tie-breaking rules (Section 4.1) between two tied teams.
 * Returns negative if Team A ranks ahead of Team B, positive if Team B ranks ahead.
 */
export function breakTieBetweenTeams(
  teamA: {
    normalizedScore: number;
    primaryCriterionScore?: number;
    reviewerStdDev: number;
    submissionTimestamp?: number;
  },
  teamB: {
    normalizedScore: number;
    primaryCriterionScore?: number;
    reviewerStdDev: number;
    submissionTimestamp?: number;
  }
): { winner: "A" | "B" | "TIE"; ruleApplied: string } {
  // 1. Normalized Score
  if (teamA.normalizedScore > teamB.normalizedScore) return { winner: "A", ruleApplied: "NORMALIZED_SCORE" };
  if (teamB.normalizedScore > teamA.normalizedScore) return { winner: "B", ruleApplied: "NORMALIZED_SCORE" };

  // 2. Primary Criterion Priority
  const critA = teamA.primaryCriterionScore || 0;
  const critB = teamB.primaryCriterionScore || 0;
  if (critA > critB) return { winner: "A", ruleApplied: "CRITERION_PRIORITY" };
  if (critB > critA) return { winner: "B", ruleApplied: "CRITERION_PRIORITY" };

  // 3. Reviewer Consensus (Lower variance wins)
  if (teamA.reviewerStdDev < teamB.reviewerStdDev) return { winner: "A", ruleApplied: "REVIEWER_CONSENSUS" };
  if (teamB.reviewerStdDev < teamA.reviewerStdDev) return { winner: "B", ruleApplied: "REVIEWER_CONSENSUS" };

  // 4. Milestone Velocity (Earlier timestamp wins)
  const timeA = teamA.submissionTimestamp || Number.MAX_SAFE_INTEGER;
  const timeB = teamB.submissionTimestamp || Number.MAX_SAFE_INTEGER;
  if (timeA < timeB) return { winner: "A", ruleApplied: "MILESTONE_VELOCITY" };
  if (timeB < timeA) return { winner: "B", ruleApplied: "MILESTONE_VELOCITY" };

  return { winner: "TIE", ruleApplied: "COORDINATOR_DISCRETION" };
}

/**
 * Pure function: Evaluates whether scores and feedback should be visible to the user.
 * Participants can only view feedback after Coordinator releases it.
 */
export function evaluateFeedbackVisibility(
  event: { feedbackReleased: boolean },
  userRole?: string
): { canView: boolean; message?: string } {
  const isPrivileged =
    userRole === "COORDINATOR_MANAGE" ||
    userRole === "COORDINATOR_VIEW" ||
    userRole === "SUPER_ADMIN";

  if (isPrivileged) {
    return { canView: true };
  }

  if (event.feedbackReleased) {
    return { canView: true };
  }

  return {
    canView: false,
    message:
      "Evaluations are under committee review. Scores and written feedback will be published once moderation concludes.",
  };
}

/**
 * Database operation: Commits calculated normalized scores into Evaluation records.
 */
export async function commitEventNormalization(params: {
  eventId: string;
  coordinatorId: string;
}) {
  const { eventId, coordinatorId } = params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      evaluations: true,
      rubrics: { include: { criteria: true } },
    },
  });

  if (!event) throw new Error("Event not found.");

  const evaluationRecords: EvaluationRecord[] = event.evaluations.map((e) => ({
    id: e.id,
    teamId: e.teamId,
    evaluatorId: e.evaluatorId,
    rawScore: e.rawTotalScore || 0,
    status: e.status,
  }));

  const normResult = computeZScoreNormalization({
    evaluations: evaluationRecords,
  });

  // Update Evaluation records with normalized scores
  for (const teamSummary of Object.values(normResult.teamSummaries)) {
    for (const rev of teamSummary.reviewerScores) {
      const match = event.evaluations.find(
        (e) => e.teamId === teamSummary.teamId && e.evaluatorId === rev.evaluatorId
      );
      if (match) {
        await prisma.evaluation.update({
          where: { id: match.id },
          data: { normalizedScore: rev.normalizedScore },
        });
      }
    }
  }

  // Audit Log
  await prisma.auditLog.create({
    data: {
      editionId: event.editionId,
      actorId: coordinatorId,
      action: "NORMALIZATION_COMMITTED",
      entityType: "Event",
      entityId: eventId,
      newState: JSON.stringify({
        totalRankedTeams: normResult.rankedTeams.length,
        evaluatorStats: normResult.evaluatorStats,
      }),
    },
  });

  return normResult;
}
