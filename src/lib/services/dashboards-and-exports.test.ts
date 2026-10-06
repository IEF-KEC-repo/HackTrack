import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateDistributionMetrics,
  computeFunnelMetrics,
  computeCohortFunnel,
  getOverdueItemsSummary,
  computeScoreDistribution,
} from "./analytics-service";
import {
  validateDecisionParameters,
  isLeaderboardVisible,
  recordTeamStageDecision,
  toggleLeaderboardPublication,
  getEventDecisions,
  clearInMemoryDecisions,
} from "./decision-service";
import {
  escapeCsvCell,
  buildCsv,
  exportIdeasToCsv,
  exportScoresToCsv,
  exportFeedbackToCsv,
  exportMilestonesToCsv,
  generatePrintableHtmlReport,
  ExportScoreRecordItem,
} from "./export-service";
import { canMutateEventConfig } from "@/lib/permissions";
import { renderEmailTemplate } from "./email-service";

describe("Phase 7: Dashboards, Coordinator Decisions, Leaderboard Gating & Export Engine", () => {
  beforeEach(() => {
    clearInMemoryDecisions();
  });

  // ----------------------------------------------------
  // 1. COHORT FUNNEL RETENTION & DROP-OFF CALCULATIONS
  // ----------------------------------------------------
  describe("Cohort Funnel Analytics", () => {
    it("computes sequential conversion and drop-off percentages correctly", () => {
      const totalInitial = 300;
      const stages = [
        { sequenceIndex: 1, eventId: "ev_1", eventName: "Ideathon", status: "COMPLETED", activeCount: 210 },
        { sequenceIndex: 2, eventId: "ev_2", eventName: "Innovatz", status: "COMPLETED", activeCount: 150 },
        { sequenceIndex: 3, eventId: "ev_3", eventName: "CPR 1", status: "ACTIVE", activeCount: 90 },
      ];

      const metrics = computeFunnelMetrics(totalInitial, stages);

      expect(metrics).toHaveLength(3);

      // Stage 1: Ideathon (210 / 300 = 70.0% conversion; 90 drop-off = 30.0%)
      expect(metrics[0].conversionPercent).toBe(70.0);
      expect(metrics[0].dropOffCount).toBe(90);
      expect(metrics[0].dropOffPercent).toBe(30.0);

      // Stage 2: Innovatz (150 / 300 = 50.0% conversion; 60 drop-off from 210 = 28.6%)
      expect(metrics[1].conversionPercent).toBe(50.0);
      expect(metrics[1].dropOffCount).toBe(60);
      expect(metrics[1].dropOffPercent).toBe(28.6);

      // Stage 3: CPR 1 (90 / 300 = 30.0% conversion; 60 drop-off from 150 = 40.0%)
      expect(metrics[2].conversionPercent).toBe(30.0);
      expect(metrics[2].dropOffCount).toBe(60);
      expect(metrics[2].dropOffPercent).toBe(40.0);
    });

    it("handles zero cohort size gracefully without NaN or divide-by-zero", () => {
      const metrics = computeFunnelMetrics(0, [
        { sequenceIndex: 1, eventId: "ev_1", eventName: "Ideathon", status: "COMPLETED", activeCount: 0 },
      ]);

      expect(metrics[0].conversionPercent).toBe(0);
      expect(metrics[0].dropOffPercent).toBe(0);
      expect(metrics[0].dropOffCount).toBe(0);
    });

    it("computeCohortFunnel returns structured edition funnel result", async () => {
      const result = await computeCohortFunnel("ht26");
      expect(result.totalRegisteredTeams).toBe(300);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.stages[0].eventName).toBe("Ideathon");
    });
  });

  // ----------------------------------------------------
  // 2. OPERATIONAL OVERDUE RADAR
  // ----------------------------------------------------
  describe("Overdue Items Summary", () => {
    it("aggregates missing slides, overdue milestones, and lapsed check-ins", async () => {
      const summary = await getOverdueItemsSummary("ht26");
      expect(summary.editionId).toBe("ht26");
      expect(summary.missingSlidesCount).toBeGreaterThanOrEqual(1);
      expect(summary.overdueMilestonesCount).toBeGreaterThanOrEqual(1);
      expect(summary.overdueCheckInsCount).toBeGreaterThanOrEqual(1);
      expect(summary.pendingEvaluatorQueuesCount).toBeGreaterThanOrEqual(1);

      // Verify structure of overdue milestone items
      const firstOverdue = summary.overdueMilestones[0];
      expect(firstOverdue).toHaveProperty("teamName");
      expect(firstOverdue).toHaveProperty("daysOverdue");
      expect(firstOverdue.daysOverdue).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------
  // 3. SCORE DISTRIBUTION STATISTICS
  // ----------------------------------------------------
  describe("Score Distribution Calculations", () => {
    it("computes exact quartiles, median, min, max, mean, and standard deviation", () => {
      const sampleScores = [50, 60, 70, 80, 90];
      const stats = calculateDistributionMetrics(sampleScores);

      expect(stats.count).toBe(5);
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(90);
      expect(stats.mean).toBe(70);
      expect(stats.median).toBe(70);
      expect(stats.p25).toBe(60);
      expect(stats.p75).toBe(80);
      expect(stats.standardDeviation).toBe(15.81);
    });

    it("handles empty scores gracefully", () => {
      const stats = calculateDistributionMetrics([]);
      expect(stats.count).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
    });

    it("computeScoreDistribution returns both raw and normalized distributions", async () => {
      const result = await computeScoreDistribution("ev_cpr");
      expect(result.rawDistribution).toBeDefined();
      expect(result.normalizedDistribution).toBeDefined();
      expect(result.rawDistribution.count).toBeGreaterThan(0);
      expect(result.normalizedDistribution.count).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------
  // 4. ACCEPTANCE CRITERION 1: 100% NUMERICAL PRECISION PARITY
  // ----------------------------------------------------
  describe("Acceptance Criterion 1: Exported numbers match on-screen numbers with 100% precision", () => {
    const onScreenRecords: ExportScoreRecordItem[] = [
      {
        rank: 1,
        regCode: "HT26-T001",
        teamName: "QuantumForge",
        track: "AI/ML & Edge Computing",
        normalizedScore: 92.45,
        rawAverageScore: 89.0,
        zScoreMean: 1.452,
        evaluatorCount: 3,
        rankShift: 2,
        tieBreakReason: "Higher score on primary criterion (Problem Relevance)",
        stageDecision: "CONTINUE",
      },
      {
        rank: 2,
        regCode: "HT26-T002",
        teamName: "BioSynth AI",
        track: "Healthtech & Bio",
        normalizedScore: 88.75,
        rawAverageScore: 87.5,
        zScoreMean: 0.985,
        evaluatorCount: 3,
        rankShift: 0,
        tieBreakReason: null,
        stageDecision: "CONTINUE",
      },
      {
        rank: 3,
        regCode: "HT26-T005",
        teamName: "BlockVault Zero",
        track: "FinTech & Security",
        normalizedScore: 68.25,
        rawAverageScore: 67.0,
        zScoreMean: -1.22,
        evaluatorCount: 3,
        rankShift: -2,
        tieBreakReason: null,
        stageDecision: "EXIT",
      },
    ];

    it("exports normalized scores, raw averages, and Z-scores with identical on-screen formatting", () => {
      const csv = exportScoresToCsv(onScreenRecords);

      // Verify UTF-8 BOM
      expect(csv.startsWith("\uFEFF")).toBe(true);

      // Check header line
      expect(csv).toContain("Official Rank,Registration Code,Team Name,Track,Normalized Score,Raw Average Score,Mean Z-Score,Evaluators Count,Rank Shift,Tie-Break Resolution,Stage Decision");

      // Check Rank 1 exact numerical values
      expect(csv).toContain("1,HT26-T001,QuantumForge,AI/ML & Edge Computing,92.45,89.00,+1.452,3,+2,Higher score on primary criterion (Problem Relevance),CONTINUE");

      // Check Rank 2 exact numerical values
      expect(csv).toContain("2,HT26-T002,BioSynth AI,Healthtech & Bio,88.75,87.50,+0.985,3,0,Direct Score Differential,CONTINUE");

      // Check Rank 3 negative Z-score and negative rank shift formatting
      expect(csv).toContain("3,HT26-T005,BlockVault Zero,FinTech & Security,68.25,67.00,-1.220,3,-2,Direct Score Differential,EXIT");
    });

    it("guarantees 0.00 rounding precision on all floating point scores", () => {
      const preciseRecord: ExportScoreRecordItem[] = [
        {
          rank: 1,
          regCode: "T-PRECISE",
          teamName: "Test Precision",
          track: "AI",
          normalizedScore: 85,
          rawAverageScore: 84.1,
          zScoreMean: 0,
          evaluatorCount: 3,
          rankShift: 0,
        },
      ];

      const csv = exportScoresToCsv(preciseRecord);
      expect(csv).toContain("85.00,84.10,+0.000");
    });
  });

  // ----------------------------------------------------
  // 5. ACCEPTANCE CRITERION 2: LEADERBOARD GATING
  // ----------------------------------------------------
  describe("Acceptance Criterion 2: Leaderboard stays hidden from participants until published", () => {
    it("strictly blocks PARTICIPANT, MENTOR, and EVALUATOR when leaderboardPublished is false", () => {
      expect(isLeaderboardVisible({ leaderboardPublished: false, userRole: "PARTICIPANT" })).toBe(false);
      expect(isLeaderboardVisible({ leaderboardPublished: false, userRole: "MENTOR" })).toBe(false);
      expect(isLeaderboardVisible({ leaderboardPublished: false, userRole: "EVALUATOR" })).toBe(false);
      expect(isLeaderboardVisible({ leaderboardPublished: false, userRole: undefined })).toBe(false);
    });

    it("allows COORDINATOR_MANAGE, COORDINATOR_VIEW, and SUPER_ADMIN to preview unpublished leaderboards", () => {
      expect(isLeaderboardVisible({ leaderboardPublished: false, userRole: "COORDINATOR_MANAGE" })).toBe(true);
      expect(isLeaderboardVisible({ leaderboardPublished: false, userRole: "COORDINATOR_VIEW" })).toBe(true);
      expect(isLeaderboardVisible({ leaderboardPublished: false, userRole: "SUPER_ADMIN" })).toBe(true);
    });

    it("unblocks all roles once leaderboardPublished is toggled to true", () => {
      expect(isLeaderboardVisible({ leaderboardPublished: true, userRole: "PARTICIPANT" })).toBe(true);
      expect(isLeaderboardVisible({ leaderboardPublished: true, userRole: "MENTOR" })).toBe(true);
      expect(isLeaderboardVisible({ leaderboardPublished: true, userRole: "EVALUATOR" })).toBe(true);
      expect(isLeaderboardVisible({ leaderboardPublished: true, userRole: "COORDINATOR_MANAGE" })).toBe(true);
      expect(isLeaderboardVisible({ leaderboardPublished: true, userRole: "COORDINATOR_VIEW" })).toBe(true);
    });

    it("toggleLeaderboardPublication updates publication status correctly", async () => {
      const published = await toggleLeaderboardPublication("ev_test", true, "coord_manage");
      expect(published.published).toBe(true);
      expect(isLeaderboardVisible({ leaderboardPublished: published.published, userRole: "PARTICIPANT" })).toBe(true);

      const unpublished = await toggleLeaderboardPublication("ev_test", false, "coord_manage");
      expect(unpublished.published).toBe(false);
      expect(isLeaderboardVisible({ leaderboardPublished: unpublished.published, userRole: "PARTICIPANT" })).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 6. STAGE DECISION RECORDING & NOTIFICATIONS
  // ----------------------------------------------------
  describe("Event Stage Decision Recording & Validation", () => {
    it("allows CONTINUE without mandatory notes", () => {
      const valid = validateDecisionParameters({ decision: "CONTINUE" });
      expect(valid.valid).toBe(true);
    });

    it("rejects CONDITIONAL decision if condition notes are missing or shorter than 5 chars", () => {
      const invalidNoNotes = validateDecisionParameters({ decision: "CONDITIONAL" });
      expect(invalidNoNotes.valid).toBe(false);
      expect(invalidNoNotes.error).toContain("Conditional advancement requires explicit remedial conditions");

      const invalidShortNotes = validateDecisionParameters({ decision: "CONDITIONAL", notes: "fix" });
      expect(invalidShortNotes.valid).toBe(false);

      const validNotes = validateDecisionParameters({
        decision: "CONDITIONAL",
        notes: "Must submit hardware BOM and bench latency report before CPR 1.",
      });
      expect(validNotes.valid).toBe(true);
    });

    it("rejects EXIT decision if exit rationale notes are missing or shorter than 5 chars", () => {
      const invalid = validateDecisionParameters({ decision: "EXIT" });
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain("Stage elimination requires an exit rationale");

      const valid = validateDecisionParameters({
        decision: "EXIT",
        notes: "Lack of novel consensus mechanism and missing slide deck evidence.",
      });
      expect(valid.valid).toBe(true);
    });

    it("records stage decision and dispatches notifications to team members", async () => {
      const result = await recordTeamStageDecision({
        eventId: "ev_ideathon",
        teamId: "t_quantum",
        decision: "CONDITIONAL",
        notes: "Must submit hardware BOM before CPR 1.",
        decidedById: "coord_1",
        eventName: "Ideathon Screening",
        teamName: "QuantumForge",
        teamMembers: [
          { userId: "u_lead", name: "Priya Sharma", email: "priya@hacktrack.edu" },
          { userId: "u_member", name: "Liam O'Connor", email: "liam@hacktrack.edu" },
        ],
      });

      expect(result.status).toBe("RECORDED");
      expect(result.notifiedCount).toBe(2);
      expect(result.decision.decision).toBe("CONDITIONAL");

      const decisions = await getEventDecisions("ev_ideathon");
      expect(decisions).toHaveLength(1);
      expect(decisions[0].teamId).toBe("t_quantum");
      expect(decisions[0].decision).toBe("CONDITIONAL");
    });

    it("renders branded email template for STAGE_DECISION with correct decision badge", () => {
      const renderedContinue = renderEmailTemplate({
        recipientName: "Priya Sharma",
        recipientEmail: "priya@hacktrack.edu",
        templateType: "STAGE_DECISION",
        eventName: "Ideathon Screening",
        teamName: "QuantumForge",
        stageDecision: "CONTINUE",
        decisionNotes: "Outstanding presentation.",
        actionUrl: "https://hacktrack.edu/results",
      });

      expect(renderedContinue.subject).toContain("CONTINUE for Ideathon Screening");
      expect(renderedContinue.html).toContain("CONTINUE");
      expect(renderedContinue.html).toContain("Outstanding presentation.");

      const renderedConditional = renderEmailTemplate({
        recipientName: "Priya Sharma",
        recipientEmail: "priya@hacktrack.edu",
        templateType: "STAGE_DECISION",
        eventName: "Ideathon Screening",
        teamName: "QuantumForge",
        stageDecision: "CONDITIONAL",
        decisionNotes: "Must submit hardware BOM before CPR 1.",
        actionUrl: "https://hacktrack.edu/results",
      });

      expect(renderedConditional.subject).toContain("CONDITIONAL");
      expect(renderedConditional.html).toContain("Conditional Advancement");
      expect(renderedConditional.html).toContain("Must submit hardware BOM before CPR 1.");
    });
  });

  // ----------------------------------------------------
  // 7. RFC 4180 CSV ESCAPING & BOM GENERATION
  // ----------------------------------------------------
  describe("CSV RFC 4180 Formatting & Other Exports", () => {
    it("escapes commas, quotes, and newlines per RFC 4180", () => {
      expect(escapeCsvCell("Simple")).toBe("Simple");
      expect(escapeCsvCell("Hello, World")).toBe('"Hello, World"');
      expect(escapeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
      expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCsvCell(null)).toBe("");
    });

    it("builds valid CSV with UTF-8 BOM and CRLF line breaks", () => {
      const headers = ["Col1", "Col2"];
      const rows = [
        ["val1", "val2"],
        ['val3, with comma', 'val4 "quoted"'],
      ];
      const csv = buildCsv(headers, rows);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("Col1,Col2\r\n");
      expect(csv).toContain('val1,val2\r\n');
      expect(csv).toContain('"val3, with comma","val4 ""quoted"""');
    });

    it("exportIdeasToCsv correctly maps team attributes", () => {
      const csv = exportIdeasToCsv([
        {
          regCode: "HT26-T001",
          name: "QuantumForge",
          track: "AI",
          status: "SUBMITTED",
          leadName: "Priya",
          leadEmail: "priya@test.com",
          memberCount: 4,
          slidesUrl: "https://slides.com/123",
          problemStatement: "Problem description, with comma",
          solutionAbstract: "Solution abstract",
        },
      ]);

      expect(csv).toContain("HT26-T001,QuantumForge,AI,SUBMITTED,Priya,priya@test.com,4,https://slides.com/123");
      expect(csv).toContain('"Problem description, with comma"');
    });

    it("exportFeedbackToCsv maps rubric criteria and written notes", () => {
      const csv = exportFeedbackToCsv([
        {
          regCode: "HT26-T001",
          teamName: "QuantumForge",
          eventName: "Ideathon",
          evaluatorName: "Dr. Evelyn Reed",
          criterionTitle: "Problem Relevance",
          weightPercentage: 25,
          criterionScore: 23.5,
          maxPoints: 25,
          writtenFeedback: "Great societal impact.",
        },
      ]);

      expect(csv).toContain("HT26-T001,QuantumForge,Ideathon,Dr. Evelyn Reed,Problem Relevance,25%,23.5,25,Great societal impact.");
    });

    it("exportMilestonesToCsv maps deliverable compliance and overdue days", () => {
      const csv = exportMilestonesToCsv([
        {
          regCode: "HT26-T003",
          teamName: "SolarGrid Nexus",
          milestoneTitle: "Hardware BOM",
          source: "COORDINATOR_MANDATORY",
          dueDate: "2026-09-25",
          status: "PENDING",
          isOverdue: true,
          daysOverdue: 6,
        },
      ]);

      expect(csv).toContain("HT26-T003,SolarGrid Nexus,Hardware BOM,Mandatory Deliverable,2026-09-25,PENDING,Unsubmitted,YES,6");
    });
  });

  // ----------------------------------------------------
  // 8. PRINTABLE HTML REPORT GENERATOR
  // ----------------------------------------------------
  describe("Printable HTML Report Generation", () => {
    it("generates valid printer-friendly HTML markup with @media print CSS and podium styles", () => {
      const html = generatePrintableHtmlReport({
        reportTitle: "Ideathon Standings",
        editionName: "HackTrack 2026",
        eventName: "Stage 1",
        generatedBy: "Coordinator Admin",
        summaryCards: [
          { label: "Total Teams", value: 300 },
          { label: "Completed", value: "100%" },
        ],
        tableHeaders: ["Rank", "Team Code", "Team Name", "Score"],
        tableRows: [
          ["#1", "T001", "QuantumForge", "92.45"],
          ["#2", "T002", "BioSynth AI", "88.75"],
          ["#3", "T003", "SolarGrid Nexus", "85.30"],
          ["#4", "T004", "AeroVision Labs", "78.10"],
        ],
      });

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("@media print");
      expect(html).toContain("Ideathon Standings — HackTrack 2026");
      expect(html).toContain("podium-1");
      expect(html).toContain("podium-2");
      expect(html).toContain("podium-3");
      expect(html).toContain("autoprint=true");
    });
  });

  // ----------------------------------------------------
  // 9. TWO-TIER COORDINATOR RBAC ENFORCEMENT
  // ----------------------------------------------------
  describe("Two-Tier Coordinator RBAC Permissions", () => {
    it("allows COORDINATOR_MANAGE to mutate decisions and publish leaderboards", () => {
      expect(canMutateEventConfig("COORDINATOR_MANAGE")).toBe(true);
      expect(canMutateEventConfig("SUPER_ADMIN")).toBe(true);
    });

    it("strictly blocks COORDINATOR_VIEW from mutating decisions or publishing leaderboards", () => {
      expect(canMutateEventConfig("COORDINATOR_VIEW")).toBe(false);
      expect(canMutateEventConfig("PARTICIPANT")).toBe(false);
      expect(canMutateEventConfig("MENTOR")).toBe(false);
      expect(canMutateEventConfig("EVALUATOR")).toBe(false);
    });
  });
});
