"use client";

import { useState } from "react";
import { CoordinatorShell } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

interface EventItem {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  reviewType: "ASYNC_MULTI_REVIEWER" | "LIVE_PANEL";
  status: string;
}

export default function EventsConfigPage() {
  const [events, setEvents] = useState<EventItem[]>([
    { id: "e1", name: "Ideathon", slug: "ideathon", sequenceIndex: 1, reviewType: "ASYNC_MULTI_REVIEWER", status: "SUBMISSION_OPEN" },
    { id: "e2", name: "Innovatz", slug: "innovatz", sequenceIndex: 2, reviewType: "LIVE_PANEL", status: "UPCOMING" },
    { id: "e3", name: "Continuous Project Review 1 (CPR 1)", slug: "cpr-1", sequenceIndex: 3, reviewType: "LIVE_PANEL", status: "UPCOMING" },
    { id: "e4", name: "Continuous Project Review 2 (CPR 2)", slug: "cpr-2", sequenceIndex: 4, reviewType: "LIVE_PANEL", status: "UPCOMING" },
    { id: "e5", name: "Continuous Project Review 3 (CPR 3)", slug: "cpr-3", sequenceIndex: 5, reviewType: "LIVE_PANEL", status: "UPCOMING" },
    { id: "e6", name: "Proof of Concept (POC)", slug: "poc", sequenceIndex: 6, reviewType: "LIVE_PANEL", status: "UPCOMING" },
    { id: "e7", name: "Demo Day", slug: "demo-day", sequenceIndex: 7, reviewType: "LIVE_PANEL", status: "UPCOMING" },
  ]);

  const [cprCount, setCprCount] = useState<number>(3);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventModality, setNewEventModality] = useState<"ASYNC_MULTI_REVIEWER" | "LIVE_PANEL">("LIVE_PANEL");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Move stage up
  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...events];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    updated.forEach((e, idx) => (e.sequenceIndex = idx + 1));
    setEvents(updated);
    setFeedback({ type: "success", msg: "Stage sequence updated. Remember to save changes." });
  };

  // Move stage down
  const moveDown = (index: number) => {
    if (index === events.length - 1) return;
    const updated = [...events];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    updated.forEach((e, idx) => (e.sequenceIndex = idx + 1));
    setEvents(updated);
    setFeedback({ type: "success", msg: "Stage sequence updated. Remember to save changes." });
  };

  // Handle CPR Count Change (3 to 5)
  const handleCprChange = (count: number) => {
    setCprCount(count);
    // Dynamically regenerate CPR stages
    const nonCprs = events.filter((e) => !e.slug.startsWith("cpr-"));
    const ideathon = nonCprs.filter((e) => e.slug === "ideathon");
    const innovatz = nonCprs.filter((e) => e.slug === "innovatz");
    const poc = nonCprs.filter((e) => e.slug === "poc");
    const demoDay = nonCprs.filter((e) => e.slug === "demo-day");
    const others = nonCprs.filter((e) => !["ideathon", "innovatz", "poc", "demo-day"].includes(e.slug));

    const newCprs: EventItem[] = [];
    for (let i = 1; i <= count; i++) {
      newCprs.push({
        id: `cpr-${i}`,
        name: `Continuous Project Review ${i} (CPR ${i})`,
        slug: `cpr-${i}`,
        sequenceIndex: 2 + i,
        reviewType: "LIVE_PANEL",
        status: "UPCOMING",
      });
    }

    const merged = [...ideathon, ...innovatz, ...newCprs, ...poc, ...demoDay, ...others];
    merged.forEach((e, idx) => (e.sequenceIndex = idx + 1));
    setEvents(merged);
    setFeedback({
      type: "success",
      msg: `Configured pipeline for ${count} Continuous Project Review rounds.`,
    });
  };

  // Add Custom Event Stage
  const handleAddEvent = () => {
    if (!newEventName.trim()) return;
    const slug = newEventName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const updated = [
      ...events,
      {
        id: `ev_${Date.now()}`,
        name: newEventName.trim(),
        slug,
        sequenceIndex: events.length + 1,
        reviewType: newEventModality,
        status: "UPCOMING",
      },
    ];
    setEvents(updated);
    setAddModalOpen(false);
    setNewEventName("");
    setFeedback({ type: "success", msg: `Added event stage "${newEventName}".` });
  };

  // Remove Event Stage
  const handleRemoveEvent = (id: string, name: string) => {
    const updated = events.filter((e) => e.id !== id);
    updated.forEach((e, idx) => (e.sequenceIndex = idx + 1));
    setEvents(updated);
    setFeedback({ type: "success", msg: `Removed stage "${name}".` });
  };

  return (
    <CoordinatorShell
      title="Event Pipeline & Program Lifecycle"
      description="Configure, reorder, and add stages for HackTrack 2026. Set Continuous Project Review depth."
      action={
        <div className="flex gap-2">
          <ActionButton variant="outline" onClick={() => setCloneModalOpen(true)}>
            Clone From Prior Edition
          </ActionButton>
          <ActionButton onClick={() => setAddModalOpen(true)}>+ Add Custom Stage</ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {feedback && (
          <Alert variant={feedback.type === "success" ? "success" : "error"} title="Pipeline Notice">
            {feedback.msg}
          </Alert>
        )}

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
                    onClick={() => handleCprChange(cnt)}
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
            <h3 className="font-bold text-sm text-slate-900">
              Ordered Event Pipeline ({events.length} Total Stages)
            </h3>
            <span className="text-xs text-slate-500">Reorder stages using ↑ and ↓ buttons</span>
          </div>

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
                    <p className="font-bold text-sm text-slate-900">{stg.name}</p>
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
                      disabled={idx === 0}
                      onClick={() => moveUp(idx)}
                      title="Move stage earlier in sequence"
                    >
                      ↑
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="outline"
                      disabled={idx === events.length - 1}
                      onClick={() => moveDown(idx)}
                      title="Move stage later in sequence"
                    >
                      ↓
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemoveEvent(stg.id, stg.name)}
                      title="Remove stage from pipeline"
                    >
                      ✕
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Stage Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Event Stage to Pipeline"
        description="Insert an additional review gate or presentation event."
      >
        <div className="space-y-4">
          <Input
            label="Event Title"
            placeholder="e.g. Midterm Poster Session"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
          />
          <Select
            label="Review Modality"
            value={newEventModality}
            onChange={(e) => setNewEventModality(e.target.value as any)}
            options={[
              { value: "LIVE_PANEL", label: "Live Panel Evaluation" },
              { value: "ASYNC_MULTI_REVIEWER", label: "Asynchronous 3-Reviewer Review" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton onClick={handleAddEvent}>Add Stage</ActionButton>
          </div>
        </div>
      </Modal>

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
            options={[
              { value: "ht26", label: "HackTrack 2026 (7 stages, 3 CPR rounds)" },
              { value: "ht25", label: "HackTrack 2025 (8 stages, 4 CPR rounds)" },
            ]}
          />
          <Input label="New Edition Title" placeholder="HackTrack 2027" defaultValue="HackTrack 2027" />
          <Input label="New Edition Slug" placeholder="ht27" defaultValue="ht27" />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCloneModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton
              onClick={() => {
                setCloneModalOpen(false);
                setFeedback({
                  type: "success",
                  msg: "Successfully cloned template into HackTrack 2027 workspace.",
                });
              }}
            >
              Confirm Cloning
            </ActionButton>
          </div>
        </div>
      </Modal>
    </CoordinatorShell>
  );
}
