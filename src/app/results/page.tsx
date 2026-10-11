"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  globalRole: string;
  editionRole: string;
}

interface TimelineEventItem {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  status: string;
}

interface RankedTeam {
  rank: number;
  teamId: string;
  teamCode: string;
  teamName: string;
  track: string | null;
  normalizedScore: number;
  rawAverageScore: number;
  zScoreMean: number;
  evaluatorCount: number;
  rankShift: number;
  tieBreakReason?: string | null;
  stageDecision?: "CONTINUE" | "CONDITIONAL" | "EXIT" | null;
  decisionNotes?: string | null;
}

interface LeaderboardResponse {
  published: boolean;
  isPublished: boolean;
  eventId: string | null;
  eventName: string;
  rankedTeams: RankedTeam[];
  message?: string;
}

function mapRankedTeams(rows: any[] | undefined): RankedTeam[] {
  return (rows || []).map((rt) => ({
    rank: rt.rank,
    teamId: rt.teamId,
    teamCode: rt.regCode || rt.teamCode || "TEAM",
    teamName: rt.teamName,
    track: rt.track || null,
    normalizedScore: rt.normalizedScore ?? 0,
    rawAverageScore: rt.rawAverageScore ?? rt.rawAverage ?? 0,
    zScoreMean: rt.zScoreMean ?? 0,
    evaluatorCount: rt.evaluatorCount ?? rt.reviewerScores?.length ?? 0,
    rankShift: rt.rankShift ?? 0,
    tieBreakReason: rt.tieBreakReason ?? null,
    stageDecision: rt.stageDecision ?? null,
    decisionNotes: rt.decisionNotes ?? null,
  })) as RankedTeam[];
}

const COORDINATOR_ROLES = ["SUPER_ADMIN", "COORDINATOR_MANAGE", "COORDINATOR_VIEW"];
const MANAGE_ROLES = ["SUPER_ADMIN", "COORDINATOR_MANAGE"];

