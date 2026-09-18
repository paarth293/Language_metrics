"use client";

import React from "react";
import {
  AlertCircle, Calendar, Sparkles, Users, Wallet, Flame, BookOpen,
  TrendingUp, ArrowRight, Video, PlayCircle, Clock, Star
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StreakDots } from "@/components/dashboard/StreakDots";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { cn } from "@/lib/cn";
import Link from "next/link";

type DashboardData = {
  profile: {
    name: string;
    languageToLearn: string;
    proficiencyLevel: string;
    avatarUrl: string | null;
  };
  stats: {
    totalClasses: number;
    totalHours: number;
    uniqueTeachers: number;
    coinBalance: number;
    monthlyClasses: number;
    classesThisMonth: number;
    classesLastMonth: number;
    streak: number;
    bestStreak: number;
    streakDays: boolean[];
    hoursThisWeek: number;
    hoursLastWeek: number;
  };
  practiceSeries: Array<{ weekStart: string; hours: number; classes: number }>;
  teachers: Array<{ id: string; name: string; avatar: string | null; language: string }>;
  upcomingClasses: Array<{
    id: string;
    sessionId?: string;
    teacher: string;
    avatar: string | null;
    language: string;
    type: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  }>;
  recentActivity: Array<{
    id: string;
    teacher: string;
    avatar: string | null;
    type: string;
    language: string;
    date: string;
    amount: number;
  }>;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function formatClassDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

function formatActivityDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size, height: size,
        background: src ? undefined : "linear-gradient(135deg, #c7982f, #e0b24a)",
        fontSize: size * 0.35,
      }}
    >
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function StudentDashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/students/dashboard", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[#1a1547] mb-2">Unable to load dashboard</h2>
          <p className="text-[#8a93a6] mb-6">{error || "Something went wrong."}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #c7982f, #e0b24a)" }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { profile, stats, upcomingClasses, recentActivity } = data;
  const firstName = profile.name.split(" ")[0] || profile.name;
  const greeting = getGreeting();
  const now = new Date();

  // Live class detection
  const nextClass = upcomingClasses[0];
  let isLive = false;
  if (nextClass?.scheduledStart && nextClass?.scheduledEnd) {
    const start = new Date(nextClass.scheduledStart);
    const end = new Date(nextClass.scheduledEnd);
    isLive = now >= new Date(start.getTime() - 15 * 60000) && now <= end;
  }

  return (
    <div className="min-h-full pb-16 animate-in fade-in slide-in-from-bottom-2 duration-400">

      {/* ── HERO SECTION ── */}
      <div
        className="relative overflow-hidden rounded-2xl mb-8 px-8 py-8"
        style={{
          background: "linear-gradient(135deg, #0f0c29 0%, #231d5e 50%, #1a1547 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #c7982f, transparent)" }} />
        <div className="absolute -right-4 bottom-0 w-40 h-40 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #7b73e4, transparent)" }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              {formatFullDate(now)}
            </p>
            <h1 className="font-display text-[38px] sm:text-[46px] font-bold leading-tight text-white mb-2">
              {greeting}, <span style={{ color: "#c7982f" }}>{firstName}</span>
            </h1>
            <p className="text-[15px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              Continue your {profile.languageToLearn} learning journey · Level {profile.proficiencyLevel}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-3 flex-shrink-0">
            <Link
              href="/student/discover"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:gap-3"
              style={{
                background: "linear-gradient(135deg, #c7982f, #e0b24a)",
                color: "#0f0c29",
                boxShadow: "0 4px 20px rgba(199,152,47,0.4)",
              }}
            >
              Find a Teacher <ArrowRight className="w-4 h-4" />
            </Link>
            {stats.streak > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.08)" }}>
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-[13px] font-semibold text-white">{stats.streak}-day streak</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={Wallet}
          label="Wallet balance"
          value={`₹${stats.coinBalance.toLocaleString("en-IN")}`}
          accentColor="#c7982f"
          accentBg="rgba(199,152,47,0.1)"
          highlight
          delta={stats.coinBalance > 0 ? { value: stats.coinBalance, trend: "up" } : undefined}
        />
        <MetricCard
          icon={BookOpen}
          label="Classes this month"
          value={stats.classesThisMonth}
          accentColor="#5046c8"
          accentBg="rgba(80,70,200,0.08)"
          delta={
            stats.classesThisMonth > stats.classesLastMonth
              ? { value: stats.classesThisMonth - stats.classesLastMonth, trend: "up" }
              : undefined
          }
        />
        <MetricCard
          icon={Flame}
          label="Current streak"
          value={`${stats.streak} days`}
          accentColor="#f97316"
          accentBg="rgba(249,115,22,0.08)"
          delta={stats.streak > 0 ? { value: stats.streak, trend: "up" } : undefined}
        />
        <MetricCard
          icon={Video}
          label="Total hours"
          value={stats.totalHours}
          accentColor="#0f9d6b"
          accentBg="rgba(15,157,107,0.08)"
          delta={
            stats.hoursThisWeek > stats.hoursLastWeek
              ? { value: stats.hoursThisWeek - stats.hoursLastWeek, trend: "up" }
              : undefined
          }
        />
      </div>

      {/* ── MAIN CONTENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Upcoming Classes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#1a1547]">Upcoming Classes</h2>
              {upcomingClasses.length > 0 && (
                <Link href="/student/classes" className="text-[13px] font-semibold text-[#c7982f] hover:text-[#a36e1a] transition-colors">
                  View all →
                </Link>
              )}
            </div>

            {upcomingClasses.length > 0 ? (
              <div className="space-y-3">
                {upcomingClasses.slice(0, 3).map((cls, idx) => {
                  const isFirst = idx === 0;
                  const isCurrentLive = isFirst && isLive;
                  const start = cls.scheduledStart ? new Date(cls.scheduledStart) : new Date();

                  return (
                    <div
                      key={cls.id}
                      className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-200"
                      style={{
                        background: isCurrentLive ? "linear-gradient(135deg, #0f9d6b08, #0f9d6b04)" : "#fff",
                        border: isCurrentLive ? "1px solid rgba(15,157,107,0.3)" : "1px solid rgba(35,29,94,0.08)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      }}
                    >
                      <Avatar src={cls.avatar} name={cls.teacher} size={48} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-[15px] text-[#1a1547]">{cls.teacher}</span>
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: "rgba(80,70,200,0.08)", color: "#5046c8" }}
                          >
                            {cls.language}
                          </span>
                          {isCurrentLive && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse" style={{ background: "rgba(15,157,107,0.12)", color: "#0f9d6b" }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[13px]" style={{ color: "#8a93a6" }}>
                          <Clock className="w-3.5 h-3.5" />
                          {formatClassDate(start)}
                        </div>
                      </div>

                      <button
                        className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all flex-shrink-0"
                        style={isCurrentLive ? {
                          background: "linear-gradient(135deg, #0f9d6b, #0f6b58)",
                          color: "#fff",
                          boxShadow: "0 4px 12px rgba(15,157,107,0.3)",
                        } : {
                          background: "rgba(35,29,94,0.05)",
                          color: "#231d5e",
                        }}
                      >
                        {isCurrentLive ? "Join Now" : "Details"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center py-12 rounded-2xl"
                style={{ background: "#fff", border: "1px solid rgba(35,29,94,0.08)" }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(80,70,200,0.06)" }}>
                  <Calendar className="w-7 h-7" style={{ color: "#5046c8" }} />
                </div>
                <h3 className="font-bold text-[#1a1547] text-[16px] mb-1">No upcoming classes</h3>
                <p className="text-[13px] text-[#8a93a6] text-center max-w-[280px] mb-5">
                  Book a session with one of our verified teachers to continue your learning.
                </p>
                <Link
                  href="/student/discover"
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ background: "linear-gradient(135deg, #c7982f, #e0b24a)" }}
                >
                  Find a Teacher
                </Link>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-xl font-bold text-[#1a1547] mb-4">Recent Activity</h2>
            {recentActivity.length > 0 ? (
              <div
                className="rounded-2xl overflow-hidden divide-y divide-[rgba(35,29,94,0.06)]"
                style={{
                  background: "#fff",
                  border: "1px solid rgba(35,29,94,0.08)",
                }}
              >
                {recentActivity.slice(0, 5).map(activity => (
                  <div key={activity.id} className="flex items-center gap-4 px-5 py-4">
                    <Avatar src={activity.avatar} name={activity.teacher} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] text-[#1a1547] truncate">{activity.teacher}</p>
                      <p className="text-[12px] text-[#8a93a6] truncate capitalize">{activity.type} · {activity.language}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[14px] font-bold text-[#1a1547]">₹{activity.amount}</p>
                      <p className="text-[11px] text-[#8a93a6]">{formatActivityDate(new Date(activity.date))}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center py-10 rounded-2xl"
                style={{ background: "#fff", border: "1px solid rgba(35,29,94,0.08)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(199,152,47,0.08)" }}>
                  <Sparkles className="w-6 h-6" style={{ color: "#c7982f" }} />
                </div>
                <p className="font-semibold text-[#1a1547] mb-1">No recent activity</p>
                <p className="text-[13px] text-[#8a93a6]">Your completed sessions will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">

          {/* Progress Card */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "#fff", border: "1px solid rgba(35,29,94,0.08)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <h3 className="font-bold text-[#1a1547] text-[16px] mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: "#c7982f" }} />
              Your Progress
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#8a93a6]">Study streak</span>
                  <span className="text-[16px] font-bold" style={{ color: "#f97316" }}>{stats.streak} days</span>
                </div>
                <StreakDots count={stats.streak} />
              </div>

              <div style={{ height: "1px", background: "rgba(35,29,94,0.06)" }} />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#8a93a6]">Study hours</span>
                  <span className="text-[16px] font-bold text-[#1a1547]">{stats.totalHours}h</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(35,29,94,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${Math.min(stats.totalHours * 5, 100)}%`,
                      background: "linear-gradient(90deg, #5046c8, #7b73e4)",
                    }}
                  />
                </div>
              </div>

              <div style={{ height: "1px", background: "rgba(35,29,94,0.06)" }} />

              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#8a93a6] flex items-center gap-2">
                  <Users className="w-4 h-4" /> Teachers met
                </span>
                <span className="text-[16px] font-bold text-[#1a1547]">{stats.uniqueTeachers}</span>
              </div>

              <div style={{ height: "1px", background: "rgba(35,29,94,0.06)" }} />

              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#8a93a6] flex items-center gap-2">
                  <Star className="w-4 h-4" /> Level
                </span>
                <span
                  className="px-2.5 py-1 rounded-lg text-[12px] font-bold"
                  style={{ background: "rgba(80,70,200,0.08)", color: "#5046c8" }}
                >
                  {profile.proficiencyLevel}
                </span>
              </div>
            </div>
          </div>

          {/* Journey CTA Card */}
          <div
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0f0c29, #231d5e)",
            }}
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #c7982f, transparent)" }} />
            <div className="relative">
              <h3 className="font-bold text-white text-[15px] mb-1">Your {profile.languageToLearn} Journey</h3>
              <p className="text-[13px] mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>
                Level {profile.proficiencyLevel} · Next milestone: 10 classes
              </p>
              <Link
                href="/student/discover"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all w-full justify-center"
                style={{ background: "linear-gradient(135deg, #c7982f, #e0b24a)", color: "#0f0c29" }}
              >
                <PlayCircle className="w-4 h-4" /> Book a class
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
