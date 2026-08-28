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
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Find Teacher", href: "/discover", icon: Search },
  { label: "My Classes", href: "/classes", icon: Calendar },
  { label: "Live Class", href: "/live", icon: Video },
  { label: "Recordings", href: "/recordings", icon: Video },
  { label: "Chat", href: "/chat", icon: MessageCircle },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Support", href: "/support", icon: HelpCircle },
  { label: "FAQ", href: "/faq", icon: HelpCircle },
  { label: "Terms", href: "/terms", icon: FileText },
  { label: "Privacy", href: "/privacy", icon: FileText },
];

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell navItems={studentNavItems}>{children}</AppShell>;
}
