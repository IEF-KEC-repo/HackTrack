"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import {
  calculateWeightedRubricScore,
  type RubricCriterionItem,
} from "@/lib/services/scoring-service";

interface QueueItem {
  id: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  track: string;
  problemStatement: string;
  solutionAbstract: string;
  embedSlidesUrl: string | null;
  slidesUrl: string | null;
  eventName: string;
  eventSlug: string;
  isCalibration: boolean;
  isOutlierReview: boolean;
  scheduledSlotStart: string | null;
  scheduledSlotEnd: string | null;
  roomOrMeetingUrl: string | null;
  status: string;
  rawTotalScore: number | null;
  submittedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
}

type RubricCriterion = RubricCriterionItem & {
  description?: string;
  sequenceOrder?: number;
};

interface WorkspaceResponse {
  evaluation: {
    id: string;
    status: string;
    rawTotalScore: number | null;
    generalFeedback: string | null;
    submittedAt: string | null;
    isCalibration: boolean;
    isOutlierReview: boolean;
    scheduledSlotStart: string | null;
    scheduledSlotEnd: string | null;
    roomOrMeetingUrl: string | null;
    reopenedAt: string | null;
    reopenReason: string | null;
  };
  team: {
    id: string;
    regCode: string;
    name: string;
    track: string;
    problemStatement: string;
    solutionAbstract: string;
    slidesUrl: string | null;
    embedSlidesUrl: string | null;
    members: Array<{ name: string; role: string }>;
    artifacts: unknown[];
  };
  rubric: { id: string; criteria: RubricCriterion[] } | null;
  existingScores: Record<string, number>;
  existingFeedback: Record<string, string>;
}

interface EvaluatorIdentity {
  id: string;
  name: string;
  email: string;
  globalRole?: string;
  editionId?: string;
  editionRole?: string;
}

