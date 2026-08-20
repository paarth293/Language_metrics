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
    <div className="min-h-screen flex w-full">
      <Sidebar admin={admin} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav admin={admin} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
