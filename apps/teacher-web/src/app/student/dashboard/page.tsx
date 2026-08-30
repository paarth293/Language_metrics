"use client";

import React from "react";
import Link from "next/link";
import {
  Video,
  Star,
  Users,
  BookOpen,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Wallet,
  Sparkles,
  Flame,
  Target,
  Play,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

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
    streak: number;
  };
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

  const { profile, stats, upcomingClasses, recentActivity } = data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Welcome Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">
            {greeting}, <span className="bg-gradient-to-r from-brand to-brand-hover bg-clip-text text-transparent">{profile.name.split(" ")[0]}</span>
          </h1>
          <p className="text-text-muted mt-1.5">
            Ready to continue your <strong>{profile.languageToLearn}</strong> journey?
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/student/classes">
              <Calendar className="w-4 h-4 mr-1.5" /> My Classes
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/student/discover">
              <BookOpen className="w-4 h-4 mr-1.5" /> Find Teacher
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Coin Balance — Featured Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] p-[1px] col-span-2 lg:col-span-1">
          <div className="relative rounded-[15px] p-5 h-full bg-gradient-to-br from-[#1a1547] to-[#0f0c29] overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-400/15 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                </div>
                Coin Balance
              </div>
              <div className="text-3xl font-bold text-white font-display">
                🪙 {stats.coinBalance.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-white/50">1 Coin = ₹1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Classes */}
        <Card className="group hover:border-brand/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/15 transition-colors">
                <BookOpen className="w-5 h-5 text-brand" />
              </div>
              <span className="text-[11px] text-text-subtle font-medium uppercase tracking-wider">Total</span>
            </div>
            <div className="text-3xl font-bold text-text font-display">{stats.totalClasses}</div>
            <div className="text-xs text-text-muted mt-1">Classes completed</div>
          </CardContent>
        </Card>

        {/* Learning Streak */}
        <Card className="group hover:border-amber-200/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-50 transition-colors">
                <Flame className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-[11px] text-text-subtle font-medium uppercase tracking-wider">Streak</span>
            </div>
            <div className="text-3xl font-bold text-text font-display">{stats.streak}</div>
            <div className="text-xs text-text-muted mt-1">Day learning streak 🔥</div>
          </CardContent>
        </Card>

        {/* Monthly Progress */}
        <Card className="group hover:border-trust/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-trust/10 flex items-center justify-center group-hover:bg-trust/15 transition-colors">
                <Target className="w-5 h-5 text-trust" />
              </div>
              <span className="text-[11px] text-text-subtle font-medium uppercase tracking-wider">This Month</span>
            </div>
            <div className="text-3xl font-bold text-text font-display">{stats.monthlyClasses}</div>
            <div className="text-xs text-text-muted mt-1">Classes this month</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Content Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Upcoming Classes (2 cols) ──────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-text flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-brand" />
              </div>
              Upcoming Classes
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/student/classes">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>

          {upcomingClasses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-3xl bg-surface-inset flex items-center justify-center mb-4">
                  <Calendar className="w-9 h-9 text-text-subtle" />
                </div>
                <p className="text-text-muted font-semibold mb-1">No upcoming classes</p>
                <p className="text-sm text-text-subtle mb-4">Book a class to start your learning journey.</p>
                <Button asChild variant="primary" size="sm">
                  <Link href="/student/discover">Find a Teacher</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingClasses.map((cls) => {
                const timeUntil = getTimeUntil(cls.scheduledStart);
                return (
                  <Card key={cls.id} className="overflow-hidden transition-all duration-300">
                    <CardContent className="p-0 sm:flex items-center">
                      <div className="p-5 flex-1 flex items-center gap-4">
                        <div className="relative">
                          <Avatar src={cls.avatar || undefined} size="lg" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-text truncate">{cls.teacher}</h3>
                            <Badge variant={cls.type === "DEMO" ? "warning" : "default"} className="text-[10px] uppercase py-0">
                              {cls.type === "DEMO" ? "Demo" : "Regular"}
                            </Badge>
                            <Badge variant="info" className="text-[10px] uppercase py-0">{cls.language}</Badge>
                          </div>
                          <div className="text-sm text-text-muted mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {cls.scheduledStart
                                ? new Date(cls.scheduledStart).toLocaleString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "TBD"}
                            </span>
                            {timeUntil && (
                              <span className="text-xs font-medium text-brand">{timeUntil}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-5 sm:border-l border-border flex flex-col items-stretch min-w-[160px] gap-2 bg-surface-inset/30">
                        <Button asChild variant="primary" className="w-full">
                          <Link href={`/live/${cls.sessionId || cls.id}`}>
                            <Video className="w-4 h-4 mr-1.5" /> Join Class
                          </Link>
                        </Button>
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
          {/* Learning Progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-brand" />
                </div>
                Learning Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-muted">Total Hours</span>
                    <span className="font-semibold text-text">{stats.totalHours}h</span>
                  </div>
                  <div className="h-2 bg-surface-inset rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand to-brand-hover rounded-full" style={{ width: `${Math.min(stats.totalHours * 10, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-muted">Unique Teachers</span>
                    <span className="font-semibold text-text">{stats.uniqueTeachers}</span>
                  </div>
                  <div className="h-2 bg-surface-inset rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-trust to-trust-hover rounded-full" style={{ width: `${Math.min(stats.uniqueTeachers * 20, 100)}%` }} />
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <div className="text-xs text-text-muted mb-2">Learning Level</div>
                  <Badge variant="info" className="text-sm">{profile.proficiencyLevel}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-2xl bg-surface-inset flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-text-subtle" />
                  </div>
                  <p className="text-sm text-text-muted font-medium">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-3 group">
                      <Avatar src={a.avatar || undefined} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate group-hover:text-brand transition-colors">
                          {a.teacher}
                        </div>
                        <div className="text-[11px] text-text-subtle">
                          {a.type === "DEMO" ? "Demo" : "Booked"} · {a.language} · {timeAgo(a.date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Link href="/student/discover" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-inset transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center group-hover:bg-brand/15 transition-colors">
                  <BookOpen className="w-4 h-4 text-brand" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text">Find a Teacher</div>
                  <div className="text-[11px] text-text-subtle">Browse available teachers</div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-subtle" />
              </Link>
              <Link href="/student/wallet" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-inset transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-50 transition-colors">
                  <Wallet className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text">Top up Coins</div>
                  <div className="text-[11px] text-text-subtle">Add coins to your wallet</div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-subtle" />
              </Link>
              <Link href="/student/profile" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-inset transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-trust/10 flex items-center justify-center group-hover:bg-trust/15 transition-colors">
                  <Users className="w-4 h-4 text-trust" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text">Edit Profile</div>
                  <div className="text-[11px] text-text-subtle">Update your preferences</div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-subtle" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

