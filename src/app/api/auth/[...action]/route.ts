import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  verifySessionToken,
} from "@/lib/auth";
import { getAuthorizedRedirect } from "@/lib/permissions";
import {
  registerTeamLead,
  validateTeamLeadRegistration,
  RegistrationError,
} from "@/lib/services/registration-service";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  try {
    // ----------------------------------------------------
    // 1. LOGIN
    // ----------------------------------------------------
    if (action === "login") {
      const body = await req.json();
      const { email, password } = body;

      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: {
          memberships: {
            include: { edition: true },
            where: { edition: { status: "ACTIVE" } },
          },
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      // Resolve active edition membership role
      const activeMembership = user.memberships[0];
      const editionRole =
        user.globalRole === "SUPER_ADMIN"
          ? "SUPER_ADMIN"
          : activeMembership?.role || "PARTICIPANT";

      const token = await signSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
        editionId: activeMembership?.editionId,
        editionRole,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          globalRole: user.globalRole,
          editionRole,
        },
        redirectUrl: getAuthorizedRedirect(editionRole),
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
      return response;
    }

    // ----------------------------------------------------
    // 2. REGISTER WITH INVITE TOKEN (Invite-Only Registration)
    // ----------------------------------------------------
    if (action === "register-with-invite") {
      const body = await req.json();
      const { inviteToken, name, password } = body;

      if (!inviteToken || !name || !password) {
        return NextResponse.json(
          { error: "Invite token, name, and password are required" },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }

      // Check invitation validity
      const invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
        include: { edition: true },
      });

      if (!invitation) {
        return NextResponse.json(
          { error: "Invalid invitation token" },
          { status: 404 }
        );
      }

      if (invitation.acceptedAt) {
        return NextResponse.json(
          { error: "This invitation has already been accepted" },
          { status: 400 }
        );
      }

      if (new Date() > invitation.expiresAt) {
        return NextResponse.json(
          { error: "This invitation token has expired" },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(password);

      // Create or update user
      const user = await prisma.user.upsert({
        where: { email: invitation.email.toLowerCase() },
        update: {
          name,
          passwordHash,
          isVerified: true,
        },
        create: {
          email: invitation.email.toLowerCase(),
          name,
          passwordHash,
          isVerified: true,
        },
      });

      // Assign Edition Membership with pre-assigned role
      await prisma.editionMembership.upsert({
        where: {
          userId_editionId: {
            userId: user.id,
            editionId: invitation.editionId,
          },
        },
        update: { role: invitation.role },
        create: {
          userId: user.id,
          editionId: invitation.editionId,
          role: invitation.role,
        },
      });

      // Mark invitation accepted
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      // Auto-login newly registered user
      const token = await signSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
        editionId: invitation.editionId,
        editionRole: invitation.role,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          editionRole: invitation.role,
        },
        redirectUrl: getAuthorizedRedirect(invitation.role),
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
      return response;
    }

    // ----------------------------------------------------
    // 3. PUBLIC TEAM-LEAD SELF-REGISTRATION (no invite token)
    // ----------------------------------------------------
    if (action === "register-team") {
      const body = await req.json();
      const { teamName, name, email, password } = body;

      const validation = validateTeamLeadRegistration({
        teamName,
        name,
        email,
        password,
      });

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const result = await registerTeamLead({ teamName, name, email, password });

      const token = await signSessionToken({
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        globalRole: result.user.globalRole,
        editionId: result.editionId,
        editionRole: result.user.editionRole,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          editionRole: result.user.editionRole,
        },
        team: result.team,
        redirectUrl: result.redirectUrl,
      });

      response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
      return response;
    }

    // ----------------------------------------------------
    // 4. FORGOT PASSWORD (Generate Reset Token)
    // ----------------------------------------------------
    if (action === "forgot-password") {
      const { email } = await req.json();
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.passwordResetToken.create({
          data: {
            email: user.email,
            token,
            expiresAt,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "If your email is registered, you will receive password reset instructions.",
      });
    }

    // ----------------------------------------------------
    // 4. RESET PASSWORD
    // ----------------------------------------------------
    if (action === "reset-password") {
      const { token, newPassword } = await req.json();
      if (!token || !newPassword) {
        return NextResponse.json(
          { error: "Token and new password are required" },
          { status: 400 }
        );
      }

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
      });

      if (!resetToken || resetToken.expiresAt < new Date()) {
        return NextResponse.json(
          { error: "Invalid or expired reset token" },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { email: resetToken.email },
        data: { passwordHash },
      });

      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      return NextResponse.json({
        success: true,
        message: "Password updated successfully. Please log in.",
      });
    }

    // ----------------------------------------------------
    // 5. LOGOUT
    // ----------------------------------------------------
    if (action === "logout") {
      const response = NextResponse.json({ success: true });
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 404 });
  } catch (error: any) {
    if (error instanceof RegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(`Auth Error [${action}]:`, error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { action: string[] } }
) {
  const action = params.action?.[0];

  if (action === "me") {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: payload.userId,
        name: payload.name,
        email: payload.email,
        globalRole: payload.globalRole,
        editionId: payload.editionId,
        editionRole: payload.editionRole,
      },
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
