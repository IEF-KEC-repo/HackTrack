"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [notifyAnnouncements, setNotifyAnnouncements] = useState(true);
  const [notifyMilestones, setNotifyMilestones] = useState(true);
  const [notifyCheckIns, setNotifyCheckIns] = useState(true);
  const [notifyEvaluations, setNotifyEvaluations] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPreferences();
    }
  }, [isOpen]);

  const loadPreferences = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setEmailEnabled(data.preferences.emailEnabled ?? true);
          setInAppEnabled(data.preferences.inAppEnabled ?? true);
          setNotifyAnnouncements(data.preferences.notifyAnnouncements ?? true);
          setNotifyMilestones(data.preferences.notifyMilestones ?? true);
          setNotifyCheckIns(data.preferences.notifyCheckIns ?? true);
          setNotifyEvaluations(data.preferences.notifyEvaluations ?? true);
        }
      }
    } catch (err) {
      console.error("Failed to load preferences", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled,
          inAppEnabled,
          notifyAnnouncements,
          notifyMilestones,
          notifyCheckIns,
          notifyEvaluations,
        }),
      });

      if (!res.ok) throw new Error("Failed to save preferences");

      setFeedback({ type: "success", msg: "Notification preferences updated successfully." });
      setTimeout(() => {
        onClose();
        setFeedback(null);
      }, 1000);
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to save preferences." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notification Preferences"
      description="Manage how and when you receive HackTrack notifications and email digests."
      maxWidth="md"
    >
      <div className="space-y-6">
        {feedback && (
          <Alert variant={feedback.type} title={feedback.type === "success" ? "Saved" : "Error"}>
            {feedback.msg}
          </Alert>
        )}

        {/* Global Delivery Channels */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Delivery Channels
          </h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">In-App Notifications</span>
                <span className="text-xs text-slate-500">Show notification bell alerts and popover drawer</span>
              </div>
              <input
                type="checkbox"
                checked={inAppEnabled}
                onChange={(e) => setInAppEnabled(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">Email Delivery</span>
                <span className="text-xs text-slate-500">Send copies to your registered institutional email</span>
              </div>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Category Controls */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Notification Categories
          </h4>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">📢 Announcements</span>
                <span className="text-xs text-slate-500">Broadcast updates and committee announcements</span>
              </div>
              <input
                type="checkbox"
                checked={notifyAnnouncements}
                onChange={(e) => setNotifyAnnouncements(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">⏰ Milestones & Deadlines</span>
                <span className="text-xs text-slate-500">48-hour due-soon reminders and overdue alerts</span>
              </div>
              <input
                type="checkbox"
                checked={notifyMilestones}
                onChange={(e) => setNotifyMilestones(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">📅 Mentorship Check-Ins</span>
                <span className="text-xs text-slate-500">Fortnightly review cadences and check-in logs</span>
              </div>
              <input
                type="checkbox"
                checked={notifyCheckIns}
                onChange={(e) => setNotifyCheckIns(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">📋 Evaluation & Scoring</span>
                <span className="text-xs text-slate-500">Review assignments, score releases, and unlock notices</span>
              </div>
              <input
                type="checkbox"
                checked={notifyEvaluations}
                onChange={(e) => setNotifyEvaluations(e.target.checked)}
                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
            Save Preferences
          </Button>
        </div>
      </div>
    </Modal>
  );
};
