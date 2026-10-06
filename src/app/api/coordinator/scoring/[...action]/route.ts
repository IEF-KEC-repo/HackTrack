import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { canMutateEventConfig } from "@/lib/permissions";
import {
  executeEventReviewAllocation,
  scheduleEvaluationSlot,
} from "@/lib/services/review-assignment-service";
import { reopenEvaluation } from "@/lib/services/scoring-service";
import {
  computeZScoreNormalization,
  commitEventNormalization,
  EvaluationRecord,
} from "@/lib/services/normalization-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];
  const eventId = req.nextUrl.searchParams.get("eventId");
  const editionSlug = req.nextUrl.searchParams.get("edition") || "ht26";

  try {
    const edition = await prisma.edition.findUnique({
      where: { slug: editionSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!edition) {
      return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    }

    // ----------------------------------------------------
    // GET: LEADERBOARD WITH Z-SCORE NORMALIZATION & OUTLIER FLAGS
    // ----------------------------------------------------
    if (action === "leaderboard") {
      let targetEventId = eventId;
      if (!targetEventId) {
        const firstEvent = await prisma.event.findFirst({
          where: { editionId: edition.id },
          select: { id: true },
        });
        targetEventId = firstEvent?.id || null;
      }

      if (!targetEventId) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      const event = await prisma.event.findUnique({
        where: { id: targetEventId },
        include: {
          evaluations: {
            include: {
              evaluator: { select: { id: true, name: true } },
              team: { select: { id: true, name: true, regCode: true, track: true } },
            },
          },
          rubrics: {
            include: { criteria: true },
          },
        },
      });

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      const evaluationRecords: EvaluationRecord[] = event.evaluations.map((e) => ({
        id: e.id,
        teamId: e.teamId,
        evaluatorId: e.evaluatorId,
        rawScore: e.rawTotalScore || 0,
        status: e.status,
      }));

      // Primary criterion (highest weighted)
      const primaryCriterion = event.rubrics[0]?.criteria.reduce((max, c) =>
        c.weightPercentage > (max?.weightPercentage || 0) ? c : max
      );

      const normResult = computeZScoreNormalization({
        evaluations: evaluationRecords,
      });

      // Enrich ranked teams with team names and registration codes
      const enrichedRankedTeams = normResult.rankedTeams.map((rt) => {
        const sampleMatch = event.evaluations.find((e) => e.teamId === rt.teamId);
        return {
          ...rt,
          teamName: sampleMatch?.team.name || rt.teamId,
          regCode: sampleMatch?.team.regCode || "TEAM",
          track: sampleMatch?.team.track || "General",
        };
      });

      const totalAssigned = event.evaluations.length;
      const totalSubmitted = event.evaluations.filter((e) => e.status === "SUBMITTED").length;

      return NextResponse.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
          status: event.status,
          evaluatorCountPerTeam: event.evaluatorCountPerTeam,
          feedbackReleased: event.feedbackReleased,
          isCalibrationActive: event.isCalibrationActive,
        },
        primaryCriterion: primaryCriterion?.title || "Composite",
        evaluatorStats: normResult.evaluatorStats,
        rankedTeams: enrichedRankedTeams,
        summary: {
          totalAssigned,
          totalSubmitted,
          completionPercent:
            totalAssigned > 0 ? Math.round((totalSubmitted / totalAssigned) * 1000) / 10 : 100,
          outlierCount: enrichedRankedTeams.filter((t) => t.isOutlier).length,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Coordinator Scoring GET Error]", error);
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

  const userRole = session?.editionRole || "COORDINATOR_MANAGE";

  // Enforce View-Only Write Protection
  if (!canMutateEventConfig(userRole as any)) {
    return NextResponse.json(
      {
        error: "View-only coordinators cannot perform modifications or allocations.",
        code: "COORDINATOR_VIEW_WRITE_BLOCKED",
      },
      { status: 403 }
    );
  }

  const coordinatorId = session?.userId || "coord_manage";

  try {
    // ----------------------------------------------------
    // POST: ALLOCATE REVIEWERS (Auto-balanced, overlapping)
    // ----------------------------------------------------
    if (action === "allocate") {
      const body = await req.json();
      const { eventId, editionId, clearExisting } = body;

      if (!eventId || !editionId) {
        return NextResponse.json(
          { error: "eventId and editionId are required." },
          { status: 400 }
        );
      }

      const result = await executeEventReviewAllocation({
        eventId,
        editionId,
        clearExisting: Boolean(clearExisting),
        coordinatorId,
      });

      return NextResponse.json({
        success: true,
        result,
        message: `Successfully generated ${result.totalAssignments} balanced review assignments.`,
      });
    }

    // ----------------------------------------------------
    // POST: REOPEN EVALUATION (Coordinator Manage, Audited)
    // ----------------------------------------------------
    if (action === "reopen") {
      const body = await req.json();
      const { evaluationId, reason } = body;

      if (!evaluationId || !reason) {
        return NextResponse.json(
          { error: "evaluationId and reason are required." },
          { status: 400 }
        );
      }

      const reopened = await reopenEvaluation({
        evaluationId,
        coordinatorId,
        reason,
      });

      return NextResponse.json({
        success: true,
        evaluation: reopened,
        message: "Evaluation unlocked and returned to draft for evaluator revision.",
      });
    }

    // ----------------------------------------------------
    // POST: COMMIT NORMALIZATION
    // ----------------------------------------------------
    if (action === "normalize") {
      const body = await req.json();
      const { eventId } = body;

      if (!eventId) {
        return NextResponse.json({ error: "eventId is required." }, { status: 400 });
      }

      const result = await commitEventNormalization({
        eventId,
        coordinatorId,
      });

      return NextResponse.json({
        success: true,
        result,
        message: "Statistical Z-Score normalization successfully committed to database.",
      });
    }

    // ----------------------------------------------------
    // POST: RELEASE FEEDBACK TO TEAMS
    // ----------------------------------------------------
    if (action === "release-feedback") {
      const body = await req.json();
      const { eventId, feedbackReleased } = body;

      if (!eventId || typeof feedbackReleased !== "boolean") {
        return NextResponse.json(
          { error: "eventId and feedbackReleased (boolean) are required." },
          { status: 400 }
        );
      }

      const event = await prisma.event.update({
        where: { id: eventId },
        data: { feedbackReleased },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          editionId: event.editionId,
          actorId: coordinatorId,
          action: feedbackReleased ? "FEEDBACK_RELEASED" : "FEEDBACK_CONCEALED",
          entityType: "Event",
          entityId: event.id,
          newState: JSON.stringify({ feedbackReleased }),
        },
      });

      return NextResponse.json({
        success: true,
        event,
        message: `Evaluation feedback ${
          feedbackReleased ? "RELEASED to participants" : "CONCEALED"
        }.`,
      });
    }

    // ----------------------------------------------------
    // POST: SCHEDULE PRESENTATION SLOT
    // ----------------------------------------------------
    if (action === "schedule") {
      const body = await req.json();
      const { evaluationId, slotStart, slotEnd, roomOrMeetingUrl } = body;

      if (!evaluationId || !slotStart || !slotEnd) {
        return NextResponse.json(
          { error: "evaluationId, slotStart, and slotEnd are required." },
          { status: 400 }
        );
      }

      const scheduled = await scheduleEvaluationSlot({
        evaluationId,
        slotStart: new Date(slotStart),
        slotEnd: new Date(slotEnd),
        roomOrMeetingUrl,
      });

      return NextResponse.json({ success: true, evaluation: scheduled });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (error: any) {
    console.error("[Coordinator Scoring POST Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
