import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createTeam } from "./team-service";
import type { GlobalRole } from "@/lib/permissions";

/**
 * Public Team-Lead self-registration (no invitation token required).
 *
 * A first-time Team Lead signs up with their own name/email/password plus a
 * team name. In one step we create the account, create the team with the user
 * as LEAD (reusing the canonical `createTeam` logic — permanent registration
 * code included), and mint a real session. Staff roles (Coordinator/Evaluator/
 * Mentor) and additional team members still go through the invite-only path.
 */

/**
 * Event operational states in which new teams may still register for the
 * edition. Registration closes once the edition's first/registration event
 * moves past these states (submissions locked, evaluating, or completed),
 * mirroring the event-gate playbook (docs/04_EVENT_GATE_PLAYBOOK.md §2.1).
 *
 * The event status is the operational source of truth: a Coordinator flips the
 * event to `SUBMISSION_LOCKED`/`COMPLETED` after the deadline passes, which
 * closes public registration.
 */
export const REGISTRATION_OPEN_EVENT_STATUSES = [
  "UPCOMING",
  "REGISTRATION_OPEN",
  "SUBMISSION_OPEN",
] as const;

export function isRegistrationOpenForEventStatus(
  status?: string | null
): boolean {
  if (!status) return false;
  return (REGISTRATION_OPEN_EVENT_STATUSES as readonly string[]).includes(status);
}

export type RegistrationWindowReason =
  | "NO_ACTIVE_EDITION"
  | "REGISTRATION_CLOSED"
  | null;

/**
 * Resolves the active edition and its first (registration) event, and reports
 * whether public Team-Lead self-registration is currently open.
 */
export async function getRegistrationWindow(): Promise<{
  edition: {
    id: string;
    name: string;
    slug: string;
    academicYear: string;
  } | null;
  registrationEvent: { id: string; name: string; status: string } | null;
  isOpen: boolean;
  reason: RegistrationWindowReason;
}> {
  const edition = await prisma.edition.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });

  if (!edition) {
    return {
      edition: null,
      registrationEvent: null,
      isOpen: false,
      reason: "NO_ACTIVE_EDITION",
    };
  }

  const registrationEvent = await prisma.event.findFirst({
    where: { editionId: edition.id },
    orderBy: { sequenceIndex: "asc" },
    select: { id: true, name: true, status: true },
  });

  const isOpen = isRegistrationOpenForEventStatus(registrationEvent?.status);

  return {
    edition: {
      id: edition.id,
      name: edition.name,
      slug: edition.slug,
      academicYear: edition.academicYear,
    },
    registrationEvent,
    isOpen,
    reason: isOpen ? null : "REGISTRATION_CLOSED",
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * HackTrack is a single-college event, so the open, unvetted public self-signup
 * path is restricted to the host institution's domain. Staff invites
 * (Coordinator/Evaluator/Mentor) and staff-issued participant invites are
 * vetted when they are issued, so they are deliberately exempt from this gate.
 */
export const ALLOWED_REGISTRATION_DOMAIN = "kongu.edu";

export const REGISTRATION_DOMAIN_ERROR =
  "Registration is open to kongu.edu email addresses only.";

/**
 * Returns true when the email's domain is exactly the allowed registration
 * domain (case-insensitive). Sub-domains such as `sub.kongu.edu` — and domains
 * that merely end in the allowed one, such as `kongu.edu.evil.com` — do not match.
 */
export function isAllowedRegistrationEmail(email: string): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex === -1) return false;
  return normalized.slice(atIndex + 1) === ALLOWED_REGISTRATION_DOMAIN;
}

export interface TeamLeadRegistrationInput {
  teamName: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Pure validation for the public registration form. Uses the same minimal
 * fields the existing registration schema already expects (team name + the
 * lead's own name/email/password) — no invented fields.
 */
export function validateTeamLeadRegistration(
  input: Partial<TeamLeadRegistrationInput>
): { valid: boolean; error?: string } {
  const teamName = (input.teamName ?? "").trim();
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  const password = input.password ?? "";

  if (teamName.length < 2) {
    return { valid: false, error: "Team name must be at least 2 characters long." };
  }
  if (name.length < 2) {
    return { valid: false, error: "Your full name is required." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: "A valid email address is required." };
  }
  if (!isAllowedRegistrationEmail(email)) {
    return { valid: false, error: REGISTRATION_DOMAIN_ERROR };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  return { valid: true };
}

/** Carries an HTTP status so the route can return 400/403/409 precisely. */
export class RegistrationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RegistrationError";
    this.status = status;
  }
}

export interface RegisteredTeamLead {
  user: {
    id: string;
    name: string;
    email: string;
    globalRole: GlobalRole;
    editionRole: "PARTICIPANT";
  };
  editionId: string;
  team: { id: string; name: string; regCode: string; status: string };
  redirectUrl: string;
}

/**
 * `createTeam` derives the registration code from the current team count, which
 * can collide under concurrent signups (two teams computed the same sequence).
 * Retry a few times on the unique-regCode constraint before surfacing the error.
 */
async function createTeamWithRetry(
  params: { editionId: string; creatorUserId: string; name: string },
  attempts = 5
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await createTeam(params);
    } catch (error: any) {
      lastError = error;
      // P2002 = unique constraint violation (regCode race under load).
      if (error?.code === "P2002") continue;
      throw error;
    }
  }
  throw lastError ?? new Error("Could not allocate a team registration code.");
}

/**
 * Creates a brand-new Team Lead account (real password + session) and their
 * team in a single step. If team creation fails, the freshly-created account is
 * rolled back so a partial signup can't orphan a user.
 */
export async function registerTeamLead(
  input: TeamLeadRegistrationInput
): Promise<RegisteredTeamLead> {
  const teamName = input.teamName.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  // Server-side domain gate at the account-creation boundary. The route already
  // validates the form, but enforcing it here too guarantees no caller can mint
  // a public participant account from a non-institutional address.
  if (!isAllowedRegistrationEmail(email)) {
    throw new RegistrationError(REGISTRATION_DOMAIN_ERROR, 400);
  }

  const window = await getRegistrationWindow();

  if (!window.edition) {
    throw new RegistrationError(
      "Registration is not open: no edition is currently published.",
      403
    );
  }

  if (!window.isOpen) {
    throw new RegistrationError(
      "Team registration is currently closed for this edition.",
      403
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new RegistrationError(
      "An account with this email already exists. Please sign in instead.",
      409
    );
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await prisma.user.create({
      data: { email, name, passwordHash, isVerified: true },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new RegistrationError(
        "An account with this email already exists. Please sign in instead.",
        409
      );
    }
    throw error;
  }

  try {
    await prisma.editionMembership.create({
      data: { userId: user.id, editionId: window.edition.id, role: "PARTICIPANT" },
    });

    const team = await createTeamWithRetry({
      editionId: window.edition.id,
      creatorUserId: user.id,
      name: teamName,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole as GlobalRole,
        editionRole: "PARTICIPANT",
      },
      editionId: window.edition.id,
      team: {
        id: team.id,
        name: team.name,
        regCode: team.regCode,
        status: team.status,
      },
      redirectUrl: "/team",
    };
  } catch (error) {
    // Roll back the account (cascades to the edition membership) so a failed
    // team creation cannot leave a half-registered user behind.
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    throw error;
  }
}
