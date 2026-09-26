"use client";

/**
 * Live operations console.
 *
 * Three jobs on one page, in the order an admin needs them:
 *   1. What is happening right now (and the ability to stop it).
 *   2. What it is costing, against the budget.
 *   3. What needs a human decision (teacher no-shows).
 */

import React, { useCallback, useEffect, useState } from "react";
import CostChart, { type DailyCost } from "./CostChart";

interface LiveRoom {
  classSessionId: string;
  roomName: string;
  numParticipants: number;
  participants: Array<{ identity: string; name: string; role: string; isPublishing: boolean }>;
  studentName: string | null;
  teacherName: string | null;
  scheduledEnd: string | null;
  isOverrunning: boolean;
  elapsedMinutes: number;
  recordingStatus: string | null;
}

interface CostReport {
  usage: {
    connectionMinutes: number;
    downstreamGb: number;
    egressVideoMinutes: number;
    egressAudioMinutes: number;
  };
  breakdown: {
    tier: {
      label: string;
      includedConnectionMinutes: number;
      includedDownstreamGb: number;
      connectionMinuteUsd: number;
      downstreamGbUsd: number;
    };
    overageCostUsd: number;
    connectionMinutesUtilisation: number;
    downstreamGbUtilisation: number;
  };
  budget: { verdict: string; spendUsd: number; budgetUsd: number; utilisation: number; message: string };
  remainingFreeClassMinutes: number;
  daily: DailyCost[];
  perClass: Array<{ profile: string; totalCostUsd: number; downstreamGb: number }>;
}

interface ReviewItem {
  classSessionId: string;
  studentName: string;
  teacherName: string;
  scheduledStart: string;
  heldCoins: number;
  refundedCoins: number;
  noShow: string;
  reason: string | null;
}

const card: React.CSSProperties = {
  background: "var(--lm-surface)",
  border: "1px solid var(--border)",
};

