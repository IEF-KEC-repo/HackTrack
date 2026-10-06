"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { calculateWeightedRubricScore } from "@/lib/services/scoring-service";

interface QueueItem {
  id: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  track: string;
  problemStatement: string;
  solutionAbstract: string;
  embedSlidesUrl: string;
  slidesUrl: string;
  status: "DRAFT" | "SUBMITTED";
  rawTotalScore: number | null;
  isCalibration: boolean;
  isOutlierReview?: boolean;
}

interface CriterionItem {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
  weightPercentage: number;
  anchors: Array<{ level: number; label: string; description: string }>;
}

export default function EvaluatorCockpitPage() {
  // Evaluator Profile
  const [evaluator] = useState({
    name: "Alex Rivera",
    email: "evaluator@hacktrack.edu",
    role: "EVALUATOR",
  });

  // View Mode: Queue Dashboard vs Split-Screen Cockpit
  const [viewMode, setViewMode] = useState<"queue" | "cockpit">("queue");

  // Assigned Queue State
  const [queue, setQueue] = useState<QueueItem[]>([
    {
      id: "ev_1",
      teamId: "t_1",
      teamCode: "HT26-T001",
      teamName: "QuantumForge",
      track: "AI/ML & Edge Computing",
      problemStatement:
        "Cloud AI inference incurs severe bandwidth bottlenecks and latency spikes in remote robotics systems.",
      solutionAbstract:
        "Neuromorphic micro-controller architecture with quantized INT4 weight caching, cutting inference power by 85%.",
      slidesUrl:
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing",
      embedSlidesUrl:
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
      status: "DRAFT",
      rawTotalScore: 70.0,
      isCalibration: false,
    },
    {
      id: "ev_2",
      teamId: "t_2",
      teamCode: "HT26-T002",
      teamName: "BioSynth AI",
      track: "Healthtech & Bio",
      problemStatement:
        "Antibiotic resistance is compounding due to slow discovery pipelines for novel peptide sequences.",
      solutionAbstract:
        "Transformer-based de novo antimicrobial peptide generator paired with fast wet-lab screening protocols.",
      slidesUrl:
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing",
      embedSlidesUrl:
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
      status: "DRAFT",
      rawTotalScore: null,
      isCalibration: false,
    },
    {
      id: "ev_cal_1",
      teamId: "t_anchor",
      teamCode: "ANCHOR-01",
      teamName: "SolarGrid Nexus (Calibration Sample)",
      track: "Clean Energy & IoT",
      problemStatement: "Solar mini-grids experience frequent phase imbalances leading to inverter burnout.",
      solutionAbstract: "Decentralized edge phase balancing relay using real-time frequency modulation.",
      slidesUrl:
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing",
      embedSlidesUrl:
        "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000",
      status: "SUBMITTED",
      rawTotalScore: 82.0,
      isCalibration: true,
    },
  ]);

  const [activeQueueId, setActiveQueueId] = useState<string>("ev_1");
  const activeItem = queue.find((q) => q.id === activeQueueId) || queue[0];

  // Rubric Criteria with Level 1-5 Scale Anchors
  const [criteria] = useState<CriterionItem[]>([
    {
      id: "crit_1",
      title: "1. Problem Relevance & Societal Impact",
      description: "Clarity of problem definition, domain research, and collegiate/industry impact.",
      maxPoints: 25.0,
      weightPercentage: 25.0,
      anchors: [
        { level: 1, label: "Rudimentary", description: "Vague problem statement without validated customer pain." },
        { level: 3, label: "Demonstrated", description: "Well-researched with relevant data and target audience identified." },
        { level: 5, label: "Exceptional", description: "Profound societal or industrial need with field interview metrics." },
      ],
    },
    {
      id: "crit_2",
      title: "2. Technical Feasibility & Architecture",
      description: "Soundness of proposed system architecture, tech stack selection, and hardware/software viability.",
      maxPoints: 30.0,
      weightPercentage: 30.0,
      anchors: [
        { level: 1, label: "Unviable", description: "Ignores real-world constraints or relies on magic box tech." },
        { level: 3, label: "Viable MVP", description: "Realistic tech stack and component block diagram for CPR 1." },
        { level: 5, label: "Production-Ready", description: "Rigorous latency budgets, BOM, and risk mitigation strategies." },
      ],
    },
    {
      id: "crit_3",
      title: "3. Innovation & Originality",
      description: "Novelty of approach compared to existing market solutions and standard open-source tools.",
      maxPoints: 25.0,
      weightPercentage: 25.0,
      anchors: [
        { level: 1, label: "Derivative", description: "Direct clone of existing tutorial or commercial software." },
        { level: 3, label: "Clever Application", description: "Applies existing technology in a novel vertical with clear differentiation." },
        { level: 5, label: "Breakthrough", description: "Unique IP, algorithmic innovation, or paradigm shift." },
      ],
    },
    {
      id: "crit_4",
      title: "4. Presentation & Deck Quality",
      description: "Clarity, structure, data visualizations, and professional delivery of the Google Slides deck.",
      maxPoints: 20.0,
      weightPercentage: 20.0,
      anchors: [
        { level: 1, label: "Unclear", description: "Cluttered slides with missing context or broken links." },
        { level: 3, label: "Polished", description: "Clean slide structure with clear problem-to-solution narrative." },
        { level: 5, label: "Compelling", description: "Executive-grade delivery with pristine graphics and benchmarks." },
      ],
    },
  ]);

  // Scores State for active evaluation
  const [scores, setScores] = useState<Record<string, number>>({
    crit_1: 18,
    crit_2: 21,
    crit_3: 17,
    crit_4: 14,
  });

  const [criterionFeedback, setCriterionFeedback] = useState<Record<string, string>>({
    crit_1: "Good problem context; validate deployment costs.",
    crit_2: "INT4 quantization is technically sound for edge microcontrollers.",
  });

  const [generalFeedback, setGeneralFeedback] = useState(
    "Solid algorithmic kernel. Ensure you stress test thermal throttling before the CPR 1 live panel."
  );

  // Status & UI States
  const [saveStatus, setSaveStatus] = useState<string>("Draft auto-saved locally");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCoiModalOpen, setIsCoiModalOpen] = useState(false);
  const [coiTargetItem, setCoiTargetItem] = useState<QueueItem | null>(null);
  const [coiReason, setCoiReason] = useState("");
  const [slideLoadError, setSlideLoadError] = useState(false);

  // Calculation
  const rubricCalc = calculateWeightedRubricScore(criteria, scores);
  const isLocked = activeItem?.status === "SUBMITTED";

  // Anchor click handler
  const handleAnchorClick = (criterionId: string, maxPoints: number, level: number) => {
    if (isLocked) return;
    const ratio = level / 5;
    const computedScore = Math.round(maxPoints * ratio * 10) / 10;
    setScores({ ...scores, [criterionId]: computedScore });
    setSaveStatus("Saving...");
    setTimeout(() => setSaveStatus("Draft auto-saved"), 400);
  };

  const handleScoreChange = (criterionId: string, val: number) => {
    if (isLocked) return;
    setScores({ ...scores, [criterionId]: val });
    setSaveStatus("Saving...");
    setTimeout(() => setSaveStatus("Draft auto-saved"), 400);
  };

  // Submit Final Evaluation
  const handleConfirmSubmit = () => {
    if (generalFeedback.trim().length < 20) return;

    const updatedQueue = queue.map((q) =>
      q.id === activeItem.id
        ? { ...q, status: "SUBMITTED" as const, rawTotalScore: rubricCalc.totalScore }
        : q
    );

    setQueue(updatedQueue);
    setIsSubmitModalOpen(false);
    setSaveStatus("Evaluation finalized & locked");
  };

  // Declare Conflict of Interest
  const handleDeclareCoi = (e: React.FormEvent) => {
    e.preventDefault();
    const target = coiTargetItem || activeItem;
    const remaining = queue.filter((q) => q.id !== target.id);
    setQueue(remaining);
    setIsCoiModalOpen(false);
    setCoiReason("");
    setCoiTargetItem(null);
    if (remaining.length > 0) {
      setActiveQueueId(remaining[0].id);
    }
  };

  const completedCount = queue.filter((q) => q.status === "SUBMITTED").length;
  const progressPercent = queue.length > 0 ? Math.round((completedCount / queue.length) * 100) : 100;

  // --------------------------------------------------------------------------
  // QUEUE DASHBOARD VIEW (Role-specific Queue Overview, Progress & Countdown)
  // --------------------------------------------------------------------------
  if (viewMode === "queue") {
    return (
      <div className="min-h-screen bg-slate-50 pb-16">
        {/* Top Header */}
        <div className="border-b border-slate-200 bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                  <span>Evaluator Queue Portal</span>
                  <span>•</span>
                  <span>Ideathon Double-Blind Evaluation</span>
                </div>
                <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                  Welcome back, {evaluator.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {evaluator.email} • Assigned reviews are calibrated with automated Z-score standardization.
                </p>
              </div>

              {/* Countdown Pill & Action */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm">
                  <span className="text-base">⏳</span>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-amber-700">Deadline Countdown</span>
                    <span>Evaluation Window Closes In: 2d 14h 32m</span>
                  </div>
                </div>

                {activeItem && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => setViewMode("cockpit")}
                  >
                    Open Review Cockpit 🎯
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          {/* Progress Overview Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Queue Completion</span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">
                  {completedCount} of {queue.length} Reviews Finalized ({progressPercent}%)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete all assigned evaluations before the deadline for cohort normalization.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Assigned</span>
                  <p className="text-xl font-bold text-slate-900">{queue.length}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Submitted</span>
                  <p className="text-xl font-bold text-emerald-800">{completedCount}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-700">Drafts</span>
                  <p className="text-xl font-bold text-amber-800">{queue.length - completedCount}</p>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-5 w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Assigned Queue Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Assigned Idea Queue</h2>
                <p className="text-xs text-slate-500">
                  Click &ldquo;Launch Cockpit&rdquo; to open the split-screen deck viewer and scoring rubric
                </p>
              </div>
              <Badge variant="purple" size="sm">
                Ideathon Stage
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Team Code</th>
                    <th className="py-3.5 px-4">Idea / Team Name</th>
                    <th className="py-3.5 px-4">Track</th>
                    <th className="py-3.5 px-4">Presentation Deck</th>
                    <th className="py-3.5 px-4">Review Status</th>
                    <th className="py-3.5 px-4">Raw Score</th>
                    <th className="py-3.5 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.map((item) => {
                    const isItemLocked = item.status === "SUBMITTED";
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-indigo-700">
                          {item.teamCode}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{item.teamName}</span>
                            {item.isCalibration && (
                              <Badge variant="purple" size="sm">Anchor</Badge>
                            )}
                            {item.isOutlierReview && (
                              <Badge variant="danger" size="sm">Adjudication</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-normal truncate max-w-xs mt-0.5">
                            {item.problemStatement}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-slate-600">{item.track}</td>
                        <td className="py-4 px-4">
                          <a
                            href={item.slidesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
                          >
                            <span>Google Slides</span> ↗
                          </a>
                        </td>
                        <td className="py-4 px-4">
                          <Badge
                            variant={isItemLocked ? "success" : "warning"}
                            size="sm"
                          >
                            {isItemLocked ? "✓ Submitted" : "✎ Draft In-Progress"}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold">
                          {item.rawTotalScore !== null ? (
                            <span className="text-slate-900">{item.rawTotalScore.toFixed(1)} / 100</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Pending</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                          {!isItemLocked && (
                            <button
                              type="button"
                              onClick={() => {
                                setCoiTargetItem(item);
                                setIsCoiModalOpen(true);
                              }}
                              className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50"
                              title="Declare conflict of interest"
                            >
                              ⚖️ COI
                            </button>
                          )}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setActiveQueueId(item.id);
                              setViewMode("cockpit");
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            {isItemLocked ? "View Submission" : "Launch Cockpit 🎯"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal: Declare Conflict of Interest */}
        <Modal
          isOpen={isCoiModalOpen}
          onClose={() => {
            setIsCoiModalOpen(false);
            setCoiTargetItem(null);
          }}
          title={`Declare Conflict of Interest: ${(coiTargetItem || activeItem)?.teamCode}`}
        >
          <form onSubmit={handleDeclareCoi} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Declare a conflict if you have a personal relationship, academic co-authorship, direct mentorship, or departmental affiliation with any member of{" "}
              <strong>{(coiTargetItem || activeItem)?.teamName}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Conflict Explanation / Nature of Affiliation (Required)
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g., Undergraduate advisee in my research laboratory / Prior project co-inventor..."
                value={coiReason}
                onChange={(e) => setCoiReason(e.target.value)}
                className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <Alert variant="warning" title="Recusal Effect">
              Declaring a conflict will instantly remove this team from your queue and automatically re-assign it to an alternate conflict-free evaluator.
            </Alert>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setIsCoiModalOpen(false);
                  setCoiTargetItem(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="danger" type="submit" disabled={!coiReason.trim()}>
                Recuse & Reassign Review
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SPLIT-SCREEN COCKPIT VIEW (Deck Viewer on Left, Rubric on Right)
  // --------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden bg-slate-900">
      {/* Top Cockpit Navigation Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-white">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setViewMode("queue")}
            className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
          >
            ← Back to Queue Dashboard
          </Button>
          <span className="text-slate-400">|</span>
          <span className="font-semibold text-slate-300">
            Evaluating: <strong className="text-white">{activeItem.teamName}</strong> ({activeItem.teamCode})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 hidden sm:inline">{saveStatus}</span>
          <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-indigo-300">
            Queue: {completedCount} / {queue.length} Done
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* LEFT PANEL: Deck Viewer & Team Intel */}
        <section
          aria-label="Presentation Deck Viewer"
          className="flex-1 flex flex-col justify-between bg-slate-950 p-4 border-r border-slate-800 overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between text-white pb-3 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded border border-indigo-700/50">
                {activeItem.teamCode}
              </span>
              <span className="font-bold text-slate-100 text-sm truncate max-w-[200px] sm:max-w-none">
                {activeItem.teamName}
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">({activeItem.track})</span>

              {activeItem.isCalibration && (
                <Badge variant="purple">🎯 Calibration Anchor</Badge>
              )}

              {activeItem.isOutlierReview && (
                <Badge variant="danger">⚠️ Adjudicator Extra Review</Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => setIsCoiModalOpen(true)}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 px-2 py-1 rounded transition-colors"
                  title="Recuse yourself if you have a personal, academic, or mentorship connection to this team."
                >
                  ⚖️ Declare Conflict
                </button>
              )}

              <a
                href={activeItem.slidesUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded flex items-center gap-1"
              >
                Open External ↗
              </a>
            </div>
          </div>

          {/* Problem & Abstract Context Accordion */}
          <div className="my-2 bg-slate-900/90 rounded p-2.5 border border-slate-800 text-xs text-slate-300 space-y-1">
            <p>
              <strong className="text-indigo-400">Problem:</strong> {activeItem.problemStatement}
            </p>
            <p>
              <strong className="text-indigo-400">Solution:</strong> {activeItem.solutionAbstract}
            </p>
          </div>

          {/* Sandboxed Google Slides Presentation Deck */}
          <div className="flex-1 w-full relative min-h-[300px] rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
            {slideLoadError ? (
              <div className="text-center p-6 space-y-3">
                <span className="text-3xl">⚠️</span>
                <p className="text-sm font-semibold text-rose-400">Unable to load embedded Google Slides deck.</p>
                <p className="text-xs text-slate-400 max-w-md">
                  The deck link may not have public view permissions (&quot;Anyone with the link can view&quot;) or was removed.
                </p>
                <a
                  href={activeItem.slidesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Attempt Direct Open in Google Docs ↗
                </a>
              </div>
            ) : (
              <iframe
                src={activeItem.embedSlidesUrl}
                title={`${activeItem.teamName} Presentation Deck`}
                className="w-full h-full min-h-[320px] rounded"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups"
                onError={() => setSlideLoadError(true)}
              />
            )}
          </div>

          {/* Viewer Footer Status */}
          <div className="text-[11px] text-slate-400 pt-2 flex items-center justify-between">
            <span>Use keyboard arrow keys inside presentation to advance slides</span>
            <span className="text-emerald-400 flex items-center gap-1">
              ✓ Read-Only Sandboxed Iframe (Double-Blind)
            </span>
          </div>
        </section>

        {/* RIGHT PANEL: Queue Switcher & Rubric Scoring Form */}
        <section
          aria-label="Evaluation Scoring Cockpit"
          className="w-full lg:w-[500px] border-l border-slate-200 bg-white flex flex-col justify-between overflow-hidden"
        >
          {/* Queue Dropdown / Switcher Bar */}
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 flex-1 mr-2">
              <span className="font-semibold text-slate-500">Queue:</span>
              <select
                value={activeQueueId}
                onChange={(e) => setActiveQueueId(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 flex-1 truncate"
              >
                {queue.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.teamCode} — {q.teamName} {q.status === "SUBMITTED" ? "(✓ Completed)" : "(Draft)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-right whitespace-nowrap">
              <span className="font-mono font-bold text-indigo-700">
                {completedCount} / {queue.length}
              </span>
              <span className="text-slate-400 ml-1">Done</span>
            </div>
          </div>

          {/* Locked Alert if Submitted */}
          {isLocked && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs flex items-center justify-between text-emerald-800">
              <span className="font-semibold">🔒 Evaluation Finalized & Locked</span>
              <span className="text-[11px] text-emerald-700">Contact Coordinator to Reopen</span>
            </div>
          )}

          {/* Scrollable Rubric Form */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Rubric Header with Running Weighted Score */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Weighted Ideathon Rubric</h2>
                <p className="text-xs text-slate-500">Reviewer 1 of 3 (Standardized Z-Score Normalization)</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Composite Score
                </span>
                <p className="text-2xl font-black text-indigo-600">{rubricCalc.totalScore} / 100</p>
              </div>
            </div>

            {/* Criteria Cards */}
            <form className="space-y-6">
              {criteria.map((c) => {
                const currentScore = scores[c.id] ?? 0;
                return (
                  <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{c.title}</h3>
                        <p className="text-[11px] text-slate-500">{c.description}</p>
                      </div>
                      <span className="font-mono text-sm font-extrabold text-indigo-600 whitespace-nowrap ml-2">
                        {currentScore} / {c.maxPoints}
                      </span>
                    </div>

                    {/* Level 1-5 Scale Anchor Pills */}
                    <div className="flex gap-1.5 pt-1">
                      {c.anchors.map((anchor) => (
                        <button
                          key={anchor.level}
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleAnchorClick(c.id, c.maxPoints, anchor.level)}
                          className={`flex-1 py-1.5 px-2 rounded text-[11px] border text-center transition-colors ${
                            currentScore >= (c.maxPoints * anchor.level) / 5 - 1 &&
                            currentScore <= (c.maxPoints * anchor.level) / 5 + 1
                              ? "bg-indigo-600 text-white border-indigo-700 font-bold shadow-sm"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          } ${isLocked ? "cursor-not-allowed opacity-75" : ""}`}
                          title={anchor.description}
                        >
                          <span className="block font-bold">L{anchor.level}</span>
                          <span className="text-[9px] block truncate">{anchor.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Fine Score Slider */}
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        type="range"
                        min="0"
                        max={c.maxPoints}
                        step="0.5"
                        disabled={isLocked}
                        value={currentScore}
                        onChange={(e) => handleScoreChange(c.id, parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <input
                        type="number"
                        min="0"
                        max={c.maxPoints}
                        step="0.5"
                        disabled={isLocked}
                        value={currentScore}
                        onChange={(e) => handleScoreChange(c.id, parseFloat(e.target.value) || 0)}
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-center disabled:bg-slate-100"
                      />
                    </div>

                    {/* Criterion Specific Written Feedback */}
                    <div className="pt-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Specific Criterion Notes / Actionable Suggestions:
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        placeholder="e.g., Explain trade-offs in compute vs precision..."
                        value={criterionFeedback[c.id] || ""}
                        onChange={(e) =>
                          setCriterionFeedback({ ...criterionFeedback, [c.id]: e.target.value })
                        }
                        className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                );
              })}

              {/* General Written Feedback (Mandatory min 20 chars) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-baseline">
                  <label className="text-xs font-bold text-slate-900">
                    Comprehensive Qualitative Feedback (Mandatory)
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      generalFeedback.trim().length >= 20 ? "text-emerald-600" : "text-amber-600 font-semibold"
                    }`}
                  >
                    {generalFeedback.trim().length} / 20 chars min
                  </span>
                </div>
                <textarea
                  rows={4}
                  disabled={isLocked}
                  placeholder="Provide constructive guidance, identifying potential pitfalls, testing advice, and architectural recommendations for upcoming Continuous Project Reviews..."
                  value={generalFeedback}
                  onChange={(e) => setGeneralFeedback(e.target.value)}
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:ring-1 focus:ring-indigo-600 disabled:bg-slate-100"
                />
              </div>
            </form>
          </div>

          {/* Cockpit Action Footer */}
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{saveStatus}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewMode("queue")}
              >
                Back to Queue
              </Button>
              {!isLocked ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={generalFeedback.trim().length < 20}
                  onClick={() => setIsSubmitModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Finalize & Submit Review
                </Button>
              ) : (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  ✓ Submitted & Locked
                </span>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modal: Confirm Final Submission */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Confirm Final Submission & Lock"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            You are about to finalize your evaluation for{" "}
            <strong className="text-slate-900">{activeItem.teamName} ({activeItem.teamCode})</strong> with a composite score of:
          </p>

          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-center">
            <span className="text-xs uppercase font-bold text-indigo-700">Raw Composite Score</span>
            <p className="text-3xl font-black text-indigo-900 mt-1">{rubricCalc.totalScore} / 100</p>
            <p className="text-[11px] text-indigo-700 mt-1">
              Will be standard-normalized against cohort baseline (Mean 70, StdDev 15) to eliminate evaluator bias.
            </p>
          </div>

          <p className="text-slate-500">
            Once submitted, your scores and written feedback will be locked to prevent accidental edits. A Coordinator (Manage) must manually reopen the review if revisions are required.
          </p>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" onClick={() => setIsSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmSubmit} className="bg-indigo-600 text-white">
              Confirm & Lock Evaluation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Declare Conflict of Interest */}
      <Modal
        isOpen={isCoiModalOpen}
        onClose={() => {
          setIsCoiModalOpen(false);
          setCoiTargetItem(null);
        }}
        title={`Declare Conflict of Interest: ${(coiTargetItem || activeItem)?.teamCode}`}
      >
        <form onSubmit={handleDeclareCoi} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Declare a conflict if you have a personal relationship, academic co-authorship, direct mentorship, or departmental affiliation with any member of{" "}
            <strong>{(coiTargetItem || activeItem)?.teamName}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Conflict Explanation / Nature of Affiliation (Required)
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g., Undergraduate advisee in my research laboratory / Prior project co-inventor..."
              value={coiReason}
              onChange={(e) => setCoiReason(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <Alert variant="warning" title="Recusal Effect">
            Declaring a conflict will instantly remove this team from your queue and automatically re-assign it to an alternate conflict-free evaluator.
          </Alert>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setIsCoiModalOpen(false);
                setCoiTargetItem(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" type="submit" disabled={!coiReason.trim()}>
              Recuse & Reassign Review
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
