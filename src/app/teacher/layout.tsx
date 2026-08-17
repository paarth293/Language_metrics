"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, Calendar, Users, Wallet, User } from "lucide-react";

const teacherNavItems = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "My Schedule", href: "/teacher/schedule", icon: Calendar },
  { label: "Students", href: "/teacher/students", icon: Users },
  { label: "Earnings", href: "/teacher/wallet", icon: Wallet },
  { label: "Profile", href: "/teacher/profile", icon: User },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell navItems={teacherNavItems}>
      {children}
    </AppShell>
  );
}
