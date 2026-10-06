"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";

interface EventStep {
  id: string;
  name: string;
  type: string;
  sequenceIndex: number;
  status: "COMPLETED" | "ACTIVE" | "UPCOMING";
  date: string;
  stageDecision?: "CONTINUE" | "CONDITIONAL" | "EXIT" | null;
  decisionNotes?: string;
  evaluatorCount: number;
  scoreAwarded?: number;
}

interface DeliverableItem {
  id: string;
  title: string;
  dueDate: string;
  status: "SUBMITTED" | "PENDING" | "OVERDUE";
  type: "COORDINATOR_MANDATORY" | "TEAM_CUSTOM";
  evidenceUrl?: string;
}

export default function ParticipantProgressPage() {
  const [team] = useState({
    name: "QuantumForge",
    regCode: "HT26-T001",
    track: "AI/ML & Edge Computing",
    edition: "HackTrack 2026",
    slidesUrl:
      "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing",
    embedSlidesUrl:
      "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
    mentor: {
      name: "Dr. Evelyn Reed",
      title: "Senior Principal Scientist, Edge Systems",
      email: "evelyn.reed@hacktrack.edu",
      lastCheckInDaysAgo: 4,
      cadenceHealth: "HEALTHY" as "HEALTHY" | "OVERDUE",
      lastNotes:
        "Discussed memory bandwidth constraints on STM32. Team is advised to benchmark INT4 quantization latency under continuous thermal load.",
    },
  });

  const [currentEventDecision] = useState<{
    stageDecision: "CONTINUE" | "CONDITIONAL" | "EXIT";
    notes?: string;
    stageName: string;
  }>({
    stageDecision: "CONTINUE",
    stageName: "Ideathon & Innovatz Gate",
    notes:
      "Exceptional technical grounding and clear roadmap for hardware integration. Cleared for Continuous Project Reviews.",
  });

  const [eventSteps] = useState<EventStep[]>([
    {
      id: "ev_ideathon",
      name: "Ideathon Screening",
      type: "SCREENING",
      sequenceIndex: 1,
      status: "COMPLETED",
      date: "Aug 15 - Aug 20, 2026",
      stageDecision: "CONTINUE",
      evaluatorCount: 3,
      scoreAwarded: 92.45,
    },
    {
      id: "ev_innovatz",
      name: "Innovatz Idea Review",
      type: "REVIEW",
      sequenceIndex: 2,
      status: "COMPLETED",
      date: "Sep 01 - Sep 05, 2026",
      stageDecision: "CONTINUE",
      evaluatorCount: 3,
      scoreAwarded: 89.2,
    },
    {
      id: "ev_cpr1",
      name: "CPR 1: Architecture & Kernel",
      type: "PROJECT_REVIEW",
      sequenceIndex: 3,
      status: "ACTIVE",
      date: "Sep 20 - Oct 05, 2026",
      stageDecision: null,
      evaluatorCount: 3,
    },
    {
      id: "ev_cpr2",
      name: "CPR 2: Mid-Point Stress Testing",
      type: "PROJECT_REVIEW",
      sequenceIndex: 4,
      status: "UPCOMING",
      date: "Oct 25 - Nov 02, 2026",
      stageDecision: null,
      evaluatorCount: 3,
    },
    {
      id: "ev_poc",
      name: "POC Verification Review",
      type: "POC",
      sequenceIndex: 5,
      status: "UPCOMING",
      date: "Nov 20 - Nov 25, 2026",
      stageDecision: null,
      evaluatorCount: 4,
    },
    {
      id: "ev_demo",
      name: "Demo Day Grand Finale",
      type: "DEMO_DAY",
      sequenceIndex: 6,
      status: "UPCOMING",
      date: "Dec 10, 2026",
      stageDecision: null,
      evaluatorCount: 5,
    },
  ]);

  const [deliverables] = useState<DeliverableItem[]>([
    {
      id: "del_1",
      title: "System Architecture & Hardware Block Diagram",
      dueDate: "Sep 28, 2026",
      status: "SUBMITTED",
      type: "COORDINATOR_MANDATORY",
      evidenceUrl: "https://docs.google.com/presentation/d/sample-arch",
    },
    {
      id: "del_2",
      title: "INT4 Quantized Edge Latency Benchmark",
      dueDate: "Oct 04, 2026",
      status: "SUBMITTED",
      type: "COORDINATOR_MANDATORY",
      evidenceUrl: "https://github.com/hacktrack/benchmarks",
    },
    {
      id: "del_3",
      title: "Thermal Stress Test Video Proof",
      dueDate: "Oct 12, 2026",
      status: "PENDING",
      type: "TEAM_CUSTOM",
    },
  ]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                <span>{team.edition}</span>
                <span>•</span>
                <span>Track: {team.track}</span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                Event-by-Event Progress: {team.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Official registration code:{" "}
                <span className="font-mono font-bold text-slate-800">{team.regCode}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/team">
                <Button variant="secondary" size="sm">
                  Team Hub & Profile
                </Button>
              </Link>
              <Link href="/team/milestones">
                <Button variant="secondary" size="sm">
                  Milestone Board
                </Button>
              </Link>
              <Link href="/results">
                <Button variant="primary" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  🏆 View Published Results
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Stage Decision Notice Banner */}
        {currentEventDecision.stageDecision === "CONTINUE" && (
          <Alert variant="success" title="Stage Advancement Confirmed ✅">
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                Your team was awarded a <strong>CONTINUE</strong> decision for the{" "}
                <strong>{currentEventDecision.stageName}</strong>. You have officially advanced to
                the active Continuous Project Review (CPR) cycle!
                {currentEventDecision.notes && (
                  <p className="mt-2 text-xs text-emerald-800 bg-emerald-100/60 p-2.5 rounded-md border border-emerald-300">
                    <strong>Coordinator Review Notes:</strong> {currentEventDecision.notes}
                  </p>
                )}
              </div>
              <Link href="/results" className="self-start sm:self-auto shrink-0">
                <Button size="sm" variant="secondary" className="border-emerald-300 text-emerald-900 bg-white">
                  View Full Standings
                </Button>
              </Link>
            </div>
          </Alert>
        )}

        {currentEventDecision.stageDecision === "CONDITIONAL" && (
          <Alert variant="warning" title="Action Required: Conditional Stage Advancement ⚠️">
            <div className="mt-1">
              Your team has received a <strong>CONDITIONAL</strong> advancement decision for{" "}
              <strong>{currentEventDecision.stageName}</strong>. To retain your position in upcoming reviews,
              you must complete the mandatory coordinator requirements detailed below:
              <div className="mt-2 bg-amber-100/80 p-3 rounded-md border border-amber-300 text-amber-900 font-medium text-xs">
                {currentEventDecision.notes || "Must submit outstanding deliverables before CPR review deadline."}
              </div>
            </div>
          </Alert>
        )}

        {currentEventDecision.stageDecision === "EXIT" && (
          <Alert variant="error" title="Stage Elimination / Program Concluded">
            <div className="mt-1">
              Your team received an <strong>EXIT</strong> decision at this stage. Thank you for your hard work and participation in HackTrack!
              {currentEventDecision.notes && (
                <div className="mt-2 bg-rose-100/80 p-3 rounded-md border border-rose-300 text-rose-900 text-xs">
                  <strong>Exit Feedback:</strong> {currentEventDecision.notes}
                </div>
              )}
            </div>
          </Alert>
        )}

        {/* Sequential Event Stepper Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Program Progression Pipeline</h2>
              <p className="text-xs text-slate-500">
                Sequential gate advancement across configured annual edition events
              </p>
            </div>
            <Badge variant="purple" size="sm">
              Current Stage: CPR 1 Active
            </Badge>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventSteps.map((step) => {
              const isDone = step.status === "COMPLETED";
              const isActive = step.status === "ACTIVE";

              return (
                <div
                  key={step.id}
                  className={`rounded-lg border p-4 transition-all relative ${
                    isActive
                      ? "border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-sm"
                      : isDone
                      ? "border-emerald-200 bg-white"
                      : "border-slate-200 bg-slate-50/50 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      Stage {step.sequenceIndex}
                    </span>
                    <Badge
                      variant={
                        isDone
                          ? "success"
                          : isActive
                          ? "info"
                          : "default"
                      }
                      size="sm"
                    >
                      {step.status}
                    </Badge>
                  </div>

                  <h3 className="mt-2 font-bold text-slate-900 text-sm">{step.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{step.date}</p>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Evaluators: <strong>{step.evaluatorCount} Assigned</strong>
                    </span>
                    {step.scoreAwarded && (
                      <span className="font-semibold text-emerald-700">
                        Score: {step.scoreAwarded.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {step.stageDecision && (
                    <div className="mt-2 text-xs font-semibold flex items-center gap-1.5">
                      <span className="text-slate-500">Decision:</span>
                      <Badge
                        variant={
                          step.stageDecision === "CONTINUE"
                            ? "success"
                            : step.stageDecision === "CONDITIONAL"
                            ? "warning"
                            : "danger"
                        }
                        size="sm"
                      >
                        {step.stageDecision}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dual Grid: Google Slides Embed & Deliverable Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Live Google Slides Embed (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>📊 Active Google Slides Pitch Deck</span>
                  <Badge variant="success" size="sm">
                    Verified Public
                  </Badge>
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time preview rendered directly to assigned evaluators in their split-screen cockpit
                </p>
              </div>
              <a
                href={team.slidesUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="secondary">
                  Open in Drive ↗
                </Button>
              </a>
            </div>

            <div className="mt-4 flex-1 min-h-[380px] bg-slate-900 rounded-lg overflow-hidden border border-slate-300 relative shadow-inner">
              <iframe
                src={team.embedSlidesUrl}
                title="Google Slides Pitch Deck"
                width="100%"
                height="100%"
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400 text-center">
              Evaluators review slides live during evaluation windows. Updates made in Google Slides reflect immediately.
            </p>
          </div>

          {/* Right Column: Deliverable Checklist & Mentor Cadence (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Deliverable Checklist Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Stage Deliverables</h2>
                  <p className="text-xs text-slate-500">Mandatory artifacts and checkpoint proof</p>
                </div>
                <Link href="/team/milestones">
                  <Button size="sm" variant="secondary">
                    Manage
                  </Button>
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {deliverables.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-500">Due: {item.dueDate}</div>
                      {item.evidenceUrl && (
                        <a
                          href={item.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline font-mono text-[10px] block"
                        >
                          View Artifact ↗
                        </a>
                      )}
                    </div>
                    <Badge
                      variant={
                        item.status === "SUBMITTED"
                          ? "success"
                          : item.status === "OVERDUE"
                          ? "danger"
                          : "warning"
                      }
                      size="sm"
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Mentor Cadence Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Assigned Mentor & Cadence</h2>
                  <p className="text-xs text-slate-500">Rolling milestones and guidance check-ins</p>
                </div>
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                    ER
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{team.mentor.name}</h3>
                    <p className="text-[11px] text-slate-500">{team.mentor.title}</p>
                    <p className="text-[11px] font-mono text-indigo-600">{team.mentor.email}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Cadence: Healthy ✅</span>
                    <span>{team.mentor.lastCheckInDaysAgo} days since check-in</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-800">
                    Mandatory check-in required every 14 days. Next recommended check-in: in 10 days.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="font-semibold text-slate-700 text-[11px]">Latest Check-In Notes:</div>
                  <p className="mt-1 text-slate-600 text-xs italic">&ldquo;{team.mentor.lastNotes}&rdquo;</p>
                </div>

                <Button variant="secondary" size="sm" className="w-full">
                  Request Mentor Office Hours / Check-In
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
