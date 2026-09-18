"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { NavItem } from "./AppShell";

interface SidebarProps {
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ navItems, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Group nav items by section
  const sectionsMap = new Map<string, NavItem[]>();
  navItems.forEach(item => {
    const section = item.section || "General";
    if (!sectionsMap.has(section)) sectionsMap.set(section, []);
    sectionsMap.get(section)!.push(item);
  });

  // Persist collapsed state
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
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      style={{
        background: "linear-gradient(180deg, #0d0d14 0%, #111118 60%, #13121c 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="flex h-[68px] shrink-0 items-center justify-between px-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" className="flex items-center gap-3" aria-label="Language Metrics — home">
          <div className="relative flex-shrink-0">
            <img
              src="/brand/logo-full.png"
              alt="LM"
              className="w-9 h-9 rounded-xl object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "flex";
              }}
            />
            <div
              className="hidden w-9 h-9 rounded-xl items-center justify-center text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #c7982f, #e0b24a)" }}
            >
              LM
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-white font-bold text-[14px] tracking-tight">Language</span>
            <span className="text-[14px] font-bold tracking-tight" style={{ color: "#c7982f" }}>Metrics</span>
          </div>
        </Link>
        <button
          className="lg:hidden rounded-lg p-1.5 transition-colors"
          style={{ color: "rgba(255,255,255,0.4)" }}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-5 space-y-6 hide-scrollbar" style={{ scrollbarWidth: "none" }}>
        {Array.from(sectionsMap.entries()).map(([section, items]) => {
          const isSectionOpen = openSections[section] !== false;

          return (
            <div key={section}>
              <button
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between px-5 mb-2 focus:outline-none group"
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {section}
                </span>
                <ChevronDown
                  className={cn("w-3 h-3 transition-transform duration-200", isSectionOpen ? "" : "-rotate-90")}
                  style={{ color: "rgba(255,255,255,0.25)" }}
                />
              </button>

              <ul className={cn("space-y-0.5 overflow-hidden transition-all duration-200", isSectionOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0")}>
                {items.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href} className="relative px-3">
                      {/* Active pill indicator on left edge */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
                          style={{ background: "linear-gradient(180deg, #c7982f, #e0b24a)" }}
                        />
                      )}
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 focus:outline-none",
                          isActive
                            ? "text-white"
                            : "hover:text-white/80"
                        )}
                        style={{
                          background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                          color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                        }}
                        onMouseEnter={e => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                        }}
                        onMouseLeave={e => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                        }}
                      >
                        <span
                          className="flex-shrink-0"
                          style={{ color: isActive ? "#c7982f" : "rgba(255,255,255,0.35)" }}
                        >
                          <item.icon className="w-[17px] h-[17px]" />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Language Metrics © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </aside>
  );
}
