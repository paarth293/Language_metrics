"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  avatar: string;
  level: string;
  totalClasses: number;
  completedClasses: number;
  upcomingClasses: number;
  totalSpent: number;
  lastClassDate: string | null;
  rating: number | null;
};

const PILL_COLORS = ["#0f9d6b","#231d5e","#c7982f","#5046c8","#dc4c3e","#3d32a0"];
function getInitials(n: string) { return n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(); }

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default function TeacherStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
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
          <Card className="border border-border/50 hover:border-brand/30 transition-colors shadow-sm bg-brand/5">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center mb-2">
                <Users className="w-4 h-4 text-brand" />
              </div>
              <div className="text-[24px] font-display font-bold text-brand leading-none mb-1">
                {students.length}
              </div>
              <div className="text-[11px] font-semibold text-brand-subtle uppercase tracking-wider">
                Total Students
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 hover:border-trust/30 transition-colors shadow-sm bg-trust/5">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-trust/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-4 h-4 text-trust" />
              </div>
              <div className="text-[24px] font-display font-bold text-trust leading-none mb-1">
                {students.reduce((a, s) => a + s.completedClasses, 0)}
              </div>
              <div className="text-[11px] font-semibold text-trust/80 uppercase tracking-wider">
                Classes Done
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 hover:border-action/30 transition-colors shadow-sm bg-action/5">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-action/10 flex items-center justify-center mb-2">
                <Star className="w-4 h-4 text-action" />
              </div>
              <div className="text-[24px] font-display font-bold text-action-on leading-none mb-1">
                {students.filter((s) => s.rating && s.rating >= 4).length}
              </div>
              <div className="text-[11px] font-semibold text-action-on/80 uppercase tracking-wider">
                High Ratings
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 hover:border-danger/30 transition-colors shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-surface-inset flex items-center justify-center mb-2">
                <TrendingUp className="w-4 h-4 text-text-subtle" />
              </div>
              <div className="text-[24px] font-display font-bold text-text leading-none mb-1">
                ₹{Math.round(students.reduce((a, s) => a + s.totalSpent, 0) / 100).toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Total Earned
              </div>
            </CardContent>
          </Card>
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
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
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
          <div className="text-center py-20 bg-surface rounded-2xl border" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
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
            {filtered.map((student, idx) => {
              const initials = getInitials(student.name);
              
              return (
                <Card key={student.id} className="overflow-hidden flex flex-col border border-border/50 hover:shadow-level-2 hover:border-brand/30 transition-all duration-300">
                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Header: Student Info */}
                    <div className="p-5 flex items-start gap-4 border-b border-border/40">
                      {student.avatar ? (
                        <Avatar src={student.avatar} size="lg" className="shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[14px] font-bold shadow-sm" style={{ background: PILL_COLORS[idx % PILL_COLORS.length] }}>
                          {initials}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0 pt-0.5">
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
                      <div className="bg-action/5 border border-action/20 rounded-xl p-3 text-center flex flex-col justify-center">
                        <div className="text-[18px] font-bold text-action-on flex items-center justify-center gap-1 leading-tight">
                          <Star className="w-3.5 h-3.5 text-action fill-action" />
                          {student.rating ? student.rating.toFixed(1) : "—"}
                        </div>
                        <div className="text-[10px] font-semibold text-action-on/70 uppercase tracking-wider mt-1">Rating</div>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-auto p-4 bg-surface-inset/30 flex items-center justify-between text-[12px] font-medium border-t border-border/40">
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <Calendar className="w-3.5 h-3.5 opacity-70" />
                        <span className={student.lastClassDate ? "" : "italic opacity-70"}>
                          Last class: {timeAgo(student.lastClassDate)}
                        </span>
                      </div>
                      <div className="text-brand font-bold bg-brand/10 px-2.5 py-1 rounded-md">
                        ₹{Math.round(student.totalSpent / 100).toLocaleString("en-IN")}
                      </div>
                    </div>
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
