// HackTrack Authentication & Session Management Library
// Supports invite-only user verification, password hashing, and JWT session handling.

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { UserSessionContext, EditionRole, GlobalRole } from "./permissions";

const JWT_SECRET = process.env.AUTH_SECRET || "hacktrack-default-dev-secret-change-in-prod";
const TOKEN_EXPIRY = "7d";

const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface SessionTokenPayload {
  userId: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  editionId?: string;
  editionRole?: EditionRole;
  iat?: number;
  exp?: number;
}

/**
 * Hashes a plaintext password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compares plaintext password with stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Signs a session JWT payload.
 */
export async function signSessionToken(
  payload: Omit<SessionTokenPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey);
}

/**
 * Verifies a session JWT and returns the parsed payload, or null if invalid/expired.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionTokenPayload;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth] verifySessionToken failed:", (e as Error)?.message);
    }
    return null;
  }
}

/**
 * Converts a verified session payload to a UserSessionContext for permission checks.
 */
export function toSessionContext(payload: SessionTokenPayload | null): UserSessionContext | null {
  if (!payload) return null;
  return {
    userId: payload.userId,
    email: payload.email,
    globalRole: payload.globalRole,
    editionId: payload.editionId,
    editionRole: payload.editionRole,
  };
}

/**
 * Cookie configuration for session tokens.
 */
export const SESSION_COOKIE_NAME = "ht_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};
