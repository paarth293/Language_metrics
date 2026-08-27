"use client";

import type { User } from "@/types";
import React from "react";
import { Bell, Menu, Search, Sun, Moon, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth-client";

interface TopBarProps {
  onMenuClick: () => void;
  user: User | null;
}

export function TopBar({ onMenuClick, user }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();
  const isTeacherRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/teacher");

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const ThemeIcon = theme === "light" ? Moon : Sun;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/80 backdrop-blur-md px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          className="text-text-muted hover:text-text lg:hidden transition-colors p-1.5 rounded-lg hover:bg-surface-inset"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search Bar */}
        <div className="hidden relative md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-64 rounded-lg border border-border bg-surface-inset/60 pl-10 pr-4 text-sm text-text placeholder:text-text-muted focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200"
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-danger">
            <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-75" />
          </span>
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-border mx-1 hidden md:block" />

        {/* User Menu */}
        <div className="flex items-center gap-3 ml-1">
          <div className="hidden text-right md:block">
            <div className="text-sm font-semibold text-text leading-tight">{user?.name || "User"}</div>
            <div className="text-[11px] text-text-muted capitalize">
              {user?.role?.toLowerCase() || (isTeacherRoute ? "Teacher" : "Student")}
            </div>
          </div>
          <button className="focus:outline-none focus-ring rounded-full" title="Profile">
            <Avatar initials={user?.name?.[0] || "U"} online={true} />
          </button>
          <button
            onClick={logout}
            className="hidden md:flex rounded-lg p-2 text-text-muted hover:bg-danger/10 hover:text-danger transition-all duration-200"
            title="Sign out"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
