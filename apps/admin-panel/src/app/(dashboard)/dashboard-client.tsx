"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import type { SessionUser } from "@/lib/rbac";

interface DashboardClientProps {
  admin: SessionUser;
  children: React.ReactNode;
}

export function DashboardClient({ admin, children }: DashboardClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="lm-shell flex min-h-screen w-full">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--brand-navy)]/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar admin={admin} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav admin={admin} onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg)]">
          {children}
        </main>
      </div>
    </div>
  );
}
