import { prisma } from "@/lib/prisma";
import { EditionRole } from "@prisma/client";
import crypto from "crypto";
import { recordAuditLog } from "./audit-service";

export interface ParsedCsvRow {
  row: number;
  email: string;
  name: string;
  role: EditionRole;
  teamName?: string;
}

export interface CsvImportError {
  row: number;
  email: string;
  field: string;
  reason: string;
}

export interface CsvImportReport {
  totalRows: number;
  validCount: number;
  errorCount: number;
  skippedDuplicates: number;
  createdInvitationsCount: number;
  errors: CsvImportError[];
  createdTokens: Array<{ email: string; role: EditionRole; token: string }>;
}

const VALID_ROLES = new Set<string>([
  "PARTICIPANT",
  "MENTOR",
  "EVALUATOR",
  "COORDINATOR_VIEW",
  "COORDINATOR_MANAGE",
  "SUPER_ADMIN",
]);

/**
 * Parses raw CSV text and normalizes column headers.
 */
export function parseCsvText(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Helper for comma separation supporting quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

/**
 * Validates parsed CSV rows and isolates validation errors.
 */
export function validateCsvRows(headers: string[], rows: string[][]): {
  validRows: ParsedCsvRow[];
  errors: CsvImportError[];
} {
  const emailIdx = headers.findIndex((h) => h.includes("email"));
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const roleIdx = headers.findIndex((h) => h.includes("role"));
  const teamIdx = headers.findIndex((h) => h.includes("team"));

  const errors: CsvImportError[] = [];
  const validRows: ParsedCsvRow[] = [];
  const seenEmails = new Set<string>();

  if (emailIdx === -1) {
    errors.push({
      row: 1,
      email: "N/A",
      field: "header",
      reason: "Missing mandatory 'email' column header.",
    });
    return { validRows, errors };
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  rows.forEach((cols, idx) => {
    const rowNum = idx + 2; // Row 1 is header
    const rawEmail = cols[emailIdx]?.trim() || "";
    const rawName = nameIdx !== -1 ? cols[nameIdx]?.trim() : "";
    const rawRole = roleIdx !== -1 ? cols[roleIdx]?.trim().toUpperCase().replace(/\s+/g, "_") : "PARTICIPANT";
    const teamName = teamIdx !== -1 ? cols[teamIdx]?.trim() : undefined;

    // Validate Email
    if (!rawEmail) {
      errors.push({ row: rowNum, email: "EMPTY", field: "email", reason: "Email is required." });
      return;
    }

    if (!EMAIL_REGEX.test(rawEmail)) {
      errors.push({
        row: rowNum,
        email: rawEmail,
        field: "email",
        reason: "Invalid email format.",
      });
      return;
    }

    const emailLower = rawEmail.toLowerCase();
    if (seenEmails.has(emailLower)) {
      errors.push({
        row: rowNum,
        email: rawEmail,
        field: "email",
        reason: "Duplicate email within pasted CSV file.",
      });
      return;
    }
    seenEmails.add(emailLower);

    // Validate Name
    if (!rawName) {
      errors.push({ row: rowNum, email: rawEmail, field: "name", reason: "Name cannot be empty." });
      return;
    }

    // Validate Role
    let role = rawRole as EditionRole;
    if (rawRole === "COORDINATOR") role = "COORDINATOR_VIEW"; // Default fallback
    if (!VALID_ROLES.has(role)) {
      errors.push({
        row: rowNum,
        email: rawEmail,
        field: "role",
        reason: `Unrecognized role "${rawRole}". Allowed: PARTICIPANT, MENTOR, EVALUATOR, COORDINATOR_VIEW, COORDINATOR_MANAGE.`,
      });
      return;
    }

    validRows.push({
      row: rowNum,
      email: emailLower,
      name: rawName,
      role,
      teamName,
    });
  });

  return { validRows, errors };
}

/**
 * Executes batch user invitations from validated CSV rows.
 */
export async function executeBulkUserImport(params: {
  editionId: string;
  csvContent: string;
  actorId: string;
}): Promise<CsvImportReport> {
  const { editionId, csvContent, actorId } = params;
  const { headers, rows } = parseCsvText(csvContent);
  const { validRows, errors } = validateCsvRows(headers, rows);

  const existingInvitations = await prisma.invitation.findMany({
    where: { editionId },
    select: { email: true },
  });
  const existingInvitedEmails = new Set(existingInvitations.map((i) => i.email.toLowerCase()));

  const createdTokens: Array<{ email: string; role: EditionRole; token: string }> = [];
  let skippedDuplicates = 0;

  // Process valid rows in chunks of 100 to optimize throughput
  const CHUNK_SIZE = 100;
  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(async (tx) => {
      for (const item of chunk) {
        if (existingInvitedEmails.has(item.email)) {
          skippedDuplicates++;
          continue;
        }

        const token = `inv_${crypto.randomBytes(24).toString("hex")}`;
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

        await tx.invitation.create({
          data: {
            editionId,
            email: item.email,
            role: item.role,
            token,
            expiresAt,
            invitedById: actorId,
          },
        });

        existingInvitedEmails.add(item.email);
        createdTokens.push({ email: item.email, role: item.role, token });
      }
    });
  }

  await recordAuditLog({
    editionId,
    actorId,
    action: "CSV_BULK_USERS_IMPORTED",
    entityType: "Invitation",
    entityId: editionId,
    newState: {
      totalRows: rows.length,
      validRows: validRows.length,
      createdInvitations: createdTokens.length,
      skippedDuplicates,
      errorCount: errors.length,
    },
  });

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    errorCount: errors.length,
    skippedDuplicates,
    createdInvitationsCount: createdTokens.length,
    errors,
    createdTokens,
  };
}
