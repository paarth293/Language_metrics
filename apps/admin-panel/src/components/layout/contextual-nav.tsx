"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, LockKeyhole, X } from "lucide-react";
import clsx from "clsx";
import type { SessionUser } from "@/lib/rbac";
import { activeModuleForPath, isPathActive, visibleContextLinks, type AdminModule } from "./navigation";

interface ContextualNavProps {
  admin: SessionUser;
  pathname: string;
  activeModule: AdminModule;
  open: boolean;
  onClose: () => void;
}

export function ContextualNav({ admin, pathname, activeModule, open, onClose }: ContextualNavProps) {
  const links = visibleContextLinks(activeModule, admin);
  const currentModule = activeModuleForPath(pathname, admin);

  return (
    <aside id="admin-context-nav" className={clsx("lm-context-nav flex h-dvh w-[218px] shrink-0 flex-col border-r", open && "is-open")}>
      <div className="flex h-[86px] items-center justify-between border-b border-white/[0.08] px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#83b8b2]">Language Metrics</p>
          <p className="mt-1 text-[12px] text-[#8fa5ad]">Admin Portal</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close section navigation" className="lm-icon-button hidden h-8 min-h-8 w-8 min-w-8 text-[#9eb0b5] hover:bg-white/[0.06] hover:text-[#eef7f5] max-[1100px]:inline-flex">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#78909a]">{currentModule.label}</span>
          <ChevronLeft size={15} className="text-[#83b8b2]" aria-hidden="true" />
        </div>

        <nav aria-label={`${currentModule.label} navigation`} className="mt-5 space-y-1.5">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isPathActive(pathname, link.href);
            return (
              <Link
                key={`${currentModule.key}-${link.href}-${link.label}`}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={clsx("lm-context-link", active && "is-active")}
                onClick={onClose}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{link.label}</span>
                {active && currentModule.key === "overview" ? <ChevronRight size={14} aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-12 border-t border-white/[0.08] pt-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#78909a]">Quick access</p>
          <div className="mt-4 space-y-1">
            <Link href="/teachers?filter=pending" onClick={onClose} className="group flex min-h-10 items-center justify-between rounded-lg px-3 text-[12px] text-[#9eb0b5] transition-colors hover:bg-white/[0.05] hover:text-[#eef7f5]">
              <span>Pending approvals</span>
              <ArrowUpRight size={14} className="text-[#83b8b2] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </Link>
            <Link href="/complaints" onClick={onClose} className="group flex min-h-10 items-center justify-between rounded-lg px-3 text-[12px] text-[#9eb0b5] transition-colors hover:bg-white/[0.05] hover:text-[#eef7f5]">
              <span>Open complaints</span>
              <ArrowUpRight size={14} className="text-[#e9c28c] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </Link>
            <Link href="/payouts" onClick={onClose} className="group flex min-h-10 items-center justify-between rounded-lg px-3 text-[12px] text-[#9eb0b5] transition-colors hover:bg-white/[0.05] hover:text-[#eef7f5]">
              <span>Payout queue</span>
              <ArrowUpRight size={14} className="text-[#e6a4a1] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.08] px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2d5a5b] text-[#a9dfd6]">
            <LockKeyhole size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#d6e1e2]">Secure session</p>
            <p className="mt-0.5 truncate text-[10px] text-[#78909a]">Encrypted · access logged</p>
          </div>
        </div>
        <p className="mt-4 truncate text-[10px] text-[#78909a]">{admin.email}</p>
      </div>
    </aside>
  );
}
