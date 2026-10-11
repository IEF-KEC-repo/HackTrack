import { describe, it, expect } from "vitest";
import {
  canAccessRoute,
  getAuthorizedRedirect,
  isPublicPath,
  UserSessionContext,
} from "./permissions";

describe("HackTrack RBAC & Permission Matrix", () => {
  // Test Session Contexts
  const superAdminSession: UserSessionContext = {
    userId: "usr_admin",
    email: "superadmin@hacktrack.edu",
    globalRole: "SUPER_ADMIN",
    editionRole: "SUPER_ADMIN",
  };

  const coordManageSession: UserSessionContext = {
    userId: "usr_coord_manage",
    email: "coord.manage@hacktrack.edu",
    globalRole: "USER",
    editionRole: "COORDINATOR_MANAGE",
  };

  const coordViewSession: UserSessionContext = {
    userId: "usr_coord_view",
    email: "coord.view@hacktrack.edu",
    globalRole: "USER",
    editionRole: "COORDINATOR_VIEW",
  };

  const evaluatorSession: UserSessionContext = {
    userId: "usr_evaluator",
    email: "evaluator@hacktrack.edu",
    globalRole: "USER",
    editionRole: "EVALUATOR",
  };

  const mentorSession: UserSessionContext = {
    userId: "usr_mentor",
    email: "mentor@hacktrack.edu",
    globalRole: "USER",
    editionRole: "MENTOR",
  };

  const participantSession: UserSessionContext = {
    userId: "usr_participant",
    email: "lead@hacktrack.edu",
    globalRole: "USER",
    editionRole: "PARTICIPANT",
  };

  // ----------------------------------------------------
  // 1. PUBLIC PATHS
  // ----------------------------------------------------
  describe("Public Routes Access", () => {
    it("allows unauthenticated access to landing and auth pages", () => {
      expect(isPublicPath("/")).toBe(true);
      expect(isPublicPath("/auth/login")).toBe(true);
      expect(isPublicPath("/auth/register")).toBe(true);
      expect(isPublicPath("/auth/forgot-password")).toBe(true);
      expect(isPublicPath("/api/auth/login")).toBe(true);

      expect(canAccessRoute(null, "/")).toEqual({ allowed: true });
      expect(canAccessRoute(null, "/auth/login")).toEqual({ allowed: true });
    });

    it("blocks unauthenticated users from protected routes", () => {
      expect(canAccessRoute(null, "/admin")).toEqual({
        allowed: false,
        reason: "UNAUTHENTICATED",
      });
      expect(canAccessRoute(null, "/coordinator")).toEqual({
        allowed: false,
        reason: "UNAUTHENTICATED",
      });
      expect(canAccessRoute(null, "/evaluator")).toEqual({
        allowed: false,
        reason: "UNAUTHENTICATED",
      });
      expect(canAccessRoute(null, "/mentor")).toEqual({
        allowed: false,
        reason: "UNAUTHENTICATED",
      });
      expect(canAccessRoute(null, "/team")).toEqual({
        allowed: false,
        reason: "UNAUTHENTICATED",
      });
    });
  });

  // ----------------------------------------------------
  // 2. SUPER ADMIN
  // ----------------------------------------------------
  describe("Super Admin Permissions", () => {
    it("allows full access to all routes and mutation methods", () => {
      const routes = ["/admin", "/coordinator/manage", "/coordinator", "/evaluator", "/mentor", "/team"];
      const methods = ["GET", "POST", "PUT", "DELETE"];

      for (const route of routes) {
        for (const method of methods) {
          const res = canAccessRoute(superAdminSession, route, method);
          expect(res.allowed).toBe(true);
        }
      }
    });
  });

  // ----------------------------------------------------
  // 3. COORDINATOR (MANAGE)
  // ----------------------------------------------------
  describe("Coordinator (Manage) Permissions", () => {
    it("allows management operations and mutations on coordinator, team, evaluator, mentor routes", () => {
      expect(canAccessRoute(coordManageSession, "/coordinator/manage", "GET").allowed).toBe(true);
      expect(canAccessRoute(coordManageSession, "/coordinator/manage", "POST").allowed).toBe(true);
      expect(canAccessRoute(coordManageSession, "/coordinator", "GET").allowed).toBe(true);
      expect(canAccessRoute(coordManageSession, "/evaluator", "GET").allowed).toBe(true);
      expect(canAccessRoute(coordManageSession, "/team", "POST").allowed).toBe(true);
    });

    it("strictly blocks Coordinator (Manage) from Super Admin route", () => {
      const res = canAccessRoute(coordManageSession, "/admin", "GET");
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("ROLE_NOT_AUTHORIZED");
    });
  });

  // ----------------------------------------------------
  // 4. COORDINATOR (VIEW-ONLY) - CRITICAL WRITE-PROTECTION
  // ----------------------------------------------------
  describe("Coordinator (View-Only) Permissions & Mutation Blocking", () => {
    it("allows read-only access (GET) to coordinator and team dashboards", () => {
      expect(canAccessRoute(coordViewSession, "/coordinator", "GET").allowed).toBe(true);
      expect(canAccessRoute(coordViewSession, "/team", "GET").allowed).toBe(true);
    });

    it("strictly blocks Coordinator (View-Only) from ALL mutations (POST, PUT, PATCH, DELETE)", () => {
      const mutationMethods = ["POST", "PUT", "PATCH", "DELETE"];

      for (const method of mutationMethods) {
        const res = canAccessRoute(coordViewSession, "/coordinator", method);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe("COORDINATOR_VIEW_WRITE_BLOCKED");
      }

      for (const method of mutationMethods) {
        const res = canAccessRoute(coordViewSession, "/team", method);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe("COORDINATOR_VIEW_WRITE_BLOCKED");
      }
    });

    it("blocks Coordinator (View-Only) from manage and admin routes", () => {
      expect(canAccessRoute(coordViewSession, "/coordinator/manage", "GET").allowed).toBe(false);
      expect(canAccessRoute(coordViewSession, "/admin", "GET").allowed).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 5. EVALUATOR
  // ----------------------------------------------------
  describe("Evaluator Permissions", () => {
    it("allows access to evaluator cockpit and scoring mutations", () => {
      expect(canAccessRoute(evaluatorSession, "/evaluator", "GET").allowed).toBe(true);
      expect(canAccessRoute(evaluatorSession, "/evaluator", "POST").allowed).toBe(true);
    });

    it("blocks Evaluator from coordinator, admin, mentor routes", () => {
      expect(canAccessRoute(evaluatorSession, "/coordinator", "GET").allowed).toBe(false);
      expect(canAccessRoute(evaluatorSession, "/coordinator/manage", "GET").allowed).toBe(false);
      expect(canAccessRoute(evaluatorSession, "/admin", "GET").allowed).toBe(false);
      expect(canAccessRoute(evaluatorSession, "/mentor", "GET").allowed).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 6. MENTOR
  // ----------------------------------------------------
  describe("Mentor Permissions", () => {
    it("allows access to mentor workspace and check-in logging", () => {
      expect(canAccessRoute(mentorSession, "/mentor", "GET").allowed).toBe(true);
      expect(canAccessRoute(mentorSession, "/mentor", "POST").allowed).toBe(true);
    });

    it("blocks Mentor from evaluator scoring and coordinator consoles", () => {
      expect(canAccessRoute(mentorSession, "/evaluator", "GET").allowed).toBe(false);
      expect(canAccessRoute(mentorSession, "/coordinator", "GET").allowed).toBe(false);
      expect(canAccessRoute(mentorSession, "/admin", "GET").allowed).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 7. PARTICIPANT
  // ----------------------------------------------------
  describe("Participant Permissions", () => {
    it("allows access to the team portal", () => {
      expect(canAccessRoute(participantSession, "/team", "GET").allowed).toBe(true);
      expect(canAccessRoute(participantSession, "/team", "POST").allowed).toBe(true);
    });

    it("blocks Participant from all staff routes", () => {
      expect(canAccessRoute(participantSession, "/coordinator", "GET").allowed).toBe(false);
      expect(canAccessRoute(participantSession, "/evaluator", "GET").allowed).toBe(false);
      expect(canAccessRoute(participantSession, "/mentor", "GET").allowed).toBe(false);
      expect(canAccessRoute(participantSession, "/admin", "GET").allowed).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 8. ROLE REDIRECTS
  // ----------------------------------------------------
  describe("Default Role Redirects", () => {
    it("routes each role to their designated default workspace", () => {
      expect(getAuthorizedRedirect("SUPER_ADMIN")).toBe("/admin");
      expect(getAuthorizedRedirect("COORDINATOR_MANAGE")).toBe("/coordinator/manage");
      expect(getAuthorizedRedirect("COORDINATOR_VIEW")).toBe("/coordinator");
      expect(getAuthorizedRedirect("EVALUATOR")).toBe("/evaluator");
      expect(getAuthorizedRedirect("MENTOR")).toBe("/mentor");
      expect(getAuthorizedRedirect("PARTICIPANT")).toBe("/team");
      expect(getAuthorizedRedirect(undefined)).toBe("/");
    });
  });
});
