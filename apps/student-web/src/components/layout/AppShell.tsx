"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, isNavActive } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/lib/auth-client";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  section?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
}

export function AppShell({ children, navItems }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const current = navItems.find((item) => isNavActive(pathname, item.href));

  // Redirect to login if unauthenticated after auth state resolves
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  // Show minimal skeleton while auth state loads
  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <span className="text-sm text-text-muted font-medium">
            {isLoading ? "Loading..." : "Redirecting to login..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-bg text-text transition-colors duration-200">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm lg:hidden"
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
        <TopBar onMenuClick={() => setSidebarOpen(true)} user={user} navItems={navItems} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-bg">
          <div className="mx-auto max-w-[1230px] px-4 pb-6 pt-4 md:px-6">
            {current && (
              <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2 text-[11px] font-medium text-text-subtle">
                <span>{current.section ?? "Home"}</span>
                <span aria-hidden="true">/</span>
                <span className="text-text-muted">{current.label}</span>
              </nav>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
