import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import { validateFileUpload, saveUploadedFile } from "@/lib/services/artifact-service";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session) {
    // For demo/dev allow fallback if headers say test
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const teamId = formData.get("teamId") as string | null;
    const eventId = formData.get("eventId") as string | null;
    const editionId = (formData.get("editionId") as string | null) || "ht26";
    const fileType = (formData.get("fileType") as string | null) || "MILESTONE_EVIDENCE";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
    }

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required." }, { status: 400 });
    }

    // 1. Fetch Team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, regCode: true, editionId: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    // 2. Check Event Upload Toggle
    let uploadsEnabled = true; // default true if not attached to a locked event
    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { uploadsEnabled: true, name: true },
      });
      if (event && !event.uploadsEnabled) {
        return NextResponse.json(
          {
            error: `File uploads are disabled for ${event.name}. Coordinator must enable uploads before files can be attached.`,
            code: "EVENT_UPLOADS_DISABLED",
          },
          { status: 403 }
        );
      }
      if (event) {
        uploadsEnabled = event.uploadsEnabled;
      }
    }

    // 3. Validate File (Size, Extension, MIME type)
    const validation = validateFileUpload({
      eventUploadsEnabled: uploadsEnabled,
      fileSizeBytes: file.size,
      mimeType: file.type,
      filename: file.name,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 4. Read File Buffer & Save Server-Side with Team Registration Code
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const artifact = await saveUploadedFile({
      teamId: team.id,
      regCode: team.regCode,
      editionId: team.editionId || editionId,
      eventId: eventId || undefined,
      originalName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
      fileBuffer: buffer,
      fileType,
    });

    return NextResponse.json({
      success: true,
      artifact,
      message: `File uploaded and stored as ${artifact.storedName}`,
    });
  } catch (error: any) {
    console.error("[Artifact Upload Error]", error);
    return NextResponse.json({ error: error.message || "Upload failed." }, { status: 500 });
  }
}
