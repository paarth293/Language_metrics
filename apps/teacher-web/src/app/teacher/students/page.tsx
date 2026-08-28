"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Star,
  BookOpen,
  Calendar,
  AlertCircle,
  Loader2,
  Filter,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

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
        setStudents(data.students);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <span className="text-sm text-text-muted">Loading students…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <p className="text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">My Students</h1>
          <p className="text-text-muted mt-1">
            {students.length} student{students.length !== 1 ? "s" : ""} across all bookings
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
          <input
            type="text"
            placeholder="Search students by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setLevelFilter("ALL")}
            className={`px-3 h-10 rounded-xl text-sm font-medium border transition-all ${
              levelFilter === "ALL"
                ? "bg-brand text-white border-brand"
                : "bg-surface border-border text-text-muted hover:border-brand/30"
            }`}
          >
            All Levels
          </button>
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={`px-3 h-10 rounded-xl text-sm font-medium border transition-all ${
                levelFilter === l
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-text-muted hover:border-brand/30"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center flex flex-col items-center">
            <Users className="w-12 h-12 text-text-subtle mb-4" />
            <p className="text-text-muted font-medium">
              {students.length === 0
                ? "No students yet"
                : "No students match your search"}
            </p>
            {students.length > 0 && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(""); setLevelFilter("ALL"); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((student) => (
            <Card key={student.id} className="group hover:border-brand/30 transition-all cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar src={student.avatar} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text truncate">{student.name}</h3>
                    </div>
                    <Badge variant="info" className="text-[10px] mt-1">{student.level}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <div className="text-lg font-bold text-text">{student.completedClasses}</div>
                    <div className="text-[10px] text-text-subtle uppercase tracking-wide">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-text">{student.upcomingClasses}</div>
                    <div className="text-[10px] text-text-subtle uppercase tracking-wide">Upcoming</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-brand">
                      {student.rating ? `★ ${student.rating}` : "—"}
                    </div>
                    <div className="text-[10px] text-text-subtle uppercase tracking-wide">Rating</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Last class: {timeAgo(student.lastClassDate)}
                  </span>
                  <span>₹{Math.round(student.totalSpent / 100).toLocaleString("en-IN")} earned</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {students.length > 0 && (
        <Card className="bg-surface-inset/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-text">{students.length}</div>
                <div className="text-xs text-text-muted">Total Students</div>
              </div>
              <div>
                <div className="text-xl font-bold text-text">
                  {students.reduce((a, s) => a + s.completedClasses, 0)}
                </div>
                <div className="text-xs text-text-muted">Classes Completed</div>
              </div>
              <div>
                <div className="text-xl font-bold text-text">
                  ₹{Math.round(students.reduce((a, s) => a + s.totalSpent, 0) / 100).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-text-muted">Total Earned</div>
              </div>
              <div>
                <div className="text-xl font-bold text-text">
                  {students.filter((s) => s.rating && s.rating >= 4).length}
                </div>
                <div className="text-xs text-text-muted">5★ Students</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
