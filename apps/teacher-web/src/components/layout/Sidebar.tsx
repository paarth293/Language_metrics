"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronDown, LogOut } from "lucide-react";
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
  const { logout } = useAuth();

  // Group nav items by section
  const sectionsMap = new Map<string, NavItem[]>();
  navItems.forEach(item => {
    const section = item.section || "General";
    if (!sectionsMap.has(section)) sectionsMap.set(section, []);
    sectionsMap.get(section)!.push(item);
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Learn: true,
    Account: true,
    Help: false
  });

  useEffect(() => {
    const saved = localStorage.getItem("sidebar_sections");
    if (saved) {
      try {
        setOpenSections(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {}
    }
  }, []);

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem("sidebar_sections", JSON.stringify(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 bg-surface border-r border-border shadow-[2px_0_10px_rgba(0,0,0,0.02)]",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Language Metrics — home">
          <div className="relative flex-shrink-0">
            <img
              src="/brand/logo-full.png"
              alt="LM"
              className="w-8 h-8 rounded-lg object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "flex";
              }}
            />
            <div
              className="hidden w-8 h-8 rounded-lg items-center justify-center text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #c7982f, #e0b24a)" }}
            >
              LM
            </div>
          </div>
          <div className="flex flex-col leading-none mt-0.5">
            <span className="font-display font-bold text-[20px] text-text tracking-tight">
              Language<span className="text-brand">Metrics</span>
            </span>
          </div>
        </Link>
        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl lg:hidden transition-colors text-text-muted hover:bg-surface-inset auth-focus"
          onClick={onClose}
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 hide-scrollbar">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none mb-1",
                isActive
                  ? "text-brand bg-brand/5 border border-brand/20 shadow-sm"
                  : "text-text-muted hover:bg-surface-inset hover:text-text border border-transparent"
              )}
            >
              <span className="flex-shrink-0">
                <item.icon className={cn("w-5 h-5", isActive ? "text-brand" : "text-text-muted")} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-border">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full min-h-11 items-center gap-2 text-sm font-medium text-text-muted hover:text-text transition-colors auth-focus rounded-lg"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}
