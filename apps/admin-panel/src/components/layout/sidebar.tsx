"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, X, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { SessionUser } from "@/lib/rbac";
import { visibleModules, isPathActive } from "./navigation";

interface SidebarProps {
  admin: SessionUser;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ admin, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const modules = visibleModules(admin);

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
        <Link href="/" aria-label="Language Metrics admin — home" className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-[#f8f4ea] ring-1 ring-[var(--border-strong)]">
            <Image
              src="/brand/logo-full.png"
              alt=""
              fill
              sizes="32px"
              className="object-cover"
              style={{ objectPosition: "50% 5%", transform: "scale(1.22)" }}
              priority
              draggable={false}
            />
          </span>
          <div>
            <p className="text-[12px] font-bold leading-tight text-[var(--text)]">Language Metrics</p>
            <p className="text-[10px] leading-tight text-[var(--text-subtle)]">Admin</p>
          </div>
        </Link>

        {/* Mobile close */}
        <button
          type="button"
          className="lm-icon-button h-8 min-h-8 w-8 min-w-8 lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto py-2">
        {modules.map((module, i) => {
          const Icon = module.icon;
          const isModuleActive = module.match.some((m) =>
            m === "/" ? pathname === "/" : pathname.startsWith(m)
          );

          return (
            <div key={module.key} className={clsx("px-3", i > 0 && "mt-1 border-t border-[var(--border)] pt-1")}>
              {/* Module group label */}
              <p className="mb-1 px-2 pt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                {module.label}
              </p>

              <ul className="space-y-0.5">
                {module.contextLinks.map((link) => {
                  const LinkIcon = link.icon;
                  const active = isPathActive(pathname, link.href);
                  return (
                    <li key={`${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={clsx(
                          "relative flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150",
                          active
                            ? "bg-[color-mix(in_srgb,var(--brand-gold)_10%,transparent)] text-[var(--brand-navy)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--surface-inset)] hover:text-[var(--text)]"
                        )}
                      >
                        {/* Active bar */}
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brand-gold)]" />
                        )}
                        <LinkIcon
                          size={16}
                          strokeWidth={1.8}
                          aria-hidden="true"
                          className={active ? "text-[var(--brand-gold)]" : ""}
                        />
                        <span className="flex-1 truncate">{link.label}</span>
                        {active && (
                          <ChevronRight size={13} className="text-[var(--brand-gold)] opacity-60" aria-hidden="true" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer / User */}
      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-gold)_15%,transparent)] text-[11px] font-bold text-[var(--brand-navy)]">
            {admin.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-[var(--text)]">{admin.name}</p>
            <p className="truncate text-[10px] text-[var(--text-subtle)]">{admin.email}</p>
          </div>
          <button
            type="button"
            title="Sign out"
            aria-label="Sign out"
            className="lm-icon-button h-7 min-h-7 w-7 min-w-7 hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] hover:text-[var(--danger)]"
            onClick={async () => {
              const { logoutAction } = await import("@/app/login/actions");
              await logoutAction();
            }}
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--text-subtle)]">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          Language Metrics © {new Date().getFullYear()}
        </div>
      </div>
    </aside>
  );
}
