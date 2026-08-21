"use client";

import { Bell, ChevronDown, LockKeyhole, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { SessionUser } from "@/lib/rbac";

const emptySubscribe = () => () => undefined;

export function TopNav({ admin }: { admin: SessionUser }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const initials = admin.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SA";

  return (
    <header className="sticky top-0 z-30 flex h-[86px] items-center justify-between border-b border-[var(--lm-line)] bg-[color-mix(in_srgb,var(--lm-surface)_88%,transparent)] px-9 backdrop-blur-md max-[900px]:px-5 max-[640px]:h-[74px] max-[640px]:px-4">
      <div className="relative flex w-full max-w-[430px] items-center">
        <Search size={18} className="pointer-events-none absolute left-4 text-[var(--lm-subtle)]" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search people, classes, payments"
          placeholder="Search people, classes, payments…"
          className="lm-input h-11 w-full pl-11 pr-16 text-[13px]"
        />
        <span className="pointer-events-none absolute right-3 rounded-md border border-[var(--lm-line)] bg-[var(--lm-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--lm-subtle)]">
          ⌘ K
        </span>
      </div>

      <div className="ml-5 flex items-center gap-4 max-[700px]:gap-1.5">
        <div className="hidden items-center gap-2 rounded-full border border-[var(--lm-line)] bg-[var(--lm-paper-muted)] px-3 py-1.5 text-[11px] font-semibold text-[var(--lm-teal-deep)] min-[820px]:flex">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>Secure session</span>
        </div>

        <button type="button" className="lm-icon-button relative" aria-label="Notifications, 4 unread" title="Notifications">
          <Bell size={19} strokeWidth={1.8} aria-hidden="true" />
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--lm-red)] px-1 font-mono text-[9px] text-white">4</span>
        </button>

        {mounted ? (
          <button
            type="button"
            className="lm-icon-button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={19} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={19} strokeWidth={1.8} aria-hidden="true" />}
          </button>
        ) : (
          <span className="lm-icon-button" aria-hidden="true"><Moon size={19} strokeWidth={1.8} /></span>
        )}

        <span className="mx-1 h-7 w-px bg-[var(--lm-line)] max-[700px]:hidden" aria-hidden="true" />

        <button type="button" className="flex min-h-10 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-[var(--lm-hover)] max-[700px]:gap-0" aria-label={`Admin profile for ${admin.name}`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2d5a5b] text-[12px] font-bold text-[#e9f7f3]">{initials}</span>
          <span className="hidden text-left min-[820px]:block">
            <span className="block text-[12px] font-bold text-[var(--lm-ink-strong)]">{admin.name}</span>
            <span className="mt-0.5 block max-w-[140px] truncate text-[10px] text-[var(--lm-subtle)]">{admin.email}</span>
          </span>
          <ChevronDown size={15} className="hidden text-[var(--lm-subtle)] min-[820px]:block" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
