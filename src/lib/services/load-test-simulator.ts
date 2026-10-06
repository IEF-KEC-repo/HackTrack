/**
 * Scale Load Testing Simulator for HackTrack.
 * Simulates target production scale per Section 8:
 * - 1,000+ participants partitioned across 300 teams (1-6 members, solo allowed)
 * - 30 evaluators with balanced overlapping assignment (900 Ideathon reviews, Δ ≤ 1)
 * - Full Z-Score normalization execution benchmarking latency and memory stability
 * - Concurrent export generation throughput
 */

import { allocateReviewersForEvent, CandidateTeam, CandidateEvaluator } from "./review-assignment-service";
import { computeZScoreNormalization, EvaluationRecord } from "./normalization-engine";
import { exportScoresToCsv, ExportScoreRecordItem } from "./export-service";

export interface ScaleCohortProfile {
  totalParticipants: number;
  totalTeams: number;
  soloTeamsCount: number;
  teamSizeDistribution: Record<number, number>; // size -> count
  teams: Array<{
    id: string;
    regCode: string;
    name: string;
    memberCount: number;
    track: string;
  }>;
  evaluators: CandidateEvaluator[];
}

export interface ScaleSimulationResult {
  cohort: {
    participantsCount: number;
    teamsCount: number;
    evaluatorsCount: number;
    soloTeamsCount: number;
  };
  allocation: {
    totalAssignments: number;
    maxPerEvaluator: number;
    minPerEvaluator: number;
    varianceDelta: number;
    allocationLatencyMs: number;
  };
  normalization: {
    evaluationsProcessed: number;
    normalizationLatencyMs: number;
    outliersDetected: number;
    rankedTeamsCount: number;
    topTeamCode: string;
    topNormalizedScore: number;
  };
  exports: {
    concurrentExportsExecuted: number;
    csvSizeBytes: number;
    exportLatencyMs: number;
  };
  performance: {
    totalDurationMs: number;
    memoryDeltaMb: number;
    passedSla: boolean; // latency < 500ms
  };
}

/**
 * Generates an active cohort matching the 1,000+ participants and 300 teams scale requirement.
 */
export function generateScaleCohort(teamCount: number = 300, evaluatorCount: number = 30): ScaleCohortProfile {
  const tracks = [
    "AI/ML & Edge Computing",
    "Healthtech & Bio",
    "Clean Energy & IoT",
    "Robotics & Drones",
    "FinTech & Security",
    "Smart Campus Solutions",
  ];

  let totalParticipants = 0;
  let soloTeamsCount = 0;
  const teamSizeDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const teams: ScaleCohortProfile["teams"] = [];

  for (let i = 1; i <= teamCount; i++) {
    // Generate team size 1 to 6 (weighted: ~10% solo, ~20% pairs, ~35% 3-4 members, ~35% 5-6 members)
    let size: number;
    if (i <= 30) {
      size = 1; // 30 solo teams (10%)
      soloTeamsCount++;
    } else if (i <= 90) {
      size = 2; // 60 pairs
    } else if (i <= 200) {
      size = 3 + (i % 2); // 3 or 4 members
    } else {
      size = 5 + (i % 2); // 5 or 6 members
    }

    teamSizeDistribution[size]++;
    totalParticipants += size;

    const pad = String(i).padStart(3, "0");
    teams.push({
      id: `team_${pad}`,
      regCode: `HT26-T${pad}`,
      name: `Collegiate Team ${pad}`,
      memberCount: size,
      track: tracks[i % tracks.length],
    });
  }

  const evaluators: CandidateEvaluator[] = [];
  for (let j = 1; j <= evaluatorCount; j++) {
    const pad = String(j).padStart(2, "0");
    evaluators.push({
      id: `eval_${pad}`,
      name: `Faculty Reviewer ${pad}`,
    });
  }

  return {
    totalParticipants,
    totalTeams: teams.length,
    soloTeamsCount,
    teamSizeDistribution,
    teams,
    evaluators,
  };
}

/**
 * Executes a full scale load simulation running allocation, score normalization, and concurrent exports.
 */
