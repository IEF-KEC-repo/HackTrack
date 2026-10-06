import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs/promises";

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_EXTENSIONS = new Set(["pdf", "zip", "png", "jpg", "jpeg", "docx"]);

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * Pure function: Sanitizes client-provided filename.
 * Strips path traversal characters, special characters, replaces whitespace with underscores,
 * and truncates name to avoid filesystem errors.
 */
export function sanitizeFilename(originalName: string): {
  baseName: string;
  extension: string;
  sanitizedFilename: string;
} {
  if (!originalName || typeof originalName !== "string") {
    return {
      baseName: "file",
      extension: "bin",
      sanitizedFilename: "file.bin",
    };
  }

  // Remove any directory paths (both unix and windows)
  const basename = originalName.replace(/^.*[\\/]/, "");

  // Extract extension
  const lastDot = basename.lastIndexOf(".");
  let rawExt = "";
  let rawBase = basename;

  if (lastDot !== -1) {
    rawBase = basename.substring(0, lastDot);
    rawExt = basename.substring(lastDot + 1);
  }

  // Sanitize base: keep alphanumeric, underscore, and dash
  const cleanBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "attachment";

  // Sanitize ext: keep alphanumeric
  const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";

  return {
    baseName: cleanBase,
    extension: cleanExt,
    sanitizedFilename: `${cleanBase}.${cleanExt}`,
  };
}

/**
 * Pure function: Formats server-side stored filename.
 * Guarantees that the team registration code is ALWAYS prefixed and client path is completely discarded.
 * Example: "HT26-T001_circuit_diagram_1740000000000.pdf"
 */
export function generateServerStoredFilename(
  regCode: string,
  originalName: string,
  timestamp: number = Date.now()
): string {
  const cleanRegCode = (regCode || "TEAM").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const { baseName, extension } = sanitizeFilename(originalName);
  return `${cleanRegCode}_${baseName}_${timestamp}.${extension}`;
}

/**
 * Pure function: Validates an uploaded file against event settings, size limit, and allowed types.
 */
export function validateFileUpload(params: {
  eventUploadsEnabled: boolean;
  fileSizeBytes: number;
  mimeType: string;
  filename: string;
}): { valid: boolean; error?: string } {
  const { eventUploadsEnabled, fileSizeBytes, mimeType, filename } = params;

  if (!eventUploadsEnabled) {
    return {
      valid: false,
      error: "File uploads are not enabled for this event stage. Enable uploads in Coordinator Console.",
    };
  }

  if (fileSizeBytes <= 0) {
    return {
      valid: false,
      error: "Uploaded file is empty.",
    };
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 25MB maximum limit (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB provided).`,
    };
  }

  const { extension } = sanitizeFilename(filename);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: `Unsupported file extension .${extension}. Allowed extensions: ${Array.from(
        ALLOWED_EXTENSIONS
      ).join(", ")}.`,
    };
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: `Disallowed MIME type: ${mimeType}. Allowed: PDF, ZIP, PNG, JPG, DOCX.`,
    };
  }

  return { valid: true };
}

/**
 * Database & File Storage operation: Saves uploaded file and indexes in Artifact table.
 */
export async function saveUploadedFile(params: {
  teamId: string;
  regCode: string;
  editionId: string;
  eventId?: string;
  submissionId?: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileBuffer: Buffer;
  fileType?: string;
}) {
  const {
    teamId,
    regCode,
    editionId,
    submissionId,
    originalName,
    mimeType,
    fileSizeBytes,
    fileBuffer,
    fileType = "MILESTONE_EVIDENCE",
  } = params;

  // 1. Generate collision-proof server filename
  const storedName = generateServerStoredFilename(regCode, originalName);

  // 2. Local uploads directory
  const uploadsDir = path.join(process.cwd(), "public", "uploads", editionId);
  await fs.mkdir(uploadsDir, { recursive: true });

  const filePath = path.join(uploadsDir, storedName);
  await fs.writeFile(filePath, fileBuffer);

  const fileUrl = `/uploads/${editionId}/${storedName}`;

  // 3. Persist in database
  const artifact = await prisma.artifact.create({
    data: {
      teamId,
      submissionId,
      fileType,
      originalName,
      storedName,
      fileUrl,
      fileSize: fileSizeBytes,
      mimeType,
    },
  });

  return artifact;
}
