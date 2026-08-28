"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Video,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Calendar,
  Play,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

type Booking = {
  id: string;
  status: string;
  type: string;
  student: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    proficiencyLevel: string;
  };
  nextSession: {
    id: string;
    status: string;
    scheduledStart: string;
    scheduledEnd: string;
  } | null;
  totalSessions: number;
  completedSessions: number;
};

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", variant: "warning", icon: Clock },
  CONFIRMED: { label: "Confirmed", variant: "info", icon: Calendar },
  COMPLETED: { label: "Completed", variant: "success", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", variant: "danger", icon: XCircle },
};

export default function TeacherSessions() {
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/teachers/schedule", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load sessions");
        const data = await res.json();
        setUpcoming(data.upcoming || []);
        setPast(data.past || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <span className="text-sm text-text-muted">Loading sessions…</span>
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

  const allSessions = tab === "upcoming" ? upcoming : past;
  const filtered = allSessions.filter(
    (s) =>
      s.student.name.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-text">Sessions</h1>
        <p className="text-text-muted mt-1">
          {upcoming.length} upcoming · {past.length} past sessions
        </p>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-surface-inset p-1 rounded-xl">
          <button
            onClick={() => setTab("upcoming")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "upcoming"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            onClick={() => setTab("past")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "past"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Past ({past.length})
          </button>
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle" />
          <input
            type="text"
            placeholder="Search by student name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
          />
        </div>
      </div>

      {/* Sessions List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center flex flex-col items-center">
            <BookOpen className="w-12 h-12 text-text-subtle mb-4" />
            <p className="text-text-muted font-medium">
              {tab === "upcoming" ? "No upcoming sessions" : "No past sessions"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => {
            const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING;
            const session = booking.nextSession;
            const isLive = session?.status === "ONGOING";

            return (
              <Card
                key={booking.id}
                className={`overflow-hidden transition-all ${
                  isLive ? "border-trust shadow-md shadow-trust/10" : ""
                }`}
              >
                <CardContent className="p-0 sm:flex items-center">
                  <div className="p-5 flex-1 flex items-center gap-4">
                    <Avatar src={booking.student.avatarUrl || undefined} size="lg" online={isLive} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text truncate">{booking.student.name}</h3>
                        <Badge variant={statusConfig.variant as "default" | "success" | "warning" | "danger"} className="text-[10px]">
                          {statusConfig.label}
                        </Badge>
                        <Badge variant={booking.type === "DEMO" ? "warning" : "default"} className="text-[10px]">
                          {booking.type}
                        </Badge>
                      </div>
                      <div className="text-sm text-text-muted mt-1 flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {session
                            ? new Date(session.scheduledStart).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })
                            : "No session scheduled"}
                        </span>
                        {session && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(session.scheduledStart).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            –{" "}
                            {new Date(session.scheduledEnd).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 sm:border-l border-border flex flex-col items-stretch sm:min-w-[180px] gap-2 bg-surface-inset/30">
                    <div className="text-xs text-text-muted text-center mb-1">
                      {booking.completedSessions}/{booking.totalSessions} sessions
                    </div>

                    {isLive ? (
                      <Button asChild variant="primary" className="w-full bg-trust hover:bg-trust-hover text-trust-on">
                        <Link href={`/session/${booking.id}`}>
                          <Video className="w-4 h-4 mr-1.5" /> Join Now
                        </Link>
                      </Button>
                    ) : tab === "upcoming" && session ? (
                      <Button asChild variant="primary" className="w-full">
                        <Link href={`/session/${booking.id}`}>
                          <Video className="w-4 h-4 mr-1.5" /> View Session
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        {booking.status === "COMPLETED" ? "Completed" : "No Action"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
