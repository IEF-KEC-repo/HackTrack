import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  saveEvaluationDraft,
  submitFinalEvaluation,
} from "@/lib/services/scoring-service";
import { declareConflictOfInterest } from "@/lib/services/review-assignment-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session?.userId) {
    return NextResponse.json({ error: "Evaluator authentication required" }, { status: 401 });
  }
  const evaluatorId = session.userId;

  try {
    // ----------------------------------------------------
    // GET: EVALUATOR ASSIGNED QUEUE
    // ----------------------------------------------------
    if (action === "queue") {
      const eventId = req.nextUrl.searchParams.get("eventId");

      const whereClause: any = { evaluatorId };
      if (eventId) whereClause.eventId = eventId;

      const evaluations = await prisma.evaluation.findMany({
        where: whereClause,
        include: {
          team: {
            select: {
              id: true,
              regCode: true,
              name: true,
              track: true,
              problemStatement: true,
              solutionAbstract: true,
              embedSlidesUrl: true,
              slidesUrl: true,
            },
          },
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
              sequenceIndex: true,
              isCalibrationActive: true,
              feedbackReleased: true,
            },
          },
          scores: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const queue = evaluations.map((ev) => ({
        id: ev.id,
        teamId: ev.teamId,
        teamCode: ev.team.regCode,
        teamName: ev.team.name,
        track: ev.team.track,
        problemStatement: ev.team.problemStatement,
        solutionAbstract: ev.team.solutionAbstract,
        embedSlidesUrl: ev.team.embedSlidesUrl,
        slidesUrl: ev.team.slidesUrl,
        eventName: ev.event.name,
        eventSlug: ev.event.slug,
        isCalibration: ev.isCalibration,
        isOutlierReview: ev.isOutlierReview,
        scheduledSlotStart: ev.scheduledSlotStart,
        scheduledSlotEnd: ev.scheduledSlotEnd,
        roomOrMeetingUrl: ev.roomOrMeetingUrl,
        status: ev.status,
        rawTotalScore: ev.rawTotalScore,
        submittedAt: ev.submittedAt,
        reopenedAt: ev.reopenedAt,
        reopenReason: ev.reopenReason,
      }));

      const completedCount = queue.filter((q) => q.status === "SUBMITTED").length;

      return NextResponse.json({
        evaluatorId,
        queue,
        totalAssigned: queue.length,
        completedCount,
        progressPercent:
          queue.length > 0 ? Math.round((completedCount / queue.length) * 1000) / 10 : 100,
      });
    }

    // ----------------------------------------------------
    // GET: WORKSPACE FOR SPECIFIC EVALUATION
    // ----------------------------------------------------
    if (action === "workspace") {
      const evaluationId = req.nextUrl.searchParams.get("evaluationId");
      if (!evaluationId) {
        return NextResponse.json({ error: "evaluationId required" }, { status: 400 });
      }

      const evaluation = await prisma.evaluation.findUnique({
        where: { id: evaluationId },
        include: {
          team: {
            include: {
              members: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
              artifacts: true,
            },
          },
          event: {
            include: {
              rubrics: {
                include: {
                  criteria: { orderBy: { sequenceOrder: "asc" } },
                },
              },
            },
          },
          scores: true,
        },
      });

      if (!evaluation) {
        return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
      }

      const rubric = evaluation.event.rubrics[0] || null;

      // Map existing scores
      const existingScores: Record<string, number> = {};
      const existingFeedback: Record<string, string> = {};
      for (const s of evaluation.scores) {
        existingScores[s.criterionId] = s.score;
        if (s.feedback) existingFeedback[s.criterionId] = s.feedback;
      }

      return NextResponse.json({
        evaluation: {
          id: evaluation.id,
          status: evaluation.status,
          rawTotalScore: evaluation.rawTotalScore,
          generalFeedback: evaluation.generalFeedback,
          submittedAt: evaluation.submittedAt,
          isCalibration: evaluation.isCalibration,
          isOutlierReview: evaluation.isOutlierReview,
          scheduledSlotStart: evaluation.scheduledSlotStart,
          scheduledSlotEnd: evaluation.scheduledSlotEnd,
          roomOrMeetingUrl: evaluation.roomOrMeetingUrl,
          reopenedAt: evaluation.reopenedAt,
          reopenReason: evaluation.reopenReason,
        },
        team: {
          id: evaluation.team.id,
          regCode: evaluation.team.regCode,
          name: evaluation.team.name,
          track: evaluation.team.track,
          problemStatement: evaluation.team.problemStatement,
          solutionAbstract: evaluation.team.solutionAbstract,
          slidesUrl: evaluation.team.slidesUrl,
          embedSlidesUrl: evaluation.team.embedSlidesUrl,
          members: evaluation.team.members.map((m) => ({
            name: m.user.name,
            role: m.role,
          })),
          artifacts: evaluation.team.artifacts,
        },
        rubric,
        existingScores,
        existingFeedback,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Evaluator Scoring GET Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session?.userId) {
    return NextResponse.json({ error: "Evaluator authentication required" }, { status: 401 });
  }
  const evaluatorId = session.userId;

  try {
    // ----------------------------------------------------
    // POST: SAVE EVALUATION DRAFT
    // ----------------------------------------------------
    if (action === "draft") {
      const body = await req.json();
      const { evaluationId, scores, criterionFeedback, generalFeedback } = body;

      if (!evaluationId) {
        return NextResponse.json({ error: "evaluationId is required." }, { status: 400 });
      }

      const updated = await saveEvaluationDraft({
        evaluationId,
        evaluatorId,
        scores: scores || {},
        criterionFeedback,
        generalFeedback,
      });

      return NextResponse.json({ success: true, evaluation: updated });
    }

    // ----------------------------------------------------
    // POST: SUBMIT FINAL EVALUATION & LOCK
    // ----------------------------------------------------
    if (action === "submit") {
      const body = await req.json();
      const { evaluationId, scores, criterionFeedback, generalFeedback } = body;

      if (!evaluationId || !scores || !generalFeedback) {
        return NextResponse.json(
          { error: "evaluationId, scores, and generalFeedback are required." },
          { status: 400 }
        );
      }

      const updated = await submitFinalEvaluation({
        evaluationId,
        evaluatorId,
        scores,
        criterionFeedback,
        generalFeedback,
      });

      return NextResponse.json({
        success: true,
        evaluation: updated,
        message: "Evaluation submitted and locked.",
      });
    }

    // ----------------------------------------------------
    // POST: DECLARE CONFLICT OF INTEREST
    // ----------------------------------------------------
    if (action === "declare-coi") {
      const body = await req.json();
      const { editionId, teamId, reason } = body;

      if (!teamId) {
        return NextResponse.json({ error: "teamId is required." }, { status: 400 });
      }

      const coi = await declareConflictOfInterest({
        editionId: editionId || "ht26",
        evaluatorId,
        teamId,
        reason,
      });

      return NextResponse.json({
        success: true,
        coi,
        message: "Conflict of interest declared. You will not be assigned to this team.",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Evaluator Scoring POST Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
