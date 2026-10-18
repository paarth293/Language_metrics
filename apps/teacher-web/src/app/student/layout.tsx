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
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard, section: "Learn" },
  { label: "Find Teacher", href: "/student/discover", icon: Search, section: "Learn" },
  { label: "My Classes", href: "/student/classes", icon: Calendar, section: "Learn" },
  { label: "Recordings", href: "/student/recordings", icon: Video, section: "Learn" },
  { label: "Chat", href: "/student/chat", icon: MessageCircle, section: "Learn" },
  { label: "Wallet", href: "/student/wallet", icon: Wallet, section: "Account" },
  { label: "Notifications", href: "/student/notifications", icon: Bell, section: "Account" },
  { label: "Profile", href: "/student/profile", icon: User, section: "Account" },
  { label: "Support", href: "/student/support", icon: HelpCircle, section: "Help" },
  { label: "FAQ", href: "/student/faq", icon: HelpCircle, section: "Help" },
  { label: "Terms", href: "/student/terms", icon: FileText, section: "Help" },
  { label: "Privacy", href: "/student/privacy", icon: FileText, section: "Help" },
];

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={studentNavItems} requiredRole="STUDENT">
      {children}
    </AppShell>
  );
}


