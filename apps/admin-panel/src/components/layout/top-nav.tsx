"use client";

import { Bell, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { SessionUser } from "@/lib/rbac";

const emptySubscribe = () => () => undefined;

interface TopNavProps {
  admin: SessionUser;
  onMenuClick: () => void;
}

export function TopNav({ admin, onMenuClick }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const initials = admin.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SA";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/80 px-4 backdrop-blur-md md:px-6">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="lm-icon-button h-9 min-h-9 w-9 min-w-9 lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <div className="relative hidden md:block">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search"
            placeholder="Search…"
            className="lm-input h-9 w-56 pl-9 pr-4 text-[13px] lg:w-72"
          />
        </div>
      </div>

      {/* Right: theme, notifications, user */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        {mounted ? (
          <button
            type="button"
            className="lm-icon-button h-9 min-h-9 w-9 min-w-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark"
              ? <Sun size={17} strokeWidth={1.8} aria-hidden="true" />
              : <Moon size={17} strokeWidth={1.8} aria-hidden="true" />}
          </button>
        ) : (
          <span className="lm-icon-button h-9 min-h-9 w-9 min-w-9" aria-hidden="true">
            <Moon size={17} strokeWidth={1.8} />
          </span>
        )}

        {/* Notifications */}
        <button
          type="button"
          className="lm-icon-button relative h-9 min-h-9 w-9 min-w-9"
          aria-label="Notifications"
        >
          <Bell size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-[var(--danger)]">
            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--danger)] opacity-60" />
          </span>
        </button>

        {/* Divider */}
        <div className="mx-1 hidden h-7 w-px bg-[var(--border)] md:block" aria-hidden="true" />

        {/* User */}
        <div className="hidden items-center gap-2.5 md:flex">
          <div className="text-right">
            <p className="text-[12px] font-semibold leading-tight text-[var(--text)]">{admin.name}</p>
            <p className="text-[10px] leading-tight text-[var(--text-subtle)] capitalize">{admin.role?.toLowerCase()}</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-gold)_15%,transparent)] text-[11px] font-bold text-[var(--brand-navy)]">
            {initials}
          </span>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            className="lm-icon-button h-8 min-h-8 w-8 min-w-8 hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] hover:text-[var(--danger)]"
            onClick={async () => {
              const { logoutAction } = await import("@/app/login/actions");
              await logoutAction();
            }}
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
