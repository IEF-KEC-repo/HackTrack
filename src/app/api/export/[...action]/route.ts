import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exportIdeasToCsv,
  exportScoresToCsv,
  exportFeedbackToCsv,
  exportMilestonesToCsv,
  generatePrintableHtmlReport,
  ExportScoreRecordItem,
} from "@/lib/services/export-service";
import { getEventLeaderboard } from "@/lib/services/leaderboard-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];
  const editionSlug = req.nextUrl.searchParams.get("edition") || "ht26";
  const eventId = req.nextUrl.searchParams.get("eventId");

  try {
    // Resolve the active edition (used by most export branches).
    const edition = await prisma.edition.findUnique({
      where: { slug: editionSlug },
      select: { id: true, name: true },
    });

    const emptyCsvResponse = (csv: string, filename: string) =>
      new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });

    // ----------------------------------------------------
    // 1. EXPORT IDEAS TO CSV
    // ----------------------------------------------------
    if (action === "ideas") {
      const teamsData = edition
        ? await prisma.team
            .findMany({
              where: { editionId: edition.id },
              include: {
                members: {
                  include: { user: { select: { name: true, email: true } } },
                },
              },
            })
            .then((teams) =>
              teams.map((t) => {
                const lead = t.members.find((m) => m.role === "LEAD") || t.members[0];
                return {
                  regCode: t.regCode,
                  name: t.name,
                  track: t.track,
                  status: t.status,
                  leadName: lead?.user.name,
                  leadEmail: lead?.user.email,
                  memberCount: t.members.length,
                  slidesUrl: t.slidesUrl,
                  problemStatement: t.problemStatement,
                  solutionAbstract: t.solutionAbstract,
                  techStack: t.techStack,
                  githubUrl: t.githubUrl,
                };
              })
            )
        : [];

      const csv = exportIdeasToCsv(teamsData);
      return emptyCsvResponse(csv, `ideas-${editionSlug}.csv`);
    }

    // ----------------------------------------------------
    // 2. EXPORT SCORES & RANKINGS TO CSV (100% NUMERICAL PARITY)
    // ----------------------------------------------------
    if (action === "scores") {
      const board = await getEventLeaderboard({ editionSlug, eventId: eventId || null });

      const records: ExportScoreRecordItem[] = board.rankedTeams.map((rt) => ({
        rank: rt.rank,
        regCode: rt.regCode,
        teamName: rt.teamName,
        track: rt.track || "General",
        normalizedScore: rt.normalizedScore,
        rawAverageScore: rt.rawAverageScore,
        zScoreMean: rt.zScoreMean,
        evaluatorCount: rt.evaluatorCount,
        rankShift: rt.rankShift,
        tieBreakReason: rt.tieBreakReason,
        stageDecision: rt.stageDecision || null,
      }));

      const csv = exportScoresToCsv(records);
      return emptyCsvResponse(csv, `leaderboard-${eventId || editionSlug}.csv`);
    }

    // ----------------------------------------------------
    // 3. EXPORT FEEDBACK TO CSV (submitted evaluations only — never partial drafts)
    // ----------------------------------------------------
    if (action === "feedback") {
      if (!edition) {
        return emptyCsvResponse(exportFeedbackToCsv([]), `rubric-feedback-${editionSlug}.csv`);
      }

      const targetEvent = eventId
        ? await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true } })
        : await prisma.event.findFirst({
            where: { editionId: edition.id },
            orderBy: { sequenceIndex: "asc" },
            select: { id: true, name: true },
          });

      if (!targetEvent) {
        return emptyCsvResponse(exportFeedbackToCsv([]), `rubric-feedback-${editionSlug}.csv`);
      }

      const scoreRows = await prisma.evaluationScore.findMany({
        where: { evaluation: { eventId: targetEvent.id, status: "SUBMITTED" } },
        include: {
          evaluation: {
            include: {
              team: { select: { regCode: true, name: true } },
              evaluator: { select: { name: true } },
            },
          },
          criterion: { select: { title: true, weightPercentage: true, maxPoints: true } },
        },
        orderBy: { id: "asc" },
      });

      const feedbackItems = scoreRows.map((s) => ({
        regCode: s.evaluation.team.regCode,
        teamName: s.evaluation.team.name,
        eventName: targetEvent.name,
        evaluatorName: s.evaluation.evaluator.name,
        criterionTitle: s.criterion.title,
        weightPercentage: s.criterion.weightPercentage,
        criterionScore: s.score,
        maxPoints: s.criterion.maxPoints,
        writtenFeedback: s.feedback || null,
        coordinatorReason: null,
      }));

      const csv = exportFeedbackToCsv(feedbackItems);
      return emptyCsvResponse(csv, `rubric-feedback-${eventId || editionSlug}.csv`);
    }

    // ----------------------------------------------------
    // 4. EXPORT MILESTONES TO CSV
    // ----------------------------------------------------
    if (action === "milestones") {
      const rows = edition
        ? await prisma.teamMilestone.findMany({
            where: { editionId: edition.id },
            include: {
              team: { select: { regCode: true, name: true } },
            },
            orderBy: { dueDate: "asc" },
          })
        : [];

      const milestones = rows.map((m) => {
        const overdueDays =
          m.isOverdue && m.dueDate.getTime() < Date.now()
            ? Math.max(0, Math.ceil((Date.now() - m.dueDate.getTime()) / 86400000))
            : 0;
        return {
          regCode: m.team.regCode,
          teamName: m.team.name,
          milestoneTitle: m.title,
          source: m.source as "COORDINATOR_MANDATORY" | "TEAM_CUSTOM",
          dueDate: m.dueDate.toISOString().slice(0, 10),
          status: m.status,
          submittedAt: m.completedAt ? m.completedAt.toISOString().slice(0, 10) : null,
          isOverdue: m.isOverdue,
          daysOverdue: overdueDays,
          evidenceType: m.evidenceType,
          evidenceUrl: m.evidenceUrl,
        };
      });

      const csv = exportMilestonesToCsv(milestones);
      return emptyCsvResponse(csv, `milestones-${editionSlug}.csv`);
    }

    // ----------------------------------------------------
    // 5. PRINTABLE HTML REPORT (BROWSER PRINT-TO-PDF)
    // ----------------------------------------------------
    if (action === "report") {
      const board = await getEventLeaderboard({ editionSlug, eventId: eventId || null });

      const [teamCount, submittedCount, continueCount, conditionalCount] = edition
        ? await Promise.all([
            prisma.team.count({ where: { editionId: edition.id } }),
            board.eventId
              ? prisma.evaluation.count({ where: { eventId: board.eventId, status: "SUBMITTED" } })
              : Promise.resolve(0),
            board.eventId
              ? prisma.eventDecision.count({
                  where: { eventId: board.eventId, decision: "CONTINUE" },
                })
              : Promise.resolve(0),
            board.eventId
              ? prisma.eventDecision.count({
                  where: { eventId: board.eventId, decision: "CONDITIONAL" },
                })
              : Promise.resolve(0),
          ])
        : [0, 0, 0, 0];

      const html = generatePrintableHtmlReport({
        reportTitle: "Official Event Standings & Normalization Audit",
        editionName: edition?.name || `HackTrack ${editionSlug.toUpperCase()} Edition`,
        eventName: board.eventName || undefined,
        generatedBy: "HackTrack Coordinator Operations",
        summaryCards: [
          { label: "Total Cohort Teams", value: String(teamCount) },
          { label: "Reviews Completed", value: String(submittedCount) },
          { label: "Advanced (Continue)", value: String(continueCount) },
          { label: "Conditional", value: String(conditionalCount) },
        ],
        tableHeaders: [
          "Rank",
          "Team Code",
          "Team Name",
          "Track",
          "Normalized Score",
          "Raw Average",
          "Z-Score",
          "Stage Decision",
        ],
        tableRows: board.rankedTeams.map((rt) => [
          `#${rt.rank}`,
          rt.regCode,
          rt.teamName,
          rt.track || "General",
          rt.normalizedScore.toFixed(2),
          rt.rawAverageScore.toFixed(2),
          `${rt.zScoreMean >= 0 ? "+" : ""}${rt.zScoreMean.toFixed(3)}`,
          rt.stageDecision || "Pending",
        ]),
      });

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return NextResponse.json({ error: `Unknown export action: ${action}` }, { status: 404 });
  } catch (error: any) {
    console.error("[Export Route Error]", error);
    return NextResponse.json({ error: error.message || "Export failed" }, { status: 500 });
  }
}