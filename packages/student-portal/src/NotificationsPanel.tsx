"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Calendar, CheckCheck, CreditCard, Inbox, MessageSquare, Settings, Shield, X } from "lucide-react";
import { useJsonResource } from "@repo/ui/useResource";
import { cn } from "@repo/ui/cn";
import { ago } from "./format";
import { InlineError, Segmented, Sheet, Skeleton, ease } from "./primitives";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const KEY = "/api/students/notifications";

const ICONS: Record<string, { icon: typeof Bell; tone: string }> = {
  SYSTEM: { icon: Settings, tone: "bg-brand/10 text-brand" },
  BOOKING_UPDATE: { icon: Calendar, tone: "bg-trust/12 text-trust" },
  PAYMENT_UPDATE: { icon: CreditCard, tone: "bg-action/15 text-gold-strong" },
  CHAT_MESSAGE: { icon: MessageSquare, tone: "bg-accent/15 text-accent" },
  VERIFICATION_UPDATE: { icon: Shield, tone: "bg-trust/12 text-trust" },
};

function groupOf(iso: string) {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}

/** Tells the bell badge the new count without it refetching. */
function broadcast(count: number) {
  window.dispatchEvent(new CustomEvent("notifications-updated", { detail: { unreadCount: count } }));
}

/**
 * Notifications in a panel that slides over the current page from the bell,
 * so checking them never means leaving what you were doing. Fetches only
 * while open; the bell keeps using the lightweight unread-count endpoint.
 */
export function NotificationsPanel({
  open,
  onClose,
  fetchImpl = fetch,
}: {
  open: boolean;
  onClose: () => void;
  fetchImpl?: typeof fetch;
}) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const { data, isLoading, mutate } = useJsonResource<{ notifications: Notification[]; unreadCount?: number }>(KEY, {
    enabled: open,
    staleMs: 15_000,
    pollMs: open ? 60_000 : 0,
  });
  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const unread = notifications.filter((n) => !n.isRead).length;

  // Keep the badge in step with whatever this list shows.
  useEffect(() => {
    if (data) broadcast(unread);
  }, [data, unread]);

  const write = useCallback((next: Notification[]) => mutate({ ...(data ?? {}), notifications: next }), [data, mutate]);

  const put = async (body: object) => {
    const res = await fetchImpl(KEY, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
  };

  const markRead = async (n: Notification) => {
    if (n.isRead) return;
    const snapshot = notifications;
    write(snapshot.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await put({ notificationId: n.id });
    } catch {
      write(snapshot);
      setError("Could not mark that notification as read. Try again.");
    }
  };

  const markAll = async () => {
    if (markingAll || unread === 0) return;
    const snapshot = notifications;
    setMarkingAll(true);
    write(snapshot.map((x) => ({ ...x, isRead: true })));
    try {
      await put({});
    } catch {
      write(snapshot);
      setError("Could not mark everything as read. Try again.");
    } finally {
      setMarkingAll(false);
    }
  };

  const shown = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;
  // Fixed bucket order, newest first inside each: the API lists unread
  // first, which used to split one bucket into two.
  const groups = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"];
    const sorted = [...shown].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return order
      .map((label) => ({ label, items: sorted.filter((n) => groupOf(n.createdAt) === label) }))
      .filter((g) => g.items.length > 0);
  }, [shown]);

  return (
    <Sheet open={open} onClose={onClose} label="Notifications">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-text">Notifications</h2>
          <p className="text-[12px] text-text-subtle">{unread ? `${unread} unread` : "You're all caught up"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void markAll()}
            disabled={unread === 0 || markingAll}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand/10 disabled:text-text-subtle disabled:hover:bg-transparent focus-ring"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="rounded-lg p-2 text-text-subtle transition-colors hover:bg-surface-inset hover:text-text focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="px-5 pt-3">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread", count: unread },
          ]}
        />
        {error && (
          <InlineError className="mt-3">
            {error}{" "}
            <button type="button" className="font-semibold underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </InlineError>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6 pt-2">
        {isLoading ? (
          <div className="space-y-2 px-2 pt-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-inset text-text-subtle">
              <Inbox className="h-5 w-5" />
            </span>
            <p className="text-[15px] font-bold text-text">{filter === "unread" ? "Nothing unread" : "No notifications yet"}</p>
            <p className="mt-1 text-[13px] text-text-muted">Bookings, payments and messages from teachers show up here.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mt-3">
              <h3 className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-text-subtle">{g.label}</h3>
              <ul className="space-y-1">
                <AnimatePresence initial={false}>
                  {g.items.map((n) => {
                    const meta = ICONS[n.type] ?? { icon: Bell, tone: "bg-surface-inset text-text-muted" };
                    return (
                      <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }}>
                        <button
                          type="button"
                          onClick={() => void markRead(n)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-ring",
                            n.isRead ? "hover:bg-surface-inset/70" : "bg-brand/[0.05] hover:bg-brand/10 dark:bg-surface-2"
                          )}
                        >
                          <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
                            <meta.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                              <span className={cn("text-[13px] leading-snug text-text", n.isRead ? "font-medium" : "font-bold")}>{n.title}</span>
                              <span className="shrink-0 pt-px text-[11px] text-text-subtle">{ago(n.createdAt)}</span>
                            </span>
                            <span className={cn("mt-0.5 block text-[12.5px] leading-relaxed", n.isRead ? "text-text-subtle" : "text-text-muted")}>{n.message}</span>
                          </span>
                          {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-action" aria-label="Unread" />}
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))
        )}
      </div>
    </Sheet>
  );
}
