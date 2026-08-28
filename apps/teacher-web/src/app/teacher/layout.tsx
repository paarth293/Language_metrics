"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wallet,
  User,
  Bell,
  BookOpen,
} from "lucide-react";

const teacherNavItems = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "Schedule", href: "/teacher/schedule", icon: Calendar },
  { label: "Students", href: "/teacher/students", icon: Users },
  { label: "Earnings", href: "/teacher/earnings", icon: Wallet },
  { label: "Sessions", href: "/teacher/sessions", icon: BookOpen },
  { label: "Profile", href: "/teacher/profile", icon: User },
  { label: "Notifications", href: "/teacher/notifications", icon: Bell },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell navItems={teacherNavItems}>
      {children}
    </AppShell>
  );
}
