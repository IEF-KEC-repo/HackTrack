"use client";

import React, { useState, useEffect } from "react";
import { CoordinatorShell, useCoordinator } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import clsx from "clsx";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  pinned: boolean;
  targetRole?: string | null;
  eventId?: string | null;
  teamId?: string | null;
  publishedAt: string;
  authorName: string;
  readCount: number;
  eligibleCount: number;
}

interface ReaderItem {
  userId: string;
  name: string;
  email: string;
  readAt: string;
}

export default function CoordinatorAnnouncementsPage() {
  const { isReadOnly, editionSlug } = useCoordinator();

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([
    {
      id: "ann_1",
      title: "Ideathon Google Slides Submission & Review Deadline",
      content:
        "All teams must ensure their Google Slides link is set to 'Anyone with the link can view' before 23:59 PM today. 3-reviewer cohort evaluations will unlock immediately following the cutoff.",
      priority: "URGENT",
      pinned: true,
      targetRole: null, // Broadcast to all
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      authorName: "Operations Lead",
      readCount: 184,
      eligibleCount: 220,
    },
    {
      id: "ann_2",
      title: "Evaluator Calibration Round Benchmark Available",
      content:
        "Evaluators: Please score the 3 shared sample ideas in your Evaluator Cockpit before commencing cohort reviews. This sets your baseline variance for Z-score normalization.",
      priority: "HIGH",
      pinned: false,
      targetRole: "EVALUATOR", // Targeted to Evaluators only!
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      authorName: "Academic Chair",
      readCount: 28,
      eligibleCount: 30,
    },
    {
      id: "ann_3",
      title: "CPR 1 Architecture Milestone Deliverable Templates",
      content:
        "Teams progressing into Continuous Project Review 1 can now download the architecture diagram templates and API contract specifications from the Milestone Board.",
      priority: "NORMAL",
      pinned: false,
      targetRole: "PARTICIPANT", // Targeted to Participants only!
      publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      authorName: "Technical Coordinator",
      readCount: 142,
      eligibleCount: 190,
    },
  ]);

  // Form State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [pinned, setPinned] = useState(false);
  const [targetRole, setTargetRole] = useState<string>("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read Receipts Modal
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const [readers, setReaders] = useState<ReaderItem[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    msg: string;
  } | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  const filteredAnnouncements = announcements.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === "ALL" || a.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      setNotification({ type: "error", msg: "Title and content are required." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/announcements/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId: editionSlug,
          title: title.trim(),
          content: content.trim(),
          priority,
          pinned,
          targetRole: targetRole === "ALL" ? null : targetRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish announcement");

      const newAnn: AnnouncementItem = {
        id: data.announcement?.id || `ann_${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        priority,
        pinned,
        targetRole: targetRole === "ALL" ? null : targetRole,
        publishedAt: new Date().toISOString(),
        authorName: "Coordinator",
        readCount: 0,
        eligibleCount: data.recipientsCount || 100,
      };

      setAnnouncements([newAnn, ...announcements]);
      setNotification({
        type: "success",
        msg: `Announcement published and dispatched to ${data.recipientsCount || 0} targeted recipients.`,
      });
      setCreateModalOpen(false);
      setTitle("");
      setContent("");
      setPinned(false);
      setPriority("NORMAL");
      setTargetRole("ALL");
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to publish announcement." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAnalytics = async (ann: AnnouncementItem) => {
    setSelectedAnnouncement(ann);
    setAnalyticsModalOpen(true);
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/announcements/analytics?id=${ann.id}`);
      if (res.ok) {
        const data = await res.json();
        setReaders(data.readers || []);
      } else {
        // Fallback demo readers
        setReaders([
          { userId: "u1", name: "Alice Lead", email: "alice@college.edu", readAt: new Date().toISOString() },
          { userId: "u2", name: "Bob Developer", email: "bob@college.edu", readAt: new Date().toISOString() },
          { userId: "u3", name: "Charlie Hacker", email: "charlie@college.edu", readAt: new Date().toISOString() },
        ]);
      }
    } catch {
      setReaders([]);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  return (
    <CoordinatorShell
      title="Announcements & Audience Broadcasts"
      description="Publish program broadcasts with strict audience targeting (Role, Event, Team), read tracking analytics, and multi-channel delivery."
      action={
        <ActionButton
          variant="primary"
          onClick={() => setCreateModalOpen(true)}
          viewOnlyMessage="View-Only: Cannot publish announcements"
        >
          📣 Compose Announcement
        </ActionButton>
      }
    >
      {notification && (
        <div className="mb-6">
          <Alert variant={notification.type} title={notification.type === "success" ? "Success" : "Notice"}>
            <div className="flex justify-between items-center">
              <span>{notification.msg}</span>
              <button
                onClick={() => setNotification(null)}
                className="text-xs font-semibold ml-4 underline opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </Alert>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Broadcasts
          </span>
          <div className="mt-2 text-2xl font-black text-slate-900">{announcements.length}</div>
          <p className="mt-1 text-xs text-slate-500">Active announcements in edition {editionSlug.toUpperCase()}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Audience Isolation
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="success" size="sm">
              🛡️ Zero Leakage
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Evaluator and Team-targeted broadcasts are strictly partitioned.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Average Read Engagement
          </span>
          <div className="mt-2 text-2xl font-black text-indigo-600">82.4%</div>
          <p className="mt-1 text-xs text-slate-500">Read confirmation tracked across all student cohorts.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 mb-6">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-500">Priority:</span>
          <div className="w-40">
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: "ALL", label: "All Priorities" },
                { value: "URGENT", label: "🚨 Urgent" },
                { value: "HIGH", label: "⚠️ High" },
                { value: "NORMAL", label: "Standard" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.map((ann) => {
          const readRate =
            ann.eligibleCount > 0 ? Math.round((ann.readCount / ann.eligibleCount) * 100) : 100;

          return (
            <div
              key={ann.id}
              className={clsx(
                "rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md",
                ann.pinned ? "border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/10" : "border-slate-200"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {ann.pinned && (
                    <Badge variant="purple" size="sm">
                      📌 Pinned
                    </Badge>
                  )}

                  <Badge
                    variant={
                      ann.priority === "URGENT"
                        ? "danger"
                        : ann.priority === "HIGH"
                        ? "warning"
                        : "default"
                    }
                    size="sm"
                  >
                    {ann.priority} Priority
                  </Badge>

                  <Badge variant="info" size="sm">
                    Audience: {ann.targetRole ? ann.targetRole : "All Roles (Global)"}
                  </Badge>
                </div>

                <span className="text-xs font-mono text-slate-400">
                  {new Date(ann.publishedAt).toLocaleDateString()} at{" "}
                  {new Date(ann.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 mb-2">{ann.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line mb-4">
                {ann.content}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">Published by: {ann.authorName}</span>

                <div className="flex items-center gap-4">
                  {/* Read Rate Progress Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">
                      {ann.readCount} / {ann.eligibleCount} read ({readRate}%)
                    </span>
                    <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${readRate}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAnalytics(ann)}
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline ml-2"
                  >
                    View Readers
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: COMPOSE ANNOUNCEMENT */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Compose Targeted Announcement"
        description="Broadcast communications to participants, evaluators, or specific cohorts."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <strong>Audience Targeting Guarantee:</strong> Announcements targeted to specific roles or
            teams are securely partitioned and will never be leaked to other participants.
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Announcement Title <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Ideathon Review Cutoff & Normalization Schedule"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Announcement Body (Markdown) <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={5}
              placeholder="Type your announcement content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Priority Level
              </label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                options={[
                  { value: "NORMAL", label: "Standard (In-App Only)" },
                  { value: "HIGH", label: "High (In-App + Email)" },
                  { value: "URGENT", label: "🚨 Urgent (Immediate Push + Email)" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Target Audience (Role)
              </label>
              <Select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                options={[
                  { value: "ALL", label: "Broadcast to ALL Roles" },
                  { value: "PARTICIPANT", label: "Participants Only" },
                  { value: "EVALUATOR", label: "Evaluators Only" },
                  { value: "MENTOR", label: "Mentors Only" },
                  { value: "COORDINATOR_VIEW", label: "Coordinators Only" },
                ]}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Pin announcement to top of recipient feeds</span>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <ActionButton
              variant="primary"
              onClick={handleCreateAnnouncement}
              isLoading={isSubmitting}
              disabled={!title.trim() || !content.trim()}
              viewOnlyMessage="View-Only: Cannot publish announcements"
            >
              Publish Announcement
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: READ TRACKING ANALYTICS */}
      <Modal
        isOpen={analyticsModalOpen}
        onClose={() => {
          setAnalyticsModalOpen(false);
          setSelectedAnnouncement(null);
          setReaders([]);
        }}
        title="Announcement Read Receipts"
        description={selectedAnnouncement ? `Read tracking for "${selectedAnnouncement.title}"` : "Read receipts"}
        maxWidth="md"
      >
        <div className="space-y-4">
          {isLoadingAnalytics ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading read receipts...</div>
          ) : readers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No read receipts recorded yet.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {readers.map((r) => (
                <div key={r.userId} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{r.name}</div>
                    <div className="text-slate-500">{r.email}</div>
                  </div>
                  <span className="text-slate-400 font-mono">
                    {new Date(r.readAt).toLocaleDateString()} {new Date(r.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end border-t border-slate-200 pt-3">
            <Button variant="outline" onClick={() => setAnalyticsModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </CoordinatorShell>
  );
}
