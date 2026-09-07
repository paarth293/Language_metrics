"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/lib/auth-client";
import type { Role } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface AppShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  /**
   * The role this section is for (e.g. "TEACHER" for everything under
   * app/teacher/*). An unauthenticated visitor is redirected to /login, and
   * a signed-in user with a different role is redirected to their own
   * dashboard — mirroring the guard already used by app/admin/dashboard/page.tsx.
   */
  requiredRole: Role;
}

function dashboardPathFor(role: Role): string {
  switch (role) {
    case "STUDENT":
      return "/student/dashboard";
    case "TEACHER":
      return "/teacher/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    default:
      return "/login";
  }
}

export function AppShell({ children, navItems, requiredRole }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role !== requiredRole) {
      router.replace(dashboardPathFor(user.role));
    }
  }, [user, isLoading, requiredRole, router]);

  // Show minimal skeleton while auth state loads, or while a redirect above
  // is about to take the visitor away from this section.
  if (isLoading || !user || user.role !== requiredRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <span className="text-sm text-text-muted font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text transition-colors duration-200">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        navItems={navItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} user={user} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