export default function ResultsLeaderboardPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Real event configuration from the active edition.
  const [events, setEvents] = useState<TimelineEventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Real leaderboard payload from the API.
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  // Action feedback
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "info" | "warning" | "error";
    message: string;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Stage Decision Modal State
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [selectedTeamForDecision, setSelectedTeamForDecision] = useState<RankedTeam | null>(null);
  const [decisionType, setDecisionType] = useState<"CONTINUE" | "CONDITIONAL" | "EXIT">("CONTINUE");
  const [decisionNotes, setDecisionNotes] = useState("");

  const isCoordinator =
    session !== null && COORDINATOR_ROLES.includes(session.editionRole);
  const canManage = session !== null && MANAGE_ROLES.includes(session.editionRole);

  const showAlert = (type: "success" | "info" | "warning" | "error", message: string) => {
    setActionAlert({ type, message });
    setTimeout(() => setActionAlert(null), 6000);
  };

  const loadBoard = useCallback(async (eventId: string) => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const res = await fetch(`/api/leaderboard/results?edition=ht26&eventId=${encodeURIComponent(eventId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to load standings (HTTP ${res.status})`);
      }
      setBoard({
        ...data,
        rankedTeams: mapRankedTeams(data.rankedTeams),
      } as LeaderboardResponse);
    } catch (err: any) {
      setBoardError(err.message || "Failed to load standings.");
      setBoard(null);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          if (!disposed && meData?.user) setSession(meData.user);
        }
      } catch {
        /* session stays null; page-level middleware handles redirects */
      }

      try {
        const tlRes = await fetch("/api/public/timeline?edition=ht26");
        const tlData = await tlRes.json();
        const eventRows: TimelineEventItem[] = (tlData?.events || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          sequenceIndex: e.sequenceIndex,
          status: e.status,
        }));
        if (disposed) return;
        setEvents(eventRows);
        if (eventRows.length > 0) {
          setSelectedEventId(eventRows[0].id);
        }
      } catch {
        /* events stay empty */
      } finally {
        if (!disposed) setSessionLoading(false);
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  // Reload the board whenever the selected event changes.
  useEffect(() => {
    if (selectedEventId) {
      loadBoard(selectedEventId);
    }
  }, [selectedEventId, loadBoard]);

  const handleTogglePublication = async () => {
    if (!canManage || !board?.eventId) return;
    setActionBusy(true);
    try {
      const res = await fetch("/api/coordinator/decisions/publish-leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: board.eventId, publish: !board.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to update publication (HTTP ${res.status})`);
      }
      showAlert("success", data.message || "Leaderboard publication updated.");
      await loadBoard(board.eventId);
    } catch (err: any) {
      showAlert("error", err.message || "Failed to update leaderboard publication.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleOpenDecisionModal = (team: RankedTeam) => {
    if (!canManage) return;
    setSelectedTeamForDecision(team);
    setDecisionType(team.stageDecision || "CONTINUE");
    setDecisionNotes(team.decisionNotes || "");
    setIsDecisionModalOpen(true);
  };

  const handleSaveDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForDecision || !board?.eventId) return;
    if (decisionType === "CONDITIONAL" && decisionNotes.trim().length < 5) {
      showAlert("error", "Conditional decisions require explicit remedial condition notes (min 5 chars).");
      return;
    }
    if (decisionType === "EXIT" && decisionNotes.trim().length < 5) {
      showAlert("error", "Stage elimination requires an exit rationale note.");
      return;
    }

    setActionBusy(true);
    try {
      const res = await fetch("/api/coordinator/decisions/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: board.eventId,
          eventName: board.eventName,
          teamId: selectedTeamForDecision.teamId,
          teamName: selectedTeamForDecision.teamName,
          decision: decisionType,
          notes: decisionNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to record decision (HTTP ${res.status})`);
      }
      setIsDecisionModalOpen(false);
      showAlert("success", `Recorded decision '${decisionType}' for ${selectedTeamForDecision.teamName}. Team notified.`);
      await loadBoard(board.eventId);
    } catch (err: any) {
      showAlert("error", err.message || "Failed to record the stage decision.");
    } finally {
      setActionBusy(false);
    }
  };

  // Non-coordinators never see standings until the leaderboard is published.
  const isHiddenFromViewer = !isCoordinator && board !== null && board.published !== true;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header Bar */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                <span>Official Standings</span>
                <span>•</span>
                <span>HackTrack 2026 Annual Edition</span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                Event Leaderboard & Results
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Standardized Z-Score Normalized Rankings & Progression Decisions
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Event Selector */}
              <select
                aria-label="Select event stage"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={events.length === 0}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
              >
                {events.length === 0 && <option value="">Loading stages…</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    Stage {ev.sequenceIndex}: {ev.name}
                  </option>
                ))}
              </select>

              {/* Coordinator Publication Toggle */}
              {canManage && (
                <Button
                  size="sm"
                  variant={board?.isPublished ? "secondary" : "primary"}
                  onClick={handleTogglePublication}
                  disabled={actionBusy || boardLoading}
                  className={
                    board?.isPublished
                      ? "border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }
                >
                  {board?.isPublished ? "🔒 Unpublish Leaderboard" : "📢 Publish to Participants"}
                </Button>
              )}

              {/* Export Links */}
              <a href={`/api/export/scores?edition=ht26${selectedEventId ? `&eventId=${selectedEventId}` : ""}`} download>
                <Button size="sm" variant="secondary">
                  Export CSV 📥
                </Button>
              </a>

              <a
                href={`/api/export/report?edition=ht26${selectedEventId ? `&eventId=${selectedEventId}` : ""}&autoprint=true`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="secondary">
                  Print / PDF 🖨️
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Action Alert */}
        {actionAlert && (
          <Alert variant={actionAlert.type} title="Leaderboard Action">
            {actionAlert.message}
          </Alert>
        )}

        {!sessionLoading && !session && (
          <Alert variant="warning" title="Authentication Required">
            Please <Link className="underline font-semibold" href="/auth/login">log in</Link> to view
            event standings.
          </Alert>
        )}

        {boardError && (
          <Alert variant="error" title="Unable to Load Standings">
            {boardError}
          </Alert>
        )}

        {/* Draft preview banner for coordinators */}
        {isCoordinator && board && !board.isPublished && (
          <Alert variant="warning" title="Draft Preview Mode Active">
            This leaderboard is currently <strong>UNPUBLISHED</strong>. It is visible only to
            coordinators and administrators. Participants cannot view scores or rankings until you
            click &ldquo;Publish to Participants&rdquo;.
          </Alert>
        )}

        {/* GATING: hidden from participants until published */}
        {isHiddenFromViewer ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm max-w-2xl mx-auto space-y-4">
            <span className="text-5xl">⏳</span>
            <h2 className="text-xl font-bold text-slate-900">
              Results Pending Official Publication
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              The evaluation and normalization calibration phase for this stage is currently in
              progress. Official scores, panel feedback, and stage advancement decisions will be
              published here once finalized by the program coordinators.
            </p>
            <div className="pt-2">
              <Link href="/team/progress">
                <Button variant="secondary" size="sm">
                  Return to Event-by-Event Progress
                </Button>
              </Link>
            </div>
          </div>
        ) : boardLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <p className="text-sm text-slate-500">Loading official standings…</p>
          </div>
        ) : board && board.rankedTeams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm max-w-2xl mx-auto space-y-2">
            <span className="text-5xl">📊</span>
            <h2 className="text-xl font-bold text-slate-900">No Evaluations Recorded Yet</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Rankings for &ldquo;{board.eventName}&rdquo; will appear here once the review panel
              has completed evaluations for this stage.
            </p>
          </div>
        ) : board ? (
          <>
            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* 2nd Place (Silver) */}
              {board.rankedTeams[1] && (
                <div className="order-2 md:order-1 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-slate-200 text-slate-700 font-black text-xs px-3 py-1 rounded-bl-lg">
                    🥈 2ND PLACE
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      {board.rankedTeams[1].teamCode}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {board.rankedTeams[1].teamName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{board.rankedTeams[1].track}</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Normalized Score
                      </span>
                      <p className="text-2xl font-black text-slate-800">
                        {board.rankedTeams[1].normalizedScore.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-600 font-bold">
                      +{board.rankedTeams[1].zScoreMean.toFixed(3)}σ
                    </span>
                  </div>
                </div>
              )}

              {/* 1st Place (Gold) */}
              {board.rankedTeams[0] && (
                <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-50/50 to-white p-6 shadow-md flex flex-col justify-between relative overflow-hidden transform md:-translate-y-2">
                  <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 font-black text-xs px-3 py-1 rounded-bl-lg flex items-center gap-1">
                    🥇 1ST PLACE CHAMPION
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      {board.rankedTeams[0].teamCode}
                    </span>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                      {board.rankedTeams[0].teamName}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">{board.rankedTeams[0].track}</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-amber-200/60 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-800">
                        Top Normalized Score
                      </span>
                      <p className="text-3xl font-black text-amber-900">
                        {board.rankedTeams[0].normalizedScore.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-700 font-bold">
                      +{board.rankedTeams[0].zScoreMean.toFixed(3)}σ
                    </span>
                  </div>
                </div>
              )}

              {/* 3rd Place (Bronze) */}
              {board.rankedTeams[2] && (
                <div className="order-3 rounded-2xl border border-orange-200 bg-white p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-orange-100 text-orange-800 font-black text-xs px-3 py-1 rounded-bl-lg">
                    🥉 3RD PLACE
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      {board.rankedTeams[2].teamCode}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {board.rankedTeams[2].teamName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{board.rankedTeams[2].track}</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Normalized Score
                      </span>
                      <p className="text-2xl font-black text-slate-800">
                        {board.rankedTeams[2].normalizedScore.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-600 font-bold">
                      +{board.rankedTeams[2].zScoreMean.toFixed(3)}σ
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Complete Ranked Standings Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
              <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Comprehensive Official Standings</h2>
                  <p className="text-xs text-slate-500">
                    Calculated with standardized cohort Z-score normalization
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="purple" size="sm">
                    {board.rankedTeams.length} Teams Evaluated
                  </Badge>
                  {board.isPublished ? (
                    <Badge variant="success" size="sm">Publicly Visible</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">Unpublished Draft</Badge>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    Official standings for {board.eventName} ranked by normalized score
                  </caption>
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4 text-center">Rank</th>
                      <th className="py-3.5 px-4">Team Code</th>
                      <th className="py-3.5 px-4">Team / Idea Name</th>
                      <th className="py-3.5 px-4">Track</th>
                      <th className="py-3.5 px-4 text-right">Normalized</th>
                      <th className="py-3.5 px-4 text-right">Raw Avg</th>
                      <th className="py-3.5 px-4 text-right">Z-Score</th>
                      <th className="py-3.5 px-4 text-center">Rank Shift</th>
                      <th className="py-3.5 px-4">Stage Decision</th>
                      {canManage && <th className="py-3.5 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {board.rankedTeams.map((team) => {
                      const isTop3 = team.rank <= 3;
                      return (
                        <tr
                          key={team.teamId}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isTop3 ? "bg-amber-50/20" : ""
                          }`}
                        >
                          <td className="py-4 px-4 text-center font-bold text-slate-900">
                            {team.rank === 1
                              ? "🥇 #1"
                              : team.rank === 2
                              ? "🥈 #2"
                              : team.rank === 3
                              ? "🥉 #3"
                              : `#${team.rank}`}
                          </td>
                          <td className="py-4 px-4 font-mono font-bold text-indigo-700">
                            {team.teamCode}
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900">
                            <div>{team.teamName}</div>
                            {team.tieBreakReason && (
                              <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                                ⚖️ {team.tieBreakReason}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-600">{team.track}</td>
                          <td className="py-4 px-4 text-right font-mono font-extrabold text-indigo-700 text-sm">
                            {team.normalizedScore.toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-right font-mono text-slate-600">
                            {team.rawAverageScore.toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-right font-mono font-semibold">
                            <span
                              className={
                                team.zScoreMean >= 0 ? "text-emerald-700" : "text-rose-600"
                              }
                            >
                              {team.zScoreMean >= 0
                                ? `+${team.zScoreMean.toFixed(3)}`
                                : team.zScoreMean.toFixed(3)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-mono font-bold text-xs">
                            {team.rankShift > 0 ? (
                              <span className="text-emerald-600">▲ +{team.rankShift}</span>
                            ) : team.rankShift < 0 ? (
                              <span className="text-rose-600">▼ {team.rankShift}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {team.stageDecision ? (
                              <div>
                                <Badge
                                  variant={
                                    team.stageDecision === "CONTINUE"
                                      ? "success"
                                      : team.stageDecision === "CONDITIONAL"
                                      ? "warning"
                                      : "danger"
                                  }
                                  size="sm"
                                >
                                  {team.stageDecision}
                                </Badge>
                                {team.decisionNotes && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs">
                                    {team.decisionNotes}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Pending Decision</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="py-4 px-4 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenDecisionModal(team)}
                              >
                                Record Gate Decision
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Modal: Record Gate Stage Decision */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title={`Record Stage Decision: ${selectedTeamForDecision?.teamName} (${selectedTeamForDecision?.teamCode})`}
      >
        <form onSubmit={handleSaveDecision} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Select the progression decision for this team based on review panel scores and rubric
            feedback. Team members will receive automated in-app and email notices.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Advancement Decision (Mandatory)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecisionType("CONTINUE")}
                className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  decisionType === "CONTINUE"
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                ✅ CONTINUE
              </button>
              <button
                type="button"
                onClick={() => setDecisionType("CONDITIONAL")}
                className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  decisionType === "CONDITIONAL"
                    ? "bg-amber-600 text-white border-amber-700 shadow-sm"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                ⚠️ CONDITIONAL
              </button>
              <button
                type="button"
                onClick={() => setDecisionType("EXIT")}
                className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  decisionType === "EXIT"
                    ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                🚫 EXIT
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Decision Notes & Remedial Requirements:
              {decisionType === "CONDITIONAL" && (
                <span className="text-rose-600 font-bold ml-1">* Mandatory for Conditional</span>
              )}
              {decisionType === "EXIT" && (
                <span className="text-rose-600 font-bold ml-1">* Mandatory Exit Rationale</span>
              )}
            </label>
            <textarea
              rows={3}
              required={decisionType !== "CONTINUE"}
              placeholder={
                decisionType === "CONDITIONAL"
                  ? "Detail mandatory milestones or revisions the team must complete before the next stage..."
                  : decisionType === "EXIT"
                  ? "Detail exit rationale and constructive feedback for the team..."
                  : "Optional commendation notes or specific advice for upcoming reviews..."
              }
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              className="w-full rounded-md border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsDecisionModalOpen(false)}
              disabled={actionBusy}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="bg-indigo-600 text-white" disabled={actionBusy}>
              {actionBusy ? "Saving…" : "Save Decision & Notify Team"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}