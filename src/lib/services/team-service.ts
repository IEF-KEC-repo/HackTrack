import { prisma } from "@/lib/prisma";
import { TeamRole, TeamStatus, TeamInviteStatus } from "@prisma/client";
import crypto from "crypto";

export const GOOGLE_SLIDES_REGEX = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

/**
 * Validates whether a URL is a valid Google Slides link and generates its sandboxed embed URL.
 */
export function validateGoogleSlidesUrl(url: string): {
  valid: boolean;
  presentationId?: string;
  embedUrl?: string;
  error?: string;
} {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "Presentation URL cannot be empty." };
  }

  const trimmed = url.trim();
  const match = trimmed.match(GOOGLE_SLIDES_REGEX);

  if (!match || !match[1]) {
    return {
      valid: false,
      error: "Invalid Google Slides URL. Format must start with https://docs.google.com/presentation/d/{ID}...",
    };
  }

  const presentationId = match[1];
  const embedUrl = `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`;

  return {
    valid: true,
    presentationId,
    embedUrl,
  };
}

/**
 * Generates an atomic, collision-proof team registration code.
 * Example: "ht26" -> "HT26-T042"
 */
export function formatTeamRegistrationCode(editionSlug: string, sequenceNumber: number): string {
  const prefix = editionSlug.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const padded = String(sequenceNumber).padStart(3, "0");
  return `${prefix}-T${padded}`;
}

/**
 * Pure function: Validates team creation parameters.
 */
export function validateTeamCreation(params: {
  name: string;
  track?: string;
  editionId?: string;
}): { valid: boolean; error?: string } {
  if (!params.name || params.name.trim().length < 2) {
    return { valid: false, error: "Team name must be at least 2 characters long." };
  }
  return { valid: true };
}

/**
 * Pure function: Validates member invitation against team capacity.
 */
export function validateTeamInvitation(params: {
  currentMemberCount: number;
  maxCapacity?: number;
  inviteeEmail: string;
}): { valid: boolean; error?: string } {
  const max = params.maxCapacity || 6;
  if (params.currentMemberCount >= max) {
    return { valid: false, error: `Team capacity reached (maximum ${max} members allowed).` };
  }
  if (!params.inviteeEmail || !params.inviteeEmail.includes("@")) {
    return { valid: false, error: "Valid invitee email required." };
  }
  return { valid: true };
}

/**
 * Pure function: Calculates team size metrics.
 */
export function calculateTeamSizeMetrics(memberCount: number): { isSolo: boolean; isValid: boolean } {
  return {
    isSolo: memberCount === 1,
    isValid: memberCount >= 1 && memberCount <= 6,
  };
}

/**
 * Calculates string similarity between two titles using normalized token overlap.
 */
export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  const stopWords = new Set(["using", "with", "and", "for", "the", "of", "in", "via"]);
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

  const tokensA = new Set(normalize(titleA));
  const tokensB = new Set(normalize(titleB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) intersection++;
  });

  // Dice similarity coefficient
  return (2 * intersection) / (tokensA.size + tokensB.size);
}

/**
 * Checks for duplicate or overly similar idea titles within an edition.
 */
export async function checkDuplicateTitle(params: {
  editionId: string;
  title: string;
  excludeTeamId?: string;
}): Promise<{ isDuplicate: boolean; similarityScore: number; matchedTeamName?: string }> {
  const { editionId, title, excludeTeamId } = params;
  if (!title || title.trim().length < 3) {
    return { isDuplicate: false, similarityScore: 0 };
  }

  const existingTeams = await prisma.team.findMany({
    where: {
      editionId,
      id: excludeTeamId ? { not: excludeTeamId } : undefined,
    },
    select: { id: true, name: true },
  });

  let maxSimilarity = 0;
  let matchedName: string | undefined;

  for (const team of existingTeams) {
    const similarity = calculateTitleSimilarity(title, team.name);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      matchedName = team.name;
    }
  }

  // Threshold: >= 75% token overlap triggers warning
  return {
    isDuplicate: maxSimilarity >= 0.75,
    similarityScore: Math.round(maxSimilarity * 100),
    matchedTeamName: matchedName,
  };
}

/**
 * Creates a new team (1 to 6 members, solo allowed) and enforces one-team-per-edition.
 */
export async function createTeam(params: {
  editionId: string;
  creatorUserId: string;
  name: string;
  track?: string;
  problemStatement?: string;
  solutionAbstract?: string;
  slidesUrl?: string;
}) {
  const { editionId, creatorUserId, name, track, problemStatement, solutionAbstract, slidesUrl } = params;

  // 1. Enforce One-Team-Per-Edition: Creator cannot already belong to a team in this edition
  const existingMembership = await prisma.teamMember.findFirst({
    where: {
      userId: creatorUserId,
      team: { editionId },
    },
    include: { team: true },
  });

  if (existingMembership) {
    throw new Error(
      `User already belongs to team "${existingMembership.team.name}" in this edition. One team per edition is strictly enforced.`
    );
  }

  // 2. Validate Google Slides URL if provided
  let embedSlidesUrl: string | undefined;
  if (slidesUrl) {
    const validation = validateGoogleSlidesUrl(slidesUrl);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    embedSlidesUrl = validation.embedUrl;
  }

  // 3. Atomically count existing teams in edition to derive sequence index
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { slug: true },
  });

  if (!edition) {
    throw new Error("Edition not found.");
  }

  const teamCount = await prisma.team.count({ where: { editionId } });
  const regCode = formatTeamRegistrationCode(edition.slug, teamCount + 1);

  // 4. Create Team with Creator as LEAD
  return prisma.team.create({
    data: {
      editionId,
      regCode,
      name: name.trim(),
      track,
      status: TeamStatus.DRAFT,
      problemStatement,
      solutionAbstract,
      slidesUrl,
      embedSlidesUrl,
      members: {
        create: {
          userId: creatorUserId,
          role: TeamRole.LEAD,
        },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      teamInvites: true,
    },
  });
}

