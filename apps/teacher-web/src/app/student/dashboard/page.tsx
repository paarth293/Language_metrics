"use client";

import React from "react";
import { AlertCircle, Flame, Clock, BookOpen, Users, Calendar, ArrowRight } from "lucide-react";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { NextClassCard } from "@/components/dashboard/NextClassCard";
import { CoinBalanceCard } from "@/components/dashboard/CoinBalanceCard";
import { PracticeChart } from "@/components/dashboard/PracticeChart";
import { StreakDots } from "@/components/dashboard/StreakDots";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

type DashboardData = {
  profile: { name: string; languageToLearn: string; proficiencyLevel: string; avatarUrl: string | null };
  stats: {
    totalClasses: number; totalHours: number; uniqueTeachers: number;
    coinBalance: number; monthlyClasses: number; streak: number;
    hoursThisWeek?: number; hoursLastWeek?: number;
  };
  practiceSeries: Array<{ weekStart: string; hours: number; classes: number }>;
  upcomingClasses: Array<{
    id: string; sessionId?: string; teacher: string; avatar: string | null;
    language: string; type: string; scheduledStart?: string; scheduledEnd?: string;
  }>;
};

export default function StudentDashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/students/dashboard", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData).catch(() => setError("Failed to load")).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <p className="font-semibold text-text mb-1">Unable to load dashboard</p>
          <p className="text-text-muted text-sm mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold">Retry</button>
        </div>
      </div>
    );
  }

  const { profile, stats, practiceSeries, upcomingClasses } = data;
  const nextClass = upcomingClasses[0] ?? undefined;
  const hasHistory = stats.totalClasses > 0;
  const hoursThisWeek = stats.hoursThisWeek ?? 0;
  const hoursLastWeek = stats.hoursLastWeek ?? 0;

  // Decide layout: if there's a next class, show the 2+1 split. Otherwise use a 2-col layout.
  const showNextClass = !!nextClass || hasHistory;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ── GREETING ─────────────────────────────────── */}
      <DashboardGreeting
        name={profile.name}
        language={profile.languageToLearn}
        proficiencyLevel={profile.proficiencyLevel}
      />

      {/* ── METRIC CARDS ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Flame}
          label="Study streak"
          value={stats.streak > 0 ? `${stats.streak} days` : "0 days"}
          accentColor="#f97316"
          accentBg="rgba(249,115,22,0.08)"
          delta={stats.streak > 0 ? { value: stats.streak, trend: "up" } : undefined}
        />
        <MetricCard
          icon={Clock}
          label="Hours this week"
          value={`${hoursThisWeek}h`}
          accentColor="#0f9d6b"
          accentBg="rgba(15,157,107,0.08)"
          delta={
            hoursThisWeek > hoursLastWeek
              ? { value: hoursThisWeek - hoursLastWeek, trend: "up" }
              : hoursThisWeek < hoursLastWeek
                ? { value: hoursLastWeek - hoursThisWeek, trend: "down" }
                : undefined
          }
        />
        <MetricCard
          icon={BookOpen}
          label="Classes taken"
          value={stats.totalClasses}
          accentColor="#5046c8"
          accentBg="rgba(80,70,200,0.08)"
          delta={stats.monthlyClasses > 0 ? { value: stats.monthlyClasses, trend: "up" } : undefined}
        />
        <MetricCard
          icon={Users}
          label="Teachers met"
          value={stats.uniqueTeachers}
          accentColor="#c7982f"
          accentBg="rgba(199,152,47,0.08)"
        />
      </div>

      {/* ── SECOND ROW ───────────────────────────────── */}
      {showNextClass ? (
        /* Has class or history — show Next Class (2 col) + sidebar (1 col) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <NextClassCard cls={nextClass} hasHistory={hasHistory} />
          </div>
          <div className="flex flex-col gap-4">
            <CoinBalanceCard balance={stats.coinBalance} />
            <Card className="flex-1 hover:shadow-level-2 transition-shadow duration-180">
              <CardContent className="p-5 sm:p-6 h-full flex flex-col">
                <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-[0.12em] mb-3">
                  Study streak
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[28px] font-display font-bold text-text leading-none">{stats.streak}</span>
                  <span className="text-sm text-text-muted">days</span>
                </div>
                <StreakDots count={stats.streak} />
                {stats.streak === 0 && (
                  <p className="text-[12px] text-text-muted mt-2">Complete a class to start your streak</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Brand new user — no class, no history. Show a clean 3-card row. */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Get Started Card */}
          <Card className="hover:shadow-level-2 transition-shadow duration-180">
            <CardContent className="p-5 sm:p-6 flex flex-col h-full">
              <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-[0.12em] mb-4">
                Get Started
              </div>
              <div className="flex flex-col items-center justify-center flex-1 text-center py-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(80,70,200,0.08)" }}
                >
                  <Calendar className="w-6 h-6" style={{ color: "#5046c8" }} />
                </div>
                <p className="text-[14px] font-semibold text-text mb-1">Book your first class</p>
                <p className="text-[12px] text-text-muted mb-5 max-w-[200px]">
                  Find a {profile.languageToLearn} teacher and start learning today
                </p>
                <Button asChild variant="primary" className="w-full">
                  <Link href="/student/discover">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Find a teacher
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Coin Balance */}
          <CoinBalanceCard balance={stats.coinBalance} />

          {/* Streak */}
          <Card className="hover:shadow-level-2 transition-shadow duration-180">
            <CardContent className="p-5 sm:p-6 h-full flex flex-col">
              <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-[0.12em] mb-3">
                Study streak
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[28px] font-display font-bold text-text leading-none">{stats.streak}</span>
                <span className="text-sm text-text-muted">days</span>
              </div>
              <StreakDots count={stats.streak} />
              {stats.streak === 0 && (
                <p className="text-[12px] text-text-muted mt-2">Complete a class to start your streak</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── PRACTICE CHART ────────────────────────────── */}
      <PracticeChart
        data={practiceSeries}
        hoursThisWeek={hoursThisWeek}
        hoursLastWeek={hoursLastWeek}
      />

      {/* ── UPCOMING CLASSES LIST ─────────────────────── */}
      {upcomingClasses.length > 1 && (
        <Card className="hover:shadow-level-2 transition-shadow duration-180">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em]">
                Upcoming classes
              </h3>
              <Link href="/student/classes" className="text-sm font-medium text-action hover:text-action-hover transition-colors auth-focus rounded px-1 -mx-1">
                View all
              </Link>
            </div>
            <div className="divide-y divide-border/50">
              {upcomingClasses.slice(1, 4).map((cls) => {
                const start = cls.scheduledStart ? new Date(cls.scheduledStart) : null;
                const initials = cls.teacher.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={cls.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                      style={{ background: "linear-gradient(135deg, #231d5e, #5046c8)" }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-text truncate">{cls.teacher}</p>
                      <p className="text-[12px] text-text-muted capitalize">
                        {cls.language} · {cls.type.toLowerCase()}
                        {start ? ` · ${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/student/classes/${cls.id}`}
                      className="text-[12px] font-semibold text-brand hover:text-brand-hover transition-colors auth-focus rounded px-1 -mx-1 shrink-0"
                    >
                      Details
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
