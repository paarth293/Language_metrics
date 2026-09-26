"use client";

import type { User } from "@/types";
import React, { useState, useEffect, useCallback } from "react";
import { Bell, Menu, Search, Moon, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth-client";
import Link from "next/link";

interface TopBarProps {
  onMenuClick: () => void;
  user: User | null;
  unreadCount?: number;
}

export function TopBar({ onMenuClick, user, unreadCount: initialUnreadCount }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const notificationsHref = "/notifications";

  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount ?? 0);

  // Fetch using the dedicated lightweight unread-count endpoint.
  // Falls back to the full notifications list if the dedicated endpoint fails.
  const checkUnreadCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/students/notifications/unread-count", {
        credentials: "include",
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      }
    } catch (err) {
      // AbortError is expected when the component unmounts — ignore it.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }, []);

  useEffect(() => {
    // If the parent has already resolved the count server-side, use it.
    if (initialUnreadCount !== undefined) {
      setUnreadCount(initialUnreadCount);
      return;
    }

    const controller = new AbortController();
    checkUnreadCount(controller.signal);

    // Re-check when the notifications page signals a change.
    const handleNotificationsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ unreadCount?: number }>;
      if (customEvent.detail && typeof customEvent.detail.unreadCount === "number") {
        // Fast path: the page already computed the new count.
        setUnreadCount(customEvent.detail.unreadCount);
      } else {
        // Slow path: re-query the server for the canonical count.
        checkUnreadCount();
      }
    };

    // Re-check when the user returns to the tab (catches out-of-band changes).
    const handleFocus = () => checkUnreadCount();

    window.addEventListener("notifications-updated", handleNotificationsUpdated);
    window.addEventListener("focus", handleFocus);

    return () => {
      controller.abort();
      window.removeEventListener("notifications-updated", handleNotificationsUpdated);
      window.removeEventListener("focus", handleFocus);
    };
  }, [initialUnreadCount, checkUnreadCount]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const ThemeIcon = theme === "light" ? Moon : Sun;

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border bg-white/60 backdrop-blur-xl px-4 md:px-8 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          className="text-text-muted hover:text-text lg:hidden transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-surface-inset"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search Bar */}
        <div className="hidden relative md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-subtle" />
          <input
            type="text"
            placeholder="Search students, sessions, earnings..."
            className="h-10 w-80 rounded-xl border border-border bg-surface-inset/80 pl-11 pr-4 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-all duration-200"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 rounded-md bg-surface border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-subtle">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2.5 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200"
          title={`Theme: ${theme}`}
          aria-label={`Switch theme (currently ${theme})`}
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>

        {/* Notifications Bell with unread indicator dot */}
        <Link
          href={notificationsHref}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center relative rounded-xl p-2.5 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200"
          aria-label={unreadCount > 0 ? `View notifications (${unreadCount} unread)` : "View notifications"}
        >
          <Bell className="h-[18px] w-[18px]" />

          {unreadCount > 0 && (
            <span
              className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger ring-2 ring-white transition-all duration-200"
              aria-hidden="true"
            />
          )}
        </Link>

        {/* Divider */}
        <div className="h-8 w-px bg-border mx-2 hidden md:block" />

        {/* User Menu */}
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="text-sm font-semibold text-text leading-tight">{user?.name || "Student"}</div>
            <div className="text-[11px] text-text-muted capitalize">
              {user?.role?.toLowerCase() || "student"}
            </div>
          </div>
          <button className="min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus-ring rounded-full" title="Profile" aria-label="User profile">
            <Avatar initials={user?.name?.[0] || "U"} online={true} />
          </button>
        </div>
      </div>
    </header>
  );
}