export async function executeScaleLoadSimulation(
  teamCount: number = 300,
  evaluatorCount: number = 30
): Promise<ScaleSimulationResult> {
  const overallStart = Date.now();
  const memBefore = process.memoryUsage().heapUsed;

  // 1. Generate Cohort (1,000+ participants, 300 teams)
  const cohort = generateScaleCohort(teamCount, evaluatorCount);

  // 2. Benchmark Review Allocation
  const allocStart = Date.now();
  const candidateTeams: CandidateTeam[] = cohort.teams.map((t) => ({ id: t.id, name: t.name }));
  const allocResult = allocateReviewersForEvent({
    teams: candidateTeams,
    evaluators: cohort.evaluators,
    evaluatorCountPerTeam: 3, // Ideathon strictly 3 reviewers
  });
  const allocationLatencyMs = Date.now() - allocStart;

  // 3. Generate Simulated Raw Evaluation Scores (900 reviews)
  // Simulate natural distribution with realistic evaluator biases (some harsh, some lenient)
  const simulatedEvaluations: EvaluationRecord[] = allocResult.assignments.map((assignment, idx) => {
    const evalIndex = parseInt(assignment.evaluatorId.replace("eval_", ""), 10) || 1;
    // Evaluator grading bias: e.g. eval 1-5 harsh (μ~65), 6-25 moderate (μ~75), 26-30 lenient (μ~85)
    let baseBias = 75;
    if (evalIndex <= 5) baseBias = 64;
    else if (evalIndex >= 26) baseBias = 84;

    const variance = ((idx * 7) % 25) - 12; // pseudo-random deterministic variation
    const rawScore = Math.max(30, Math.min(100, baseBias + variance));

    return {
      id: `ev_rec_${idx}`,
      teamId: assignment.teamId,
      evaluatorId: assignment.evaluatorId,
      rawScore,
      status: "SUBMITTED",
    };
  });

  // 4. Benchmark Statistical Z-Score Normalization
  const normStart = Date.now();
  const normResult = computeZScoreNormalization({ evaluations: simulatedEvaluations });
  const normalizationLatencyMs = Date.now() - normStart;

  // 5. Benchmark Concurrent Export Generation (5 parallel CSV generations)
  const exportStart = Date.now();
  const exportItems: ExportScoreRecordItem[] = normResult.rankedTeams.map((rt) => ({
    rank: rt.rank,
    regCode: rt.teamId.replace("team_", "HT26-T"),
    teamName: `Collegiate Team ${rt.teamId.replace("team_", "")}`,
    track: "AI & Edge",
    normalizedScore: rt.normalizedScore,
    rawAverageScore: (rt as any).rawAverage ?? (rt as any).rawAverageScore ?? 0,
    zScoreMean:
      rt.reviewerScores && rt.reviewerScores.length > 0
        ? Math.round(
            (rt.reviewerScores.reduce(
              (sum, s) => sum + (s.normalizedScore - 70.0) / 15.0,
              0
            ) /
              rt.reviewerScores.length) *
              1000
          ) / 1000
        : 0,
    evaluatorCount: rt.reviewerScores?.length || 3,
    rankShift: rt.rankShift,
  }));

  const exportPromises = [1, 2, 3, 4, 5].map(async () => exportScoresToCsv(exportItems));
  const exportedCsvs = await Promise.all(exportPromises);
  const exportLatencyMs = Date.now() - exportStart;

  const totalDurationMs = Date.now() - overallStart;
  const memAfter = process.memoryUsage().heapUsed;
  const memoryDeltaMb = Math.round(((memAfter - memBefore) / 1024 / 1024) * 100) / 100;

  // Verify Workload Variance (Delta <= 1)
  const evalCounts = new Map<string, number>();
  allocResult.assignments.forEach((a) => {
    evalCounts.set(a.evaluatorId, (evalCounts.get(a.evaluatorId) || 0) + 1);
  });
  const counts = Array.from(evalCounts.values());
  const maxPerEvaluator = Math.max(...counts);
  const minPerEvaluator = Math.min(...counts);
  const varianceDelta = maxPerEvaluator - minPerEvaluator;

  return {
    cohort: {
      participantsCount: cohort.totalParticipants,
      teamsCount: cohort.totalTeams,
      evaluatorsCount: cohort.evaluators.length,
      soloTeamsCount: cohort.soloTeamsCount,
    },
    allocation: {
      totalAssignments: allocResult.totalAssignments,
      maxPerEvaluator,
      minPerEvaluator,
      varianceDelta,
      allocationLatencyMs,
    },
    normalization: {
      evaluationsProcessed: simulatedEvaluations.length,
      normalizationLatencyMs,
      outliersDetected: normResult.rankedTeams.filter((t) => t.isOutlier).length,
      rankedTeamsCount: normResult.rankedTeams.length,
      topTeamCode: normResult.rankedTeams[0]?.teamId || "N/A",
      topNormalizedScore: normResult.rankedTeams[0]?.normalizedScore || 0,
    },
    exports: {
      concurrentExportsExecuted: 5,
      csvSizeBytes: exportedCsvs[0]?.length || 0,
      exportLatencyMs,
    },
    performance: {
      totalDurationMs,
      memoryDeltaMb,
      passedSla: normalizationLatencyMs < 500 && varianceDelta <= 1,
    },
  };
}
