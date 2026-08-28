"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut, ChevronRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { NavItem } from "./AppShell";
import { useAuth } from "@/lib/auth-client";

interface SidebarProps {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ navItems, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        "bg-gradient-to-b from-[#0f0c29] via-[#1a1547] to-[#231d5e]",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex h-[72px] items-center justify-between px-6 border-b border-white/[0.08]">
        <Link href="/" className="flex items-center gap-3" aria-label="Language Metrics — home">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-white font-bold text-sm">LM</span>
          </div>
          <div>
            <span className="text-white font-display font-bold text-[15px] tracking-tight">Language</span>
            <span className="text-amber-400 font-display font-bold text-[15px] tracking-tight ml-1">Metrics</span>
          </div>
        </Link>
        <button className="lg:hidden text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Section Label */}
      <div className="px-6 pt-6 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">
          Navigation
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onClose()}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-white/[0.12] text-white shadow-lg shadow-black/20"
                      : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  )}
                >
                  {/* Active glow */}
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400/10 to-transparent pointer-events-none" />
                  )}
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-r-full shadow-lg shadow-amber-500/40" />
                  )}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200",
                    isActive
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-white/[0.04] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/60"
                  )}>
                    <item.icon className="h-[16px] w-[16px]" />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-white/30" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Card */}
      <div className="p-3 border-t border-white/[0.08]">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] backdrop-blur-sm px-3.5 py-3">
          <div className="relative">
            <Avatar initials={user?.name?.[0] || "U"} size="sm" online={true} />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#1a1547]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user?.name || "Teacher"}</div>
            <div className="text-[11px] text-white/40 capitalize">{user?.role?.toLowerCase() || "teacher"}</div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.05]">
        <div className="text-[11px] text-white/20 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Language Metrics © {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
