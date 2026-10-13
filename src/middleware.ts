import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, toSessionContext, SESSION_COOKIE_NAME } from "./lib/auth";
import { canAccessRoute, canAccessApiRoute, isPublicPath, getAuthorizedRedirect } from "./lib/permissions";
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
    let rateKey = `${ip}:${pathname.split("/")[2] || "root"}`;

    if (pathname.startsWith("/api/auth")) {
      // The identity probe (`GET /api/auth/me`) fires on every page load to
      // paint the header. Give it its own generous budget so ordinary
      // navigation can never exhaust the strict brute-force budget that guards
      // login/register — otherwise the probe would 429 and the header would
      // silently render as if the visitor were signed out.
      if (pathname === "/api/auth/me") {
        rateKey = `${ip}:auth-me`;
      } else {
        tier = RATE_LIMIT_TIERS.AUTH;
      }
    } else if (pathname.startsWith("/api/evaluator")) {
      tier = RATE_LIMIT_TIERS.EVALUATOR;
    }

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
  // 2. REMEMBERED SESSION: SKIP THE LOGIN SCREEN
  // ----------------------------------------------------
  // A visitor whose auth cookie is still valid should never be shown the login
  // form again. Send them straight back into their dashboard — or to the page
  // they were originally trying to reach (the `from` param set on redirect).
  if (pathname === "/auth/login") {
    let existingToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!existingToken) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        existingToken = authHeader.substring(7);
      }
    }
    const existingSession = existingToken
      ? toSessionContext(await verifySessionToken(existingToken))
      : null;

    if (existingSession) {
      const requested = req.nextUrl.searchParams.get("from");
      const safeRequested =
        requested &&
        requested.startsWith("/") &&
        !requested.startsWith("//") &&
        !requested.includes("\\") &&
        !requested.startsWith("/auth/")
          ? requested
          : null;

      const landing =
        existingSession.globalRole === "SUPER_ADMIN" ||
        existingSession.editionRole === "SUPER_ADMIN"
          ? "/admin"
          : getAuthorizedRedirect(existingSession.editionRole);
      const destination = safeRequested ?? (landing.startsWith("/auth/") ? "/" : landing);

      return addSecurityHeaders(NextResponse.redirect(new URL(destination, req.url)));
    }
  }

  // ----------------------------------------------------
  // 3. PUBLIC ASSETS & WHITELISTED PATHS
  // ----------------------------------------------------
  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // ----------------------------------------------------
  // 4. SESSION TOKEN EXTRACTION & VERIFICATION
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
  // 5. ROLE & METHOD ACCESS AUTHORIZATION
  // ----------------------------------------------------
  const access = pathname.startsWith("/api/")
    ? canAccessApiRoute(sessionContext, pathname, req.method)
    : canAccessRoute(sessionContext, pathname, req.method);

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
    // Skip Next internals and any static file served from /public (images,
    // fonts, etc. — e.g. /Mascot.png, /logos/*.png) so assets are returned
    // directly instead of hitting the auth gate below.
    "/((?!_next/static|_next/image|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|txt|xml|webmanifest|woff2?|ttf|otf|eot|css|js|map)$).*)",
  ],
};
