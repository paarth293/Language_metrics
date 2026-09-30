"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Search,
  Star,
  Calendar,
  AlertCircle,
  Filter,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

type Student = {
  id: string;
  name: string;
  avatar: string | null;
  level: string;
  totalClasses: number;
  completedClasses: number;
  upcomingClasses: number;
  totalSpent: number;
  lastClassDate: string | null;
  nextClassDate: string | null;
  rating: number | null;
  reviewComment: string | null;
};

function getInitials(n: string) { return n.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0,2).toUpperCase(); }

function timeAgo(dateStr: string): string {
  // Calendar days, so a class at 11 PM yesterday reads "yesterday" just after midnight.
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(dateStr))) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function formatNextClass(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `today, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

function StatTile({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-level-1 sm:p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-text-muted">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-3 font-display text-[26px] font-bold leading-none tracking-[-0.01em] text-text">{value}</div>
    </div>
  );
}

export default function TeacherStudentsPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender.
  return (
    <Suspense>
      <TeacherStudents />
    </Suspense>
  );
}

function TeacherStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ?q= pre-fills the search (the header's quick search links here), and
  // a new ?q= while already on the page replaces it.
  const urlQuery = useSearchParams().get("q") ?? "";
  const [search, setSearch] = useState(urlQuery);
  const [appliedQuery, setAppliedQuery] = useState(urlQuery);
  if (urlQuery !== appliedQuery) {
    setAppliedQuery(urlQuery);
    setSearch(urlQuery);
  }
  const [levelFilter, setLevelFilter] = useState<string>("ALL");

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch("/api/teachers/students", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load students");
        const data = await res.json();
        setStudents(data.students || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchesLevel = levelFilter === "ALL" || s.level === levelFilter;
      return matchesSearch && matchesLevel;
    });
  }, [students, search, levelFilter]);

  const levels = useMemo(() => {
    const set = new Set(students.map((s) => s.level));
    return Array.from(set).sort();
  }, [students]);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="lm-page-title">
            My Students
          </h1>
          <p className="text-base text-text-muted mt-1">
            <span className="font-semibold text-brand">{students.length}</span> active student{students.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── SUMMARY STATS ──────────────────────────── */}
      {students.length > 0 && !loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile icon={Users} label="Students" value={String(students.length)} tone="bg-brand/10 text-brand" />
          <StatTile
            icon={CheckCircle2}
            label="Classes completed"
            value={String(students.reduce((a, s) => a + s.completedClasses, 0))}
            tone="bg-trust/10 text-trust"
          />
          <StatTile
            icon={Star}
            label="4★ and above"
            value={String(students.filter((s) => s.rating && s.rating >= 4).length)}
            tone="bg-action/15 text-gold-strong"
          />
          <StatTile
            icon={TrendingUp}
            label="Total earned"
            value={`₹${Math.round(students.reduce((a, s) => a + s.totalSpent, 0) / 100).toLocaleString("en-IN")}`}
            tone="bg-brand/10 text-brand"
          />
        </div>
      )}

      {/* ── SEARCH & FILTER ────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 shadow-sm rounded-xl overflow-hidden border border-border/60 bg-surface">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand opacity-60" />
          <input
            type="text"
            placeholder="Search students by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 border-none bg-transparent pl-11 pr-4 text-[14px] text-text placeholder:text-text-subtle focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
          <button
            onClick={() => setLevelFilter("ALL")}
            className={`px-4 h-12 rounded-xl text-[13px] font-bold tracking-wide uppercase whitespace-nowrap transition-all border shadow-sm ${
              levelFilter === "ALL"
                ? "bg-brand text-white border-brand"
                : "bg-surface border-border/60 text-text-muted hover:border-brand/40"
            }`}
          >
            All
          </button>
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`px-4 h-12 rounded-xl text-[13px] font-bold tracking-wide uppercase whitespace-nowrap transition-all border shadow-sm ${
                levelFilter === l
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border/60 text-text-muted hover:border-brand/40"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── STUDENTS LIST ──────────────────────────── */}
      <div className="flex-1">
        {loading ? (
          <div className="py-8">
            <DashboardSkeleton />
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-surface rounded-2xl border border-border">
            <AlertCircle className="w-12 h-12 text-alert mx-auto mb-4" />
            <p className="text-text font-semibold mb-1">Failed to load students</p>
            <p className="text-text-muted text-[13px]">{error}</p>
            <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border border-border/50 shadow-sm">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mb-4 border border-border/40">
                <Users className="w-8 h-8 text-brand opacity-60" />
              </div>
              <h3 className="text-[18px] font-bold text-text mb-2">
                {students.length === 0 ? "No students yet" : "No matches found"}
              </h3>
              <p className="text-[14px] text-text-muted max-w-[280px] mb-6">
                {students.length === 0 
                  ? "When students book classes with you, they will appear here." 
                  : "Try adjusting your search terms or filters to see more results."}
              </p>
              {students.length > 0 && (
                <Button variant="outline" className="shadow-sm" onClick={() => { setSearch(""); setLevelFilter("ALL"); }}>
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((student) => {
              const initials = getInitials(student.name);

              return (
                <Card key={student.id} className="overflow-hidden flex flex-col border border-border/50 hover:shadow-level-2 hover:border-brand/30 transition-all duration-300">
                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Header: Student Info */}
                    <div className="p-5 flex items-center gap-4 border-b border-border/40">
                      <Avatar
                        src={student.avatar || undefined}
                        alt={student.name}
                        initials={initials}
                        size="lg"
                        className="shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <h3 className="text-[16px] font-bold text-text truncate font-display mb-1">
                          {student.name}
                        </h3>
                        <Badge variant="default" className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2 bg-brand/10 text-brand border-none">
                          {student.level}
                        </Badge>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="p-5 grid grid-cols-3 gap-2">
                      <div className="bg-surface border border-border/50 rounded-xl p-3 text-center flex flex-col justify-center">
                        <div className="text-[18px] font-bold text-text leading-tight">{student.completedClasses}</div>
                        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-1">Completed</div>
                      </div>
                      <div className="bg-surface border border-border/50 rounded-xl p-3 text-center flex flex-col justify-center">
                        <div className="text-[18px] font-bold text-text leading-tight">{student.upcomingClasses}</div>
                        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-1">Upcoming</div>
                      </div>
                      <div className="bg-surface border border-border/50 rounded-xl p-3 text-center flex flex-col justify-center">
                        <div className={`text-[18px] font-bold flex items-center justify-center gap-1 leading-tight ${student.rating ? "text-text" : "text-text-subtle"}`}>
                          <Star className={`w-3.5 h-3.5 ${student.rating ? "text-action fill-action" : "text-text-subtle"}`} />
                          {student.rating ? student.rating.toFixed(1) : "–"}
                        </div>
                        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-1">Rating</div>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-auto p-4 bg-surface-inset/30 flex items-center justify-between gap-3 text-[12px] font-medium border-t border-border/40">
                      <div className="flex min-w-0 items-center gap-1.5 text-text-muted">
                        <Calendar className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">
                          {student.nextClassDate
                            ? `Next class ${formatNextClass(student.nextClassDate)}`
                            : student.lastClassDate
                              ? `Last class ${timeAgo(student.lastClassDate)}`
                              : "No classes yet"}
                        </span>
                      </div>
                      <div className="text-brand font-bold bg-brand/10 px-2.5 py-1 rounded-md">
                        ₹{Math.round(student.totalSpent / 100).toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Review Section */}
                    {student.reviewComment && (
                      <div className="p-4 bg-action/5 border-t border-border/40 text-[13px] text-text-muted italic flex gap-2">
                        <span className="text-gold-strong font-serif text-lg leading-none" aria-hidden>&ldquo;</span>
                        <span className="leading-snug">{student.reviewComment}</span>
                        <span className="text-gold-strong font-serif text-lg leading-none mt-auto" aria-hidden>&rdquo;</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
