"use client";

import Image from "next/image";
import Link from "next/link";
import { HelpCircle, LogOut, Menu } from "lucide-react";
import type { SessionUser } from "@/lib/rbac";
import type { AdminModule, ModuleKey } from "./navigation";
import clsx from "clsx";

interface PrimaryRailProps {
  admin: SessionUser;
  modules: AdminModule[];
  activeModule: ModuleKey;
  contextOpen: boolean;
  onToggleContext: () => void;
}

export function PrimaryRail({
  admin,
  modules,
  activeModule,
  contextOpen,
  onToggleContext,
}: PrimaryRailProps) {
  return (
    <aside className="lm-primary-rail flex h-dvh w-[88px] shrink-0 flex-col items-center border-r max-[900px]:w-[72px] max-[640px]:w-[62px]">
      <div className="flex h-[86px] w-full items-center justify-center border-b border-white/[0.08]">
        <Link
          href="/"
          aria-label="Language Metrics overview"
          className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-[14px] bg-[#f8f4ea] ring-1 ring-white/10 transition-transform hover:scale-[1.03]"
        >
          <Image
            src="/brand/logo-full.png"
            alt="Language Metrics logo"
            fill
            sizes="44px"
            className="object-cover"
            style={{ objectPosition: "50% 5%", transform: "scale(1.22)" }}
            priority
            draggable={false}
          />
        </Link>
      </div>

      <div className="flex w-full flex-1 flex-col items-center gap-3 overflow-y-auto px-3 py-6 max-[900px]:px-2">
        <span className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#78909a] max-[900px]:sr-only">
          Workspace
        </span>
        <nav aria-label="Primary admin modules" className="flex w-full flex-col items-center gap-2">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.key;
            return (
              <Link
                key={module.key}
                href={module.href}
                aria-current={isActive ? "page" : undefined}
                title={module.label}
                className={clsx("lm-rail-link", isActive && "is-active")}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span className="lm-rail-label">{module.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex w-full flex-col items-center gap-3 border-t border-white/[0.08] px-3 py-5 max-[900px]:px-2">
        <button
          type="button"
          onClick={onToggleContext}
          aria-expanded={contextOpen}
          aria-controls="admin-context-nav"
          title="Open section navigation"
          aria-label="Open section navigation"
          className="lm-mobile-context-toggle"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <button type="button" title="Help" aria-label="Help" className="lm-icon-button h-9 min-h-9 w-9 min-w-9 rounded-full bg-[#27434e] text-[#9bcfc6] hover:bg-[#2b4a55] hover:text-[#d7f5ef]">
          <HelpCircle size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Sign out"
          aria-label="Sign out"
          className="lm-icon-button h-9 min-h-9 w-9 min-w-9 rounded-full text-[#8fa5ad] hover:bg-white/[0.06] hover:text-[#e1eeeb]"
          onClick={async () => {
            const { logoutAction } = await import("@/app/login/actions");
            await logoutAction();
          }}
        >
          <LogOut size={17} aria-hidden="true" />
        </button>
        <span className="sr-only">Signed in as {admin.name}</span>
      </div>
    </aside>
  );
}
