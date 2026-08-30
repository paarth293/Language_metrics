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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

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

  // Check if booking is within 5-minute join window
  const canJoin = (sessionStart: string) => {
    const now = new Date();
    const start = new Date(sessionStart);
    const fiveMinBefore = new Date(start.getTime() - 5 * 60 * 1000);
    return now >= fiveMinBefore;
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
          <h1 className="font-display text-3xl font-bold text-brand mb-2">
            My Classes
          </h1>
          <p className="text-text-muted">
            Manage your bookings and join live sessions
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/student/discover">Book a new class</Link>
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <p className="text-text-muted">{error}</p>
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
              <Link href="/student/discover">Book Your First Class</Link>
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
                              <Clock className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                              Join opens 5 min before class
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 text-text-muted"
                              disabled
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
                                  : "text-gray-400 cursor-not-allowed"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-navy-900">Cancel Booking</h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to cancel this class?
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              This class is eligible for a full refund as it&apos;s more than 12
              hours away. The refund will be credited to your wallet.
            </p>

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
    </div>
  );
}

