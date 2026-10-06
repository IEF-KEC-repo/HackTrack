"use client";

import { useState } from "react";
import { CoordinatorShell } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import clsx from "clsx";

interface ScaleAnchor {
  level: number;
  label: string;
  description: string;
}

interface CriterionForm {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
  weightPercentage: number;
  anchors: ScaleAnchor[];
}

export default function RubricsConfigPage() {
  const [selectedEvent, setSelectedEvent] = useState("ideathon");
  const [criteria, setCriteria] = useState<CriterionForm[]>([
    {
      id: "c1",
      title: "Problem Statement & Relevance",
      description: "Clarity of problem definition, societal or industry impact.",
      maxPoints: 25,
      weightPercentage: 25,
      anchors: [
        { level: 1, label: "Vague / Unclear", description: "Problem is ill-defined or lacks practical relevance." },
        { level: 3, label: "Clearly Stated", description: "Clear problem with established user personas." },
        { level: 5, label: "Compelling & Critical", description: "High-impact challenge backed by empirical market data." },
      ],
    },
    {
      id: "c2",
      title: "Technical Feasibility & Architecture",
      description: "Viability of proposed engineering approach and tech stack.",
      maxPoints: 30,
      weightPercentage: 30,
      anchors: [
        { level: 1, label: "Unviable / Flawed", description: "Architecture violates fundamental computing principles." },
        { level: 3, label: "Sound Architecture", description: "Standard architecture with realistic components." },
        { level: 5, label: "Production Grade", description: "Deep architectural rigor with clear latency and scale targets." },
      ],
    },
    {
      id: "c3",
      title: "Innovation & Originality",
      description: "Novelty of approach compared to existing solutions.",
      maxPoints: 25,
      weightPercentage: 25,
      anchors: [
        { level: 1, label: "Derivative", description: "Direct replica of common tutorial projects." },
        { level: 3, label: "Novel Application", description: "Fresh application of known algorithms to new domain." },
        { level: 5, label: "Breakthrough Novelty", description: "Unprecedented methodology or novel patentable insight." },
      ],
    },
    {
      id: "c4",
      title: "Presentation & Deck Quality",
      description: "Structure, visual clarity, and rigor of the Google Slides deck.",
      maxPoints: 20,
      weightPercentage: 20,
      anchors: [
        { level: 1, label: "Disorganized", description: "Missing critical slides; poor formatting and visuals." },
        { level: 3, label: "Clear Structure", description: "Clean slide hierarchy with readable diagrams." },
        { level: 5, label: "Executive Standard", description: "Flawless narrative, compelling data visualisations." },
      ],
    },
  ]);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weightPercentage) || 0), 0);
  const isValidWeight = Math.abs(totalWeight - 100) < 0.001;

  const updateCriterion = (index: number, field: keyof CriterionForm, value: any) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  };

  const updateAnchor = (criterionIdx: number, anchorIdx: number, field: keyof ScaleAnchor, value: any) => {
    const updated = [...criteria];
    const anchors = [...updated[criterionIdx].anchors];
    anchors[anchorIdx] = { ...anchors[anchorIdx], [field]: value };
    updated[criterionIdx].anchors = anchors;
    setCriteria(updated);
  };

  const addCriterion = () => {
    setCriteria([
      ...criteria,
      {
        id: `c_${Date.now()}`,
        title: "New Criterion",
        description: "",
        maxPoints: 20,
        weightPercentage: 0,
        anchors: [
          { level: 1, label: "Poor", description: "" },
          { level: 3, label: "Proficient", description: "" },
          { level: 5, label: "Exemplary", description: "" },
        ],
      },
    ]);
  };

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!isValidWeight) {
      setFeedback({
        type: "error",
        msg: `Cannot save: Criterion weights must sum to exactly 100%. Current sum is ${totalWeight}%.`,
      });
      return;
    }
    setFeedback({
      type: "success",
      msg: `Rubric for "${selectedEvent.toUpperCase()}" saved successfully with ${criteria.length} criteria and scale anchors.`,
    });
  };

  return (
    <CoordinatorShell
      title="Rubric & Scale Anchor Configuration"
      description="Design weighted scoring criteria and calibrate performance scale anchors per event."
      action={
        <div className="flex items-center gap-3">
          <ActionButton onClick={addCriterion} variant="outline">
            + Add Criterion
          </ActionButton>
          <ActionButton onClick={handleSave} disabled={!isValidWeight}>
            Save Rubric (100%)
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {feedback && (
          <Alert variant={feedback.type === "success" ? "success" : "error"} title="Rubric Status">
            {feedback.msg}
          </Alert>
        )}

        {/* Event Selector & Live Weight Meter */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="w-full md:w-80">
            <Select
              label="Select Event Stage"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              options={[
                { value: "ideathon", label: "Ideathon (Gate 1 - 3 Reviewers)" },
                { value: "innovatz", label: "Innovatz (Gate 2 - Live Pitch)" },
                { value: "cpr-1", label: "Continuous Project Review 1" },
                { value: "cpr-2", label: "Continuous Project Review 2" },
                { value: "cpr-3", label: "Continuous Project Review 3" },
                { value: "poc", label: "Proof of Concept (POC)" },
                { value: "demo-day", label: "Demo Day (Grand Finale)" },
              ]}
            />
          </div>

          {/* Live Weight Sum Indicator */}
          <div className="flex-1 max-w-md">
            <div className="flex justify-between items-center text-xs font-semibold uppercase mb-1">
              <span>Total Criteria Weight</span>
              <span
                className={clsx(
                  "font-mono text-sm",
                  isValidWeight ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"
                )}
              >
                {totalWeight}% / 100% {isValidWeight ? "✓ Valid" : "⚠️ Must Equal 100%"}
              </span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className={clsx(
                  "h-full transition-all duration-300",
                  isValidWeight ? "bg-emerald-500" : totalWeight > 100 ? "bg-rose-500" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
            {!isValidWeight && (
              <p className="mt-1 text-xs text-rose-600">
                {totalWeight < 100
                  ? `Need ${100 - totalWeight}% more to complete the rubric.`
                  : `Over by ${totalWeight - 100}%. Reduce criteria weights.`}
              </p>
            )}
          </div>
        </div>

        {/* Criteria Cards */}
        <div className="space-y-6">
          {criteria.map((crit, critIdx) => (
            <div
              key={crit.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 font-bold text-xs text-indigo-700">
                    {critIdx + 1}
                  </span>
                  <h3 className="font-bold text-base text-slate-900">{crit.title || "Untitled"}</h3>
                  <Badge variant="purple" size="sm">
                    Weight: {crit.weightPercentage}%
                  </Badge>
                </div>
                <ActionButton
                  size="sm"
                  variant="ghost"
                  onClick={() => removeCriterion(critIdx)}
                  disabled={criteria.length <= 1}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Delete Criterion
                </ActionButton>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Criterion Title"
                  value={crit.title}
                  onChange={(e) => updateCriterion(critIdx, "title", e.target.value)}
                />
                <Input
                  label="Max Raw Points"
                  type="number"
                  value={crit.maxPoints}
                  onChange={(e) => updateCriterion(critIdx, "maxPoints", Number(e.target.value))}
                />
                <Input
                  label="Weight Percentage (%)"
                  type="number"
                  value={crit.weightPercentage}
                  onChange={(e) => updateCriterion(critIdx, "weightPercentage", Number(e.target.value))}
                />
              </div>

              <Input
                label="Evaluation Description & Guidance"
                value={crit.description}
                onChange={(e) => updateCriterion(critIdx, "description", e.target.value)}
                placeholder="What evaluators should look for..."
              />

              {/* Scale Level Anchors */}
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Descriptive Scale Anchors (Calibrates Reviewers)
                  </h4>
                  <span className="text-xs text-slate-500">Guides consistent grading across panels</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {crit.anchors.map((anchor, aIdx) => (
                    <div key={anchor.level} className="rounded-md bg-white p-3 border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-xs font-bold text-indigo-700">
                          Level {anchor.level}
                        </span>
                        <input
                          type="text"
                          value={anchor.label}
                          onChange={(e) => updateAnchor(critIdx, aIdx, "label", e.target.value)}
                          placeholder="Level Label (e.g. Good)"
                          className="text-xs font-bold text-slate-800 text-right bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-indigo-500 w-32"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={anchor.description}
                        onChange={(e) => updateAnchor(critIdx, aIdx, "description", e.target.value)}
                        placeholder="Anchor description for reviewer..."
                        className="w-full text-xs text-slate-600 bg-transparent resize-none focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CoordinatorShell>
  );
}
