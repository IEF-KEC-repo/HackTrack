"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { NotificationPreferencesModal } from "./NotificationPreferencesModal";
import clsx from "clsx";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "announcements">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif_demo_1",
      type: "SLIDES_LINK_MISSING",
      title: "Action Required: Google Slides Deck Missing",
      message: "Please submit your Google Slides shareable link for Ideathon before the deadline.",
      actionUrl: "/team",
      isRead: false,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: "notif_demo_2",
      type: "ANNOUNCEMENT",
      title: "📢 Ideathon Review Schedule Finalized",
      message: "Independent 3-reviewer cohort evaluations begin tomorrow at 09:00 AM.",
      actionUrl: "/coordinator/announcements",
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "notif_demo_3",
      type: "MILESTONE_DUE_SOON",
      title: "⏰ Milestone Due Soon: Architecture Diagram",
      message: "System Architecture & API Contract deliverable is due in 48 hours.",
      actionUrl: "/team/milestones",
      isRead: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [unreadCount, setUnreadCount] = useState<number>(2);
  const [authenticated, setAuthenticated] = useState<boolean>(true);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch real notifications from API
  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications/list?limit=30");
      if (res.status === 401 || res.status === 403) {
        setAuthenticated(false);
        return;
      }
      if (res.ok) {
        setAuthenticated(true);
        const data = await res.json();
        if (data.notifications && data.notifications.length > 0) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount ?? 0);
        }
      }
    } catch {
      // Fallback to initial demo notifications in unauthenticated state
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // 1 minute poll
    return () => clearInterval(interval);
  }, [authenticated]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const handleMarkRead = async (id: string, actionUrl?: string | null) => {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread") return !n.isRead;
    if (activeTab === "announcements") return n.type === "ANNOUNCEMENT";
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "SLIDES_LINK_MISSING":
        return "⚠️";
      case "MILESTONE_DUE_SOON":
        return "⏰";
      case "MILESTONE_OVERDUE":
        return "🚨";
      case "CHECKIN_DUE":
      case "CHECKIN_OVERDUE":
        return "📅";
      case "REVIEW_ASSIGNED":
        return "📋";
      case "EVALUATION_REOPENED":
        return "🔓";
      case "FEEDBACK_RELEASED":
        return "📢";
      case "ANNOUNCEMENT":
        return "📣";
      case "TEAM_INVITE":
        return "🤝";
      default:
        return "ℹ️";
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`View notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        className="relative p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setPreferencesOpen(true);
                }}
                title="Notification Settings"
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-200 px-4 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={clsx(
                "py-2.5 px-2 border-b-2 transition-colors",
                activeTab === "all"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent hover:text-slate-700"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={clsx(
                "py-2.5 px-2 border-b-2 transition-colors",
                activeTab === "unread"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent hover:text-slate-700"
              )}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("announcements")}
              className={clsx(
                "py-2.5 px-2 border-b-2 transition-colors",
                activeTab === "announcements"
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent hover:text-slate-700"
              )}
            >
              Announcements
            </button>
          </div>

          {/* Notification Items List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <span className="text-2xl block mb-1">🎉</span>
                <p className="text-xs font-semibold text-slate-600">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No notifications matching this filter.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={clsx(
                    "p-3.5 hover:bg-slate-50 transition-colors flex gap-3 items-start cursor-pointer",
                    !notif.isRead && "bg-indigo-50/30"
                  )}
                  onClick={() => handleMarkRead(notif.id, notif.actionUrl)}
                >
                  <span className="text-lg select-none flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={clsx(
                          "text-xs line-clamp-1",
                          notif.isRead ? "font-semibold text-slate-800" : "font-black text-slate-900"
                        )}
                      >
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-slate-400">
                      <span>{formatRelativeTime(notif.createdAt)}</span>
                      {notif.actionUrl && (
                        <Link
                          href={notif.actionUrl}
                          className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Details →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-2 bg-slate-50 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setPreferencesOpen(true);
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Configure Notification Preferences
            </button>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
    </div>
  );
};
