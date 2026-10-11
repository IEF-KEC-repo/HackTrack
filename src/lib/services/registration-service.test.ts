import { describe, it, expect } from "vitest";
import {
  isRegistrationOpenForEventStatus,
  validateTeamLeadRegistration,
  REGISTRATION_OPEN_EVENT_STATUSES,
} from "./registration-service";

describe("Public Team-Lead self-registration", () => {
  // ----------------------------------------------------
  // 1. DEADLINE / WINDOW GATE
  // ----------------------------------------------------
  describe("isRegistrationOpenForEventStatus", () => {
    it.each(["UPCOMING", "REGISTRATION_OPEN", "SUBMISSION_OPEN"])(
      "is open while the registration event is %s",
      (status) => {
        expect(isRegistrationOpenForEventStatus(status)).toBe(true);
      }
    );

    it.each([
      "SUBMISSION_LOCKED",
      "EVALUATION_ACTIVE",
      "EVALUATION_LOCKED",
      "COMPLETED",
    ])("is closed once the registration event is %s", (status) => {
      expect(isRegistrationOpenForEventStatus(status)).toBe(false);
    });

    it("is closed when there is no registration event at all", () => {
      expect(isRegistrationOpenForEventStatus(null)).toBe(false);
      expect(isRegistrationOpenForEventStatus(undefined)).toBe(false);
      expect(isRegistrationOpenForEventStatus("")).toBe(false);
    });

    it("exposes exactly the documented open states", () => {
      expect([...REGISTRATION_OPEN_EVENT_STATUSES]).toEqual([
        "UPCOMING",
        "REGISTRATION_OPEN",
        "SUBMISSION_OPEN",
      ]);
    });
  });

  // ----------------------------------------------------
  // 2. MINIMAL FORM VALIDATION (team name + lead name/email/password)
  // ----------------------------------------------------
  describe("validateTeamLeadRegistration", () => {
    const valid = {
      teamName: "QuantumForge",
      name: "Ada Lovelace",
      email: "ada@kongu.edu",
      password: "supersecret",
    };

    it("accepts a complete, valid signup using only the minimal fields", () => {
      expect(validateTeamLeadRegistration(valid)).toEqual({ valid: true });
    });

    it("does not require an invite token or any extra field", () => {
      const result = validateTeamLeadRegistration({
        teamName: "Solo Builder",
        name: "Grace Hopper",
        email: "grace@kongu.edu",
        password: "Password123!",
      });
      expect(result.valid).toBe(true);
    });

    it("rejects a team name that is too short", () => {
      const result = validateTeamLeadRegistration({ ...valid, teamName: "A" });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/team name/i);
    });

    it("rejects a blank lead name", () => {
      const result = validateTeamLeadRegistration({ ...valid, name: "   " });
      expect(result.valid).toBe(false);
    });

    it("rejects an invalid email", () => {
      const result = validateTeamLeadRegistration({
        ...valid,
        email: "not-an-email",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/email/i);
    });

    it("rejects a password shorter than 8 characters", () => {
      const result = validateTeamLeadRegistration({ ...valid, password: "short" });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/at least 8/i);
    });
  });
});
