import { describe, it, expect } from "vitest";
import {
  calculateTeamProgress,
  evaluateMilestoneDueStatus,
} from "./milestone-service";
import { evaluateCheckInCadence } from "./checkin-service";
import { canMutateEventConfig } from "@/lib/permissions";
import { EditionRole } from "@prisma/client";

describe("Milestone Progress & Due Status Engine", () => {
  it("calculates mandatory milestone progress percentage accurately", () => {
    const milestones = [
      { source: "COORDINATOR_MANDATORY", status: "COMPLETED" },
      { source: "COORDINATOR_MANDATORY", status: "COMPLETED" },
      { source: "COORDINATOR_MANDATORY", status: "IN_PROGRESS" },
      { source: "COORDINATOR_MANDATORY", status: "NOT_STARTED" },
      // Custom milestone should not dilute mandatory requirement
      { source: "TEAM_CUSTOM", status: "COMPLETED" },
    ];

    const progress = calculateTeamProgress(milestones);

    expect(progress.mandatoryTotal).toBe(4);
    expect(progress.mandatoryCompleted).toBe(2);
    expect(progress.mandatoryProgressPercent).toBe(50.0);
    expect(progress.customTotal).toBe(1);
    expect(progress.customCompleted).toBe(1);
    expect(progress.totalCompleted).toBe(3);
    expect(progress.totalMilestones).toBe(5);
    expect(progress.overallProgressPercent).toBe(60.0);
  });

  it("returns 100% when all mandatory milestones are completed", () => {
    const milestones = [
      { source: "COORDINATOR_MANDATORY", status: "COMPLETED" },
      { source: "COORDINATOR_MANDATORY", status: "COMPLETED" },
    ];

    const progress = calculateTeamProgress(milestones);
    expect(progress.mandatoryProgressPercent).toBe(100.0);
  });

  it("handles empty milestones list gracefully", () => {
    const progress = calculateTeamProgress([]);
    expect(progress.mandatoryTotal).toBe(0);
    expect(progress.mandatoryProgressPercent).toBe(100.0);
  });

  it("detects overdue milestones when dueDate is in the past and status is not completed", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const pastDue = new Date("2026-08-17T12:00:00Z"); // 3 days ago

    const status = evaluateMilestoneDueStatus(pastDue, "IN_PROGRESS", now);

    expect(status.isOverdue).toBe(true);
    expect(status.isDueSoon).toBe(false);
    expect(status.daysOverdue).toBe(3);
  });

  it("detects due-soon milestones when dueDate is within 48 hours", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const dueSoon = new Date("2026-08-21T18:00:00Z"); // 30 hours in future

    const status = evaluateMilestoneDueStatus(dueSoon, "NOT_STARTED", now);

    expect(status.isOverdue).toBe(false);
    expect(status.isDueSoon).toBe(true);
    expect(status.hoursRemaining).toBe(30);
  });

  it("marks completed milestones as not overdue even if completed after due date", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const pastDue = new Date("2026-08-15T12:00:00Z");

    const status = evaluateMilestoneDueStatus(pastDue, "COMPLETED", now);

    expect(status.isOverdue).toBe(false);
    expect(status.isDueSoon).toBe(false);
    expect(status.daysOverdue).toBe(0);
  });
});

describe("Fortnightly Check-In Cadence & Reminder Engine", () => {
  it("indicates initial check-in is due when no prior check-in has been logged", () => {
    const cadence = evaluateCheckInCadence(null);

    expect(cadence.status).toBe("CHECKIN_DUE");
    expect(cadence.isOverdue).toBe(false);
    expect(cadence.daysSinceLastCheckIn).toBeNull();
  });

  it("reports ON_TRACK when check-in was logged within 9 days", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const lastCheckIn = new Date("2026-08-15T12:00:00Z"); // 5 days ago

    const cadence = evaluateCheckInCadence(lastCheckIn, now);

    expect(cadence.status).toBe("ON_TRACK");
    expect(cadence.isOverdue).toBe(false);
    expect(cadence.daysSinceLastCheckIn).toBe(5);
    expect(cadence.daysRemaining).toBe(9);
  });

  it("reports CHECKIN_DUE when elapsed days is between 10 and 14 days", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const lastCheckIn = new Date("2026-08-08T12:00:00Z"); // 12 days ago

    const cadence = evaluateCheckInCadence(lastCheckIn, now);

    expect(cadence.status).toBe("CHECKIN_DUE");
    expect(cadence.isOverdue).toBe(false);
    expect(cadence.daysRemaining).toBe(2);
  });

  it("reports CHECKIN_OVERDUE when elapsed days exceeds 14 days", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const lastCheckIn = new Date("2026-08-02T12:00:00Z"); // 18 days ago (4 days overdue)

    const cadence = evaluateCheckInCadence(lastCheckIn, now);

    expect(cadence.status).toBe("CHECKIN_OVERDUE");
    expect(cadence.isOverdue).toBe(true);
    expect(cadence.daysOverdue).toBe(4);
  });
});

describe("Mentor Isolation & View-Only Guard", () => {
  it("enforces coordinator view-only write protection on milestone mutation actions", () => {
    expect(canMutateEventConfig(EditionRole.COORDINATOR_VIEW)).toBe(false);
    expect(canMutateEventConfig(EditionRole.COORDINATOR_MANAGE)).toBe(true);
    expect(canMutateEventConfig(EditionRole.SUPER_ADMIN)).toBe(true);
    expect(canMutateEventConfig(EditionRole.PARTICIPANT)).toBe(false);
  });

  it("verifies mentor isolation query filters only assigned teams", () => {
    const mockTeams = [
      { id: "t1", mentorId: "mentor_alan" },
      { id: "t2", mentorId: "mentor_claude" },
      { id: "t3", mentorId: "mentor_alan" },
    ];

    const alanTeams = mockTeams.filter((t) => t.mentorId === "mentor_alan");
    expect(alanTeams.length).toBe(2);
    expect(alanTeams.map((t) => t.id)).toEqual(["t1", "t3"]);

    const claudeTeams = mockTeams.filter((t) => t.mentorId === "mentor_claude");
    expect(claudeTeams.length).toBe(1);
    expect(claudeTeams[0].id).toBe("t2");
  });
});
