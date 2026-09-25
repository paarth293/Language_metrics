/**
 * /live — live class operations and LiveKit cost.
 *
 * Add to the dashboard nav with permission `classes:manage`.
 */
import { requireAdmin } from "@/lib/guards";
import LiveOpsClient from "./LiveOpsClient";

export const dynamic = "force-dynamic";

export default async function LiveOpsPage() {
  await requireAdmin();

  return (
    <div className="p-7 space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
          Live Classes
        </h1>
        <div className="flex items-center gap-2 text-[13px]">
          <span style={{ color: "var(--lm-text)" }} className="font-semibold">
            Dashboard
          </span>
          <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
          <span style={{ color: "var(--lm-text-muted)" }}>Live</span>
        </div>
      </div>

      <LiveOpsClient />
    </div>
  );
}
