"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useJsonResource } from "@repo/ui/useResource";
import { useStickyState } from "@repo/ui/useStickyState";
import { invalidateResource } from "@repo/ui/resource-cache";
import { StaleDataNotice } from "@repo/ui/StaleDataNotice";

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
  /** Past its join window, waiting for automatic settlement. */
  endedSession?: { scheduledStart: string; scheduledEnd: string } | null;
  review: { rating: number; comment: string | null } | null;
  amountPaid: number;
  scheduledStart: string;
  createdAt: string;
};

/** `datetime-local` wants local wall-clock time, not an ISO string. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MyClassesPage() {
  // The chosen tab outlives a navigation, so opening a class and coming
  // back lands on the same list.
  const [activeTab, setActiveTab] = useStickyState("classes:tab", "upcoming");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [reschedulingSession, setReschedulingSession] = useState<{ id: string, scheduledStart: string } | null>(null);
  const [newStartTime, setNewStartTime] = useState<string>("");
  // Failures from cancel/reschedule show inside the open dialog, not in a
  // blocking browser alert.
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActionError(null);
  }, [showCancelModal, reschedulingSession]);

  useEffect(() => {
    if (!showCancelModal && !reschedulingSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || cancellingId) return;
      setShowCancelModal(null);
      setReschedulingSession(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCancelModal, reschedulingSession, cancellingId]);

  // One cache key per tab, so switching back to a tab already looked at is
  // instant, and a tab never shows another tab's bookings while it loads.
  const {
    data,
    error,
    isLoading,
    isStale,
    updatedAt,
    refetch: fetchBookings,
  } = useJsonResource<{ bookings: Booking[] }>(`/api/students/classes?filter=${activeTab}`, {
    staleMs: 30_000,
  });
  const bookings = data?.bookings ?? [];



  const handleCancel = async (bookingId: string) => {
    setActionError(null);
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
      // Cancelling moves the booking between tabs, so drop all of them.
      invalidateResource("/api/students/classes");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  const handleReschedule = async () => {
    if (!reschedulingSession || !newStartTime) return;
    setActionError(null);
    setCancellingId(reschedulingSession.id);
    try {
      const res = await fetch(`/api/students/classes/${reschedulingSession.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newStartTime }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reschedule booking");
      }
      setReschedulingSession(null);
      invalidateResource("/api/students/classes");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reschedule booking");
    } finally {
      setCancellingId(null);
    }
  };

  // Matches the server join window (LIVEKIT_JOIN_WINDOW_MINUTES, default 10)
  const canJoin = (sessionStart: string) => {
    const now = new Date();
    const start = new Date(sessionStart);
    const opensAt = new Date(start.getTime() - 10 * 60 * 1000);
    return now >= opensAt;
  };

  // Check if cancellation is allowed (12+ hours before start)
  const canCancel = (scheduledStart: string) => {
    const now = new Date();
    const start = new Date(scheduledStart);
    const twelveHoursBefore = new Date(start.getTime() - 12 * 60 * 60 * 1000);
    return now < twelveHoursBefore;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "STARTS_SOON":
        return "warning";
      case "ONGOING":
        return "success";
      case "CONFIRMED":
        return "info";
      case "COMPLETED":
        return "success";
      case "CANCELLED":
        return "danger";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "STARTS_SOON":
        return "Starting Soon";
      case "ONGOING":
        return "Live Now";
      case "CONFIRMED":
        return "Confirmed";
      case "COMPLETED":
        return "Completed";
      case "CANCELLED":
        return "Cancelled";
      case "PENDING":
        return "Pending";
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col h-full gap-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="lm-page-title mb-2">
            My Classes
          </h1>
          <p className="text-text-muted">
            Manage your bookings and join live sessions
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/discover">Book a new class</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {["upcoming", "past", "cancelled"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium text-sm transition-colors relative ${
              activeTab === tab
                ? "text-brand"
                : "text-text-muted hover:text-text"
            }`}
          >
            <span className="capitalize">{tab}</span>
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">
        {isStale && <StaleDataNotice onRetry={() => void fetchBookings()} updatedAt={updatedAt} />}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : error && !data ? (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <p className="text-text-muted">Check your connection and try again.</p>
            <Button variant="outline" className="mt-4" onClick={fetchBookings}>
              Try Again
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center max-w-sm mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-inset flex items-center justify-center text-text-subtle mb-2">
              <CalendarX2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text mb-1">
                No {activeTab} classes
              </h3>
              <p className="text-text-muted text-sm">
                You don&apos;t have any {activeTab} classes on your schedule
                yet.
              </p>
            </div>
            <Button asChild variant="primary">
              <Link href="/discover">Book Your First Class</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const isLive = booking.status === "ONGOING";
              const isStartingSoon = booking.status === "STARTS_SOON";
              const sessionStart =
                booking.nextSession?.scheduledStart || booking.scheduledStart;
              const joinable = sessionStart && canJoin(sessionStart);
              const cancellable =
                activeTab === "upcoming" &&
                sessionStart &&
                canCancel(sessionStart);

              return (
                <Card
                  key={booking.id}
                  className={`overflow-hidden transition-all rounded-md border ${
                    isStartingSoon
                      ? "border-amber-300/50 shadow-md shadow-amber-100"
                      : isLive
                      ? "border-trust/30 shadow-md shadow-trust/10"
                      : "border-border"
                  }`}
                >
                  <CardContent className="p-0 sm:flex items-center">
                    {/* Left info */}
                    <div className="p-6 flex-1 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                      <div className="relative">
                        <Avatar
                          src={booking.avatar || undefined}
                          alt={booking.teacher}
                          initials={booking.teacher.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                          size="lg"
                          online={isLive || isStartingSoon}
                        />
                        {(isLive || isStartingSoon) && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-text">
                            {booking.teacher}
                          </h3>
                          <Badge
                            variant={getStatusColor(booking.status)}
                            className="text-[10px] uppercase py-0"
                          >
                            {getStatusText(booking.status)}
                          </Badge>
                          <Badge
                            variant={
                              booking.type === "DEMO" ? "warning" : "default"
                            }
                            className="text-[10px] uppercase py-0"
                          >
                            {booking.type}
                          </Badge>
                        </div>
                        <div className="text-text-muted flex items-center gap-2">
                          <span className="font-medium text-text">
                            {booking.language}
                          </span>{" "}
                          •{" "}
                          {booking.nextSession
                            ? new Date(
                                booking.nextSession.scheduledStart
                              ).toLocaleString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : booking.endedSession
                              ? `Class ended ${new Date(booking.endedSession.scheduledEnd).toLocaleString("en-US", {
                                  weekday: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })} · settling automatically`
                              : "No session scheduled"}
                        </div>
                        <div className="text-xs text-text-subtle mt-1">
                          {booking.completedSessions}/{booking.totalSessions}{" "}
                          sessions completed
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div
                      className={`p-6 sm:border-l border-border flex flex-col gap-3 min-w-[220px] ${
                        isStartingSoon
                          ? "bg-amber-50"
                          : isLive
                          ? "bg-trust/5"
                          : "bg-surface-inset/30"
                      }`}
                    >
                      {isStartingSoon || isLive ? (
                        <Button asChild variant="primary" className="w-full">
                          <Link href={`/live/${booking.nextSession?.id || booking.id}`}>
                            <Video className="w-4 h-4 mr-1.5" />{" "}
                            {isLive ? "Rejoin" : "Join Class"}
                          </Link>
                        </Button>
                      ) : activeTab === "upcoming" && booking.nextSession ? (
                        <>
                          {joinable ? (
                            <Button asChild variant="primary" className="w-full">
                              <Link href={`/live/${booking.nextSession.id}`}>
                                <Video className="w-4 h-4 mr-1.5" /> Join Class
                              </Link>
                            </Button>
                          ) : (
                            <div className="w-full text-center text-xs text-text-muted py-2">
                              <Clock className="w-4 h-4 mx-auto mb-1 text-text-subtle" />
                              Join opens 5 min before class
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 text-text-muted hover:text-brand hover:bg-brand/10"
                              onClick={() => {
                                setReschedulingSession({ id: booking.nextSession!.id, scheduledStart: booking.nextSession!.scheduledStart });
                                const currentStart = new Date(booking.nextSession!.scheduledStart);
                                const tzoffset = currentStart.getTimezoneOffset() * 60000;
                                const localISOTime = (new Date(currentStart.getTime() - tzoffset)).toISOString().slice(0, 16);
                                setNewStartTime(localISOTime);
                              }}
                            >
                              <RefreshCcw className="w-3.5 h-3.5 mr-1" />{" "}
                              Reschedule
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`flex-1 ${
                                cancellable
                                  ? "text-danger hover:text-danger hover:bg-danger/10"
                                  : "text-text-subtle cursor-not-allowed"
                              }`}
                              disabled={!cancellable}
                              onClick={() =>
                                cancellable && setShowCancelModal(booking.id)
                              }
                            >
                              <CalendarX2 className="w-3.5 h-3.5 mr-1" />{" "}
                              Cancel
                            </Button>
                          </div>
                          {cancellable && (
                            <p className="text-[10px] text-text-subtle text-center">
                              Free cancellation until 12h before class
                            </p>
                          )}
                        </>
                      ) : booking.status === "COMPLETED" ? (
                        <div className="text-center text-sm text-text-muted">
                          <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
                          Completed
                        </div>
                      ) : (
                        <div className="text-center text-sm text-text-muted">
                          No action
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

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 id="cancel-dialog-title" className="font-bold text-text">Cancel Booking</h3>
                <p className="text-sm text-text-muted">
                  Are you sure you want to cancel this class?
                </p>
              </div>
            </div>

            <p className="text-sm text-text-muted">
              This class is eligible for a full refund as it&apos;s more than 12
              hours away. The refund will be credited to your wallet.
            </p>

            {actionError && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-alert/30 bg-alert-subtle px-3 py-2 text-sm text-alert-hover">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {actionError}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(null)}
              >
                Keep Booking
              </Button>
              <Button
                onClick={() =>
                  showCancelModal && handleCancel(showCancelModal)
                }
                disabled={cancellingId === showCancelModal}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {cancellingId === showCancelModal ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CalendarX2 className="w-4 h-4 mr-2" />
                )}
                Cancel Booking
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="reschedule-dialog-title" className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <RefreshCcw className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 id="reschedule-dialog-title" className="font-bold text-text">Reschedule Class</h3>
                <p className="text-sm text-text-muted">
                  Select a new time (within 1 hour range)
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="reschedule-start" className="block text-sm font-medium text-text-secondary mb-1">New Start Time</label>
              <input
                id="reschedule-start"
                type="datetime-local"
                min={toLocalInput(new Date(new Date(reschedulingSession.scheduledStart).getTime() - 3_600_000))}
                max={toLocalInput(new Date(new Date(reschedulingSession.scheduledStart).getTime() + 3_600_000))}
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full border border-border bg-surface rounded-md p-2 text-sm text-text"
              />
              <p className="text-xs text-text-muted mt-2">
                You can reschedule this class up to 1 hour before or after its original scheduled time for free, provided the teacher is available.
              </p>
            </div>

            {actionError && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-alert/30 bg-alert-subtle px-3 py-2 text-sm text-alert-hover">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {actionError}
              </p>
            )}

            <div className="flex gap-3 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setReschedulingSession(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReschedule}
                disabled={cancellingId === reschedulingSession.id || !newStartTime}
                className="bg-brand hover:bg-brand/90 text-white"
              >
                {cancellingId === reschedulingSession.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4 mr-2" />
                )}
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
