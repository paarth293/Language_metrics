"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Video,
  CalendarX2,
  RefreshCcw,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

type Booking = {
  id: string;
  teacher: string;
  avatar: string | null;
  language: string;
  type: string;
  status: string;
  totalSessions: number;
  completedSessions: number;
  nextSession: {
    id: string;
    scheduledStart: string;
    scheduledEnd: string;
    status: string;
  } | null;
  review: { rating: number; comment: string | null } | null;
  amountPaid: number;
  scheduledStart: string;
  createdAt: string;
};

const PILL_COLORS = ["#231d5e","#0f6b58","#c7982f","#dc4c3e","#3d32a0","#0f9d6b"];
function getInitials(n: string) { return n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(); }

export default function MyClassesPage() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/students/classes?filter=${activeTab}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load classes");
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/students/classes/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel booking");
      }
      setShowCancelModal(null);
      fetchBookings(); // Refresh list
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  };

  const canJoin = (sessionStart: string) => {
    const now = new Date();
    const start = new Date(sessionStart);
    const fiveMinBefore = new Date(start.getTime() - 5 * 60 * 1000);
    return now >= fiveMinBefore;
  };

  const canCancel = (scheduledStart: string) => {
    const now = new Date();
    const start = new Date(scheduledStart);
    const twelveHoursBefore = new Date(start.getTime() - 12 * 60 * 60 * 1000);
    return now < twelveHoursBefore;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "STARTS_SOON": return "warning";
      case "ONGOING": return "success";
      case "CONFIRMED": return "info";
      case "COMPLETED": return "success";
      case "CANCELLED": return "danger";
      default: return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "STARTS_SOON": return "Starting Soon";
      case "ONGOING": return "Live Now";
      case "CONFIRMED": return "Confirmed";
      case "COMPLETED": return "Completed";
      case "CANCELLED": return "Cancelled";
      case "PENDING": return "Pending";
      default: return status;
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 h-full flex flex-col">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            My Classes
          </h1>
          <p className="text-base text-text-muted mt-1">
            Manage your bookings and join live sessions
          </p>
        </div>
        <Button asChild variant="primary" className="shadow-sm">
          <Link href="/student/discover">
            Book a new class <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
        </Button>
      </div>

      {/* ── TABS ───────────────────────────────────── */}
      <div className="flex overflow-x-auto no-scrollbar border-b" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
        {["upcoming", "past", "cancelled"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3.5 font-semibold text-[14px] transition-all relative whitespace-nowrap ${
              activeTab === tab
                ? "text-brand"
                : "text-text-muted hover:text-text"
            }`}
          >
            <span className="capitalize">{tab}</span>
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-brand" />
            )}
          </button>
        ))}
      </div>

      {/* ── CONTENT ────────────────────────────────── */}
      <div className="flex-1">
        {loading ? (
          <div className="py-12">
            <DashboardSkeleton />
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-surface rounded-2xl border" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
            <AlertCircle className="w-12 h-12 text-alert mx-auto mb-4" />
            <p className="text-text font-semibold mb-1">Failed to load classes</p>
            <p className="text-text-muted text-sm">{error}</p>
            <Button variant="outline" className="mt-6" onClick={fetchBookings}>
              Try Again
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <Card className="hover:shadow-level-2 transition-shadow duration-180 border" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(80,70,200,0.08)" }}
              >
                <CalendarX2 className="w-8 h-8" style={{ color: "#5046c8" }} />
              </div>
              <h3 className="text-[18px] font-bold text-text mb-2">
                No {activeTab} classes
              </h3>
              <p className="text-[14px] text-text-muted max-w-[280px] mb-6">
                You don't have any {activeTab} classes on your schedule yet.
              </p>
              <Button asChild variant="primary" className="shadow-sm">
                <Link href="/student/discover">Book Your First Class</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bookings.map((booking, index) => {
              const isLive = booking.status === "ONGOING";
              const isStartingSoon = booking.status === "STARTS_SOON";
              const sessionStart = booking.nextSession?.scheduledStart || booking.scheduledStart;
              const joinable = sessionStart && canJoin(sessionStart);
              const cancellable = activeTab === "upcoming" && sessionStart && canCancel(sessionStart);
              const initials = getInitials(booking.teacher);

              return (
                <Card
                  key={booking.id}
                  className={`flex flex-col hover:shadow-level-2 transition-all duration-180 overflow-hidden ${
                    isStartingSoon || isLive
                      ? "border-action shadow-level-1"
                      : ""
                  }`}
                  style={{
                    borderColor: isStartingSoon || isLive ? "var(--color-action)" : "rgba(35,29,94,0.08)"
                  }}
                >
                  {/* Colored top bar if active */}
                  {(isLive || isStartingSoon) && (
                    <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #c7982f, #d8b45e)" }} />
                  )}

                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Header: Teacher & Badges */}
                    <div className="p-5 flex items-start gap-4">
                      {booking.avatar ? (
                        <Avatar src={booking.avatar} size="lg" />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-[14px] font-bold shrink-0 shadow-sm"
                          style={{ background: PILL_COLORS[index % PILL_COLORS.length] }}
                        >
                          {initials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h3 className="font-display font-semibold text-[16px] text-text truncate">
                            {booking.teacher}
                          </h3>
                          <Badge variant={getStatusColor(booking.status)} className="text-[10px] uppercase py-0.5 border-none px-2 shadow-sm">
                            {getStatusText(booking.status)}
                          </Badge>
                          <Badge variant={booking.type === "DEMO" ? "warning" : "default"} className="text-[10px] uppercase py-0.5 border-none px-2 shadow-sm">
                            {booking.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[13px] text-text-muted mt-1">
                          <span className="font-medium text-brand">{booking.language}</span>
                          <span>•</span>
                          <span>{booking.completedSessions}/{booking.totalSessions} completed</span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Details */}
                    <div className="px-5 pb-5">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-inset/50 border" style={{ borderColor: "rgba(35,29,94,0.06)" }}>
                        <Clock className="w-4 h-4 text-text-subtle" />
                        <span className="text-[13px] font-medium text-text">
                          {booking.nextSession
                            ? new Date(booking.nextSession.scheduledStart).toLocaleString("en-US", {
                                weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                              })
                            : "No session scheduled"}
                        </span>
                      </div>
                    </div>

                    {/* Footer / Actions */}
                    <div
                      className="mt-auto p-5 border-t flex flex-col sm:flex-row gap-3 items-center justify-between"
                      style={{
                        borderColor: "rgba(35,29,94,0.06)",
                        backgroundColor: isStartingSoon ? "rgba(199,152,47,0.03)" : isLive ? "rgba(15,157,107,0.03)" : "rgba(35,29,94,0.01)"
                      }}
                    >
                      {isStartingSoon || isLive ? (
                        <Button asChild variant="primary" className="w-full sm:w-auto shadow-sm">
                          <Link href={`/live/${booking.nextSession?.id || booking.id}`}>
                            <Video className="w-4 h-4 mr-1.5" />
                            {isLive ? "Rejoin Class" : "Join Class"}
                          </Link>
                        </Button>
                      ) : activeTab === "upcoming" && booking.nextSession ? (
                        <>
                          <div className="flex w-full sm:w-auto gap-2">
                            {joinable ? (
                              <Button asChild variant="primary" className="flex-1 sm:flex-none shadow-sm">
                                <Link href={`/live/${booking.nextSession.id}`}>
                                  <Video className="w-4 h-4 mr-1.5" /> Join
                                </Link>
                              </Button>
                            ) : (
                              <div className="text-[11px] text-text-subtle font-medium px-2 py-1.5">
                                Opens 5m before
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="ghost" size="sm" className="text-text-muted hover:text-text flex-1 sm:flex-none" disabled>
                              <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Reschedule
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`flex-1 sm:flex-none ${cancellable ? "text-alert hover:text-alert hover:bg-alert/10" : "text-text-subtle opacity-50 cursor-not-allowed"}`}
                              disabled={!cancellable}
                              onClick={() => cancellable && setShowCancelModal(booking.id)}
                            >
                              <CalendarX2 className="w-3.5 h-3.5 mr-1" /> Cancel
                            </Button>
                          </div>
                        </>
                      ) : booking.status === "COMPLETED" ? (
                        <div className="text-[13px] font-medium text-trust flex items-center gap-1.5 w-full justify-center sm:justify-start">
                          <CheckCircle className="w-4 h-4" /> Completed
                        </div>
                      ) : (
                        <div className="text-[12px] text-text-subtle w-full text-center sm:text-left">
                          No further actions
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CANCEL MODAL ─────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="max-w-md w-full shadow-level-2 animate-in zoom-in-95 duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-alert/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-alert" />
                </div>
                <div>
                  <h3 className="font-bold text-[18px] text-text font-display leading-tight">Cancel Booking</h3>
                  <p className="text-[13px] text-text-muted mt-0.5">
                    Are you sure you want to cancel this class?
                  </p>
                </div>
              </div>

              <div className="bg-surface-inset rounded-xl p-4 mb-6 border" style={{ borderColor: "rgba(35,29,94,0.06)" }}>
                <p className="text-[13px] text-text leading-relaxed">
                  This class is eligible for a full refund as it's more than 12
                  hours away. The refund will be credited to your wallet.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowCancelModal(null)}>
                  Keep Booking
                </Button>
                <Button
                  onClick={() => showCancelModal && handleCancel(showCancelModal)}
                  disabled={cancellingId === showCancelModal}
                  className="bg-alert hover:bg-alert-hover text-white border-none shadow-sm"
                >
                  {cancellingId === showCancelModal ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CalendarX2 className="w-4 h-4 mr-2" />
                  )}
                  Cancel Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
