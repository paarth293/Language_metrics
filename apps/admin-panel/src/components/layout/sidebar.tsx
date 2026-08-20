"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Languages,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  Banknote,
  Video,
  MessageSquareWarning,
  Star,
  TicketPercent,
  Bell,
  BarChart3,
  Scale,
  Settings,
  Shield,
  ScrollText,
  LogOut,
} from "lucide-react";
import clsx from "clsx";
import Image from "next/image";
import type { SessionUser } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  children?: { href: string; label: string }[];
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" }],
  },
  {
    title: "Management",
    items: [
      { href: "/students", label: "Students", icon: GraduationCap, permission: "students:view" },
      {
        href: "/teachers",
        label: "Teachers",
        icon: Users,
        permission: "teachers:view",
        children: [
          { href: "/teachers", label: "All Teachers" },
          { href: "/teachers?filter=pending", label: "Pending Approval" },
          { href: "/teachers?filter=bgv", label: "BGV" },
          { href: "/teachers?filter=qa", label: "QA" },
          { href: "/teachers?filter=suspended", label: "Suspended" },
        ],
      },
      { href: "/languages", label: "Languages", icon: Languages, permission: "languages:manage" },
      { href: "/courses", label: "Courses", icon: BookOpen, permission: "courses:manage" },
      { href: "/classes", label: "Classes", icon: CalendarDays, permission: "classes:manage" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/payments", label: "Payments", icon: CreditCard, permission: "payments:view" },
      { href: "/invoices", label: "GST & Invoices", icon: FileText, permission: "invoices:manage" },
      { href: "/payouts", label: "Teacher Payouts", icon: Banknote, permission: "payouts:manage" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/recordings", label: "Recordings", icon: Video, permission: "recordings:manage" },
      { href: "/complaints", label: "Complaints", icon: MessageSquareWarning, permission: "complaints:manage" },
      { href: "/reviews", label: "Reviews", icon: Star, permission: "reviews:view" },
      { href: "/coupons", label: "Coupons", icon: TicketPercent, permission: "coupons:manage" },
      { href: "/notifications", label: "Notifications", icon: Bell, permission: "notifications:send" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:view" },
      { href: "/security", label: "Security", icon: Shield, permission: "admin-users:manage" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/legal", label: "Legal & Documents", icon: Scale, permission: "settings:manage" },
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
      { href: "/admin-users", label: "Admin Users", icon: Shield, permission: "admin-users:manage" },
      { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, permission: "audit:view" },
    ],
  },
];

export function Sidebar({ admin }: { admin: SessionUser }) {
  const pathname = usePathname();

  return (
    <aside
      style={{ background: "var(--lm-surface)", borderRight: "1px solid var(--lm-border)" }}
      className="w-[260px] flex flex-col h-screen sticky top-0 z-20 shrink-0"
    >
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
            style={{ objectFit: "cover", objectPosition: "50% 5%", transform: "scale(1.25)" }}
            priority
            draggable={false}
          />
        </span>
        <div className="flex flex-col">
          <span style={{ color: "var(--lm-text)" }} className="font-bold text-[15px] tracking-tight truncate leading-tight">
            Language Metrics
          </span>
          <span style={{ color: "var(--lm-text-muted)" }} className="text-[11px] font-medium leading-tight mt-0.5">Admin Portal</span>
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-4 mb-1 mt-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--lm-text-subtle)" }}>
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items
                .filter((item) => (item.permission ? hasPermission(admin, item.permission as never) : true))
                .map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                  return (
                    <div key={item.href} className="relative">
                      {isActive && (
                        <div
                          style={{ background: "var(--lm-accent)" }}
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                        />
                      )}
                      <Link
                        href={item.href}
                        style={isActive ? { background: "var(--lm-accent-bg)", color: "var(--lm-text)" } : { color: "var(--lm-text-muted)", border: "1px solid transparent" }}
                        className={clsx(
                          "flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200 mx-2",
                          !isActive && "hover:text-white"
                        )}
                      >
                        <Icon size={16} className="shrink-0" style={{ color: isActive ? "var(--lm-text)" : "inherit" }} />
                        {item.label}
                      </Link>
                      {item.children && isActive && (
                        <div className="pl-10 space-y-0.5">
                          {item.children.map((c) => (
                            <Link
                              key={c.label}
                              href={c.href}
                              className="block text-[12px] py-1 rounded hover:text-white transition-colors"
                              style={{ color: "var(--lm-text-subtle)" }}
                            >
                              {c.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-5 shrink-0 border-t" style={{ borderColor: "var(--lm-border)" }}>
        <div className="mb-3 px-4">
          <p style={{ color: "var(--lm-text)" }} className="text-[12px] font-bold truncate">{admin.name}</p>
          <p style={{ color: "var(--lm-text-subtle)" }} className="text-[11px] truncate">{admin.email}</p>
        </div>
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

