import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runMilestoneAlertsJob } from "@/lib/services/milestone-job-service";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "hacktrack_cron_secret";

    // Optional secret check if configured
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron execution." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const editionSlug = body.editionSlug || "ht26";

    const edition = await prisma.edition.findUnique({
      where: { slug: editionSlug },
      select: { id: true, name: true },
    });

    if (!edition) {
      return NextResponse.json({ error: "Edition not found" }, { status: 404 });
    }

    const report = await runMilestoneAlertsJob({
      editionId: edition.id,
      actorId: "SCHEDULED_CRON_JOB",
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      edition: edition.name,
      report,
    });
  } catch (error: any) {
    console.error("[Milestone Alerts Cron Error]", error);
    return NextResponse.json({ error: error.message || "Cron job failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
