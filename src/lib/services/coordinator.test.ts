import { describe, it, expect } from "vitest";
import {
  validateRubricCriteria,
  CriterionInput,
} from "./rubric-service";
import {
  parseCsvText,
  validateCsvRows,
} from "./csv-import-service";
import { canAccessRoute, UserSessionContext } from "@/lib/permissions";

describe("Coordinator Business Logic & Validation Engine", () => {
  // ----------------------------------------------------
  // 1. RUBRIC CRITERIA WEIGHT & ANCHOR VALIDATION
  // ----------------------------------------------------
  describe("Rubric Weight & Scale Anchor Validator", () => {
    it("approves criteria set summing to exactly 100.0%", () => {
      const criteria: CriterionInput[] = [
        {
          title: "Technical Feasibility",
          maxPoints: 30,
          weightPercentage: 30,
          sequenceOrder: 1,
          anchors: [
            { level: 1, label: "Poor", description: "Flawed logic" },
            { level: 3, label: "Good", description: "Solid architecture" },
            { level: 5, label: "Exemplary", description: "Production-ready" },
          ],
        },
        {
          title: "Innovation",
          maxPoints: 30,
          weightPercentage: 30,
          sequenceOrder: 2,
        },
        {
          title: "Impact & Problem",
          maxPoints: 20,
          weightPercentage: 20,
          sequenceOrder: 3,
        },
        {
          title: "Deck & Presentation",
          maxPoints: 20,
          weightPercentage: 20,
          sequenceOrder: 4,
        },
      ];

      const res = validateRubricCriteria(criteria);
      expect(res.valid).toBe(true);
      expect(res.totalWeight).toBe(100);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects criteria set summing to less than 100% (e.g. 90%)", () => {
      const criteria: CriterionInput[] = [
        { title: "Technical", maxPoints: 50, weightPercentage: 50, sequenceOrder: 1 },
        { title: "Innovation", maxPoints: 40, weightPercentage: 40, sequenceOrder: 2 },
      ];

      const res = validateRubricCriteria(criteria);
      expect(res.valid).toBe(false);
      expect(res.totalWeight).toBe(90);
      expect(res.errors[0]).toContain("must sum to exactly 100.0%");
    });

    it("rejects criteria set summing to more than 100% (e.g. 110%)", () => {
      const criteria: CriterionInput[] = [
        { title: "Criterion 1", maxPoints: 60, weightPercentage: 60, sequenceOrder: 1 },
        { title: "Criterion 2", maxPoints: 50, weightPercentage: 50, sequenceOrder: 2 },
      ];

      const res = validateRubricCriteria(criteria);
      expect(res.valid).toBe(false);
      expect(res.totalWeight).toBe(110);
      expect(res.errors[0]).toContain("must sum to exactly 100.0%");
    });

    it("rejects criterion with empty title or invalid points", () => {
      const criteria: CriterionInput[] = [
        { title: "", maxPoints: 100, weightPercentage: 100, sequenceOrder: 1 },
      ];

      const res = validateRubricCriteria(criteria);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("empty title"))).toBe(true);
    });

    it("validates scale anchor labels", () => {
      const criteria: CriterionInput[] = [
        {
          title: "Testing Criterion",
          maxPoints: 100,
          weightPercentage: 100,
          sequenceOrder: 1,
          anchors: [{ level: 1, label: "", description: "Missing label" }],
        },
      ];

      const res = validateRubricCriteria(criteria);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("requires a label"))).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 2. CSV PARSING & BATCH USER VALIDATION
  // ----------------------------------------------------
  describe("CSV Import Parser & Row Validator", () => {
    it("correctly parses CSV text with headers and quoted fields", () => {
      const csv = `email,name,role\n"student@college.edu","Ada Lovelace",PARTICIPANT\n"mentor@college.edu","Alan Turing",MENTOR`;
      const { headers, rows } = parseCsvText(csv);

      expect(headers).toEqual(["email", "name", "role"]);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(["student@college.edu", "Ada Lovelace", "PARTICIPANT"]);
      expect(rows[1]).toEqual(["mentor@college.edu", "Alan Turing", "MENTOR"]);
    });

    it("validates valid rows and normalizes role designations", () => {
      const headers = ["email", "name", "role", "team"];
      const rows = [
        ["lead@college.edu", "Grace Hopper", "PARTICIPANT", "AlphaTeam"],
        ["judge@college.edu", "John von Neumann", "EVALUATOR", ""],
        ["coord@college.edu", "Margaret Hamilton", "COORDINATOR_MANAGE", ""],
      ];

      const { validRows, errors } = validateCsvRows(headers, rows);
      expect(errors).toHaveLength(0);
      expect(validRows).toHaveLength(3);
      expect(validRows[0].role).toBe("PARTICIPANT");
      expect(validRows[1].role).toBe("EVALUATOR");
      expect(validRows[2].role).toBe("COORDINATOR_MANAGE");
    });

    it("detects malformed emails and identifies exact line numbers", () => {
      const headers = ["email", "name", "role"];
      const rows = [
        ["valid@college.edu", "Valid User", "PARTICIPANT"],
        ["not-an-email", "Invalid User", "PARTICIPANT"],
      ];

      const { validRows, errors } = validateCsvRows(headers, rows);
      expect(validRows).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].row).toBe(3); // Line 3 (Header=1, Row1=2, Row2=3)
      expect(errors[0].field).toBe("email");
      expect(errors[0].reason).toContain("Invalid email format");
    });

    it("detects duplicate emails within the pasted CSV file", () => {
      const headers = ["email", "name", "role"];
      const rows = [
        ["user@college.edu", "First Entry", "PARTICIPANT"],
        ["user@college.edu", "Duplicate Entry", "PARTICIPANT"],
      ];

      const { validRows, errors } = validateCsvRows(headers, rows);
      expect(validRows).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain("Duplicate email within pasted CSV");
    });

    it("detects unrecognized role values", () => {
      const headers = ["email", "name", "role"];
      const rows = [["admin@college.edu", "Jane", "MASTER_SUPERVISOR"]];

      const { errors } = validateCsvRows(headers, rows);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe("role");
      expect(errors[0].reason).toContain('Unrecognized role "MASTER_SUPERVISOR"');
    });
  });

  // ----------------------------------------------------
  // 3. COORDINATOR VIEW-ONLY WRITE-PROTECTION
  // ----------------------------------------------------
  describe("Coordinator Tier Authorization Guard", () => {
    const viewOnlySession: UserSessionContext = {
      userId: "usr_view",
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

    it("allows Coordinator (View) read-only access to coordinator pages", () => {
      expect(canAccessRoute(viewOnlySession, "/coordinator", "GET").allowed).toBe(true);
      expect(canAccessRoute(viewOnlySession, "/coordinator/events", "GET").allowed).toBe(true);
      expect(canAccessRoute(viewOnlySession, "/coordinator/rubrics", "GET").allowed).toBe(true);
      expect(canAccessRoute(viewOnlySession, "/coordinator/import", "GET").allowed).toBe(true);
    });

    it("strictly blocks Coordinator (View) from mutating configuration via POST, PUT, DELETE", () => {
      const mutations = ["POST", "PUT", "PATCH", "DELETE"];
      for (const m of mutations) {
        const res = canAccessRoute(viewOnlySession, "/coordinator/events", m);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe("COORDINATOR_VIEW_WRITE_BLOCKED");
      }
    });

    it("allows Coordinator (Manage) to execute mutations on coordinator endpoints", () => {
      expect(canAccessRoute(manageSession, "/coordinator/manage", "POST").allowed).toBe(true);
      expect(canAccessRoute(manageSession, "/coordinator", "POST").allowed).toBe(true);
    });
  });
});
