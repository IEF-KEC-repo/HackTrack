// HackTrack Authentication & Session Management Library
// Supports invite-only user verification, password hashing, and JWT session handling.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserSessionContext, EditionRole, GlobalRole } from "./permissions";

const JWT_SECRET = process.env.AUTH_SECRET || "hacktrack-default-dev-secret-change-in-prod";
const TOKEN_EXPIRY = "7d";

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
export function signSessionToken(payload: Omit<SessionTokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verifies a session JWT and returns the parsed payload, or null if invalid/expired.
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionTokenPayload;
  } catch {
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
