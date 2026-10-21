"use client";

import React from "react";
import { AlertCircle, Flame, Clock, BookOpen, Users, Calendar, ArrowRight } from "lucide-react";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { NextClassCard } from "@/components/dashboard/NextClassCard";
import { CoinBalanceCard } from "@/components/dashboard/CoinBalanceCard";
import { PracticeChart } from "@/components/dashboard/PracticeChart";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useJsonResource } from "@repo/ui/useResource";
import { StaleDataNotice } from "@repo/ui/StaleDataNotice";

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
    sessionStatus?: string; joinOpensAt?: string; joinClosesAt?: string;
  }>;
};

export default function StudentDashboard() {
  // Served from cache on a revisit, so navigating back here no longer drops
  // to DashboardSkeleton over data that was on screen a moment ago.
  const { data, error, isLoading, isStale, updatedAt, refetch } =
    useJsonResource<DashboardData>("/api/students/dashboard", { staleMs: 30_000, pollMs: 60_000 });

  // A skeleton is only right when nothing has ever loaded.
  if (isLoading) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <p className="font-semibold text-text mb-1">Unable to load dashboard</p>
          <p className="text-text-muted text-sm mb-4">
            {error ? "Check your connection and try again." : ""}
          </p>
          {/* A client-side retry, not a document reload: reloading threw away
              the whole app shell and every other cached page with it. */}
          <Button onClick={() => void refetch()} variant="primary">Retry</Button>
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
    // No entrance animation: this page re-mounts on every navigation back to
    // it, and replaying a fade over cached content is exactly the flicker
    // this change is meant to remove.
    <div className="space-y-8 pb-16">
      {isStale && <StaleDataNotice onRetry={() => void refetch()} updatedAt={updatedAt} />}

      {/* ── GREETING ─────────────────────────────────── */}
      <DashboardGreeting
        name={profile.name}
        subtitle={`Ready to continue your ${profile.languageToLearn} journey?`}
        badge={profile.proficiencyLevel}
      />

      {/* ── METRIC CARDS ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
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
        /* Has class or history — show Next Class (2 col) + coin balance (1 col) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex">
            <NextClassCard cls={nextClass} hasHistory={hasHistory} />
          </div>
          <CoinBalanceCard balance={stats.coinBalance} />
        </div>
      ) : (
        /* Brand new user — no class, no history. Show a clean 2-card row. */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Get Started Card */}
          <Card className="hover:shadow-level-2 transition-shadow duration-180">
            <CardContent className="p-5 flex flex-col h-full">
              <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em] mb-4">
                Get started
              </h3>
              <div className="flex flex-col items-center justify-center flex-1 text-center py-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(80,70,200,0.08)" }}
                >
                  <Calendar className="w-6 h-6" style={{ color: "#5046c8" }} />
                </div>
                <p className="text-sm font-semibold text-text mb-1">Book your first class</p>
                <p className="text-xs text-text-muted mb-5 max-w-[200px]">
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
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em]">
                Upcoming classes
              </h3>
              <Link href="/student/classes" className="text-sm font-medium text-action hover:text-action-hover transition-colors auth-focus rounded-md inline-flex min-h-11 items-center -my-3 px-2 -mx-2">
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
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: "linear-gradient(135deg, #231d5e, #5046c8)" }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{cls.teacher}</p>
                      <p className="text-xs text-text-muted capitalize">
                        {cls.language} · {cls.type.toLowerCase()}
                        {start ? ` · ${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                      </p>
                    </div>
                    <Link
                      href="/student/classes"
                      className="text-xs font-semibold text-brand hover:text-brand-hover transition-colors auth-focus rounded-md inline-flex min-h-11 items-center -my-3 px-2 -mx-2 shrink-0"
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
