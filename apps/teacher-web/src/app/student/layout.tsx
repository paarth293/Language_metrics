"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Search, CalendarDays, Wallet, MessageSquare, User } from "lucide-react";

const studentNavItems = [
  { label: "Discover", href: "/student/discover", icon: Search },
  { label: "My Classes", href: "/student/classes", icon: CalendarDays },
  { label: "Wallet", href: "/student/wallet", icon: Wallet },
  { label: "Messages", href: "/student/messages", icon: MessageSquare },
  { label: "Profile", href: "/student/profile", icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell navItems={studentNavItems}>
      {children}
    </AppShell>
  );
}
