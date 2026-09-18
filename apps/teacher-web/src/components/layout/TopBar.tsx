"use client";

import type { User } from "@/types";
import React from "react";
import { Bell, Menu, Search, Moon, Sun, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/components/ThemeProvider";
import Link from "next/link";

interface TopBarProps {
  onMenuClick: () => void;
  user: User | null;
}

export function TopBar({ onMenuClick, user }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const notificationsHref = user?.role === "STUDENT" ? "/student/notifications" : "/teacher/notifications";
  const profileHref = user?.role === "STUDENT" ? "/student/profile" : "/teacher/profile";

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const ThemeIcon = theme === "light" ? Moon : Sun;

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[rgba(35,29,94,0.08)] bg-[#f5f0e4]/90 backdrop-blur-xl px-4 md:px-8 sticky top-0 z-20 transition-colors">
      <div className="flex items-center gap-4">
        <button
          className="text-text-muted hover:text-text lg:hidden transition-colors p-2 rounded-xl hover:bg-surface-inset"
          onClick={onMenuClick}
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
          className="rounded-xl p-2.5 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200 auth-focus"
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>

        {/* Notifications */}
        <Link
          href={notificationsHref}
          className="relative rounded-xl p-2.5 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200 auth-focus"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-danger">
            <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-75" />
          </span>
        </Link>

        {/* Divider */}
        <div className="h-8 w-px bg-border mx-2 hidden md:block" />

        {/* User Menu */}
        <Link 
          href={profileHref}
          className="flex items-center gap-3 auth-focus rounded-xl p-1 -m-1 hover:bg-surface-inset transition-colors"
        >
          <div className="hidden text-right md:block">
            <div className="text-sm font-semibold text-text leading-tight">{user?.name || "User"}</div>
            <div className="text-[11px] text-text-muted">View Profile</div>
          </div>
          <div className="flex items-center gap-1.5">
            <Avatar initials={user?.name?.[0] || "U"} online={true} />
            <ChevronDown className="w-4 h-4 text-text-subtle hidden md:block" />
          </div>
        </Link>
      </div>
    </header>
  );
}
