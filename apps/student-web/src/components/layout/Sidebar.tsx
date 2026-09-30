"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavItem } from "./AppShell";
import { useAuth } from "@/lib/auth-client";

interface SidebarProps {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "U";

export function Sidebar({ navItems, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Mirrors the TopBar's unread count via the same "notifications-updated"
  // event, so the database stays the single source of truth.
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/students/notifications/unread-count", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.unreadCount === "number") {
          setNotifUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {});

    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ unreadCount?: number }>).detail;
      if (typeof detail?.unreadCount === "number") {
        setNotifUnreadCount(detail.unreadCount);
      }
    };

    window.addEventListener("notifications-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("notifications-updated", handleUpdate);
    };
  }, []);

  // Group in first-seen order, like the admin panel's module groups.
  const sections: Array<{ name: string; items: NavItem[] }> = [];
  for (const item of navItems) {
    const name = item.section ?? "General";
    const existing = sections.find((s) => s.name === name);
    if (existing) existing.items.push(item);
    else sections.push({ name, items: [item] });
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Language Metrics — home">
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-cream ring-1 ring-border-strong">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-full.png" alt="" className="h-full w-full scale-[1.22] object-cover object-[50%_5%]" />
          </span>
          <span>
            <span className="block text-[12px] font-bold leading-tight text-text">Language Metrics</span>
            <span className="block text-[10px] leading-tight text-text-subtle">Student</span>
          </span>
        </Link>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-inset hover:text-text lg:hidden focus-ring"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2 hide-scrollbar">
        {sections.map((section, i) => (
          <div key={section.name} className={cn("px-3", i > 0 && "mt-1 border-t border-border pt-1")}>
            <p className="mb-1 px-2 pt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-text-subtle">
              {section.name}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isNavActive(pathname, item.href);
                const unread = item.href === "/notifications" ? notifUnreadCount : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150 focus-ring",
                        active ? "bg-action/10 text-text" : "text-text-muted hover:bg-surface-inset hover:text-text"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-action" aria-hidden />
                      )}
                      <item.icon className={cn("h-4 w-4 shrink-0", active && "text-gold-strong")} strokeWidth={1.8} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {unread > 0 && (
                        <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                      {active && unread === 0 && (
                        <ChevronRight className="h-3.5 w-3.5 text-gold-strong opacity-60" aria-hidden />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Signed-in user */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-action/15 text-[11px] font-bold text-text">
            {initialsOf(user?.name ?? "")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-text">{user?.name || "Student"}</p>
            <p className="truncate text-[10px] text-text-subtle">{user?.email}</p>
          </div>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => void logout()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-alert/10 hover:text-alert focus-ring"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-text-subtle">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
          Language Metrics © {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
