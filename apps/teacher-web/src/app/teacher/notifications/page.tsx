"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  Loader2,
  AlertCircle,
  BellRing,
  Calendar,
  CreditCard,
  MessageSquare,
  Shield,
  Settings,
  Sparkles,
  Inbox,
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

export default function TeacherNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/teachers/notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/teachers/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/teachers/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {} finally {
      setMarkingAll(false);
    }
  };

  const filtered = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  // Group notifications by date
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
            <Button onClick={() => window.location.reload()} variant="primary">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            className="flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
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
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            filter === "unread"
              ? "bg-surface text-text shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          Unread ({unreadCount})
          {unreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          )}
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
                ? "You have no unread notifications. Great job staying on top of things!"
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

                  return (
                    <Card
                      key={notification.id}
                      className={`overflow-hidden cursor-pointer transition-all duration-200 ${
                        !notification.isRead
                          ? "border-brand/20 bg-brand/[0.03] hover:bg-brand/[0.06]"
                          : "hover:bg-surface-inset/50"
                      }`}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl ${iconConfig.bg} ${iconConfig.color} flex-shrink-0 mt-0.5`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-sm ${!notification.isRead ? "font-semibold text-text" : "font-medium text-text"}`}>
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0 animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm text-text-muted mt-1 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-[11px] text-text-subtle mt-1.5 font-medium">
                            {timeAgo(notification.createdAt)}
                          </p>
                        </div>
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
  );
}
