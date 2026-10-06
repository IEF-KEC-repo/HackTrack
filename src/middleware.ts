import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "./lib/auth";
import { canAccessRoute, isPublicPath, getAuthorizedRedirect } from "./lib/permissions";
import { checkRateLimit, RATE_LIMIT_TIERS } from "./lib/services/rate-limiter";
import { logger } from "./lib/logger";

function addSecurityHeaders(res: NextResponse): NextResponse {
  // Prevent MIME-sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking while allowing embedded frames where needed
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  // Cross-site scripting filter
  res.headers.set("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Feature permissions policy
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.ip || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // ----------------------------------------------------
  // 1. RATE LIMITING ON SENSITIVE ENDPOINTS
  // ----------------------------------------------------
  if (pathname.startsWith("/api/")) {
    let tier = RATE_LIMIT_TIERS.GENERAL;

    if (pathname.startsWith("/api/auth")) {
      tier = RATE_LIMIT_TIERS.AUTH;
    } else if (pathname.startsWith("/api/artifacts/upload")) {
      tier = RATE_LIMIT_TIERS.UPLOAD;
    } else if (pathname.startsWith("/api/evaluator")) {
      tier = RATE_LIMIT_TIERS.EVALUATOR;
    }

    const rateKey = `${ip}:${pathname.split("/")[2] || "root"}`;
    const rateCheck = checkRateLimit(rateKey, tier);

    if (!rateCheck.allowed) {
      logger.security("Rate limit threshold exceeded", {
        ip,
        endpoint: pathname,
        details: { maxRequests: tier.maxRequests, windowMs: tier.windowMs },
      });

      const response = NextResponse.json(
        {
          error: "Too many requests. Please slow down and try again later.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfterSeconds: Math.ceil(rateCheck.resetMs / 1000),
        },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(Math.ceil(rateCheck.resetMs / 1000)));
      return addSecurityHeaders(response);
    }
  }

  // ----------------------------------------------------
  // 2. PUBLIC ASSETS & WHITELISTED PATHS
  // ----------------------------------------------------
  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // ----------------------------------------------------
  // 3. SESSION TOKEN EXTRACTION & VERIFICATION
  // ----------------------------------------------------
  let token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  const payload = token ? await verifySessionToken(token) : null;
  const sessionContext = toSessionContext(payload);

  // ----------------------------------------------------
  // 4. ROLE & METHOD ACCESS AUTHORIZATION
  // ----------------------------------------------------
  const access = canAccessRoute(sessionContext, pathname, req.method);

  if (!access.allowed) {
    logger.security("Access denied by authorization policy", {
      ip,
      endpoint: pathname,
      userId: sessionContext?.userId,
      role: sessionContext?.editionRole,
      details: { reason: access.reason, method: req.method },
    });

    // API endpoint response
    if (pathname.startsWith("/api/")) {
      const statusCode = access.reason === "UNAUTHENTICATED" ? 401 : 403;
      const res = NextResponse.json(
        {
          error: access.reason === "UNAUTHENTICATED" ? "Authentication required" : "Forbidden",
          reason: access.reason,
        },
        { status: statusCode }
      );
      return addSecurityHeaders(res);
    }

    // Page navigation response: unauthenticated redirect
    if (access.reason === "UNAUTHENTICATED") {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }

    // Role unauthorized -> redirect to authorized landing
    if (sessionContext?.editionRole) {
      const fallbackUrl = new URL(getAuthorizedRedirect(sessionContext.editionRole), req.url);
      return addSecurityHeaders(NextResponse.redirect(fallbackUrl));
    }

    return addSecurityHeaders(NextResponse.redirect(new URL("/auth/login", req.url)));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
