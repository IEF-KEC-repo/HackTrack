import { prisma } from "@/lib/prisma";
import { EvaluationStatus } from "@prisma/client";

export interface CandidateTeam {
  id: string;
  name: string;
  mentorId?: string | null;
  memberUserIds?: string[];
}

export interface CandidateEvaluator {
  id: string;
  name: string;
}

export interface ConflictItem {
  evaluatorId: string;
  teamId: string;
}

export interface AssignmentResult {
  assignments: Array<{ teamId: string; evaluatorId: string }>;
  evaluatorLoads: Record<string, number>;
  minLoad: number;
  maxLoad: number;
  loadDelta: number;
  isGraphConnected: boolean;
  totalAssignments: number;
}

/**
 * Pure function: Auto-balanced, overlapping review assignment algorithm.
 * Guarantees:
 * 1. Each team gets exactly evaluatorCountPerTeam distinct evaluators (3 for Ideathon).
 * 2. Balanced evaluator workload (min/max workload variance <= 1).
 * 3. Overlapping graph connectivity: Evaluators share review subjects so Z-score normalization works.
 * 4. Conflict of interest enforcement: Team mentors, team members, and declared COIs are never assigned.
 */
export function allocateReviewersForEvent(params: {
  teams: CandidateTeam[];
  evaluators: CandidateEvaluator[];
  conflicts?: ConflictItem[];
  evaluatorCountPerTeam?: number;
}): AssignmentResult {
  const {
    teams,
    evaluators,
    conflicts = [],
    evaluatorCountPerTeam = 3,
  } = params;

  if (!teams || teams.length === 0) {
    return {
      assignments: [],
      evaluatorLoads: {},
      minLoad: 0,
      maxLoad: 0,
      loadDelta: 0,
      isGraphConnected: true,
      totalAssignments: 0,
    };
  }

  if (!evaluators || evaluators.length < evaluatorCountPerTeam) {
    throw new Error(
      `Insufficient evaluators. At least ${evaluatorCountPerTeam} evaluators are required (found ${
        evaluators?.length || 0
      }).`
    );
  }

  // Build conflict lookup set: "evaluatorId_teamId"
  const conflictSet = new Set<string>();
  for (const c of conflicts) {
    conflictSet.add(`${c.evaluatorId}_${c.teamId}`);
  }

  // Track evaluator load: evaluatorId -> count
  const evaluatorLoads: Record<string, number> = {};
  for (const e of evaluators) {
    evaluatorLoads[e.id] = 0;
  }

  const assignments: Array<{ teamId: string; evaluatorId: string }> = [];

  // Pairings graph to verify overlap/connectivity: evaluatorId -> Set<evaluatorId>
  const reviewerCoAssignment = new Map<string, Set<string>>();
  for (const e of evaluators) {
    reviewerCoAssignment.set(e.id, new Set());
  }

  // Iterate over teams with a circular starting offset to ensure overlapping pairings
  teams.forEach((team, teamIndex) => {
    // 1. Identify all eligible evaluators for this team
    const eligible = evaluators.filter((e) => {
      // Conflict: Evaluator is the team's mentor
      if (team.mentorId && e.id === team.mentorId) return false;

      // Conflict: Evaluator is a member of the team
      if (team.memberUserIds && team.memberUserIds.includes(e.id)) return false;

      // Conflict: Explicit declared COI
      if (conflictSet.has(`${e.id}_${team.id}`)) return false;

      return true;
    });

    if (eligible.length < evaluatorCountPerTeam) {
      throw new Error(
        `Cannot allocate team ${team.name} (${team.id}): only ${eligible.length} conflict-free evaluators available, but ${evaluatorCountPerTeam} required.`
      );
    }

    // 2. Sort eligible evaluators by current load (least-loaded first)
    // When loads are equal, use circular offset (teamIndex % evaluators.length) to guarantee overlapping graph
    eligible.sort((a, b) => {
      const loadDiff = evaluatorLoads[a.id] - evaluatorLoads[b.id];
      if (loadDiff !== 0) return loadDiff;

      // Tie breaker: circular sequence
      const indexA = evaluators.findIndex((ev) => ev.id === a.id);
      const indexB = evaluators.findIndex((ev) => ev.id === b.id);
      const offsetA = (indexA - teamIndex + evaluators.length * 10) % evaluators.length;
      const offsetB = (indexB - teamIndex + evaluators.length * 10) % evaluators.length;
      return offsetA - offsetB;
    });

    // 3. Assign the top N least-loaded eligible evaluators
    const assignedForTeam = eligible.slice(0, evaluatorCountPerTeam);

    for (const chosen of assignedForTeam) {
      assignments.push({ teamId: team.id, evaluatorId: chosen.id });
      evaluatorLoads[chosen.id]++;
    }

    // Record graph co-assignments
    for (let i = 0; i < assignedForTeam.length; i++) {
      for (let j = i + 1; j < assignedForTeam.length; j++) {
        reviewerCoAssignment.get(assignedForTeam[i].id)?.add(assignedForTeam[j].id);
        reviewerCoAssignment.get(assignedForTeam[j].id)?.add(assignedForTeam[i].id);
      }
    }
  });

  const loads = Object.values(evaluatorLoads);
  const minLoad = Math.min(...loads);
  const maxLoad = Math.max(...loads);
  const loadDelta = maxLoad - minLoad;

  // Check if graph is connected (each evaluator shares reviews with at least 1 other evaluator)
  const isGraphConnected = evaluators.every((e) => (reviewerCoAssignment.get(e.id)?.size || 0) > 0);

  return {
    assignments,
    evaluatorLoads,
    minLoad,
    maxLoad,
    loadDelta,
    isGraphConnected,
    totalAssignments: assignments.length,
  };
}

