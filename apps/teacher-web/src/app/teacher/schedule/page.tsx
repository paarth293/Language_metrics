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
          <span className="text-sm text-text-muted font-medium">Loading schedule…</span>
        </div>
      </div>
    );
  }

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const isCurrentWeek = weekOffset === 0;
  const weekClasses = weekDates.reduce((acc, d) => acc + getSessionsForDay(d).length, 0);

  return (
    <div className="space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            Schedule
          </h1>
          <p className="text-base text-text-muted mt-1">
            <span className="font-semibold text-brand">{weekClasses} class{weekClasses !== 1 ? "es" : ""}</span> this week · Manage your availability
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={showSettings ? "primary" : "outline"} className="shadow-sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4 mr-1.5" /> Manage Availability
          </Button>
        </div>
      </div>

      {/* ── SUCCESS MESSAGE ──────────────────────────── */}
      {successMsg && (
        <div className="px-4 py-3 rounded-xl bg-trust/10 text-trust flex items-center gap-2 text-[14px] font-semibold border border-trust/20 shadow-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5" /> {successMsg}
        </div>
      )}

      {/* ── AVAILABILITY SETTINGS ────────────────────── */}
      {showSettings && (
        <Card className="border border-brand/20 shadow-level-2 animate-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-4 border-b" style={{ borderColor: "rgba(35,29,94,0.06)" }}>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[18px] font-display font-bold text-text">Availability Settings</CardTitle>
                <p className="text-[13px] text-text-muted mt-1">Set your regular weekly working hours</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setTempAvailability(availability); setShowSettings(false); }}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={saveAvailability} isLoading={saving} className="shadow-sm">
                  Save Changes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {DAY_NAMES.map((dayName, dayIndex) => {
                const daySlots = getAvailabilityForDay(dayIndex);
                const hasSlots = daySlots.length > 0;
                return (
                  <div key={dayIndex} className="bg-surface-inset/30 border rounded-xl p-4 transition-colors hover:border-brand/30" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[14px] font-bold text-text">{dayName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addSlot(dayIndex)}
                        className="text-brand hover:text-brand hover:bg-brand/10 h-7 px-2 text-[12px]"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Slot
                      </Button>
                    </div>
                    
                    {!hasSlots ? (
                      <div className="text-[12px] text-text-subtle font-medium bg-surface-inset py-2 px-3 rounded-lg text-center border border-dashed border-border">
                        Unavailable
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {daySlots.map((slot, slotIdx) => (
                          <div key={slotIdx} className="flex items-center gap-1.5 group">
                            <Input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => updateSlot(dayIndex, slotIdx, "startTime", e.target.value)}
                              className="w-full h-8 text-[12px] px-2 text-center bg-surface border-border focus:border-brand"
                            />
                            <span className="text-[11px] text-text-muted font-medium px-1">to</span>
                            <Input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => updateSlot(dayIndex, slotIdx, "endTime", e.target.value)}
                              className="w-full h-8 text-[12px] px-2 text-center bg-surface border-border focus:border-brand"
                            />
                            <button
                              onClick={() => removeSlot(dayIndex, slotIdx)}
                              className="p-1.5 text-text-subtle hover:text-alert hover:bg-alert/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove slot"
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

      {/* ── CALENDAR NAV ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-surface border rounded-2xl p-2 px-4 shadow-sm" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-brand/10 hover:text-brand" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-[14px] font-bold text-text w-[160px] text-center">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-brand/10 hover:text-brand" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" className="ml-2 h-8 text-[12px] rounded-full" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
          )}
        </div>
        <div className="text-[12px] font-medium text-text-muted mt-2 sm:mt-0 flex items-center gap-1.5 bg-surface-inset px-3 py-1.5 rounded-full">
          <Clock className="w-3.5 h-3.5 text-text-subtle" /> Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </div>

      {/* ── CALENDAR GRID ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((date, dayIdx) => {
          const sessions = getSessionsForDay(date);
          const avail = getAvailabilityForDay(date.getDay());
          const isToday = isSameDay(date, today);
          const isPast = date < today && !isToday;

          return (
            <div key={dayIdx} className={`flex flex-col rounded-2xl overflow-hidden border shadow-sm transition-all duration-200 ${isPast ? "opacity-60 hover:opacity-100" : ""} ${isToday ? "ring-2 ring-brand ring-offset-2 border-transparent" : "border-border"}`} style={!isToday ? { borderColor: "rgba(35,29,94,0.08)" } : {}}>
              
              {/* Day Header */}
              <div
                className="text-center p-3 border-b"
                style={{
                  background: isToday ? "linear-gradient(135deg, #231d5e, #5046c8)" : "#f8f9fa",
                  borderColor: isToday ? "transparent" : "rgba(35,29,94,0.06)"
                }}
              >
                <div className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? "text-brand-subtle" : "text-text-muted"}`}>
                  {DAY_SHORT[date.getDay()]}
                </div>
                <div className={`text-[24px] font-display font-bold leading-none mt-1 ${isToday ? "text-white" : "text-text"}`}>
                  {date.getDate()}
                </div>
                
                {/* Availability Bar */}
                <div className="flex justify-center gap-1 mt-2 h-1.5">
                  {avail.length > 0 ? avail.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-full flex-1 max-w-[20px]"
                      style={{ background: isToday ? "rgba(255,255,255,0.4)" : "rgba(15,157,107,0.3)" }}
                      title={`${s.startTime} – ${s.endTime}`}
                    />
                  )) : (
                    <div className="rounded-full w-4" style={{ background: isToday ? "rgba(255,255,255,0.1)" : "rgba(35,29,94,0.06)" }} />
                  )}
                </div>
              </div>

              {/* Sessions List */}
              <div className={`flex-1 p-2 space-y-2 min-h-[160px] ${isToday ? "bg-brand/5" : "bg-surface"}`}>
                {sessions.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-4">
                    <span className="text-[12px] font-medium text-text-subtle text-center">
                      {avail.length > 0 ? "No classes scheduled" : "Unavailable"}
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
                    const isStartingSoon = diffMin >= 0 && diffMin <= 15;

                    return (
                      <div
                        key={booking.id}
                        className={`rounded-xl p-3 border shadow-sm transition-all relative overflow-hidden group ${
                          isOngoing
                            ? "bg-trust/10 border-trust/30"
                            : isStartingSoon
                            ? "bg-action/10 border-action/30"
                            : "bg-surface border-border hover:border-brand/30"
                        }`}
                      >
                        {(isOngoing || isStartingSoon) && (
                          <div className={`absolute top-0 left-0 w-1 h-full ${isOngoing ? "bg-trust" : "bg-action"}`} />
                        )}
                        
                        <div className="font-bold text-[13px] text-text truncate mb-1 pr-4">
                          {booking.student.name}
                        </div>
                        <div className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                          <Badge variant={isOngoing ? "success" : isStartingSoon ? "warning" : "info"} className="text-[9px] py-0 px-1.5 uppercase font-bold tracking-wider">
                            {isOngoing ? "Live" : isStartingSoon ? "Soon" : booking.student.proficiencyLevel}
                          </Badge>
                          
                          {(isOngoing || isStartingSoon) && (
                            <Button asChild variant="primary" size="icon" className="h-6 w-6 rounded-md shadow-sm">
                              <Link href={`/session/${booking.id}`}>
                                <Video className="w-3 h-3" />
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

      {/* ── UPCOMING BOOKINGS LIST ───────────────────── */}
      {bookings.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-brand" />
            </div>
            <h2 className="text-[18px] font-display font-bold text-text">
              Upcoming Bookings
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookings.slice(0, 6).map((b) => (
              <Card key={b.id} className="overflow-hidden hover:shadow-level-2 transition-shadow duration-180 border" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar src={b.student.avatarUrl || undefined} size="md" className="shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] text-text truncate mb-0.5">{b.student.name}</div>
                    <div className="text-[12px] font-medium text-brand truncate flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 opacity-70" />
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
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant={b.status === "COMPLETED" ? "success" : "default"} className="text-[9px] uppercase tracking-wider py-0 px-2">
                      {b.status}
                    </Badge>
                    <span className="text-[11px] font-medium text-text-muted bg-surface-inset px-2 py-0.5 rounded-md">
                      {b.completedSessions}/{b.totalSessions}
                    </span>
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
