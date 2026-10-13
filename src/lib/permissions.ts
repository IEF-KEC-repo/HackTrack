// HackTrack Role-Based Access Control (RBAC) Permission Matrix
// Fully typed, declarative permission verification with method-level write protection.

export type GlobalRole = "USER" | "SUPER_ADMIN";

export type EditionRole =
  | "SUPER_ADMIN"
  | "COORDINATOR_MANAGE"
  | "COORDINATOR_VIEW"
  | "EVALUATOR"
  | "MENTOR"
  | "PARTICIPANT";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface UserSessionContext {
  userId: string;
  email: string;
  globalRole: GlobalRole;
  editionId?: string;
  editionRole?: EditionRole;
}

export interface RouteRule {
  pattern: RegExp;
  allowedRoles: EditionRole[];
  allowMutationsFor?: EditionRole[]; // If specified, only these roles can POST/PUT/PATCH/DELETE
}

// ----------------------------------------------------
// ROUTE AUTHORIZATION TABLE (Pages)
// ----------------------------------------------------
export const ROUTE_RULES: RouteRule[] = [
  // Super Admin Zone
  {
    pattern: /^\/admin(\/.*)?$/,
    allowedRoles: ["SUPER_ADMIN"],
    allowMutationsFor: ["SUPER_ADMIN"],
  },
  // Coordinator Management Zone (CRUD, Allocations, Normalization)
  {
    pattern: /^\/coordinator\/manage(\/.*)?$/,
    allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE"],
    allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE"],
  },
  // Coordinator General & View Zone (Overview, Rosters, Scores, Export)
  {
    pattern: /^\/coordinator(\/.*)?$/,
    allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW"],
    allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE"], // Note: COORDINATOR_VIEW excluded!
  },
  // Evaluator Zone (Cockpit, Rubric Scoring, Deck Preview)
  {
    pattern: /^\/evaluator(\/.*)?$/,
    allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "EVALUATOR"],
    allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "EVALUATOR"],
  },
  // Mentor Zone (Assigned Teams, Milestone Board, Check-in Logging)
  {
    pattern: /^\/mentor(\/.*)?$/,
    allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "MENTOR"],
    allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "MENTOR"],
  },
  // Participant Team Zone (Profile, Deck URL, Milestones)
  {
    pattern: /^\/team(\/.*)?$/,
    allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "PARTICIPANT"],
    allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "PARTICIPANT"], // COORDINATOR_VIEW read-only
  },
  // Results page is linked from participant progress and should be readable by authenticated users
  {
    pattern: /^\/results(\/.*)?$/,
    allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "EVALUATOR", "MENTOR", "PARTICIPANT"],
    allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE"],
  },
];

// Public paths that do not require an active session
export const PUBLIC_PATHS = [
  /^\/$/,
  /^\/auth\/login(\/.*)?$/,
  /^\/auth\/register(\/.*)?$/,
  /^\/auth\/forgot-password(\/.*)?$/,
  /^\/auth\/reset-password(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/public(\/.*)?$/,
  /^\/api\/health$/,
  /^\/api\/cron\/reminders$/,
  /^\/api\/cron\/milestone-alerts$/,
  /^\/_next(\/.*)?$/,
  /^\/favicon\.ico$/,
  /^\/public(\/.*)?$/,
];

/**
 * Checks if a route path is public.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

/**
 * Validates whether a given user session can access a route path with an HTTP method.
 */
export function canAccessRoute(
  session: UserSessionContext | null,
  pathname: string,
  method: string = "GET"
): { allowed: boolean; reason?: string } {
  // 1. Allow public paths without session
  if (isPublicPath(pathname)) {
    return { allowed: true };
  }

  // 2. Reject unauthenticated users for protected paths
  if (!session) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  // 3. Super Admin global bypass
  if (session.globalRole === "SUPER_ADMIN" || session.editionRole === "SUPER_ADMIN") {
    return { allowed: true };
  }

  const role = session.editionRole;
  if (!role) {
    return { allowed: false, reason: "NO_EDITION_MEMBERSHIP" };
  }

  // 4. Find matching route rule
  const matchedRule = ROUTE_RULES.find((rule) => rule.pattern.test(pathname));
  if (!matchedRule) {
    // If route is not explicitly protected, authenticated users can read, but mutations require manage rights
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
    if (isMutation && role === "COORDINATOR_VIEW") {
      return { allowed: false, reason: "VIEW_ONLY_MUTATION_DENIED" };
    }
    return { allowed: true };
  }

  // 5. Check if role is allowed on this route
  if (!matchedRule.allowedRoles.includes(role)) {
    return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };
  }

  // 6. Check HTTP mutation permissions
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  if (isMutation) {
    if (role === "COORDINATOR_VIEW") {
      return { allowed: false, reason: "COORDINATOR_VIEW_WRITE_BLOCKED" };
    }
    if (matchedRule.allowMutationsFor && !matchedRule.allowMutationsFor.includes(role)) {
      return { allowed: false, reason: "MUTATION_NOT_PERMITTED_FOR_ROLE" };
    }
  }

  return { allowed: true };
}

