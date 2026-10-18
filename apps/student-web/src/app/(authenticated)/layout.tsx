"use client";

import { AppShell } from "@/components/layout/AppShell";
import {
  LayoutDashboard,
  Search,
  Calendar,
  Wallet,
  User,
  Bell,
  MessageCircle,
  Video,
  HelpCircle,
  FileText,
} from "lucide-react";

const studentNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "Learn" },
  { label: "Find Teacher", href: "/discover", icon: Search, section: "Learn" },
  { label: "My Classes", href: "/classes", icon: Calendar, section: "Learn" },
  { label: "Live Class", href: "/live", icon: Video, section: "Learn" },
  { label: "Recordings", href: "/recordings", icon: Video, section: "Learn" },
  { label: "Chat", href: "/chat", icon: MessageCircle, section: "Learn" },
  { label: "Wallet", href: "/wallet", icon: Wallet, section: "Account" },
  { label: "Notifications", href: "/notifications", icon: Bell, section: "Account" },
  { label: "Profile", href: "/profile", icon: User, section: "Account" },
  { label: "Support", href: "/support", icon: HelpCircle, section: "Help" },
  { label: "FAQ", href: "/faq", icon: HelpCircle, section: "Help" },
  { label: "Terms", href: "/terms", icon: FileText, section: "Help" },
  { label: "Privacy", href: "/privacy", icon: FileText, section: "Help" },
];

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell navItems={studentNavItems}>{children}</AppShell>;
}
