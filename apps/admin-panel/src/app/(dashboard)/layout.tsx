import { requireAdmin } from "@/lib/guards";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth gate: verifies the JWT and reloads the admin's current
  // status/role from the DB on every navigation. Redirects to /login otherwise.
  const admin = await requireAdmin();

  return (
    <DashboardClient admin={admin}>
      {children}
    </DashboardClient>
  );
}
