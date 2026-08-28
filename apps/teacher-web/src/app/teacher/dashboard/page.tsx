"use client";

import React from "react";
import Link from "next/link";
import {
  Video,
  Star,
  Users,
  User,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Wallet,
  Bell,
  BookOpen,
  Crown,
  Zap,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

type DashboardData = {
  stats: {
    classesTaught: number;
    activeStudents: number;
    averageRating: number;
    totalReviews: number;
    pendingBookings: number;
    monthlyEarnings: number;
    monthlyClasses: number;
    unreadNotifications: number;
  };
  upcomingClasses: Array<{
    id: string;
    sessionId?: string;
    type: string;
    student: string;
    avatar: string;
    level: string;
    date: string;
    time: string;
    status: string;
    scheduledStart?: string;
  }>;
  weeklySchedule: Array<{ day: string; count: number }>;
  recentActivity: Array<{
    id: string;
    student: string;
    avatar: string | null;
    type: string;
    status: string;
    amount: number;
    date: string;
    lastSessionDate: string | null;
  }>;
  profileStatus: string;
  profileName: string;
  profileIncomplete: boolean;
  upcomingInterview: {
    date: string;
    meetingLink: string | null;
  } | null;
};

function formatCurrency(amount: number): string {
  return `₹${(amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getTimeUntil(scheduledStart?: string): string {
  if (!scheduledStart) return "";
  const diff = new Date(scheduledStart).getTime() - Date.now();
  if (diff < 0) return "Now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

export default function TeacherDashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/teachers/dashboard", { credentials: "include" });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent border-t-gold animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <span className="text-sm text-text-muted font-medium">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-danger" />
            </div>
            <h2 className="text-xl font-display font-bold text-text mb-2">Unable to load dashboard</h2>
            <p className="text-text-muted mb-6">{error || "Something went wrong."}</p>
            <Button onClick={() => window.location.reload()} variant="primary">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, upcomingClasses, weeklySchedule, recentActivity, profileStatus, profileName, profileIncomplete, upcomingInterview } = data;
  const isApproved = profileStatus === "APPROVED";
  const maxWeekly = Math.max(...weeklySchedule.map((d) => d.count), 1);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Profile Incomplete Banner ──────────────────────────────────── */}
      {profileIncomplete && isApproved && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand via-brand-hover to-[#3d32a0] p-[1px]">
          <div className="rounded-[15px] bg-gradient-to-r from-brand/95 to-brand-hover/95 p-5 flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-base">Complete your profile</h3>
              <p className="text-sm text-white/70 truncate">
                Add a bio and profile photo to attract more students and unlock all features.
              </p>
            </div>
            <Button asChild variant="gold" size="sm" className="flex-shrink-0">
              <Link href="/teacher/profile">Complete Profile</Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── Verification Banner ────────────────────────────────────────── */}
      {!isApproved && (
        <div className="rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-50 to-amber-100/50 p-5 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 text-sm">Profile under review</h3>
            <p className="text-sm text-amber-700/80">
              You can explore the dashboard, but classes are available once your profile is approved.
              Status: <strong className="text-amber-800">{profileStatus.replace(/_/g, " ")}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── Upcoming Interview ─────────────────────────────────────────── */}
      {upcomingInterview && (
        <div className="rounded-2xl border border-trust/30 bg-gradient-to-r from-trust/5 to-trust/10 p-5 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-trust/10 flex items-center justify-center flex-shrink-0">
            <CalendarCheck className="w-6 h-6 text-trust" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-text text-sm">Interview scheduled</h3>
            <p className="text-sm text-text-muted">
              {new Date(upcomingInterview.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {upcomingInterview.meetingLink && (
            <Button asChild variant="primary" size="sm" className="flex-shrink-0">
              <a href={upcomingInterview.meetingLink} target="_blank" rel="noopener noreferrer">
                <Video className="w-4 h-4 mr-1.5" /> Join
              </a>
            </Button>
          )}
        </div>
      )}

      {/* ── Welcome Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">
            {greeting}, <span className="bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">{profileName.split(" ")[0]}</span>
          </h1>
          <p className="text-text-muted mt-1.5">
            Here&apos;s what&apos;s happening with your classes today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/teacher/schedule">
              <Calendar className="w-4 h-4 mr-1.5" /> Schedule
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/teacher/profile">
              <User className="w-4 h-4 mr-1.5" /> Profile
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Earnings — Featured Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] p-[1px] col-span-2 lg:col-span-1">
          <div className="relative rounded-[15px] p-5 h-full bg-gradient-to-br from-[#1a1547] to-[#0f0c29] overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                </div>
                This Month
              </div>
              <div className="text-3xl font-bold text-white font-display">{formatCurrency(stats.monthlyEarnings)}</div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="flex items-center gap-0.5 text-xs text-emerald-400 font-medium">
                  <ArrowUpRight className="w-3 h-3" /> Active
                </span>
                <span className="text-xs text-white/40">·</span>
                <span className="text-xs text-white/50">{stats.monthlyClasses} classes completed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Classes Taught */}
        <Card className="group hover:border-brand/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/15 transition-colors">
                <BookOpen className="w-5 h-5 text-brand" />
              </div>
              <span className="text-[11px] text-text-subtle font-medium uppercase tracking-wider">Lifetime</span>
            </div>
            <div className="text-3xl font-bold text-text font-display">{stats.classesTaught}</div>
            <div className="text-xs text-text-muted mt-1">Classes taught</div>
          </CardContent>
        </Card>

        {/* Active Students */}
        <Card className="group hover:border-trust/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-trust/10 flex items-center justify-center group-hover:bg-trust/15 transition-colors">
                <Users className="w-5 h-5 text-trust" />
              </div>
              <span className="text-[11px] text-text-subtle font-medium uppercase tracking-wider">Unique</span>
            </div>
            <div className="text-3xl font-bold text-text font-display">{stats.activeStudents}</div>
            <div className="text-xs text-text-muted mt-1">Active students</div>
          </CardContent>
        </Card>

        {/* Rating */}
        <Card className="group hover:border-amber-200/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-50 transition-colors">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              </div>
              <span className="text-[11px] text-text-subtle font-medium uppercase tracking-wider">Avg</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-text font-display">
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
              </div>
              {stats.averageRating > 0 && (
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${
                        s <= Math.round(stats.averageRating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-neutral-200"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {stats.totalReviews > 0
                ? `Based on ${stats.totalReviews} review${stats.totalReviews !== 1 ? "s" : ""}`
                : "No reviews yet"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending Bookings", value: stats.pendingBookings, icon: Bell, href: "/teacher/schedule", color: stats.pendingBookings > 0 ? "text-amber-500 bg-amber-50" : "text-text-muted bg-surface-inset", iconBg: stats.pendingBookings > 0 ? "bg-amber-100" : "bg-surface-inset" },
          { label: "Today's Classes", value: upcomingClasses.length, icon: Calendar, href: "/teacher/schedule", color: "text-brand bg-brand/5", iconBg: "bg-brand/10" },
          { label: "Notifications", value: stats.unreadNotifications, icon: Bell, href: "/teacher/notifications", color: stats.unreadNotifications > 0 ? "text-danger bg-danger/5" : "text-text-muted bg-surface-inset", iconBg: stats.unreadNotifications > 0 ? "bg-danger/10" : "bg-surface-inset" },
          { label: "Manage Schedule", value: null, icon: CalendarCheck, href: "/teacher/schedule", color: "text-trust bg-trust/5", iconBg: "bg-trust/10" },
        ].map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="hover:border-brand/20 cursor-pointer transition-all duration-300 group hover:shadow-md">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${item.color.split(" ")[0]}`}>
                  <item.icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  {item.value !== null && (
                    <div className="text-xl font-bold text-text font-display">{item.value}</div>
                  )}
                  <div className="text-xs text-text-muted font-medium">{item.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Main Content Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Today's Schedule (2 cols) ──────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-text flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-brand" />
              </div>
              Today&apos;s Classes
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/teacher/schedule">
                View Schedule <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>

          {upcomingClasses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-3xl bg-surface-inset flex items-center justify-center mb-4">
                  <Calendar className="w-9 h-9 text-text-subtle" />
                </div>
                <p className="text-text-muted font-semibold mb-1">No classes today</p>
                <p className="text-sm text-text-subtle mb-4">Enjoy your free time or update your availability.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/teacher/schedule">Manage Schedule</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingClasses.map((cls) => {
                const timeUntil = getTimeUntil(cls.scheduledStart);
                return (
                  <Card
                    key={cls.id}
                    className={`overflow-hidden transition-all duration-300 ${
                      cls.status === "starts_soon"
                        ? "border-amber-300/50 shadow-md shadow-amber-100"
                        : cls.status === "ongoing"
                        ? "border-trust/30 shadow-md shadow-trust/10"
                        : ""
                    }`}
                  >
                    <CardContent className="p-0 sm:flex items-center">
                      <div className="p-5 flex-1 flex items-center gap-4">
                        <div className="relative">
                          <Avatar
                            src={cls.avatar}
                            size="lg"
                            online={cls.status === "ongoing" || cls.status === "starts_soon"}
                          />
                          {cls.status === "starts_soon" && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                              <Play className="w-2 h-2 text-white fill-white ml-0.5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-text truncate">{cls.student}</h3>
                            <Badge
                              variant={cls.type === "DEMO" ? "warning" : "default"}
                              className="text-[10px] uppercase py-0"
                            >
                              {cls.type === "DEMO" ? "Demo" : "Regular"}
                            </Badge>
                            <Badge variant="info" className="text-[10px] uppercase py-0">{cls.level}</Badge>
                          </div>
                          <div className="text-sm text-text-muted mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {cls.time}
                            </span>
                            {timeUntil && (
                              <span className={`text-xs font-medium ${
                                cls.status === "starts_soon" ? "text-amber-600" : cls.status === "ongoing" ? "text-trust" : "text-text-subtle"
                              }`}>
                                {timeUntil}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`p-5 sm:border-l border-border flex flex-col items-stretch min-w-[180px] gap-2 ${
                          cls.status === "starts_soon"
                            ? "bg-gradient-to-br from-amber-50 to-amber-100/50"
                            : cls.status === "ongoing"
                            ? "bg-gradient-to-br from-trust/5 to-trust/10"
                            : "bg-surface-inset/30"
                        }`}
                      >
                        {cls.status === "starts_soon" ? (
                          <>
                            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
                              <Sparkles className="w-3 h-3" /> Starting soon
                            </div>
                            <Button
                              asChild
                              variant="primary"
                              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-200"
                            >
                              <Link href={cls.sessionId ? `/session/${cls.id}` : "#"}>
                                <Video className="w-4 h-4 mr-1.5" /> Start Class
                              </Link>
                            </Button>
                          </>
                        ) : cls.status === "ongoing" ? (
                          <Button
                            asChild
                            variant="primary"
                            className="w-full bg-gradient-to-r from-trust to-trust-hover text-white shadow-md shadow-trust/20"
                          >
                            <Link href={cls.sessionId ? `/session/${cls.id}` : "#"}>
                              <Video className="w-4 h-4 mr-1.5" /> Rejoin
                            </Link>
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" className="w-full" disabled={!isApproved}>
                              <Video className="w-4 h-4 mr-1.5" /> Start
                            </Button>
                            <span className="text-[11px] text-text-subtle text-center">
                              Opens 10 min before
                            </span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right Sidebar ────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Weekly Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-brand" />
                </div>
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {weeklySchedule.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full relative flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-brand/30 to-brand/10 hover:from-brand/50 hover:to-brand/20 transition-all duration-300 cursor-pointer"
                        style={{ height: `${Math.max((d.count / maxWeekly) * 100, 4)}%` }}
                        title={`${d.count} classes`}
                      />
                    </div>
                    <span className="text-[10px] text-text-subtle font-medium uppercase tracking-wider">{d.day}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs text-text-muted">
                <span>This week</span>
                <span className="font-semibold text-text">
                  {weeklySchedule.reduce((a, d) => a + d.count, 0)} classes
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                </div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-surface-inset flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-6 h-6 text-text-subtle" />
                  </div>
                  <p className="text-sm text-text-muted font-medium">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-3 group">
                      <Avatar
                        src={a.avatar || undefined}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate group-hover:text-brand transition-colors">{a.student}</div>
                        <div className="text-[11px] text-text-subtle">
                          {a.type === "DEMO" ? "Demo class" : "Booked class"} · {timeAgo(a.date)}
                        </div>
                      </div>
                      <Badge
                        variant={
                          a.status === "COMPLETED"
                            ? "success"
                            : a.status === "CONFIRMED"
                            ? "default"
                            : a.status === "PENDING"
                            ? "warning"
                            : "danger"
                        }
                        className="text-[10px] py-0"
                      >
                        {a.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
