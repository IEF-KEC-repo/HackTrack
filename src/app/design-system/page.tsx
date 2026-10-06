"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      <div>
        <Badge variant="purple">HackTrack Design System</Badge>
        <h1 className="mt-2 text-3xl font-black text-slate-900">
          Reusable Component Library & UI Primitives
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Standardized WCAG 2.1 AA accessible atoms for buttons, forms, status badges, tables, and dialogs.
        </p>
      </div>

      {/* 1. BUTTONS */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
          Buttons & Actions
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary Action</Button>
          <Button variant="danger">Danger Action</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" isLoading>
            Loading State
          </Button>
          <Button variant="primary" disabled>
            Disabled State
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button size="sm">Small (sm)</Button>
          <Button size="md">Medium (md)</Button>
          <Button size="lg">Large (lg)</Button>
        </div>
      </section>

      {/* 2. FORM CONTROLS */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
          Form Controls & Validation States
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Team Name" placeholder="e.g. QuantumForge" hint="Unique team moniker" />
          <Input
            label="Registration Code"
            defaultValue="HT26-T001"
            disabled
            hint="System auto-generated identifier"
          />
          <Input
            label="Google Slides Deck URL"
            defaultValue="https://invalid-url.com"
            error="Must be a valid Google Slides shareable link"
          />
          <Select
            label="Review Modality"
            options={[
              { value: "ASYNC", label: "Asynchronous 3-Reviewer Review" },
              { value: "PANEL", label: "Live Presentation Panel" },
            ]}
          />
          <Select
            label="Continuous Project Review (CPR) Count"
            options={[
              { value: "3", label: "3 Rounds (Standard)" },
              { value: "4", label: "4 Rounds (Extended)" },
              { value: "5", label: "5 Rounds (Comprehensive)" },
            ]}
          />
        </div>
      </section>

      {/* 3. STATUS BADGES */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
          Status Badges & Indicators
        </h2>
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant="default">Draft Stage</Badge>
          <Badge variant="info">Submission Open</Badge>
          <Badge variant="success">Completed / Promoted</Badge>
          <Badge variant="warning">At Risk (Yellow)</Badge>
          <Badge variant="danger">Eliminated / Blocked (Red)</Badge>
          <Badge variant="purple">Coordinator (Manage)</Badge>
        </div>
      </section>

      {/* 4. ALERTS & NOTIFICATIONS */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
          Alert Banners & Notifications
        </h2>
        <div className="space-y-3">
          <Alert variant="info" title="View-Only Mode Active">
            You are signed in as a View-Only Coordinator. All modification buttons and forms are disabled.
          </Alert>
          <Alert variant="success" title="Normalization Completed">
            Ideathon scores successfully standardized across 30 evaluators using Z-score cohort scaling.
          </Alert>
          <Alert variant="warning" title="Submission Window Closing">
            Continuous Project Review 1 locks in 2 hours. 14 teams have pending slide revisions.
          </Alert>
          <Alert variant="error" title="Rubric Weight Invalid">
            Criterion weights sum to 92.5%. You must adjust weights to sum to exactly 100.0%.
          </Alert>
        </div>
      </section>

      {/* 5. MODALS & DIALOGS */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
          Dialogs & Drawers
        </h2>
        <Button onClick={() => setModalOpen(true)}>Open Accessible Modal Dialog</Button>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Clone Previous Edition Template"
          description="Copy event sequence, criteria weights, and scale anchors from a prior year."
        >
          <div className="space-y-4">
            <Select
              label="Source Edition Template"
              options={[
                { value: "ht26", label: "HackTrack 2026 (7 stages, 3 CPR rounds)" },
                { value: "ht25", label: "HackTrack 2025 (8 stages, 4 CPR rounds)" },
              ]}
            />
            <Input label="New Edition Title" placeholder="HackTrack 2027" />
            <Input label="New Edition Slug" placeholder="ht27" />
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Clone Edition</Button>
            </div>
          </div>
        </Modal>
      </section>

      {/* 6. DATA TABLES */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
          Responsive Data Table
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Sequence</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Event Stage</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Review Modality</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr>
                <td className="px-4 py-3 font-mono font-bold text-slate-500">1</td>
                <td className="px-4 py-3 font-semibold text-slate-900">Ideathon</td>
                <td className="px-4 py-3 text-slate-600">Async (3 Reviewers / Idea)</td>
                <td className="px-4 py-3">
                  <Badge variant="info">Submission Open</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline">
                    Edit Rubric
                  </Button>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono font-bold text-slate-500">2</td>
                <td className="px-4 py-3 font-semibold text-slate-900">Innovatz</td>
                <td className="px-4 py-3 text-slate-600">Live Panel Presentation</td>
                <td className="px-4 py-3">
                  <Badge variant="default">Upcoming</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline">
                    Edit Rubric
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
