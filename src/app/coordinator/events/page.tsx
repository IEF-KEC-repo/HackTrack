"use client";

import { useEffect, useState } from "react";
import { CoordinatorShell, useCoordinator } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

type ReviewType = "ASYNC_MULTI_REVIEWER" | "LIVE_PANEL";
type CprCount = 3 | 4 | 5;

interface EventItem {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  reviewType: ReviewType;
  status: string;
  submissionDeadline: string | null;
  evaluationDeadline: string | null;
  evaluatorCountPerTeam: number;
  feedbackReleased: boolean;
  isCalibrationActive: boolean;
}

// Shape returned by the coordinator API route for event records.
interface ApiEvent {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  reviewType: ReviewType;
  status?: string;
  submissionDeadline?: string | null;
  evaluationDeadline?: string | null;
  evaluatorCountPerTeam?: number;
  feedbackReleased?: boolean;
  isCalibrationActive?: boolean;
}

interface EditionDataResponse {
  edition?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    events?: ApiEvent[];
  } | null;
  error?: string;
}

interface MutationResponse {
  success?: boolean;
  error?: string;
  events?: ApiEvent[];
}

interface UpdateEventInput {
  id: string;
  name: string;
  sequenceIndex: number;
  reviewType: ReviewType;
  submissionDeadline: string | null;
  evaluationDeadline: string | null;
}

// Normalize raw stage records from the API into the page's render shape.
function mapApiEvent(raw: ApiEvent): EventItem {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    sequenceIndex: raw.sequenceIndex,
    reviewType: raw.reviewType,
    status: raw.status ?? "UPCOMING",
    submissionDeadline: raw.submissionDeadline ?? null,
    evaluationDeadline: raw.evaluationDeadline ?? null,
    evaluatorCountPerTeam: raw.evaluatorCountPerTeam ?? 3,
    feedbackReleased: raw.feedbackReleased ?? false,
    isCalibrationActive: raw.isCalibrationActive ?? false,
  };
}

