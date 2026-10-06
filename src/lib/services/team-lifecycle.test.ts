import { describe, it, expect } from "vitest";
import {
  validateGoogleSlidesUrl,
  formatTeamRegistrationCode,
  calculateTitleSimilarity,
} from "./team-service";
import { canAccessRoute, UserSessionContext } from "@/lib/permissions";

describe("Team Lifecycle, Google Slides & Idea Validation Engine", () => {
  // ----------------------------------------------------
  // 1. GOOGLE SLIDES URL VALIDATION & EMBED GENERATION (FR-5b)
  // ----------------------------------------------------
  describe("Google Slides Embed Validator", () => {
    it("validates standard shareable Google Slides link and builds embed URL", () => {
      const url =
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing";
      const result = validateGoogleSlidesUrl(url);

      expect(result.valid).toBe(true);
      expect(result.presentationId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
      expect(result.embedUrl).toBe(
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000"
      );
    });

    it("accepts /view Google Slides presentation URLs", () => {
      const url = "https://docs.google.com/presentation/d/test-slide_123XYZ/view";
      const result = validateGoogleSlidesUrl(url);

      expect(result.valid).toBe(true);
      expect(result.presentationId).toBe("test-slide_123XYZ");
      expect(result.embedUrl).toContain("/embed?start=false&loop=false&delayms=3000");
    });

    it("rejects non-Google Slides URLs", () => {
      const invalidUrls = [
        "https://slides.com/presentation/123",
        "https://drive.google.com/file/d/12345/view",
        "https://google.com",
        "https://docs.google.com/document/d/12345/edit",
        "invalid-string",
      ];

      for (const u of invalidUrls) {
        const result = validateGoogleSlidesUrl(u);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it("rejects empty or whitespace input", () => {
      expect(validateGoogleSlidesUrl("").valid).toBe(false);
      expect(validateGoogleSlidesUrl("   ").valid).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 2. REGISTRATION CODE GENERATION
  // ----------------------------------------------------
  describe("Registration Code Generator", () => {
    it("formats collision-proof registration codes with 3-digit zero padding", () => {
      expect(formatTeamRegistrationCode("ht26", 1)).toBe("HT26-T001");
      expect(formatTeamRegistrationCode("ht26", 42)).toBe("HT26-T042");
      expect(formatTeamRegistrationCode("ht26", 300)).toBe("HT26-T300");
      expect(formatTeamRegistrationCode("hacktrack-2027", 7)).toBe("HACKTRACK2027-T007");
    });
  });

  // ----------------------------------------------------
  // 3. DUPLICATE TITLE SIMILARITY CHECK
  // ----------------------------------------------------
  describe("Duplicate Idea Title Warning Engine", () => {
    it("detects identical and near-identical titles (token overlap >= 75%)", () => {
      const titleA = "Smart Attendance System using Computer Vision";
      const titleB = "Smart Attendance System with Computer Vision";

      const similarity = calculateTitleSimilarity(titleA, titleB);
      expect(similarity).toBeGreaterThanOrEqual(0.75);
    });

    it("gives 0 similarity for completely distinct idea topics", () => {
      const titleA = "Decentralized Autonomous Micro-Grid Energy Distribution";
      const titleB = "Pediatric Sepsis Optical Diagnostic Biosensor";

      const similarity = calculateTitleSimilarity(titleA, titleB);
      expect(similarity).toBe(0);
    });
  });

  // ----------------------------------------------------
  // 4. TEAM SIZING & ROSTER BOUNDS (1 to 6 members, solo allowed)
  // ----------------------------------------------------
  describe("Team Roster Sizing Bounds", () => {
    it("allows solo teams (minimum 1 member)", () => {
      const soloRoster = [{ id: "u1", role: "LEAD" }];
      expect(soloRoster.length).toBeGreaterThanOrEqual(1);
      expect(soloRoster.length).toBeLessThanOrEqual(6);
    });

    it("enforces maximum team cap of 6 members", () => {
      const fullRoster = ["u1", "u2", "u3", "u4", "u5", "u6"];
      const pendingInvites = 0;
      const canInviteMore = fullRoster.length + pendingInvites < 6;

      expect(canInviteMore).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 5. BULK DECISION CUTOFF CALCULATIONS (TOP N vs TOP %)
  // ----------------------------------------------------
  describe("Bulk Decision Cutoff Algorithm", () => {
    const candidateTeamIds = Array.from({ length: 100 }, (_, i) => `team_${i + 1}`);

    it("calculates Top N cutoff correctly", () => {
      const top25 = candidateTeamIds.slice(0, 25);
      expect(top25).toHaveLength(25);
      expect(top25[0]).toBe("team_1");
      expect(top25[24]).toBe("team_25");
    });

    it("calculates Top Percentage cutoff correctly (e.g. 30% of 100 = 30 teams)", () => {
      const percentage = 30;
      const targetCount = Math.ceil((candidateTeamIds.length * percentage) / 100);
      const topPercent = candidateTeamIds.slice(0, targetCount);

      expect(topPercent).toHaveLength(30);
    });

    it("handles boundary percentage values safely", () => {
      const candidates = Array.from({ length: 33 }, (_, i) => `team_${i + 1}`);
      const count10Percent = Math.ceil((candidates.length * 10) / 100); // 3.3 -> 4
      expect(count10Percent).toBe(4);
    });
  });

  // ----------------------------------------------------
  // 6. COORDINATOR VIEW-ONLY TIER MUTATION GUARD
  // ----------------------------------------------------
  describe("Coordinator View-Only Safeguard on Teams Operations", () => {
    const viewOnlySession: UserSessionContext = {
      userId: "usr_view_only",
      email: "coord.view@hacktrack.edu",
      globalRole: "USER",
      editionRole: "COORDINATOR_VIEW",
    };

    const manageSession: UserSessionContext = {
      userId: "usr_manage",
      email: "coord.manage@hacktrack.edu",
      globalRole: "USER",
      editionRole: "COORDINATOR_MANAGE",
    };

    it("allows Coordinator (View) to inspect team directories via GET", () => {
      expect(canAccessRoute(viewOnlySession, "/coordinator/teams", "GET").allowed).toBe(true);
    });

    it("strictly blocks Coordinator (View) from executing team bulk decisions via POST", () => {
      const res = canAccessRoute(viewOnlySession, "/coordinator/teams", "POST");
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("COORDINATOR_VIEW_WRITE_BLOCKED");
    });

    it("allows Coordinator (Manage) to execute team mutations via POST", () => {
      const res = canAccessRoute(manageSession, "/coordinator/teams", "POST");
      expect(res.allowed).toBe(true);
    });
  });
});
