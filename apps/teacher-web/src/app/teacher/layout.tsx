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
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard, section: "Teaching" },
  { label: "Schedule", href: "/teacher/schedule", icon: Calendar, section: "Teaching" },
  { label: "Sessions", href: "/teacher/sessions", icon: BookOpen, section: "Teaching" },
  { label: "Students", href: "/teacher/students", icon: Users, section: "Teaching" },
  { label: "Earnings", href: "/teacher/earnings", icon: Wallet, section: "Money" },
  { label: "Profile", href: "/teacher/profile", icon: User, section: "Account" },
  { label: "Notifications", href: "/teacher/notifications", icon: Bell, section: "Account" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell navItems={teacherNavItems} requiredRole="TEACHER">
      {children}
    </AppShell>
  );
}


