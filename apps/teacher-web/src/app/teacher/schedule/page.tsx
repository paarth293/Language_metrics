"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  Loader2,
  AlertCircle,
  Trash2,
  CheckCircle2,
  CalendarDays,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type Booking = {
  id: string;
  status: string;
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

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + offset * 7);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDate(d: Date): string {
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function TeacherSchedule() {
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempAvailability, setTempAvailability] = useState<AvailabilitySlot[]>([]);

  const weekDates = getWeekDates(weekOffset);
  const today = new Date();

  const fetchData = useCallback(async () => {
    try {
      const [scheduleRes, settingsRes] = await Promise.all([
        fetch("/api/teachers/schedule", { credentials: "include" }),
        fetch("/api/teachers/settings", { credentials: "include" }),
      ]);

      if (scheduleRes.ok) {
        const data = await scheduleRes.json();
        setBookings(data.upcoming || []);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const avail = data.profile?.availability || [];
        setAvailability(avail);
        setTempAvailability(avail);
      }
    } catch (err) {
      console.error("Error fetching schedule data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Get sessions for a specific day
  const getSessionsForDay = (date: Date) => {
    return bookings
      .filter((b) => {
        if (!b.nextSession) return false;
        const sessionDate = new Date(b.nextSession.scheduledStart);
        return isSameDay(sessionDate, date);
      })
      .sort((a, b) => {
        const aTime = new Date(a.nextSession!.scheduledStart).getTime();
        const bTime = new Date(b.nextSession!.scheduledStart).getTime();
        return aTime - bTime;
      });
  };

  // Check availability for a day
  const getAvailabilityForDay = (dayOfWeek: number) => {
    return tempAvailability.filter((s) => s.dayOfWeek === dayOfWeek);
  };

  const addSlot = (day: number) => {
    setTempAvailability([...tempAvailability, { dayOfWeek: day, startTime: "09:00", endTime: "17:00" }]);
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: "startTime" | "endTime", value: string) => {
    const daySlots = tempAvailability.filter((s) => s.dayOfWeek === dayIndex);
    const globalIdx = tempAvailability.indexOf(daySlots[slotIndex]);
    if (globalIdx === -1) return;
    const updated = [...tempAvailability];
    updated[globalIdx] = { ...updated[globalIdx], [field]: value };
    setTempAvailability(updated);
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    const daySlots = tempAvailability.filter((s) => s.dayOfWeek === dayIndex);
    const globalIdx = tempAvailability.indexOf(daySlots[slotIndex]);
    if (globalIdx === -1) return;
    const updated = [...tempAvailability];
    updated.splice(globalIdx, 1);
    setTempAvailability(updated);
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/teachers/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ availability: tempAvailability }),
      });
      if (res.ok) {
        setAvailability(tempAvailability);
        setSuccessMsg("Availability saved!");
        setTimeout(() => setSuccessMsg(null), 3000);
        setShowSettings(false);
      }
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <span className="text-sm text-text-muted">Loading schedule…</span>
        </div>
      </div>
    );
  }

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const isCurrentWeek = weekOffset === 0;
  const weekClasses = weekDates.reduce((acc, d) => acc + getSessionsForDay(d).length, 0);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">Schedule</h1>
          <p className="text-text-muted mt-1">
            {weekClasses} class{weekClasses !== 1 ? "es" : ""} this week · Manage your availability
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4 mr-1.5" /> Availability
          </Button>
        </div>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="p-3 rounded-xl bg-trust/10 text-trust flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Availability Settings Panel */}
      {showSettings && (
        <Card className="border-brand/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Manage Availability</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setTempAvailability(availability); setShowSettings(false); }}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={saveAvailability} isLoading={saving}>
                  Save Changes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DAY_NAMES.map((dayName, dayIndex) => {
                const daySlots = getAvailabilityForDay(dayIndex);
                return (
                  <div key={dayIndex} className="border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text w-28">{dayName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addSlot(dayIndex)}
                        className="text-brand hover:text-brand hover:bg-brand/10 h-8"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-text-subtle italic ml-28">Unavailable</p>
                    ) : (
                      <div className="space-y-2 ml-28">
                        {daySlots.map((slot, slotIdx) => (
                          <div key={slotIdx} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateSlot(dayIndex, slotIdx, "startTime", e.target.value)}
                              className="w-28 h-8 text-sm"
                            />
                            <span className="text-xs text-text-muted">to</span>
                            <Input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateSlot(dayIndex, slotIdx, "endTime", e.target.value)}
                              className="w-28 h-8 text-sm"
                            />
                            <button
                              onClick={() => removeSlot(dayIndex, slotIdx)}
                              className="p-1.5 text-text-subtle hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="w-9 h-9" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold text-text">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </div>
          <Button variant="outline" size="icon" className="w-9 h-9" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
          )}
        </div>
        <div className="text-xs text-text-muted">
          Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((date, dayIdx) => {
          const sessions = getSessionsForDay(date);
          const avail = getAvailabilityForDay(date.getDay());
          const isToday = isSameDay(date, today);
          const isPast = date < today && !isToday;

          return (
            <div key={dayIdx} className={`flex flex-col ${isPast ? "opacity-50" : ""}`}>
              {/* Day Header */}
              <div
                className={`text-center p-3 rounded-t-xl border border-b-0 ${
                  isToday
                    ? "bg-brand text-white border-brand"
                    : "bg-surface-inset border-border"
                }`}
              >
                <div className={`text-xs font-medium uppercase ${isToday ? "text-white/80" : "text-text-muted"}`}>
                  {DAY_SHORT[date.getDay()]}
                </div>
                <div className={`text-lg font-bold ${isToday ? "text-white" : "text-text"}`}>
                  {date.getDate()}
                </div>
                {/* Availability indicator */}
                {avail.length > 0 && (
                  <div className="flex justify-center gap-0.5 mt-1">
                    {avail.map((s, i) => (
                      <div
                        key={i}
                        className={`h-1 rounded-full ${
                          isToday ? "bg-white/50" : "bg-trust/40"
                        }`}
                        style={{ width: "12px" }}
                        title={`${s.startTime} – ${s.endTime}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div className={`flex-1 border border-border rounded-b-xl p-2 space-y-2 min-h-[140px] ${
                isToday ? "border-brand/30 bg-brand/5" : "bg-surface"
              }`}>
                {sessions.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[10px] text-text-subtle">
                      {avail.length > 0 ? "Available" : "No classes"}
                    </span>
                  </div>
                ) : (
                  sessions.map((booking) => {
                    const session = booking.nextSession!;
                    const startTime = new Date(session.scheduledStart);
                    const endTime = new Date(session.scheduledEnd);
                    const isOngoing = session.status === "ONGOING";
                    const startMs = startTime.getTime();
                    const diffMin = (startMs - Date.now()) / 60000;
                    const isStartingSoon = diffMin >= 0 && diffMin <= 10;

                    return (
                      <div
                        key={booking.id}
                        className={`rounded-lg p-2 border text-xs ${
                          isOngoing
                            ? "bg-trust/10 border-trust/20"
                            : isStartingSoon
                            ? "bg-warning/10 border-warning/20 animate-pulse"
                            : "bg-brand/5 border-brand/10"
                        }`}
                      >
                        <div className="font-medium text-text truncate">
                          {booking.student.name}
                        </div>
                        <div className="text-text-muted mt-0.5">
                          {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                          {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {isOngoing ? (
                            <Badge variant="success" className="text-[9px] py-0">Live</Badge>
                          ) : isStartingSoon ? (
                            <Badge variant="warning" className="text-[9px] py-0">Soon</Badge>
                          ) : (
                            <Badge variant="default" className="text-[9px] py-0">{booking.student.proficiencyLevel}</Badge>
                          )}
                          {(isOngoing || isStartingSoon) && (
                            <Button asChild variant="primary" size="sm" className="h-5 text-[9px] px-2 ml-auto">
                              <Link href={`/session/${booking.id}`}>
                                <Video className="w-2.5 h-2.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming List */}
      {bookings.length > 0 && (
        <div>
          <h2 className="text-lg font-display font-semibold text-text mb-3 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand" /> Upcoming Bookings
          </h2>
          <div className="space-y-2">
            {bookings.slice(0, 5).map((b) => (
              <Card key={b.id} className="overflow-hidden">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar src={b.student.avatarUrl || undefined} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-text truncate">{b.student.name}</div>
                    <div className="text-sm text-text-muted">
                      {b.nextSession
                        ? `${new Date(b.nextSession.scheduledStart).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })} at ${new Date(b.nextSession.scheduledStart).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "Schedule TBD"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>{b.completedSessions}/{b.totalSessions} sessions</span>
                    <Badge variant={b.status === "COMPLETED" ? "success" : "default"} className="text-[10px]">
                      {b.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
