"use client";

import React from "react";
import {
  AlertCircle, Users, AlertTriangle, TrendingUp, Star,
  BookOpen, ChevronRight, CircleDollarSign, Clock,
} from "lucide-react";
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
  const firstName = profileName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const rating = stats.averageRating > 0 ? stats.averageRating : 0;
  const maxW = Math.max(...weeklySchedule.map(d => d.count), 1);
  const totalWeeklyClasses = weeklySchedule.reduce((a, d) => a + d.count, 0);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ── GREETING ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] lg:text-[44px] leading-[1.05] font-display font-bold text-text tracking-[-0.02em]">
            {greeting}, {firstName}
          </h1>
          <p className="text-base text-text-muted mt-2">
            Here's your teaching overview for today
          </p>
        </div>
        <div className="inline-flex px-3 py-1.5 rounded-full bg-surface-inset text-text-muted text-[11px] font-semibold tracking-[0.14em] uppercase self-start shrink-0 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long" }).toUpperCase()}
        </div>
      </div>

      {/* ── METRIC CARDS ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          icon={Star}
          label="Average rating"
          value={rating > 0 ? rating.toFixed(1) : "—"}
          accentColor="#c7982f"
          accentBg="rgba(199,152,47,0.08)"
          highlight
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Weekly Schedule Chart — 2 cols */}
        <Card className="lg:col-span-2 hover:shadow-level-2 transition-shadow duration-180">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em]">
                  Weekly schedule
                </h3>
                <p className="text-[13px] text-text-muted mt-0.5">
                  {totalWeeklyClasses} class{totalWeeklyClasses !== 1 ? "es" : ""} this week
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-brand/10 text-brand text-[12px] font-semibold">
                This week
              </div>
            </div>

            {/* Bar Chart */}
            <div className="flex items-end gap-2 h-36">
              {weeklySchedule.map((d, i) => {
                const pct = d.count > 0 ? Math.max((d.count / maxW) * 100, 8) : 4;
                const today = new Date().getDay();
                const isToday = today === (i + 1 > 6 ? 0 : i + 1);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-2.5 group cursor-pointer">
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: "104px" }}>
                      {d.count > 0 && (
                        <span
                          className="text-[10px] font-bold mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: isToday ? "#5046c8" : "#8a93a6" }}
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
                      className="text-[11px] font-semibold"
                      style={{ color: isToday ? "#231d5e" : "#8a93a6" }}
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
                <span className="text-[11px] text-text-muted">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand/22" />
                <span className="text-[11px] text-text-muted">Scheduled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Rating — 1 col */}
        <Card className="hover:shadow-level-2 transition-shadow duration-180">
          <CardContent className="p-5 sm:p-6 h-full flex flex-col">
            <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-[0.12em] mb-4">
              Your rating
            </div>

            {/* Large rating */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[48px] font-display font-bold text-text leading-none tracking-[-0.02em]">
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

            <p className="text-[13px] text-text-muted mb-5">
              {stats.totalReviews > 0 ? `Based on ${stats.totalReviews} review${stats.totalReviews !== 1 ? "s" : ""}` : "No reviews yet"}
            </p>

            {/* Rating bar */}
            {rating > 0 && (
              <div className="mb-6">
                <div className="flex justify-between text-[11px] mb-1.5">
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

            <div className="mt-auto">
              {stats.pendingBookings > 0 && (
                <Link href="/teacher/bookings">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-alert/8 border border-alert/20 group hover:bg-alert/12 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-alert shrink-0" />
                      <span className="text-[13px] font-semibold text-text">{stats.pendingBookings} pending</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-subtle opacity-0 group-hover:opacity-60 transition-opacity" />
                  </div>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── QUICK ACTIONS ────────────────────────────── */}
      <Card className="hover:shadow-level-2 transition-shadow duration-180">
        <CardContent className="p-5 sm:p-6">
          <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em] mb-4">
            Quick actions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { Icon: Clock, label: "Review Bookings", sub: `${stats.pendingBookings} waiting`, hex: "#dc4c3e", href: "/teacher/bookings" },
              { Icon: Users, label: "My Students", sub: `${stats.activeStudents} active`, hex: "#0f9d6b", href: "/teacher/students" },
              { Icon: CircleDollarSign, label: "Earnings", sub: "View payouts", hex: "#c7982f", href: "/teacher/earnings" },
              { Icon: TrendingUp, label: "Analytics", sub: "See trends", hex: "#5046c8", href: "/teacher/analytics" },
            ].map(({ Icon, label, sub, hex, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 p-4 rounded-2xl border border-border/50 hover:border-brand/20 hover:bg-surface-inset/60 transition-all duration-150 group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${hex}12` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: hex }} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-text truncate">{label}</p>
                  <p className="text-[11px] text-text-muted">{sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
