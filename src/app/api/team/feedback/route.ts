import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { evaluateFeedbackVisibility } from "@/lib/services/normalization-engine";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  const teamId = req.nextUrl.searchParams.get("teamId");
  const eventId = req.nextUrl.searchParams.get("eventId");

  if (!teamId || !eventId) {
    return NextResponse.json({ error: "teamId and eventId are required." }, { status: 400 });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, slug: true, feedbackReleased: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const visibility = evaluateFeedbackVisibility(event, session?.editionRole);

    if (!visibility.canView) {
      return NextResponse.json({
        feedbackReleased: false,
        message: visibility.message,
      });
    }

    // Fetch team evaluations with criteria feedback
    const evaluations = await prisma.evaluation.findMany({
      where: { teamId, eventId, status: "SUBMITTED" },
      include: {
        scores: {
          include: {
            criterion: { select: { title: true, maxPoints: true, weightPercentage: true } },
          },
        },
      },
    });

    const reviews = evaluations.map((ev, index) => ({
      reviewNumber: index + 1,
      rawScore: ev.rawTotalScore,
      normalizedScore: ev.normalizedScore,
      generalFeedback: ev.generalFeedback,
      criterionFeedback: ev.scores.map((s) => ({
        criterion: s.criterion.title,
        score: s.score,
        maxPoints: s.criterion.maxPoints,
        feedback: s.feedback,
      })),
    }));

    const rawAverage =
      evaluations.length > 0
        ? Math.round(
            (evaluations.reduce((acc, e) => acc + (e.rawTotalScore || 0), 0) / evaluations.length) *
              10
          ) / 10
        : 0;

    const normalizedAverage =
      evaluations.length > 0
        ? Math.round(
            (evaluations.reduce((acc, e) => acc + (e.normalizedScore || 0), 0) /
              evaluations.length) *
              10
          ) / 10
        : 0;

    return NextResponse.json({
      feedbackReleased: true,
      eventName: event.name,
      rawAverage,
      normalizedAverage,
      reviewsCount: evaluations.length,
      reviews,
    });
  } catch (error: any) {
    console.error("[Team Feedback GET Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