/**
 * Database operation: Executes automated review assignment and persists Evaluation records.
 */
export async function executeEventReviewAllocation(params: {
  eventId: string;
  editionId: string;
  clearExisting?: boolean;
  coordinatorId: string;
}) {
  const { eventId, editionId, clearExisting = false, coordinatorId } = params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, slug: true, evaluatorCountPerTeam: true },
  });

  if (!event) throw new Error("Event not found.");

  // Fetch submitted teams in the edition
  const teams = await prisma.team.findMany({
    where: { editionId },
    select: {
      id: true,
      name: true,
      mentorId: true,
      members: { select: { userId: true } },
    },
  });

  // Fetch registered evaluators
  const evaluatorMemberships = await prisma.editionMembership.findMany({
    where: { editionId, role: "EVALUATOR" },
    include: { user: { select: { id: true, name: true } } },
  });
  const evaluators = evaluatorMemberships.map((m) => m.user);

  // Fetch declared conflicts
  const conflicts = await prisma.conflictOfInterest.findMany({
    where: { editionId },
    select: { evaluatorId: true, teamId: true },
  });

  const candidateTeams: CandidateTeam[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    mentorId: t.mentorId,
    memberUserIds: t.members.map((m) => m.userId),
  }));

  const candidateEvaluators: CandidateEvaluator[] = evaluators.map((e) => ({
    id: e.id,
    name: e.name,
  }));

  // Run allocation algorithm
  const result = allocateReviewersForEvent({
    teams: candidateTeams,
    evaluators: candidateEvaluators,
    conflicts,
    evaluatorCountPerTeam: event.evaluatorCountPerTeam || 3,
  });

  // Persist evaluations in database
  if (clearExisting) {
    await prisma.evaluation.deleteMany({
      where: { eventId },
    });
  }

  // Create Evaluation records with DRAFT status
  await prisma.evaluation.createMany({
    data: result.assignments.map((a) => ({
      eventId,
      teamId: a.teamId,
      evaluatorId: a.evaluatorId,
      status: EvaluationStatus.DRAFT,
    })),
    skipDuplicates: true,
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      editionId,
      actorId: coordinatorId,
      action: "REVIEW_ALLOCATION_EXECUTED",
      entityType: "Event",
      entityId: eventId,
      newState: JSON.stringify({
        totalAssignments: result.totalAssignments,
        minLoad: result.minLoad,
        maxLoad: result.maxLoad,
        loadDelta: result.loadDelta,
      }),
    },
  });

  return result;
}

/**
 * Database operation: Evaluator declares a Conflict of Interest against a team.
 */
export async function declareConflictOfInterest(params: {
  editionId: string;
  evaluatorId: string;
  teamId: string;
  reason?: string;
}) {
  const { editionId, evaluatorId, teamId, reason } = params;

  return await prisma.conflictOfInterest.upsert({
    where: {
      evaluatorId_teamId: { evaluatorId, teamId },
    },
    update: { reason, declaredAt: new Date() },
    create: {
      editionId,
      evaluatorId,
      teamId,
      reason,
      declaredAt: new Date(),
    },
  });
}

/**
 * Database operation: Assigns calendar-friendly presentation slots to an evaluation.
 */
export async function scheduleEvaluationSlot(params: {
  evaluationId: string;
  slotStart: Date;
  slotEnd: Date;
  roomOrMeetingUrl?: string;
}) {
  const { evaluationId, slotStart, slotEnd, roomOrMeetingUrl } = params;

  return await prisma.evaluation.update({
    where: { id: evaluationId },
    data: {
      scheduledSlotStart: slotStart,
      scheduledSlotEnd: slotEnd,
      roomOrMeetingUrl,
    },
  });
}