function formatCountdown(endIso: string | null): string | null {
  if (!endIso) return null;
  const diff = new Date(endIso).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return "Evaluation window closed";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${d}d ${h}h ${m}m`;
}

export default function EvaluatorCockpitPage() {
  // Evaluator Identity (real session profile)
  const [me, setMe] = useState<EvaluatorIdentity | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  // View Mode: Queue Dashboard vs Split-Screen Cockpit
  const [viewMode, setViewMode] = useState<"queue" | "cockpit">("queue");

  // Assigned Queue State (real evaluations)
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  // Active evaluation workspace state
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Scores State for active evaluation (hydrated from server)
  const [scores, setScores] = useState<Record<string, number>>({});
  const [criterionFeedback, setCriterionFeedback] = useState<Record<string, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState("");

  // Status & UI States
  const [saveStatus, setSaveStatus] = useState("");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCoiModalOpen, setIsCoiModalOpen] = useState(false);
  const [coiTargetItem, setCoiTargetItem] = useState<QueueItem | null>(null);
  const [coiReason, setCoiReason] = useState("");
  const [slideLoadError, setSlideLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Last persisted draft payload (prevents redundant auto-saves after hydration)
  const lastSavedRef = useRef<string>("");

  const activeItem = queue.find((q) => q.id === activeQueueId) ?? queue[0] ?? null;

  // Load the assigned queue from the real evaluator endpoint
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await fetch("/api/evaluator/scoring/queue");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load your assigned queue");
      const items: QueueItem[] = json.queue || [];
      setQueue(items);
      setActiveQueueId((prev) =>
        prev && items.some((q) => q.id === prev) ? prev : items[0]?.id ?? null
      );
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Failed to load your assigned queue");
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error("Unable to load your evaluator profile");
        const json = await res.json();
        if (active) {
          setMe(json.user || null);
          setMeError(null);
        }
      } catch (err) {
        // Identity is cosmetic; queue access is enforced server-side.
        if (active) {
          setMeError(
            err instanceof Error ? err.message : "Unable to load your evaluator profile"
          );
        }
      }
    })();
    loadQueue();
    return () => {
      active = false;
    };
  }, [loadQueue]);

  // Load the workspace (rubric + existing scores/feedback) when a review opens
  useEffect(() => {
    if (viewMode !== "cockpit" || !activeQueueId) return;
    let active = true;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    setSlideLoadError(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/evaluator/scoring/workspace?evaluationId=${encodeURIComponent(activeQueueId)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load the evaluation workspace");
        if (!active) return;
        const nextScores = json.existingScores || {};
        const nextFeedback = json.existingFeedback || {};
        const nextGeneral = json.evaluation?.generalFeedback || "";
        setWorkspace(json);
        setScores(nextScores);
        setCriterionFeedback(nextFeedback);
        setGeneralFeedback(nextGeneral);
        lastSavedRef.current = JSON.stringify({
          scores: nextScores,
          criterionFeedback: nextFeedback,
          generalFeedback: nextGeneral,
        });
        setSaveStatus("Draft loaded");
      } catch (err) {
        if (active) {
          setWorkspaceError(
            err instanceof Error ? err.message : "Failed to load the evaluation workspace"
          );
        }
      } finally {
        if (active) setWorkspaceLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [viewMode, activeQueueId]);

  // Debounced auto-save of the current draft (real persistence)
  useEffect(() => {
    if (viewMode !== "cockpit" || !activeItem) return;
    if (activeItem.status === "SUBMITTED" || workspaceLoading) return;

    const payload = JSON.stringify({ scores, criterionFeedback, generalFeedback });
    if (!activeItem.id || payload === lastSavedRef.current) return;

    const timer = setTimeout(async () => {
      try {
        setSaveStatus("Saving...");
        const res = await fetch("/api/evaluator/scoring/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evaluationId: activeItem.id,
            scores,
            criterionFeedback,
            generalFeedback,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Draft save failed");
        lastSavedRef.current = payload;
        setSaveStatus("Draft auto-saved");
      } catch (err) {
        setSaveStatus(err instanceof Error ? err.message : "Draft save failed");
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [scores, criterionFeedback, generalFeedback, viewMode, activeItem, workspaceLoading]);

  const criteria: RubricCriterion[] = workspace?.rubric?.criteria ?? [];
  const rubricCalc = calculateWeightedRubricScore(criteria, scores);
  const isLocked = activeItem?.status === "SUBMITTED";

  const completedCount = queue.filter((q) => q.status === "SUBMITTED").length;
  const progressPercent =
    queue.length > 0 ? Math.round((completedCount / queue.length) * 100) : 100;

  const countdown = formatCountdown(activeItem?.scheduledSlotEnd ?? null);

  // Anchor click handler
  const handleAnchorClick = (criterionId: string, maxPoints: number, level: number) => {
    if (isLocked) return;
    const ratio = level / 5;
    const computedScore = Math.round(maxPoints * ratio * 10) / 10;
    setScores((prev) => ({ ...prev, [criterionId]: computedScore }));
  };

  const handleScoreChange = (criterionId: string, val: number) => {
    if (isLocked) return;
    setScores((prev) => ({ ...prev, [criterionId]: val }));
  };

  const handleCriterionFeedbackChange = (criterionId: string, val: string) => {
    if (isLocked) return;
    setCriterionFeedback((prev) => ({ ...prev, [criterionId]: val }));
  };

  // Submit Final Evaluation (real lock)
  const handleConfirmSubmit = async () => {
    if (!activeItem) return;
    if (generalFeedback.trim().length < 20) {
      setSaveStatus("Comprehensive feedback must be at least 20 characters");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/evaluator/scoring/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluationId: activeItem.id,
          scores,
          criterionFeedback,
          generalFeedback,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit evaluation");
      lastSavedRef.current = JSON.stringify({ scores, criterionFeedback, generalFeedback });
      setIsSubmitModalOpen(false);
      setSaveStatus("Evaluation finalized & locked");
      await loadQueue();
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Failed to submit evaluation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Declare Conflict of Interest (real recusal)
  const handleDeclareCoi = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = coiTargetItem || activeItem;
    if (!target || !coiReason.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/evaluator/scoring/declare-coi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: me?.editionId || "ht26",
          teamId: target.teamId,
          reason: coiReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to declare conflict of interest");
      setIsCoiModalOpen(false);
      setCoiReason("");
      setCoiTargetItem(null);
      setSaveStatus("Conflict declared — review recused");
      await loadQueue();
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Failed to declare conflict of interest");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // QUEUE DASHBOARD VIEW (Role-specific Queue Overview, Progress & Countdown)
  // --------------------------------------------------------------------------
  if (viewMode === "queue" || !activeItem) {
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
                  <span>{queue[0]?.eventName || "Assigned Review Stage"}</span>
                </div>
                <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                  Welcome back, {me?.name || "Evaluator"}
                </h1>
                <p className={`mt-1 text-sm ${meError ? "text-rose-600" : "text-slate-500"}`}>
                  {meError
                    ? meError
                    : me
                      ? `${me.email} • Assigned reviews are calibrated with automated Z-score standardization.`
                      : "Loading evaluator profile…"}
                </p>
              </div>

              {/* Countdown Pill & Action */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm">
                  <span className="text-base">⏳</span>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-amber-700">Deadline Countdown</span>
                    <span>
                      {countdown ? `Evaluation Window Closes In: ${countdown}` : "No evaluation window scheduled"}
                    </span>
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
          {queueError && (
            <Alert variant="error" title="Unable to load your assigned queue">
              {queueError}{" "}
              <button type="button" className="underline font-semibold" onClick={() => loadQueue()}>
                Retry
              </button>
            </Alert>
          )}

          {/* Progress Overview Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Queue Completion</span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">
                  {queueLoading ? "Loading…" : `${completedCount} of ${queue.length} Reviews Finalized (${progressPercent}%)`}
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
                {queue[0]?.eventName || "Assigned Stage"}
              </Badge>
            </div>

            {queueLoading ? (
              <div className="p-10 text-center text-sm text-slate-500">Loading your assigned reviews…</div>
            ) : queue.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                <p className="font-semibold text-slate-700">No evaluations assigned yet.</p>
                <p className="mt-1 text-xs">A coordinator must allocate reviews for the active stage before they appear here.</p>
              </div>
            ) : (
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
                            {item.slidesUrl ? (
                              <a
                                href={item.slidesUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
                              >
                                <span>Google Slides</span> ↗
                              </a>
                            ) : (
                              <span className="text-slate-400">No deck</span>
                            )}
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
            )}
          </div>
        </div>

        {/* Modal: Declare Conflict of Interest */}
        <Modal
          isOpen={isCoiModalOpen}
          onClose={() => {
            setIsCoiModalOpen(false);
            setCoiTargetItem(null);
          }}
          title={`Declare Conflict of Interest: ${(coiTargetItem || activeItem)?.teamCode || "Team"}`}
        >
          <form onSubmit={handleDeclareCoi} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Declare a conflict if you have a personal relationship, academic co-authorship, direct mentorship, or departmental affiliation with any member of{" "}
              <strong>{(coiTargetItem || activeItem)?.teamName || "this team"}</strong>.
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
              <Button variant="danger" type="submit" disabled={!coiReason.trim() || isSubmitting}>
                {isSubmitting ? "Recording…" : "Recuse & Reassign Review"}
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

              {activeItem.slidesUrl && (
                <a
                  href={activeItem.slidesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded flex items-center gap-1"
                >
                  Open External ↗
                </a>
              )}
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
            {!activeItem.embedSlidesUrl ? (
              <div className="text-center p-6 space-y-3">
                <span className="text-3xl">📄</span>
                <p className="text-sm font-semibold text-slate-300">No embedded presentation deck available.</p>
                <p className="text-xs text-slate-400 max-w-md">
                  This team has not submitted a Google Slides deck that can be embedded for review.
                </p>
                {activeItem.slidesUrl && (
                  <a
                    href={activeItem.slidesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Attempt Direct Open in Google Docs ↗
                  </a>
                )}
              </div>
            ) : slideLoadError ? (
              <div className="text-center p-6 space-y-3">
                <span className="text-3xl">⚠️</span>
                <p className="text-sm font-semibold text-rose-400">Unable to load embedded Google Slides deck.</p>
                <p className="text-xs text-slate-400 max-w-md">
                  The deck link may not have public view permissions (&quot;Anyone with the link can view&quot;) or was removed.
                </p>
                <a
                  href={activeItem.slidesUrl || "#"}
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
                value={activeQueueId ?? ""}
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

          {workspaceError && (
            <div className="p-4">
              <Alert variant="error" title="Unable to load evaluation workspace">
                {workspaceError}
              </Alert>
            </div>
          )}

          {/* Scrollable Rubric Form */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Rubric Header with Running Weighted Score */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">{workspace?.rubric ? "Weighted Ideathon Rubric" : "Evaluation Rubric"}</h2>
                <p className="text-xs text-slate-500">Double-Blind Panel Review (Standardized Z-Score Normalization)</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Composite Score
                </span>
                <p className="text-2xl font-black text-indigo-600">{rubricCalc.totalScore} / 100</p>
              </div>
            </div>

            {workspaceLoading ? (
              <p className="text-sm text-slate-500">Loading rubric &amp; existing scores…</p>
            ) : criteria.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No scoring rubric is configured for this event yet.
              </div>
            ) : (
              /* Criteria Cards */
              <form className="space-y-6">
                {criteria.map((c) => {
                  const currentScore = scores[c.id] ?? 0;
                  return (
                    <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{c.title || "Criterion"}</h3>
                          <p className="text-[11px] text-slate-500">{c.description}</p>
                        </div>
                        <span className="font-mono text-sm font-extrabold text-indigo-600 whitespace-nowrap ml-2">
                          {currentScore} / {c.maxPoints}
                        </span>
                      </div>

                      {/* Level 1-5 Scale Anchor Pills */}
                      <div className="flex gap-1.5 pt-1">
                        {[1, 2, 3, 4, 5].map((level) => {
                          const target = Math.round((c.maxPoints * level) / 5 * 10) / 10;
                          const isActiveBand =
                            currentScore >= (c.maxPoints * level) / 5 - 1 &&
                            currentScore <= (c.maxPoints * level) / 5 + 1;
                          return (
                            <button
                              key={level}
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleAnchorClick(c.id, c.maxPoints, level)}
                              className={`flex-1 py-1.5 px-2 rounded text-[11px] border text-center transition-colors ${
                                isActiveBand
                                  ? "bg-indigo-600 text-white border-indigo-700 font-bold shadow-sm"
                                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                              } ${isLocked ? "cursor-not-allowed opacity-75" : ""}`}
                              title={`${target} of ${c.maxPoints} points`}
                            >
                              <span className="block font-bold">L{level}</span>
                              <span className="text-[9px] block truncate">{target} pts</span>
                            </button>
                          );
                        })}
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
                          onChange={(e) => handleCriterionFeedbackChange(c.id, e.target.value)}
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
            )}
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
                  disabled={generalFeedback.trim().length < 20 || criteria.length === 0}
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
              Will be standardized (Z-score normalization) against the cohort baseline during coordinator normalization to eliminate evaluator bias.
            </p>
          </div>

          <p className="text-slate-500">
            Once submitted, your scores and written feedback will be locked to prevent accidental edits. A Coordinator (Manage) must manually reopen the review if revisions are required.
          </p>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" onClick={() => setIsSubmitModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="bg-indigo-600 text-white"
            >
              {isSubmitting ? "Submitting…" : "Confirm & Lock Evaluation"}
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
        title={`Declare Conflict of Interest: ${(coiTargetItem || activeItem)?.teamCode || "Team"}`}
      >
        <form onSubmit={handleDeclareCoi} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Declare a conflict if you have a personal relationship, academic co-authorship, direct mentorship, or departmental affiliation with any member of{" "}
            <strong>{(coiTargetItem || activeItem)?.teamName || "this team"}</strong>.
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
            <Button variant="danger" type="submit" disabled={!coiReason.trim() || isSubmitting}>
              {isSubmitting ? "Recording…" : "Recuse & Reassign Review"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
