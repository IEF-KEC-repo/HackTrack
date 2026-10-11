import { describe, it, expect } from "vitest";
import {
  allocateReviewersForEvent,
  CandidateTeam,
  CandidateEvaluator,
  ConflictItem,
} from "./review-assignment-service";
import {
  calculateWeightedRubricScore,
  validateEvaluationSubmission,
  RubricCriterionItem,
} from "./scoring-service";
import {
  computeZScoreNormalization,
  detectOutliersAndTriggerExtraReview,
  breakTieBetweenTeams,
  evaluateFeedbackVisibility,
  EvaluationRecord,
} from "./normalization-engine";
import { canMutateEventConfig, canAccessRoute, UserSessionContext } from "@/lib/permissions";

describe("Evaluation, Scoring & Normalization Engine", () => {
  // ----------------------------------------------------
  // 1. REVIEW ASSIGNMENT ALGORITHM
  // ----------------------------------------------------
  describe("Review Assignment & Allocation (allocateReviewersForEvent)", () => {
    const evaluators: CandidateEvaluator[] = [
      { id: "eval_1", name: "Evaluator 1" },
      { id: "eval_2", name: "Evaluator 2" },
      { id: "eval_3", name: "Evaluator 3" },
      { id: "eval_4", name: "Evaluator 4" },
      { id: "eval_5", name: "Evaluator 5" },
    ];

    const teams: CandidateTeam[] = [
      { id: "t_1", name: "Team 1" },
      { id: "t_2", name: "Team 2" },
      { id: "t_3", name: "Team 3" },
      { id: "t_4", name: "Team 4" },
      { id: "t_5", name: "Team 5" },
    ];

    it("assigns strictly 3 reviewers per idea for Ideathon", () => {
      const result = allocateReviewersForEvent({
        teams,
        evaluators,
        evaluatorCountPerTeam: 3,
      });

      expect(result.assignments).toHaveLength(15); // 5 teams * 3 reviewers
      expect(result.totalAssignments).toBe(15);

      // Verify each team has exactly 3 unique evaluators
      for (const t of teams) {
        const teamAssigned = result.assignments.filter((a) => a.teamId === t.id);
        expect(teamAssigned).toHaveLength(3);
        const uniqueEvaluators = new Set(teamAssigned.map((a) => a.evaluatorId));
        expect(uniqueEvaluators.size).toBe(3);
      }
    });

    it("maintains balanced workload (Δ ≤ 1) across all evaluators", () => {
      const result = allocateReviewersForEvent({
        teams,
        evaluators,
        evaluatorCountPerTeam: 3,
      });

      expect(result.loadDelta).toBeLessThanOrEqual(1);
      // 15 total / 5 evaluators = 3 each
      Object.values(result.evaluatorLoads).forEach((load) => {
        expect(load).toBe(3);
      });
    });

    it("ensures overlapping graph connectivity for cross-evaluator normalization", () => {
      const result = allocateReviewersForEvent({
        teams,
        evaluators,
        evaluatorCountPerTeam: 3,
      });

      expect(result.isGraphConnected).toBe(true);
    });

    it("strictly excludes declared Conflicts of Interest (COI)", () => {
      const conflicts: ConflictItem[] = [
        { evaluatorId: "eval_1", teamId: "t_1" },
        { evaluatorId: "eval_2", teamId: "t_2" },
      ];

      const result = allocateReviewersForEvent({
        teams,
        evaluators,
        conflicts,
        evaluatorCountPerTeam: 3,
      });

      // Assert eval_1 was not assigned to t_1
      const eval1ForTeam1 = result.assignments.find(
        (a) => a.evaluatorId === "eval_1" && a.teamId === "t_1"
      );
      expect(eval1ForTeam1).toBeUndefined();

      // Assert eval_2 was not assigned to t_2
      const eval2ForTeam2 = result.assignments.find(
        (a) => a.evaluatorId === "eval_2" && a.teamId === "t_2"
      );
      expect(eval2ForTeam2).toBeUndefined();

      // Teams still received 3 evaluators
      expect(result.assignments.filter((a) => a.teamId === "t_1")).toHaveLength(3);
      expect(result.assignments.filter((a) => a.teamId === "t_2")).toHaveLength(3);
    });

    it("strictly excludes mentors and team members from evaluating the team", () => {
      const teamsWithRelations: CandidateTeam[] = [
        {
          id: "t_mentor",
          name: "Mentored Team",
          mentorId: "eval_3", // eval_3 is the mentor
          memberUserIds: ["eval_4"], // eval_4 is a participant teammate
        },
      ];

      const result = allocateReviewersForEvent({
        teams: teamsWithRelations,
        evaluators,
        evaluatorCountPerTeam: 3,
      });

      const assignedEvaluatorIds = result.assignments
        .filter((a) => a.teamId === "t_mentor")
        .map((a) => a.evaluatorId);

      expect(assignedEvaluatorIds).not.toContain("eval_3"); // mentor excluded
      expect(assignedEvaluatorIds).not.toContain("eval_4"); // member excluded
      expect(assignedEvaluatorIds).toHaveLength(3);
    });

    it("throws an error if available evaluators are fewer than evaluatorCountPerTeam", () => {
      expect(() =>
        allocateReviewersForEvent({
          teams,
          evaluators: [evaluators[0], evaluators[1]], // only 2 evaluators
          evaluatorCountPerTeam: 3,
        })
      ).toThrowError(/Insufficient evaluators/);
    });
  });

  // ----------------------------------------------------
  // 2. RUBRIC SCORING ENGINE
  // ----------------------------------------------------
  describe("Rubric Weighted Scoring Engine (calculateWeightedRubricScore)", () => {
    const criteria: RubricCriterionItem[] = [
      { id: "c_prob", maxPoints: 25, weightPercentage: 25 },
      { id: "c_tech", maxPoints: 30, weightPercentage: 30 },
      { id: "c_inno", maxPoints: 25, weightPercentage: 25 },
      { id: "c_pres", maxPoints: 20, weightPercentage: 20 },
    ];

    it("computes exact composite score across weighted criteria", () => {
      const scores = {
        c_prob: 20, // 20/25 * 25 = 20.0
        c_tech: 24, // 24/30 * 30 = 24.0
        c_inno: 20, // 20/25 * 25 = 20.0
        c_pres: 16, // 16/20 * 20 = 16.0
      };

      const result = calculateWeightedRubricScore(criteria, scores);
      expect(result.isValid).toBe(true);
      expect(result.totalScore).toBe(80.0);
      expect(result.weightedScores["c_tech"]).toBe(24.0);
      expect(result.weightedScores["c_pres"]).toBe(16.0);
    });

    it("clamps scores exceeding maxPoints and flags validation errors", () => {
      const scores = {
        c_prob: 30, // exceeds max 25
        c_tech: 30,
        c_inno: 25,
        c_pres: 20,
      };

      const result = calculateWeightedRubricScore(criteria, scores);
      expect(result.isValid).toBe(false);
      expect(result.errors?.[0]).toContain("outside allowed range");
      // Clamped calculation: (25/25 * 25) + 30 + 25 + 20 = 100.0
      expect(result.totalScore).toBe(100.0);
    });

    it("validates evaluation submission requires minimum qualitative feedback length", () => {
      const validScores = { c_prob: 20, c_tech: 20, c_inno: 20, c_pres: 15 };

      const shortFeedback = validateEvaluationSubmission({
        criteria,
        scores: validScores,
        generalFeedback: "Great job.", // 10 chars < 20 min
        minFeedbackLength: 20,
      });
      expect(shortFeedback.valid).toBe(false);
      expect(shortFeedback.errors[0]).toContain("must be at least 20 characters long");

      const sufficientFeedback = validateEvaluationSubmission({
        criteria,
        scores: validScores,
        generalFeedback: "Solid technical architecture and clear societal impact demonstrated.",
        minFeedbackLength: 20,
      });
      expect(sufficientFeedback.valid).toBe(true);
      expect(sufficientFeedback.errors).toHaveLength(0);
    });
  });

  // ----------------------------------------------------
  // 3. STATISTICAL Z-SCORE NORMALIZATION ENGINE (ACCEPTANCE TEST)
  // ----------------------------------------------------
  describe("Statistical Z-Score Normalization Engine (computeZScoreNormalization)", () => {
    /**
     * ACCEPTANCE CRITERIA TEST CASE:
     * Three reviewers score a team at Ideathon:
      * Reviewer 1 (μ=65, σ=10): raw 70.0 -> Z = (70 - 65)/10 = +0.50 -> Snorm = 50 + 15 * 0.50 = 57.5
      * Reviewer 2 (μ=80, σ=8):  raw 80.0 -> Z = (80 - 80)/8  =  0.00 -> Snorm = 50 + 15 * 0.00 = 50.0
      * Reviewer 3 (μ=85, σ=10): raw 90.0 -> Z = (90 - 85)/10 = +0.50 -> Snorm = 50 + 15 * 0.50 = 57.5
      * Team Raw Average = (70.0 + 80.0 + 90.0) / 3 = 80.0
      * Final Normalized Score = (57.5 + 50.0 + 57.5) / 3 = 55.0
      */
     it("satisfies the exact hand-calculated acceptance test (Team Raw Avg = 80.0, Final Norm = 55.0)", () => {
       const evaluations: EvaluationRecord[] = [
         { id: "e1", teamId: "target_team", evaluatorId: "rev_1", rawScore: 70.0, status: "SUBMITTED" },
         { id: "e2", teamId: "target_team", evaluatorId: "rev_2", rawScore: 80.0, status: "SUBMITTED" },
         { id: "e3", teamId: "target_team", evaluatorId: "rev_3", rawScore: 90.0, status: "SUBMITTED" },
       ];

       // Provide the exact evaluator distribution parameters from the acceptance specification:
       const evaluatorStatsOverride = {
         rev_1: { mean: 65.0, stdDev: 10.0, harshness: "HARSH" as const },
         rev_2: { mean: 80.0, stdDev: 8.0, harshness: "MODERATE" as const },
         rev_3: { mean: 85.0, stdDev: 10.0, harshness: "GENEROUS" as const },
       };

       const result = computeZScoreNormalization({
         evaluations,
         evaluatorStatsOverride,
         baselineMean: 50.0,
         baselineStdDev: 15.0,
       });

       const summary = result.teamSummaries["target_team"];
       expect(summary).toBeDefined();

       // Check Team Raw Average is exactly 80.0
       expect(summary.rawAverage).toBe(80.0);

       // Check Individual Normalized Scores
       const r1Score = summary.reviewerScores.find((r) => r.evaluatorId === "rev_1");
       const r2Score = summary.reviewerScores.find((r) => r.evaluatorId === "rev_2");
       const r3Score = summary.reviewerScores.find((r) => r.evaluatorId === "rev_3");

       expect(r1Score?.normalizedScore).toBe(57.5);
       expect(r2Score?.normalizedScore).toBe(50.0);
       expect(r3Score?.normalizedScore).toBe(57.5);

       // Check Final Team Normalized Score is exactly 55.0
       expect(summary.normalizedScore).toBe(55.0);
     });

    it("correctly identifies evaluator harshness profiles from scoring data", () => {
      // Reviewer A gives lower scores (mean 62), Reviewer B gives high scores (mean 88)
      const evaluations: EvaluationRecord[] = [
        { id: "ea1", teamId: "t1", evaluatorId: "rev_harsh", rawScore: 60.0, status: "SUBMITTED" },
        { id: "ea2", teamId: "t2", evaluatorId: "rev_harsh", rawScore: 64.0, status: "SUBMITTED" },
        { id: "eb1", teamId: "t1", evaluatorId: "rev_lenient", rawScore: 86.0, status: "SUBMITTED" },
        { id: "eb2", teamId: "t2", evaluatorId: "rev_lenient", rawScore: 90.0, status: "SUBMITTED" },
      ];

      const result = computeZScoreNormalization({ evaluations });

      expect(result.evaluatorStats["rev_harsh"].harshness).toBe("HARSH");
      expect(result.evaluatorStats["rev_harsh"].mean).toBe(62.0);

      expect(result.evaluatorStats["rev_lenient"].harshness).toBe("GENEROUS");
      expect(result.evaluatorStats["rev_lenient"].mean).toBe(88.0);
    });

    it("demonstrates rank shift correction (harsh evaluator team climbs, lenient falls)", () => {
      // Team A had harsh reviewer (raw 64), Team B had generous reviewer (raw 86)
      const evaluations: EvaluationRecord[] = [
        { id: "e1", teamId: "team_harshly_graded", evaluatorId: "r_harsh", rawScore: 64.0, status: "SUBMITTED" },
        { id: "e2", teamId: "team_leniently_graded", evaluatorId: "r_lenient", rawScore: 86.0, status: "SUBMITTED" },
      ];

      const evaluatorStatsOverride = {
        r_harsh: { mean: 54.0, stdDev: 10.0 }, // Z = (64 - 54)/10 = +1.0 -> Snorm = 65.0
        r_lenient: { mean: 86.0, stdDev: 10.0 }, // Z = (86 - 86)/10 = 0.0 -> Snorm = 50.0
      };

      const result = computeZScoreNormalization({
        evaluations,
        evaluatorStatsOverride,
      });

      const ranked = result.rankedTeams;
      // In raw score, team_leniently_graded (86) beat team_harshly_graded (64)
      // In normalized score, team_harshly_graded (65.0) beats team_leniently_graded (50.0)!
      expect(ranked[0].teamId).toBe("team_harshly_graded");
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].rawRank).toBe(2);
      expect(ranked[0].rankShift).toBe(1); // Climbed +1 rank!

      expect(ranked[1].teamId).toBe("team_leniently_graded");
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].rawRank).toBe(1);
      expect(ranked[1].rankShift).toBe(-1); // Fell -1 rank!
    });
  });

  // ----------------------------------------------------
  // 4. OUTLIER DETECTION & 4TH REVIEW TRIGGER
  // ----------------------------------------------------
  describe("Outlier Divergence Detection (detectOutliersAndTriggerExtraReview)", () => {
    it("flags outlier review when reviewer score spread is ≥ 20 points", () => {
      const result = detectOutliersAndTriggerExtraReview({
        rawScores: [65.0, 75.0, 86.0], // Spread = 86 - 65 = 21 points
        thresholdRange: 20.0,
      });

      expect(result.isOutlier).toBe(true);
      expect(result.needsExtraReview).toBe(true);
      expect(result.scoreRange).toBe(21.0);
      expect(result.reason).toContain("variance");
    });

    it("flags outlier review when reviewer standard deviation exceeds threshold (> 15.0)", () => {
      const result = detectOutliersAndTriggerExtraReview({
        rawScores: [50.0, 75.0, 95.0], // Large spread & high variance
        thresholdStdDev: 15.0,
      });

      expect(result.isOutlier).toBe(true);
      expect(result.stdDev).toBeGreaterThan(15.0);
      expect(result.needsExtraReview).toBe(true);
    });

    it("does not flag outlier when reviewers have close consensus", () => {
      const result = detectOutliersAndTriggerExtraReview({
        rawScores: [76.0, 78.0, 80.0], // Spread = 4 pts, low std dev
        thresholdRange: 20.0,
        thresholdStdDev: 15.0,
      });

      expect(result.isOutlier).toBe(false);
      expect(result.needsExtraReview).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 5. SECTION 4.1 TIE-BREAKING PROTOCOL
  // ----------------------------------------------------
  describe("Section 4.1 Tie-Breaking Protocol (breakTieBetweenTeams)", () => {
    it("breaks tie on Primary Criterion score when normalized scores are identical", () => {
      const teamA = {
        normalizedScore: 78.0,
        primaryCriterionScore: 24.0, // higher primary criterion
        reviewerStdDev: 3.5,
        submissionTimestamp: 1000,
      };

      const teamB = {
        normalizedScore: 78.0,
        primaryCriterionScore: 21.0,
        reviewerStdDev: 3.5,
        submissionTimestamp: 900,
      };

      const result = breakTieBetweenTeams(teamA, teamB);
      expect(result.winner).toBe("A");
      expect(result.ruleApplied).toBe("CRITERION_PRIORITY");
    });

    it("breaks tie on Reviewer Consensus (lower variance) when primary criterion is tied", () => {
      const teamA = {
        normalizedScore: 78.0,
        primaryCriterionScore: 22.0,
        reviewerStdDev: 2.1, // more consensus / lower variance
        submissionTimestamp: 2000,
      };

      const teamB = {
        normalizedScore: 78.0,
        primaryCriterionScore: 22.0,
        reviewerStdDev: 5.4,
        submissionTimestamp: 1000,
      };

      const result = breakTieBetweenTeams(teamA, teamB);
      expect(result.winner).toBe("A");
      expect(result.ruleApplied).toBe("REVIEWER_CONSENSUS");
    });

    it("breaks tie on Milestone Velocity (earlier timestamp) when variance is tied", () => {
      const teamA = {
        normalizedScore: 78.0,
        primaryCriterionScore: 22.0,
        reviewerStdDev: 3.0,
        submissionTimestamp: 1500, // submitted earlier
      };

      const teamB = {
        normalizedScore: 78.0,
        primaryCriterionScore: 22.0,
        reviewerStdDev: 3.0,
        submissionTimestamp: 1900,
      };

      const result = breakTieBetweenTeams(teamA, teamB);
      expect(result.winner).toBe("A");
      expect(result.ruleApplied).toBe("MILESTONE_VELOCITY");
    });

    it("falls back to Coordinator Discretion when all factors are completely identical", () => {
      const teamA = {
        normalizedScore: 78.0,
        primaryCriterionScore: 22.0,
        reviewerStdDev: 3.0,
        submissionTimestamp: 1500,
      };

      const teamB = {
        normalizedScore: 78.0,
        primaryCriterionScore: 22.0,
        reviewerStdDev: 3.0,
        submissionTimestamp: 1500,
      };

      const result = breakTieBetweenTeams(teamA, teamB);
      expect(result.winner).toBe("TIE");
      expect(result.ruleApplied).toBe("COORDINATOR_DISCRETION");
    });
  });

  // ----------------------------------------------------
  // 6. CONTROLLED FEEDBACK RELEASE GATING
  // ----------------------------------------------------
  describe("Controlled Feedback Release (evaluateFeedbackVisibility)", () => {
    it("conceals scores and written remarks from participants before feedback release", () => {
      const event = { feedbackReleased: false };
      const result = evaluateFeedbackVisibility(event, "PARTICIPANT");

      expect(result.canView).toBe(false);
      expect(result.message).toContain("Evaluations are under committee review");
    });

    it("reveals scores and written remarks to participants after feedback release", () => {
      const event = { feedbackReleased: true };
      const result = evaluateFeedbackVisibility(event, "PARTICIPANT");

      expect(result.canView).toBe(true);
    });

    it("allows coordinators to view evaluations at all times regardless of release flag", () => {
      const unreleasedEvent = { feedbackReleased: false };

      expect(evaluateFeedbackVisibility(unreleasedEvent, "COORDINATOR_MANAGE").canView).toBe(true);
      expect(evaluateFeedbackVisibility(unreleasedEvent, "COORDINATOR_VIEW").canView).toBe(true);
      expect(evaluateFeedbackVisibility(unreleasedEvent, "SUPER_ADMIN").canView).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 7. VIEW-ONLY WRITE PROTECTION GUARD
  // ----------------------------------------------------
  describe("Dual-Tier Coordinator RBAC Write Protection", () => {
    it("allows COORDINATOR_MANAGE and SUPER_ADMIN to mutate event scoring configurations", () => {
      expect(canMutateEventConfig("COORDINATOR_MANAGE")).toBe(true);
      expect(canMutateEventConfig("SUPER_ADMIN")).toBe(true);
    });

    it("blocks COORDINATOR_VIEW from mutating event scoring configurations", () => {
      expect(canMutateEventConfig("COORDINATOR_VIEW")).toBe(false);
      expect(canMutateEventConfig("PARTICIPANT")).toBe(false);
      expect(canMutateEventConfig("EVALUATOR")).toBe(false);
    });

    it("blocks COORDINATOR_VIEW from HTTP mutation requests to coordinator routes", () => {
      const viewContext: UserSessionContext = {
        userId: "coord_v",
        email: "view@college.edu",
        globalRole: "USER",
        editionRole: "COORDINATOR_VIEW",
      };

      // Read is permitted:
      const readCheck = canAccessRoute(viewContext, "/coordinator/evaluations", "GET");
      expect(readCheck.allowed).toBe(true);

      // Mutation is blocked:
      const writeCheck = canAccessRoute(viewContext, "/coordinator/evaluations", "POST");
      expect(writeCheck.allowed).toBe(false);
      expect(writeCheck.reason).toBe("COORDINATOR_VIEW_WRITE_BLOCKED");
    });
  });
});
