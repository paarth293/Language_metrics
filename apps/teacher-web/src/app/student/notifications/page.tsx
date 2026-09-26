"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

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
  PAYMENT_UPDATE: { icon: CreditCard, color: "text-action", bg: "bg-action/10" },
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

export default function StudentNotifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/students/notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/students/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/students/notifications", {
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
      <div className="py-8 max-w-3xl mx-auto w-full">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] max-w-3xl mx-auto w-full">
        <Card className="max-w-md w-full border border-border/50 shadow-sm bg-surface">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-alert/10 flex items-center justify-center mx-auto mb-4 border border-alert/20">
              <AlertCircle className="w-8 h-8 text-alert" />
            </div>
            <h2 className="text-[20px] font-display font-bold text-text mb-2 leading-tight">Unable to load notifications</h2>
            <p className="text-[14px] text-text-muted mb-6">{error}</p>
            <Button onClick={() => router.refresh()} variant="primary" className="shadow-sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 h-full flex flex-col max-w-3xl mx-auto w-full">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            Notifications
          </h1>
          <p className="text-base text-text-muted mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} isLoading={markingAll} className="flex items-center gap-1.5 shadow-sm">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      {/* ── TABS ───────────────────────────────────── */}
      <div className="flex overflow-x-auto no-scrollbar border-b" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
        <button
          onClick={() => setFilter("all")}
          className={`px-5 py-3.5 font-semibold text-[14px] transition-all relative whitespace-nowrap ${
            filter === "all" ? "text-brand" : "text-text-muted hover:text-text"
          }`}
        >
          All ({notifications.length})
          {filter === "all" && <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-brand" />}
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-5 py-3.5 font-semibold text-[14px] transition-all relative flex items-center gap-2 whitespace-nowrap ${
            filter === "unread" ? "text-brand" : "text-text-muted hover:text-text"
          }`}
        >
          Unread ({unreadCount})
          {unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-alert animate-pulse" />}
          {filter === "unread" && <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-brand" />}
        </button>
      </div>

      {/* ── CONTENT ────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card className="border border-border/50 shadow-sm bg-surface">
          <CardContent className="py-20 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mb-4 border border-border/40">
              {filter === "unread" ? (
                <CheckCheck className="w-8 h-8 text-trust opacity-80" />
              ) : (
                <Inbox className="w-8 h-8 text-text-subtle" />
              )}
            </div>
            <h3 className="text-[18px] font-bold text-text mb-2">
              {filter === "unread" ? "All caught up!" : "No notifications yet"}
            </h3>
            <p className="text-[14px] text-text-muted max-w-[280px]">
              {filter === "unread"
                ? "You have no unread notifications. Great job staying on top of things!"
                : "You'll receive updates about bookings, payments, and more here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="space-y-3">
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-subtle px-1">{group}</h3>
              <div className="space-y-2">
                {items.map((notification) => {
                  const iconConfig = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.SYSTEM;
                  const Icon = iconConfig.icon;

                  return (
                    <Card
                      key={notification.id}
                      className={`overflow-hidden cursor-pointer transition-all duration-200 border ${
                        !notification.isRead
                          ? "border-brand/30 bg-brand/[0.04] shadow-sm hover:bg-brand/[0.08]"
                          : "border-border/40 bg-surface shadow-none hover:border-brand/20 hover:shadow-sm"
                      }`}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                    >
                      <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconConfig.bg} ${iconConfig.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`text-[15px] leading-snug mb-1 ${!notification.isRead ? "font-bold text-text" : "font-semibold text-text"}`}>
                              {notification.title}
                            </h3>
                            {!notification.isRead && <div className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />}
                          </div>
                          <p className={`text-[13px] leading-relaxed mb-2 ${!notification.isRead ? "text-text" : "text-text-muted"}`}>
                            {notification.message}
                          </p>
                          <p className="text-[11px] font-medium text-text-subtle uppercase tracking-wider">
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