export default function LiveOpsClient() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [configured, setConfigured] = useState(true);
  const [cost, setCost] = useState<CostReport | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live/rooms", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setConfigured(data.configured !== false);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRooms();
    // 15s is a deliberate floor: this endpoint calls LiveKit's REST API, which
    // is rate limited, and a live-class list does not need to be truer than
    // that.
    const id = setInterval(loadRooms, 15_000);
    return () => clearInterval(id);
  }, [loadRooms]);

  useEffect(() => {
    void (async () => {
      const [c, r] = await Promise.all([
        fetch("/api/admin/live/costs", { credentials: "include" }).then((x) => (x.ok ? x.json() : null)),
        fetch("/api/admin/live/review", { credentials: "include" }).then((x) => (x.ok ? x.json() : null)),
      ]);
      if (c) setCost(c);
      if (r) setReview(r.items ?? []);
    })();
  }, []);

  const endClass = useCallback(
    async (sessionId: string) => {
      if (!window.confirm("End this class for everyone and settle the student's coins?")) return;
      setBusy(sessionId);
      try {
        await fetch(`/api/admin/live/rooms/${sessionId}/end`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Ended from the admin console" }),
        });
        await loadRooms();
      } finally {
        setBusy(null);
      }
    },
    [loadRooms]
  );

  const verdictColor: Record<string, string> = {
    ok: "var(--success)",
    warn: "var(--warning)",
    critical: "var(--warning)",
    exceeded: "var(--danger)",
  };

  return (
    <div className="space-y-6">
      {!configured && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ ...card, borderColor: "var(--warning)", color: "var(--text)" }}
        >
          LiveKit is not configured on this deployment. Set <code>LIVEKIT_API_KEY</code>,{" "}
          <code>LIVEKIT_API_SECRET</code> and <code>LIVEKIT_WS_URL</code> to enable live classes.
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Live right now"
          value={String(rooms.length)}
          sub={`${rooms.reduce((a, r) => a + r.numParticipants, 0)} people connected`}
          accent={rooms.some((r) => r.isOverrunning) ? "var(--warning)" : undefined}
        />
        <Stat
          label="Spend this month"
          value={cost ? `$${cost.budget.spendUsd.toFixed(2)}` : "—"}
          sub={cost ? `of $${cost.budget.budgetUsd.toFixed(2)} budget` : ""}
          accent={cost ? verdictColor[cost.budget.verdict] : undefined}
        />
        <Stat
          label="Free class-minutes left"
          value={cost ? cost.remainingFreeClassMinutes.toLocaleString() : "—"}
          sub={cost ? `≈ ${Math.floor(cost.remainingFreeClassMinutes / 60)} hours of 1:1 teaching` : ""}
        />
        <Stat
          label="Needs review"
          value={String(review.length)}
          sub="teacher no-shows and refunds"
          accent={review.length > 0 ? "var(--warning)" : undefined}
        />
      </div>

      {/* ── Budget meter ────────────────────────────────────────────────── */}
      {cost && (
        <div className="rounded-lg p-5" style={card}>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {cost.breakdown.tier.label} plan allowances
            </h3>
            <span className="text-xs" style={{ color: verdictColor[cost.budget.verdict] }}>
              {cost.budget.message}
            </span>
          </div>

          <Meter
            label="Connection minutes"
            used={cost.usage.connectionMinutes}
            total={cost.breakdown.tier.includedConnectionMinutes}
            format={(n) => `${Math.round(n).toLocaleString()} min`}
          />
          <Meter
            label="Downstream data"
            used={cost.usage.downstreamGb}
            total={cost.breakdown.tier.includedDownstreamGb}
            format={(n) => `${n.toFixed(1)} GB`}
          />

          <p className="mt-4 text-xs" style={{ color: "var(--text-subtle)" }}>
            One more 60-minute 1:1 class costs{" "}
            {cost.perClass
              .map((p) => `${p.profile} $${p.totalCostUsd.toFixed(3)}`)
              .join(" · ")}
            . New classes drop to audio-only automatically at 90% of budget.
          </p>
        </div>
      )}

      {/* ── Cost chart ──────────────────────────────────────────────────── */}
      {cost && (
        <CostChart
          daily={cost.daily}
          rates={{
            connectionMinuteUsd: cost.breakdown.tier.connectionMinuteUsd,
            downstreamGbUsd: cost.breakdown.tier.downstreamGbUsd,
          }}
        />
      )}

      {/* ── Live rooms ──────────────────────────────────────────────────── */}
      <div className="rounded-lg overflow-hidden" style={card}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Classes in progress
          </h3>
        </div>

        {rooms.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No classes are live right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                  {["Teacher", "Student", "Elapsed", "In room", "Recording", ""].map((h) => (
                    <th
                      key={h}
                      className="py-3 px-5 text-[11px] font-semibold uppercase"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.classSessionId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-3 px-5" style={{ color: "var(--text)" }}>
                      {r.teacherName ?? "—"}
                    </td>
                    <td className="py-3 px-5" style={{ color: "var(--text)" }}>
                      {r.studentName ?? "—"}
                    </td>
                    <td className="py-3 px-5 tabular-nums" style={{ color: r.isOverrunning ? "var(--warning)" : "var(--text-muted)" }}>
                      {r.elapsedMinutes} min{r.isOverrunning ? " · overrunning" : ""}
                    </td>
                    <td className="py-3 px-5" style={{ color: "var(--text-muted)" }}>
                      {r.participants.map((p) => p.name).join(", ") || r.numParticipants}
                    </td>
                    <td className="py-3 px-5" style={{ color: "var(--text-muted)" }}>
                      {r.recordingStatus === "RECORDING" ? "● recording" : "—"}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => endClass(r.classSessionId)}
                        disabled={busy === r.classSessionId}
                        className="px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
                        style={{ background: "var(--danger)", color: "#fff" }}
                      >
                        {busy === r.classSessionId ? "Ending…" : "Force end"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Review queue ────────────────────────────────────────────────── */}
      {review.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={card}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Settlements needing review
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
              The student has already been refunded automatically. These are here so somebody
              decides what happens to the teacher.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                  {["When", "Teacher", "Student", "Refunded", "Reason"].map((h) => (
                    <th key={h} className="py-3 px-5 text-[11px] font-semibold uppercase" style={{ color: "var(--text-subtle)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {review.map((r) => (
                  <tr key={r.classSessionId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-3 px-5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {new Date(r.scheduledStart).toLocaleString()}
                    </td>
                    <td className="py-3 px-5" style={{ color: "var(--text)" }}>{r.teacherName}</td>
                    <td className="py-3 px-5" style={{ color: "var(--text)" }}>{r.studentName}</td>
                    <td className="py-3 px-5 tabular-nums" style={{ color: "var(--text)" }}>{r.refundedCoins}</td>
                    <td className="py-3 px-5" style={{ color: "var(--text-muted)" }}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg p-5" style={card}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-subtle)" }}>
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-bold tabular-nums" style={{ color: accent ?? "var(--text)" }}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Meter({
  label,
  used,
  total,
  format,
}: {
  label: string;
  used: number;
  total: number;
  format: (n: number) => string;
}) {
  const pct = total > 0 ? Math.min(1.2, used / total) : 0;
  const over = pct > 1;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <span className="text-xs tabular-nums" style={{ color: "var(--text)" }}>
          {format(used)} / {format(total)}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-inset)" }}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.min(100, pct * 100)}%`,
            background: over ? "var(--danger)" : pct > 0.75 ? "var(--warning)" : "var(--success)",
          }}
        />
      </div>
    </div>
  );
}
