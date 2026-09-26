"use client";

import type { User } from "@/types";
import React from "react";
import { Bell, Menu, Moon, Sun, ChevronDown } from "lucide-react";
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
    <header className="flex h-[76px] shrink-0 items-center justify-between px-6 sticky top-0 z-20 bg-bg transition-colors">
      <div className="flex items-center gap-4">
        <button
          className="text-text-muted hover:text-text lg:hidden transition-colors p-2 rounded-xl hover:bg-surface-inset"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-full p-2 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200"
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <Link
          href={notificationsHref}
          className="relative rounded-full p-2 text-text-muted hover:bg-surface-inset hover:text-text transition-all duration-200"
        >
          <Bell className="h-5 w-5" />
        </Link>

        {/* Divider */}
        <div className="h-8 w-px bg-border mx-1 hidden md:block" />

        {/* User Menu */}
        <Link 
          href={profileHref}
          className="flex items-center gap-3 rounded-full hover:bg-surface-inset transition-colors py-1 px-2 pr-1"
        >
          <div className="relative">
            <Avatar initials={user?.name?.[0] || "U"} />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-trust rounded-full border-2 border-bg" />
          </div>
          <div className="hidden text-left md:block pr-2">
            <div className="text-[14px] font-semibold text-text leading-tight">{user?.name || "Demo User"}</div>
            <div className="text-[12px] text-text-subtle font-medium">View Profile</div>
          </div>
          <ChevronDown className="w-4 h-4 text-text-muted hidden md:block mr-2" />
        </Link>
      </div>
    </header>
  );
}