/**
 * Helper to determine default landing page redirect based on assigned role.
 */
export function getAuthorizedRedirect(role?: EditionRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin";
    case "COORDINATOR_MANAGE":
      return "/coordinator";
    case "COORDINATOR_VIEW":
      return "/coordinator";
    case "EVALUATOR":
      return "/evaluator";
    case "MENTOR":
      return "/mentor";
    case "PARTICIPANT":
      return "/team";
    default:
      return "/";
  }
}

/**
 * Helper to check if a role is allowed to mutate event/program configuration.
 * Only SUPER_ADMIN and COORDINATOR_MANAGE can mutate; COORDINATOR_VIEW and others cannot.
 */
// ----------------------------------------------------
// API ROUTE AUTHORIZATION RULES
// ----------------------------------------------------
export const API_ROUTE_RULES: RouteRule[] = [
  // Coordinator admin APIs
  { pattern: /^\/api\/coordinator(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE"] },
  // Evaluator APIs
  { pattern: /^\/api\/evaluator(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "EVALUATOR"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "EVALUATOR"] },
  // Mentor APIs
  { pattern: /^\/api\/mentor(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "MENTOR"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "MENTOR"] },
  // Teams/participant APIs
  { pattern: /^\/api\/teams(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "PARTICIPANT"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "PARTICIPANT"] },
  { pattern: /^\/api\/team(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "PARTICIPANT"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "PARTICIPANT"] },
  // Milestones
  { pattern: /^\/api\/milestones(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "PARTICIPANT", "MENTOR"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "PARTICIPANT", "MENTOR"] },
  // Announcements
  { pattern: /^\/api\/announcements(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "EVALUATOR", "MENTOR", "PARTICIPANT"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE"] },
  // Notifications
  { pattern: /^\/api\/notifications(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "EVALUATOR", "MENTOR", "PARTICIPANT"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "EVALUATOR", "MENTOR", "PARTICIPANT"] },
  // Export (GET only) - exports must stay readable by any authenticated user per blueprint findings
  { pattern: /^\/api\/export(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "EVALUATOR", "MENTOR", "PARTICIPANT"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE"] },
  // Leaderboard
  { pattern: /^\/api\/leaderboard(\/.*)?$/, allowedRoles: ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW", "EVALUATOR", "MENTOR", "PARTICIPANT"], allowMutationsFor: ["SUPER_ADMIN", "COORDINATOR_MANAGE"] },
];

export function canAccessApiRoute(
  session: UserSessionContext | null,
  pathname: string,
  method: string = "GET"
): { allowed: boolean; reason?: string } {
  // Public API paths
  if (
    /^\/api\/auth(\/.*)?$/.test(pathname) ||
    /^\/api\/public(\/.*)?$/.test(pathname) ||
    /^\/api\/health$/.test(pathname) ||
    /^\/api\/cron\/reminders$/.test(pathname) ||
    /^\/api\/cron\/milestone-alerts$/.test(pathname)
  ) {
    return { allowed: true };
  }

  if (!session) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  if (session.globalRole === "SUPER_ADMIN" || session.editionRole === "SUPER_ADMIN") {
    return { allowed: true };
  }

  const role = session.editionRole;
  if (!role) {
    return { allowed: false, reason: "NO_EDITION_MEMBERSHIP" };
  }

  const matchedRule = API_ROUTE_RULES.find((rule) => rule.pattern.test(pathname));
  if (!matchedRule) {
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
    if (isMutation && role === "COORDINATOR_VIEW") {
      return { allowed: false, reason: "COORDINATOR_VIEW_WRITE_BLOCKED" };
    }
    return { allowed: true };
  }

  if (!matchedRule.allowedRoles.includes(role)) {
    return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };
  }

  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  if (isMutation) {
    if (role === "COORDINATOR_VIEW") {
      return { allowed: false, reason: "COORDINATOR_VIEW_WRITE_BLOCKED" };
    }
    if (matchedRule.allowMutationsFor && !matchedRule.allowMutationsFor.includes(role)) {
      return { allowed: false, reason: "MUTATION_NOT_PERMITTED_FOR_ROLE" };
    }
  }

  return { allowed: true };
}

export function canMutateEventConfig(role?: EditionRole | string | null): boolean {
  return role === "SUPER_ADMIN" || role === "COORDINATOR_MANAGE";
}

