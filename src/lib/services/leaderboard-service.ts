import { prisma } from "@/lib/prisma";
import { computeZScoreNormalization, EvaluationRecord } from "./normalization-engine";

/**
 * Shared leaderboard resolver used by the public results API and the export
 * engine. Always returns REAL data — an empty cohort when no evaluations exist
 * for the event — and never fabricates a fallback cohort.
 */

export interface LeaderboardTeamItem {
  rank: number;
  teamId: string;
  teamName: string;
  regCode: string;
  track: string | null;
  rawAverageScore: number;
  normalizedScore: number;
  zScoreMean: number;
  rawRank: number;
  rankShift: number;
  evaluatorCount: number;
  isOutlier: boolean;
  needsExtraReview: boolean;
  stageDecision: "CONTINUE" | "CONDITIONAL" | "EXIT" | null;
  decisionNotes: string | null;
  tieBreakReason?: string | null;
}

export interface EventLeaderboard {
  eventId: string | null;
  eventName: string;
  isPublished: boolean;
  rankedTeams: LeaderboardTeamItem[];
  evaluatorStats: Record<string, unknown>;
}

export async function getEventLeaderboard(params: {
  editionSlug?: string;
  eventId?: string | null;
}): Promise<EventLeaderboard> {
  const { editionSlug, eventId } = params;

  // Resolve the target event (explicit id, else the first event of the edition).
  let event: { id: string; name: string; leaderboardPublished: boolean } | null = null;

  if (eventId) {
    event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, leaderboardPublished: true },
    });
  }

  if (!event && editionSlug) {
    const edition = await prisma.edition.findUnique({
      where: { slug: editionSlug },
      select: { id: true },
    });
    if (edition) {
      event = await prisma.event.findFirst({
        where: { editionId: edition.id },
        orderBy: { sequenceIndex: "asc" },
        select: { id: true, name: true, leaderboardPublished: true },
      });
    }
  }

  const emptyResult = (): EventLeaderboard => ({
    eventId: event?.id ?? null,
    eventName: event?.name ?? "Ideathon Evaluation",
    isPublished: event?.leaderboardPublished ?? false,
    rankedTeams: [],
    evaluatorStats: {},
  });

  if (!event) {
    return emptyResult();
  }

  const full = await prisma.event.findUnique({
    where: { id: event.id },
    include: {
      evaluations: {
        include: {
          team: { select: { id: true, name: true, regCode: true, track: true } },
        },
      },
      decisions: true,
    },
  });

  if (!full) {
    return emptyResult();
  }

  const evaluationRecords: EvaluationRecord[] = full.evaluations.map((e) => ({
    id: e.id,
    teamId: e.teamId,
    evaluatorId: e.evaluatorId,
    rawScore: e.rawTotalScore || 0,
    status: e.status,
  }));

  if (evaluationRecords.length === 0) {
    return emptyResult();
  }

  const normResult = computeZScoreNormalization({ evaluations: evaluationRecords });

  const rankedTeams: LeaderboardTeamItem[] = normResult.rankedTeams.map((rt) => {
    const sampleMatch = full.evaluations.find((e) => e.teamId === rt.teamId);
    const decisionMatch = full.decisions.find((d) => d.teamId === rt.teamId);
    const reviewerZscores = (rt.reviewerScores || []).map((r) => r.normalizedScore);
    const zScoreMean =
      reviewerZscores.length > 0
        ? reviewerZscores.reduce((a, b) => a + b, 0) / reviewerZscores.length
        : 0;

    return {
      rank: rt.rank,
      teamId: rt.teamId,
      teamName: sampleMatch?.team.name || rt.teamId,
      regCode: sampleMatch?.team.regCode || "TEAM",
      track: sampleMatch?.team.track || null,
      rawAverageScore: rt.rawAverage,
      normalizedScore: rt.normalizedScore,
      zScoreMean: Math.round(zScoreMean * 1000) / 1000,
      rawRank: rt.rawRank,
      rankShift: rt.rankShift,
      evaluatorCount: (rt.reviewerScores || []).length,
      isOutlier: rt.isOutlier,
      needsExtraReview: rt.needsExtraReview,
      stageDecision: (decisionMatch?.decision as "CONTINUE" | "CONDITIONAL" | "EXIT") || null,
      decisionNotes: decisionMatch?.notes || null,
      tieBreakReason: rt.outlierReason ?? null,
    };
  });

  return {
    eventId: event.id,
    eventName: event.name,
    isPublished: event.leaderboardPublished,
    rankedTeams,
    evaluatorStats: normResult.evaluatorStats as unknown as Record<string, unknown>,
  };
}