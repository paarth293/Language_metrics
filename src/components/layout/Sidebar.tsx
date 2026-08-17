"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { NavItem } from "./AppShell";

interface SidebarProps {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ navItems, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-display font-semibold text-text group">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
            <BookOpen className="h-4.5 w-4.5 text-gold" />
          </div>
          <span>LM</span>
        </Link>
        <button className="lg:hidden text-text-muted hover:text-text transition-colors" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onClose()}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-gold/10 text-gold shadow-sm"
                      : "text-text-muted hover:bg-surface-inset hover:text-text"
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gold rounded-r-full" />
                  )}
                  <item.icon className={cn("h-[18px] w-[18px] transition-colors", isActive ? "text-gold" : "text-text-muted")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-text-muted flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Language Metrics © {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
