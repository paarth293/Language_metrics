"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BookOpen, CreditCard, Settings, Plus, LogOut } from "lucide-react";
import clsx from "clsx";

import Image from "next/image";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/teachers", label: "Teachers", icon: Users },
  { href: "/students", label: "Students", icon: Users },
  { href: "/classes", label: "Classes", icon: BookOpen },
  { href: "/payouts", label: "Payouts", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{ background: "var(--lm-surface)", borderRight: "1px solid var(--lm-border)" }}
      className="w-[260px] flex flex-col h-screen sticky top-0 z-20 shrink-0">

      {/* Logo */}
      <div className="h-[72px] flex items-center px-6 gap-3 shrink-0">
        <span
          className="relative shrink-0 flex items-center justify-center overflow-hidden rounded-[0.4rem] bg-[#f8f4ea] shadow-sm"
          style={{ width: 32, height: 32 }}
        >
          <Image
            src="/brand/logo-full.png"
            alt="Language Matrix Logo"
            fill
            sizes="32px"
            style={{
              objectFit: "cover",
              objectPosition: "50% 5%",
              transform: "scale(1.25)",
            }}
            priority
            draggable={false}
          />
        </span>
        <div className="flex flex-col">
          <span style={{ color: "var(--lm-text)" }} className="font-bold text-[15px] tracking-tight truncate leading-tight">
            Language Matrix
          </span>
          <span style={{ color: "var(--lm-text-muted)" }} className="text-[11px] font-medium leading-tight mt-0.5">Admin Portal</span>
        </div>
      </div>

      <div className="px-5 mt-2 mb-4">
        <button style={{ background: "var(--lm-accent)", color: "#000" }} className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-semibold text-[14px] hover:opacity-90 transition-opacity">
          <Plus size={16} /> New Course
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <div key={item.href} className="relative">
              {isActive && (
                <div style={{ background: "var(--lm-accent)" }} className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"></div>
              )}
              <Link
                href={item.href}
                style={isActive
                  ? { background: "var(--lm-accent-bg)", color: "var(--lm-text)" }
                  : { color: "var(--lm-text-muted)", border: "1px solid transparent" }
                }
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-[13px] font-semibold transition-all duration-200 mx-2",
                  !isActive && "hover:text-white"
                )}
              >
                <Icon size={16} className="shrink-0" style={{ color: isActive ? "var(--lm-text)" : "inherit" }} />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-5 shrink-0">
        <button
          onClick={async () => {
            const { logoutAction } = await import("@/app/login/actions");
            await logoutAction();
          }}
          style={{ color: "var(--lm-text-muted)" }}
          className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors hover:text-white hover:bg-white/5 mx-2"
        >
          <LogOut size={16} className="shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
