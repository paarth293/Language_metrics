"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  CheckCheck,
  AlertCircle,
  Calendar,
  CreditCard,
  MessageSquare,
  Shield,
  Settings,
  Inbox,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type Toast = {
  id: string;
  message: string;
  kind: "error" | "success";
};

const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  SYSTEM: { icon: Settings, color: "text-brand", bg: "bg-brand/10" },
  BOOKING_UPDATE: { icon: Calendar, color: "text-trust", bg: "bg-trust/10" },
  PAYMENT_UPDATE: { icon: CreditCard, color: "text-amber-600", bg: "bg-amber-100" },
  CHAT_MESSAGE: { icon: MessageSquare, color: "text-brand", bg: "bg-brand/10" },
  VERIFICATION_UPDATE: { icon: Shield, color: "text-trust", bg: "bg-trust/10" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This Week";
  return "Earlier";
}

function broadcastUnreadCount(count: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("notifications-updated", { detail: { unreadCount: count } })
    );
  }
}

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-md backdrop-blur-sm animate-in slide-in-from-right-4 duration-300 ${
            t.kind === "error"
              ? "bg-danger/10 border-danger/20 text-danger"
              : "bg-trust/10 border-trust/20 text-trust"
          }`}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium flex-1">{t.message}</p>
          <button
            onClick={() => onDismiss(t.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function TeacherNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const toastIdRef = useRef(0);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const showToast = useCallback((message: string, kind: Toast["kind"] = "error") => {
    const id = String(++toastIdRef.current);
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/teachers/notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      broadcastUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!loading) {
      broadcastUnreadCount(unreadCount);
    }
  }, [unreadCount, loading]);

  const markAsRead = useCallback(async (id: string) => {
    if (markingIds.has(id)) return;
    const snapshot = notifications;

    setMarkingIds((prev) => new Set(prev).add(id));
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));

    try {
      const res = await fetch("/api/teachers/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationId: id }),
      });

      if (!res.ok) throw new Error("Failed to mark notification as read.");
    } catch {
      setNotifications(snapshot);
      showToast("Could not mark notification as read. Please try again.");
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [notifications, markingIds, showToast]);

  const markAllRead = useCallback(async () => {
    if (markingAll || unreadCount === 0) return;
    const snapshot = notifications;

    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      const res = await fetch("/api/teachers/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("Failed to mark all notifications as read.");
    } catch {
      setNotifications(snapshot);
      showToast("Could not mark all notifications as read. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, notifications, showToast]);

  const filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const grouped = filtered.reduce((acc, notification) => {
    const group = getDateGroup(notification.createdAt);
    if (!acc[group]) acc[group] = [];
    acc[group].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent border-t-gold animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <span className="text-sm text-text-muted font-medium">Loading notifications...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-danger" />
            </div>
            <h2 className="text-xl font-display font-bold text-text mb-2">Unable to load notifications</h2>
            <p className="text-text-muted mb-6">{error}</p>
            <Button onClick={() => { setLoading(true); fetchNotifications(); }} variant="primary">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <ToastList toasts={toasts} onDismiss={dismissToast} />
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold text-text">
              Notifications
            </h1>
            <p className="text-text-muted mt-1">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "You're all caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              isLoading={markingAll}
              className="flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            >
              <CheckCheck className="w-4 h-4" /> Mark all as read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-surface-inset p-1 rounded-xl w-fit">
          <button
            onClick={() => setFilter("all")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              filter === "all"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              filter === "unread"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Unread
          </button>
        </div>

        {/* Notification List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-16 text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-surface-inset flex items-center justify-center mb-5">
                {filter === "unread" ? (
                  <CheckCheck className="w-9 h-9 text-trust" />
                ) : (
                  <Inbox className="w-9 h-9 text-text-subtle" />
                )}
              </div>
              <p className="text-lg font-semibold text-text mb-1">
                {filter === "unread" ? "All caught up!" : "No notifications yet"}
              </p>
              <p className="text-sm text-text-muted max-w-sm">
                {filter === "unread"
                  ? "No unread notifications. You're on top of things!"
                  : "You'll receive updates about bookings, payments, and more here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-subtle px-1 mb-3">
                  {group}
                </h3>
                <div className="space-y-2">
                  {items.map((notification) => {
                    const iconConfig = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.SYSTEM;
                    const Icon = iconConfig.icon;
                    const isMarking = markingIds.has(notification.id);

                    return (
                      <Card
                        key={notification.id}
                        className={`overflow-hidden transition-all duration-200 ${
                          !notification.isRead
                            ? "border-brand/20 bg-brand/[0.03] hover:bg-brand/[0.06]"
                            : "hover:bg-surface-inset/50 opacity-80"
                        }`}
                      >
                        <CardContent className="p-4 flex items-start gap-4">
                          <div className={`p-2.5 rounded-xl ${iconConfig.bg} ${iconConfig.color} flex-shrink-0 mt-0.5`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className={`text-sm ${!notification.isRead ? "font-semibold text-text" : "font-medium text-text-muted"}`}>
                                {notification.title}
                              </h3>
                              {!notification.isRead && (
                                <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0 animate-pulse" aria-hidden="true" />
                              )}
                            </div>
                            <p className="text-sm text-text-muted mt-1 line-clamp-2 leading-relaxed">
                              {notification.message}
                            </p>
                            <p className="text-[11px] text-text-subtle mt-1.5 font-medium">
                              {timeAgo(notification.createdAt)}
                            </p>
                          </div>

                          {!notification.isRead && (
                            <button
                              className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                border border-brand/20 text-brand bg-brand/5
                                hover:bg-brand hover:text-white hover:border-brand
                                transition-all duration-200 cursor-pointer
                                flex-shrink-0 self-center ml-2
                                disabled:opacity-50 disabled:cursor-not-allowed
                              `}
                              onClick={() => markAsRead(notification.id)}
                              disabled={isMarking}
                              title="Mark as read"
                              aria-label={`Mark "${notification.title}" as read`}
                            >
                              <CheckCheck className={`w-3.5 h-3.5 ${isMarking ? "animate-spin" : ""}`} />
                              {isMarking ? "Marking…" : "Mark as read"}
                            </button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