export default function EventsConfigPage() {
  const { isReadOnly, editionSlug } = useCoordinator();

  // Pipeline state is loaded live from the real edition configuration.
  const [events, setEvents] = useState<EventItem[]>([]);
  const [editionId, setEditionId] = useState<string>("");
  const [editionName, setEditionName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // The server stores no cprCount column — it is derived from the stage set.
  const cprCount = events.filter((e) => e.slug.startsWith("cpr-")).length;

  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingCpr, setIsSettingCpr] = useState(false);

  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [templateSlug, setTemplateSlug] = useState("ht25");
  const [cloneName, setCloneName] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneAcademicYear, setCloneAcademicYear] = useState("2026-2027");
  const [isCloning, setIsCloning] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Load the real stage pipeline once on mount (and on manual retry).
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/coordinator/edition-data?slug=${encodeURIComponent(editionSlug)}`
        );
        const data: EditionDataResponse = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || `Failed to load edition data (HTTP ${res.status}).`);
        }
        const edition = data?.edition;
        if (!edition) {
          throw new Error(`Edition "${editionSlug}" was not found for the current coordinator context.`);
        }
        if (!active) return;
        setEditionId(edition.id);
        setEditionName(edition.name);
        setEvents(edition.events?.map(mapApiEvent) ?? []);
        setFeedback(null);
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : "Failed to load pipeline data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editionSlug, reloadKey]);

  // Inline rename of an existing stage (persisted by Save Pipeline).
  const handleRename = (id: string, name: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
    setDirty(true);
  };

  // Reorder stage in the local draft (persisted by Save Pipeline).
  const applyMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= events.length) return;
    const updated = [...events];
    const temp = updated[target];
    updated[target] = updated[index];
    updated[index] = temp;
    updated.forEach((e, idx) => {
      e.sequenceIndex = idx + 1;
    });
    setEvents(updated);
    setDirty(true);
    setFeedback({
      type: "info",
      msg: "Stage sequence updated in the draft. Click 'Save Pipeline Changes' to persist it.",
    });
  };

  // Persist reorder + rename edits for the existing stage set (no create/delete).
  const savePipeline = async () => {
    if (!editionId) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const payloadEvents: UpdateEventInput[] = events.map((e) => ({
        id: e.id,
        name: e.name.trim() || e.slug,
        sequenceIndex: e.sequenceIndex,
        reviewType: e.reviewType,
        submissionDeadline: e.submissionDeadline,
        evaluationDeadline: e.evaluationDeadline,
      }));
      const res = await fetch("/api/coordinator/update-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId, events: payloadEvents }),
      });
      const data: MutationResponse = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Failed to save pipeline changes.");
      }
      setEvents(data.events ? data.events.map(mapApiEvent) : events);
      setDirty(false);
      setFeedback({ type: "success", msg: "Pipeline saved. Stage order, names, and deadlines were persisted." });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Failed to save pipeline changes.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Continuous Review stages are created/removed server-side via set-cpr-count.
  const handleCprChange = async (count: CprCount) => {
    if (!editionId || isSettingCpr || count === cprCount) return;
    if (dirty && !window.confirm("You have unsaved reorder/rename changes that will be replaced by the server-side pipeline. Continue?")) {
      return;
    }
    setIsSettingCpr(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/coordinator/set-cpr-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId, cprCount: count }),
      });
      const data: MutationResponse = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Failed to update Continuous Review depth.");
      }
      if (!data.events) {
        throw new Error("Server returned no updated stage list.");
      }
      setEvents(data.events.map(mapApiEvent));
      setDirty(false);
      setFeedback({
        type: "success",
        msg: `Configured pipeline for ${count} Continuous Project Review rounds.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Failed to update Continuous Review depth.",
      });
    } finally {
      setIsSettingCpr(false);
    }
  };

  // Clone an entire prior edition into a clean workspace.
  const handleClone = async () => {
    if (!templateSlug || !cloneName.trim() || !cloneSlug.trim()) {
      setFeedback({ type: "error", msg: "Template edition, new edition title, and new slug are required." });
      return;
    }
    setIsCloning(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/coordinator/clone-edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSlug: templateSlug,
          newName: cloneName.trim(),
          newSlug: cloneSlug.trim().toLowerCase().replace(/\s+/g, "-"),
          academicYear: cloneAcademicYear.trim() || undefined,
        }),
      });
      const data: MutationResponse & { edition?: unknown } = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Failed to clone edition.");
      }
      setCloneModalOpen(false);
      setFeedback({
        type: "success",
        msg: `Successfully cloned "${templateSlug}" into "${cloneName.trim()}" (${cloneSlug.trim().toLowerCase().replace(/\s+/g, "-")}). Reload this page on the new edition to see its pipeline.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Failed to clone edition.",
      });
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <CoordinatorShell
      title="Event Pipeline & Program Lifecycle"
      description={
        editionName
          ? `Configure, reorder, and rename the live stage pipeline for ${editionName}. Set Continuous Project Review depth.`
          : "Configure, reorder, and rename the live stage pipeline. Set Continuous Project Review depth."
      }
      action={
        <div className="flex gap-2">
          <ActionButton variant="outline" onClick={() => setCloneModalOpen(true)}>
            Clone From Prior Edition
          </ActionButton>
          <ActionButton
            disabled
            title="Stage count is configured via Continuous Reviews (3–5) and edition cloning"
          >
            + Add Custom Stage
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {feedback && (
          <Alert variant={feedback.type} title="Pipeline Notice">
            {feedback.msg}
          </Alert>
        )}

        {!loading && !loadError && (
          <Alert variant="info" title="How stages are configured">
            Stage count is configured via Continuous Reviews (3–5) and edition cloning. Individual
            stage add/remove is not supported by the API, so those controls stay disabled.
          </Alert>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading pipeline for {editionSlug}…</p>
          </div>
        ) : loadError ? (
          <div className="space-y-4">
            <Alert variant="error" title="Unable to load the event pipeline">
              {loadError}
            </Alert>
            <div className="flex justify-end">
              <ActionButton variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                Retry Loading
              </ActionButton>
            </div>
          </div>
        ) : (
          <>
            {/* CPR Count Selector Box */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Continuous Project Review (CPR) Depth
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Configure the number of rolling reviews between Innovatz (Screening) and POC (Proof of Concept).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-700">CPR Rounds:</span>
                  <div className="inline-flex rounded-md shadow-sm">
                    {[3, 4, 5].map((cnt) => (
                      <ActionButton
                        key={cnt}
                        size="sm"
                        variant={cprCount === cnt ? "primary" : "outline"}
                        onClick={() => handleCprChange(cnt as CprCount)}
                        disabled={isSettingCpr || isSaving}
                        className="first:rounded-r-none last:rounded-l-none first:border-r-0 last:border-l-0"
                      >
                        {cnt} Rounds
                      </ActionButton>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sequential Stages List */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm text-slate-900">
                    Ordered Event Pipeline ({events.length} Total Stages)
                  </h3>
                  {dirty && <Badge variant="warning">Unsaved changes</Badge>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    Reorder, rename, then save to persist.
                  </span>
                  <ActionButton
                    size="sm"
                    isLoading={isSaving}
                    disabled={!dirty || !editionId || isSettingCpr}
                    onClick={savePipeline}
                  >
                    Save Pipeline Changes
                  </ActionButton>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">No stages configured for this edition.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Configure Continuous Project Review depth above, or clone a prior edition to seed the pipeline.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {events.map((stg, idx) => (
                    <div
                      key={stg.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 font-mono text-sm font-extrabold text-indigo-700 border border-indigo-200">
                          {stg.sequenceIndex}
                        </span>
                        <div>
                          <input
                            value={stg.name}
                            onChange={(e) => handleRename(stg.id, e.target.value)}
                            disabled={isReadOnly || isSaving}
                            aria-label={`Rename stage ${stg.slug}`}
                            className="block w-full max-w-[18rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-slate-900 hover:border-slate-200 focus:border-indigo-300 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                          />
                          <p className="text-xs text-slate-500 font-mono">slug: {stg.slug}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <Badge variant={stg.reviewType === "ASYNC_MULTI_REVIEWER" ? "purple" : "default"}>
                          {stg.reviewType === "ASYNC_MULTI_REVIEWER" ? "Async (3 Reviewers)" : "Live Panel"}
                        </Badge>

                        <Badge variant={stg.status === "SUBMISSION_OPEN" ? "info" : "default"}>
                          {stg.status}
                        </Badge>

                        <div className="flex items-center gap-1">
                          <ActionButton
                            size="sm"
                            variant="outline"
                            disabled={idx === 0 || isSaving || isSettingCpr}
                            onClick={() => applyMove(idx, -1)}
                            title="Move stage earlier in sequence"
                          >
                            ↑
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            variant="outline"
                            disabled={idx === events.length - 1 || isSaving || isSettingCpr}
                            onClick={() => applyMove(idx, 1)}
                            title="Move stage later in sequence"
                          >
                            ↓
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            variant="danger"
                            disabled
                            title="Individual stage deletion is not supported — stage count is configured via Continuous Reviews (3–5) and edition cloning"
                          >
                            ✕
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Clone Edition Modal */}
      <Modal
        isOpen={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        title="Clone Program From Prior Edition"
        description="Duplicates event sequence, rubrics, and scale anchors into a clean workspace."
      >
        <div className="space-y-4">
          <Select
            label="Template Edition"
            value={templateSlug}
            onChange={(e) => setTemplateSlug(e.target.value)}
            options={[
              { value: "ht25", label: "HackTrack 2025 (ht25)" },
              { value: "ht26", label: "HackTrack 2026 (ht26)" },
            ]}
          />
          <Input
            label="New Edition Title"
            placeholder="HackTrack 2027"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
          />
          <Input
            label="New Edition Slug"
            placeholder="ht27"
            value={cloneSlug}
            onChange={(e) => setCloneSlug(e.target.value)}
          />
          <Input
            label="Academic Year"
            placeholder="2026-2027"
            value={cloneAcademicYear}
            onChange={(e) => setCloneAcademicYear(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCloneModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton onClick={handleClone} isLoading={isCloning}>
              Confirm Cloning
            </ActionButton>
          </div>
        </div>
      </Modal>
    </CoordinatorShell>
  );
}