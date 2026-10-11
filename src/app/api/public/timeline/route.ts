import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public, read-only, no-auth endpoint (see PUBLIC_PATHS + canAccessApiRoute).
// Serves ONLY the active edition's program structure — event names, order, and
// dates. Never exposes team data, scores, participant lists, or internal notes.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const edition = await prisma.edition.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        academicYear: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!edition) {
      return NextResponse.json({ edition: null, events: [] });
    }

    const events = await prisma.event.findMany({
      where: { editionId: edition.id },
      orderBy: { sequenceIndex: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        sequenceIndex: true,
        status: true,
        reviewType: true,
        submissionDeadline: true,
        evaluationDeadline: true,
      },
    });

    return NextResponse.json({ edition, events });
  } catch (error: any) {
    console.error("[Public Timeline Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to load event timeline" },
      { status: 500 }
    );
  }
}