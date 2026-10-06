import { NextRequest, NextResponse } from "next/server";
import { scanAndDispatchReminders } from "@/lib/services/reminder-job-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "hacktrack_cron_secret";

    // Optional bearer secret check if configured
    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }

    let editionId = req.nextUrl.searchParams.get("editionId");
    if (!editionId) {
      const activeEdition = await prisma.edition.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      editionId = activeEdition?.id || null;
    }

    if (!editionId) {
      // Fallback to first edition
      const first = await prisma.edition.findFirst({ select: { id: true } });
      editionId = first?.id || null;
    }

    if (!editionId) {
      return NextResponse.json({ error: "No active edition found to process reminders." }, { status: 404 });
    }

    const report = await scanAndDispatchReminders({ editionId });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error("[Cron Reminders Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute reminder job" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Allow manual GET trigger in local development / diagnostics
  return POST(req);
}
