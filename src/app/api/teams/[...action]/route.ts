import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "@/lib/auth";
import {
  createTeam,
  sendTeamInvite,
  respondToTeamInvite,
  transferTeamLead,
  checkDuplicateTitle,
} from "@/lib/services/team-service";
import {
  submitIdeaStepOne,
  submitIdeaStepTwo,
  withdrawSubmission,
} from "@/lib/services/idea-submission-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    // ----------------------------------------------------
    // ACTION: CREATE TEAM (1 to 6 members, solo allowed)
    // ----------------------------------------------------
    if (action === "create") {
      const body = await req.json();
      const { editionId, name, track, problemStatement, solutionAbstract, slidesUrl } = body;

      if (!editionId || !name) {
        return NextResponse.json({ error: "editionId and team name required" }, { status: 400 });
      }

      const team = await createTeam({
        editionId,
        creatorUserId: session.userId,
        name,
        track,
        problemStatement,
        solutionAbstract,
        slidesUrl,
      });

      return NextResponse.json({ success: true, team });
    }

    // ----------------------------------------------------
    // ACTION: SEND TEAM EMAIL INVITE
    // ----------------------------------------------------
    if (action === "invite") {
      const body = await req.json();
      const { teamId, email, role } = body;

      if (!teamId || !email) {
        return NextResponse.json({ error: "teamId and email required" }, { status: 400 });
      }

      const invite = await sendTeamInvite({
        teamId,
        requesterUserId: session.userId,
        email,
        role,
      });

      return NextResponse.json({ success: true, invite });
    }

    // ----------------------------------------------------
    // ACTION: RESPOND TO TEAM INVITE (ACCEPT / DECLINE)
    // ----------------------------------------------------
    if (action === "respond-invite") {
      const body = await req.json();
      const { inviteToken, decision } = body;

      if (!inviteToken || !["ACCEPT", "DECLINE"].includes(decision)) {
        return NextResponse.json({ error: "inviteToken and valid decision required" }, { status: 400 });
      }

      const result = await respondToTeamInvite({
        inviteToken,
        userId: session.userId,
        userEmail: session.email,
        action: decision,
      });

      return NextResponse.json({ success: true, result });
    }

    // ----------------------------------------------------
    // ACTION: TRANSFER TEAM LEAD
    // ----------------------------------------------------
    if (action === "transfer-lead") {
      const body = await req.json();
      const { teamId, newLeadId } = body;

      if (!teamId || !newLeadId) {
        return NextResponse.json({ error: "teamId and newLeadId required" }, { status: 400 });
      }

      const result = await transferTeamLead({
        teamId,
        currentLeadId: session.userId,
        newLeadId,
      });

      return NextResponse.json({ success: true, result });
    }

    // ----------------------------------------------------
    // ACTION: SUBMIT STEP 1 (Short Idea Form)
    // ----------------------------------------------------
    if (action === "submit-step1") {
      const body = await req.json();
      const { teamId, data } = body;

      if (!teamId || !data) {
        return NextResponse.json({ error: "teamId and idea data required" }, { status: 400 });
      }

      const team = await submitIdeaStepOne({
        teamId,
        userId: session.userId,
        data,
      });

      return NextResponse.json({ success: true, team });
    }

    // ----------------------------------------------------
    // ACTION: SUBMIT STEP 2 (Detailed Shortlisted Form)
    // ----------------------------------------------------
    if (action === "submit-step2") {
      const body = await req.json();
      const { teamId, data } = body;

      if (!teamId || !data) {
        return NextResponse.json({ error: "teamId and detailed data required" }, { status: 400 });
      }

      const team = await submitIdeaStepTwo({
        teamId,
        userId: session.userId,
        data,
      });

      return NextResponse.json({ success: true, team });
    }

    // ----------------------------------------------------
    // ACTION: WITHDRAW SUBMISSION
    // ----------------------------------------------------
    if (action === "withdraw") {
      const body = await req.json();
      const { teamId } = body;

      if (!teamId) {
        return NextResponse.json({ error: "teamId required" }, { status: 400 });
      }

      const team = await withdrawSubmission({
        teamId,
        userId: session.userId,
      });

      return NextResponse.json({ success: true, team });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 404 });
  } catch (error: any) {
    console.error(`Teams API Error [${action}]:`, error);
    return NextResponse.json({ error: error.message || "Operation failed" }, { status: 400 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifySessionToken(token) : null;
  const session = toSessionContext(payload);

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    // ----------------------------------------------------
    // CHECK DUPLICATE TITLE
    // ----------------------------------------------------
    if (action === "check-duplicate") {
      const editionId = req.nextUrl.searchParams.get("editionId") || "";
      const title = req.nextUrl.searchParams.get("title") || "";
      const excludeTeamId = req.nextUrl.searchParams.get("excludeTeamId") || undefined;

      const result = await checkDuplicateTitle({ editionId, title, excludeTeamId });
      return NextResponse.json(result);
    }

    // ----------------------------------------------------
    // GET CURRENT USER'S TEAM
    // ----------------------------------------------------
    if (action === "my-team") {
      const editionSlug = req.nextUrl.searchParams.get("editionSlug") || "ht26";

      const member = await prisma.teamMember.findFirst({
        where: {
          userId: session.userId,
          team: { edition: { slug: editionSlug } },
        },
        include: {
          team: {
            include: {
              edition: {
                include: {
                  events: {
                    where: { slug: "ideathon" },
                    select: { submissionDeadline: true, status: true },
                  },
                },
              },
              members: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
              teamInvites: {
                where: { status: "PENDING" },
              },
            },
          },
        },
      });

      // Also check if current user has pending team invites
      const pendingInvitesForUser = await prisma.teamInvite.findMany({
        where: {
          email: session.email.toLowerCase(),
          status: "PENDING",
        },
        include: {
          team: { select: { id: true, name: true, regCode: true, track: true } },
        },
      });

      return NextResponse.json({
        team: member?.team || null,
        myRole: member?.role || null,
        pendingInvites: pendingInvitesForUser,
      });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
