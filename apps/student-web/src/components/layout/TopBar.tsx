"use client";

import type { User } from "@/types";
import React, { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { Bell, Menu, Search, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import Link from "next/link";
import { CommandPalette } from "./CommandPalette";
import type { NavItem } from "./AppShell";

interface TopBarProps {
  onMenuClick: () => void;
  user: User | null;
  navItems: NavItem[];
  unreadCount?: number;
}

const noopSubscribe = () => () => {};
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true
  );
}

const iconButton =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors hover:border-border hover:bg-surface-inset hover:text-text focus-ring";

export function TopBar({ onMenuClick, user, navItems, unreadCount: initialUnreadCount }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isMac = useIsMac();
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount ?? 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Dedicated lightweight unread-count endpoint.
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
        setUnreadCount(customEvent.detail.unreadCount);
      } else {
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
  const initials =
    (user?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "U";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-3">
        <button className={`${iconButton} lg:hidden`} onClick={onMenuClick} aria-label="Open navigation menu">
          <Menu className="h-[18px] w-[18px]" />
        </button>

        {/* Search — opens the quick-jump palette */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
          aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
          className="hidden h-9 w-56 items-center gap-2.5 rounded-lg border border-border bg-surface-inset pl-3 pr-2 text-left text-[13px] text-text-subtle transition-colors hover:border-border-strong md:flex lg:w-72 focus-ring"
        >
          <Search className="h-[15px] w-[15px] shrink-0" />
          <span className="flex-1 truncate">Search pages…</span>
          <kbd className="hidden shrink-0 items-center rounded border border-border bg-surface px-1.5 py-px text-[10px] font-medium text-text-subtle lg:inline-flex">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setPaletteOpen(true)} className={`${iconButton} md:hidden`} aria-label="Search">
          <Search className="h-[17px] w-[17px]" strokeWidth={1.8} />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className={iconButton}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          <ThemeIcon className="h-[17px] w-[17px]" strokeWidth={1.8} />
        </button>

        <Link
          href="/notifications"
          className={iconButton}
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        >
          <Bell className="h-[17px] w-[17px]" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-danger" aria-hidden="true">
              <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-60" />
            </span>
          )}
        </Link>

        <div className="mx-1 hidden h-7 w-px bg-border md:block" aria-hidden="true" />

        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-surface-inset md:ml-1 focus-ring"
          aria-label="Your profile"
        >
          <span className="hidden text-right md:block">
            <span className="block text-[12px] font-semibold leading-tight text-text">{user?.name || "Student"}</span>
            <span className="block text-[10px] leading-tight text-text-subtle">Student</span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-action/15 text-[11px] font-bold text-text">
            {initials}
          </span>
        </Link>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={navItems}
        canSearchStudents={false}
      />
    </header>
  );
}
