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
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Find Teacher", href: "/student/discover", icon: Search },
  { label: "My Classes", href: "/student/classes", icon: Calendar },
  { label: "Live Class", href: "/student/live", icon: Video },
  { label: "Recordings", href: "/student/recordings", icon: Video },
  { label: "Chat", href: "/student/chat", icon: MessageCircle },
  { label: "Wallet", href: "/student/wallet", icon: Wallet },
  { label: "Notifications", href: "/student/notifications", icon: Bell },
  { label: "Profile", href: "/student/profile", icon: User },
  { label: "Support", href: "/student/support", icon: HelpCircle },
  { label: "FAQ", href: "/student/faq", icon: HelpCircle },
  { label: "Terms", href: "/student/terms", icon: FileText },
  { label: "Privacy", href: "/student/privacy", icon: FileText },
];

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell navItems={studentNavItems}>{children}</AppShell>;
}
