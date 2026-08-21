import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { requireAdmin } from "@/lib/guards";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth gate: verifies the JWT and reloads the admin's current
  // status/role from the DB on every navigation. Redirects to /login otherwise.
  const admin = await requireAdmin();

  return (
    <div className="lm-shell flex min-h-screen w-full">
      <Sidebar admin={admin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav admin={admin} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--lm-paper)]">
          {children}
        </main>
      </div>
    </div>
  );
}
