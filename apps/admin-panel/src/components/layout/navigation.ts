import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  Languages,
  LayoutDashboard,
  MessageSquareWarning,
  ScrollText,
  Settings,
  Shield,
  Star,
  UsersRound,
  Video,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac";

export type ModuleKey = "overview" | "people" | "learning" | "finance" | "operations" | "system";

export interface ContextLink {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export interface AdminModule {
  key: ModuleKey;
  href: string;
  label: string;
  icon: LucideIcon;
  permissions: Permission[];
  match: string[];
  contextLinks: ContextLink[];
}

export const adminModules: AdminModule[] = [
  {
    key: "overview",
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
    permissions: ["dashboard:view"],
    match: ["/"],
    contextLinks: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
      { href: "/analytics", label: "Reports & Analytics", icon: BarChart3, permission: "analytics:view" },
    ],
  },
  {
    key: "people",
    href: "/students",
    label: "People",
    icon: UsersRound,
    permissions: ["students:view", "teachers:view", "admin-users:manage"],
    match: ["/students", "/teachers", "/admin-users"],
    contextLinks: [
      { href: "/students", label: "Students", icon: GraduationCap, permission: "students:view" },
      { href: "/teachers", label: "Teachers", icon: UsersRound, permission: "teachers:view" },
      { href: "/admin-users", label: "Admin users", icon: Shield, permission: "admin-users:manage" },
    ],
  },
  {
    key: "learning",
    href: "/courses",
    label: "Learning",
    icon: BookOpen,
    permissions: ["languages:manage", "courses:manage", "classes:manage"],
    match: ["/languages", "/courses", "/classes"],
    contextLinks: [
      { href: "/languages", label: "Languages", icon: Languages, permission: "languages:manage" },
      { href: "/courses", label: "Courses", icon: BookOpen, permission: "courses:manage" },
      { href: "/classes", label: "Classes", icon: CalendarDays, permission: "classes:manage" },
    ],
  },
  {
    key: "finance",
    href: "/payments",
    label: "Finance",
    icon: CreditCard,
    permissions: ["payments:view", "invoices:manage", "payouts:manage"],
    match: ["/payments", "/invoices", "/payouts"],
    contextLinks: [
      { href: "/payments", label: "Payments", icon: CreditCard, permission: "payments:view" },
      { href: "/invoices", label: "GST & invoices", icon: FileText, permission: "invoices:manage" },
      { href: "/payouts", label: "Teacher payouts", icon: CreditCard, permission: "payouts:manage" },
    ],
  },
  {
    key: "operations",
    href: "/complaints",
    label: "Operations",
    icon: Activity,
    permissions: [
      "recordings:manage",
      "complaints:manage",
      "reviews:view",
      "coupons:manage",
      "notifications:send",
      "analytics:view",
    ],
    match: ["/recordings", "/complaints", "/reviews", "/coupons", "/notifications", "/analytics", "/security"],
    contextLinks: [
      { href: "/complaints", label: "Complaints", icon: MessageSquareWarning, permission: "complaints:manage" },
      { href: "/reviews", label: "Reviews", icon: Star, permission: "reviews:view" },
      { href: "/recordings", label: "Recordings", icon: Video, permission: "recordings:manage" },
      { href: "/notifications", label: "Notifications", icon: MessageSquareWarning, permission: "notifications:send" },
      { href: "/security", label: "Security", icon: Shield, permission: "admin-users:manage" },
    ],
  },
  {
    key: "system",
    href: "/settings",
    label: "System",
    icon: Settings,
    permissions: ["settings:manage", "audit:view", "admin-users:manage"],
    match: ["/legal", "/settings", "/audit-logs"],
    contextLinks: [
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings:manage" },
      { href: "/legal", label: "Legal & documents", icon: FileText, permission: "settings:manage" },
      { href: "/audit-logs", label: "Audit logs", icon: ScrollText, permission: "audit:view" },
    ],
  },
];

export function visibleModules(admin: SessionUser): AdminModule[] {
  return adminModules.filter((module) =>
    module.permissions.some((permission) => hasPermission(admin, permission))
  );
}

export function isPathActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function activeModuleForPath(pathname: string, admin: SessionUser): AdminModule {
  const visible = visibleModules(admin);
  return (
    visible.find((module) =>
      module.match.some((match) => (match === "/" ? pathname === "/" : pathname.startsWith(match)))
    ) ?? visible[0] ?? adminModules[0]
  );
}

export function visibleContextLinks(module: AdminModule, admin: SessionUser): ContextLink[] {
  return module.contextLinks.filter((link) => !link.permission || hasPermission(admin, link.permission));
}