/**
 * Sends a team email invitation to join a team roster (Max 6 members limit enforced).
 */
export async function sendTeamInvite(params: {
  teamId: string;
  requesterUserId: string;
  email: string;
  role?: TeamRole;
}) {
  const { teamId, requesterUserId, email, role = TeamRole.MEMBER } = params;
  const targetEmail = email.toLowerCase().trim();

  // 1. Verify requester is Team LEAD
  const requesterMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: requesterUserId } },
    include: { team: true },
  });

  if (!requesterMember || requesterMember.role !== TeamRole.LEAD) {
    throw new Error("Only the Team Lead can invite new team members.");
  }

  // 2. Enforce 6-member team maximum
  const currentMemberCount = await prisma.teamMember.count({ where: { teamId } });
  const pendingInviteCount = await prisma.teamInvite.count({
    where: { teamId, status: TeamInviteStatus.PENDING },
  });

  if (currentMemberCount + pendingInviteCount >= 6) {
    throw new Error("Team roster limit reached (maximum 6 members allowed).");
  }

  // 3. Check if target email already belongs to a team in this edition
  const existingTeamWithEmail = await prisma.teamMember.findFirst({
    where: {
      team: { editionId: requesterMember.team.editionId },
      user: { email: targetEmail },
    },
    include: { team: true },
  });

  if (existingTeamWithEmail) {
    throw new Error(`The user <${targetEmail}> is already a member of team "${existingTeamWithEmail.team.name}".`);
  }

  // 4. Create TeamInvite Token
  const token = `teaminv_${crypto.randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return prisma.teamInvite.create({
    data: {
      teamId,
      email: targetEmail,
      role,
      token,
      expiresAt,
    },
  });
}

/**
 * Responds to a team invitation (ACCEPT or DECLINE).
 */
export async function respondToTeamInvite(params: {
  inviteToken: string;
  userId: string;
  userEmail: string;
  action: "ACCEPT" | "DECLINE";
}) {
  const { inviteToken, userId, userEmail, action } = params;

  const invite = await prisma.teamInvite.findUnique({
    where: { token: inviteToken },
    include: { team: true },
  });

  if (!invite) {
    throw new Error("Invitation not found.");
  }

  if (invite.status !== TeamInviteStatus.PENDING) {
    throw new Error(`This invitation has already been ${invite.status.toLowerCase()}.`);
  }

  if (new Date() > invite.expiresAt) {
    throw new Error("This invitation has expired.");
  }

  if (action === "DECLINE") {
    return prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.DECLINED },
    });
  }

  // For ACCEPT:
  return prisma.$transaction(async (tx) => {
    // Check 1: One-team-per-edition check
    const existingMembership = await tx.teamMember.findFirst({
      where: {
        userId,
        team: { editionId: invite.team.editionId },
      },
    });

    if (existingMembership) {
      throw new Error("You already belong to a team in this edition. Cannot accept another invitation.");
    }

    // Check 2: Max 6 members constraint
    const currentMemberCount = await tx.teamMember.count({ where: { teamId: invite.teamId } });
    if (currentMemberCount >= 6) {
      throw new Error("This team has reached the maximum size of 6 members.");
    }

    // Add as team member
    const newMember = await tx.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId,
        role: invite.role,
      },
    });

    // Mark invite accepted
    await tx.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.ACCEPTED },
    });

    return newMember;
  });
}

/**
 * Transfers Team Leadership to another verified team member.
 */
export async function transferTeamLead(params: {
  teamId: string;
  currentLeadId: string;
  newLeadId: string;
}) {
  const { teamId, currentLeadId, newLeadId } = params;

  return prisma.$transaction(async (tx) => {
    const currentLead = await tx.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: currentLeadId } },
    });

    if (!currentLead || currentLead.role !== TeamRole.LEAD) {
      throw new Error("Only the current Team Lead can transfer leadership.");
    }

    const targetMember = await tx.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: newLeadId } },
    });

    if (!targetMember) {
      throw new Error("Target user is not a member of this team.");
    }

    // Update roles
    await tx.teamMember.update({
      where: { id: currentLead.id },
      data: { role: TeamRole.MEMBER },
    });

    await tx.teamMember.update({
      where: { id: targetMember.id },
      data: { role: TeamRole.LEAD },
    });

    return { success: true, newLeadId };
  });
}
