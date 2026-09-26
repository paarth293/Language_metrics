"use client";

import React from "react";
import {
  AlertCircle, Users, AlertTriangle, Star,
  BookOpen, CircleDollarSign, Clock, CalendarDays,
} from "lucide-react";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

type DashboardData = {
  stats: { activeStudents: number; averageRating: number; totalReviews: number; pendingBookings: number };
  weeklySchedule: Array<{ day: string; count: number }>;
  profileName: string;
};

export default function TeacherDashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/teachers/dashboard", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData).catch(() => setError("Failed to load")).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <span className="text-sm text-text-muted">Loading…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
            <h2 className="text-base font-bold text-text mb-1">Unable to load</h2>
            <p className="text-text-muted text-sm mb-5">{error || "Something went wrong."}</p>
            <Button onClick={() => window.location.reload()} variant="primary">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, weeklySchedule, profileName } = data;
  const rating = stats.averageRating > 0 ? stats.averageRating : 0;
  const maxW = Math.max(...weeklySchedule.map(d => d.count), 1);
  const totalWeeklyClasses = weeklySchedule.reduce((a, d) => a + d.count, 0);

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">

      {/* ── GREETING ─────────────────────────────────── */}
      <DashboardGreeting name={profileName} subtitle="Here's your teaching overview for today" />

      {/* ── METRIC CARDS ─────────────────────────────── */}
      {/* Rating lives only in the "Your rating" card below. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard
          icon={Users}
          label="Active students"
          value={stats.activeStudents}
          accentColor="#0f9d6b"
          accentBg="rgba(15,157,107,0.08)"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Pending bookings"
          value={stats.pendingBookings}
          accentColor="#dc4c3e"
          accentBg="rgba(220,76,62,0.08)"
          delta={stats.pendingBookings > 0 ? { value: stats.pendingBookings, trend: "up" } : undefined}
        />
        <MetricCard
          icon={BookOpen}
          label="Total reviews"
          value={stats.totalReviews}
          accentColor="#5046c8"
          accentBg="rgba(80,70,200,0.08)"
        />
      </div>

      {/* ── MAIN ROW ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly Schedule Chart — 2 cols */}
        <Card className="lg:col-span-2 hover:shadow-level-2 transition-shadow duration-180">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em]">
                  Weekly schedule
                </h3>
                <p className="text-sm text-text-muted mt-0.5">
                  {totalWeeklyClasses} class{totalWeeklyClasses !== 1 ? "es" : ""} this week
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-brand/10 text-brand text-xs font-semibold">
                This week
              </div>
            </div>

            {/* Bar Chart */}
            <div className="flex items-end gap-2">
              {weeklySchedule.map((d, i) => {
                const pct = d.count > 0 ? Math.max((d.count / maxW) * 100, 8) : 4;
                const today = new Date().getDay();
                const isToday = today === (i + 1 > 6 ? 0 : i + 1);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                    <div className="w-full h-28 flex flex-col items-center justify-end">
                      {d.count > 0 && (
                        <span
                          className={`text-xs font-bold mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${isToday ? "text-brand" : "text-text-subtle"}`}
                        >
                          {d.count}
                        </span>
                      )}
                      <div
                        className="w-full rounded-t-xl transition-all duration-300"
                        style={{
                          height: `${pct}%`,
                          maxWidth: "44px",
                          background: isToday
                            ? "linear-gradient(to top, #231d5e, #5046c8)"
                            : d.count > 0
                              ? "rgba(80,70,200,0.22)"
                              : "rgba(35,29,94,0.05)",
                          opacity: d.count === 0 ? 0.6 : 1,
                        }}
                      />
                    </div>
                    <span
                      className={`text-xs font-semibold ${isToday ? "text-text" : "text-text-subtle"}`}
                    >
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "linear-gradient(to top, #231d5e, #5046c8)" }} />
                <span className="text-xs text-text-muted">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand/22" />
                <span className="text-xs text-text-muted">Scheduled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Rating — 1 col */}
        <Card className="hover:shadow-level-2 transition-shadow duration-180">
          <CardContent className="p-5 h-full flex flex-col">
            <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em] mb-4">
              Your rating
            </h3>

            {/* Large rating */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-display text-[20px] sm:text-[28px] font-bold leading-none tracking-[-0.01em] text-text">
                {rating > 0 ? rating.toFixed(1) : "—"}
              </span>
              <span className="text-text-muted text-sm">/ 5</span>
            </div>

            {/* Stars */}
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(s => (
                <Star
                  key={s}
                  className="w-4 h-4 text-action"
                  fill={s <= Math.floor(rating) ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              ))}
            </div>

            <p className="text-sm text-text-muted mb-5">
              {stats.totalReviews > 0 ? `Based on ${stats.totalReviews} review${stats.totalReviews !== 1 ? "s" : ""}` : "No reviews yet"}
            </p>

            {/* Rating bar */}
            {rating > 0 && (
              <div className="mb-6">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-text-muted">Score</span>
                  <span className="font-bold text-text">{Math.round((rating / 5) * 100)}%</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden bg-surface-inset">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((rating / 5) * 100)}%`, background: "linear-gradient(90deg, #c7982f, #d8b45e)" }}
                  />
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* ── QUICK ACTIONS ────────────────────────────── */}
      <Card className="hover:shadow-level-2 transition-shadow duration-180">
        <CardContent className="p-5">
          <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em] mb-4">
            Quick actions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { Icon: Clock, label: "Sessions", sub: "Review bookings", hex: "#dc4c3e", href: "/teacher/sessions" },
              { Icon: Users, label: "My Students", sub: `${stats.activeStudents} active`, hex: "#0f9d6b", href: "/teacher/students" },
              { Icon: CircleDollarSign, label: "Earnings", sub: "View payouts", hex: "#c7982f", href: "/teacher/earnings" },
              { Icon: CalendarDays, label: "Schedule", sub: "Set availability", hex: "#5046c8", href: "/teacher/schedule" },
            ].map(({ Icon, label, sub, hex, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 p-5 rounded-2xl border border-border/50 hover:border-brand/20 hover:bg-surface-inset/60 transition-all duration-150 group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}12` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: hex }} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{label}</p>
                  <p className="text-xs text-text-muted">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
