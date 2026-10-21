"use client";

import Image from "next/image";
import { openCashfreeCheckout, type CashfreeMode } from "@repo/ui/cashfree";

import { useState } from "react";
import { motion } from "framer-motion";
import { Video, Lock, Play, Calendar, Search, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useJsonResource } from "@repo/ui/useResource";
import { useStickyState } from "@repo/ui/useStickyState";
import { invalidateResource } from "@repo/ui/resource-cache";
import { StaleDataNotice } from "@repo/ui/StaleDataNotice";

interface Recording {
  id: string;
  classSessionId: string;
  title: string;
  teacherName: string;
  language: string;
  scheduledStart: string;
  duration: number;
  isRecordingPaid: boolean;
  unlockPrice: number;
  videoUrl: string | null;
  thumbnailUrl: string | null;
}

type FilterType = "all" | "unlocked" | "locked";

export default function RecordingsPage() {
  // Filter and search survive a navigation, so opening a recording and coming
  // back returns to the same view.
  const [filter, setFilter] = useStickyState<FilterType>("recordings:filter", "all");
  const [searchQuery, setSearchQuery] = useStickyState("recordings:search", "");
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const {
    data,
    error,
    isLoading,
    isStale,
    updatedAt,
    refetch: fetchRecordings,
  } = useJsonResource<{ recordings: Recording[] }>("/api/students/recordings", { staleMs: 60_000 });
  const recordings = data?.recordings ?? [];



  const handleUnlock = async (recordingId: string) => {
    if (unlockingId) return;
    setUnlockingId(recordingId);
    try {
      const orderRes = await fetch("/api/students/payments/cashfree/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId }),
      });

      if (!orderRes.ok) throw new Error("Failed to create payment order");
      const { orderId, paymentSessionId, mode }: { orderId: string; paymentSessionId: string; mode: CashfreeMode } = await orderRes.json();

      const result = await openCashfreeCheckout(paymentSessionId, mode);
      if (result.error) throw new Error(result.error.message || "Payment was not completed.");

      // The server confirms the payment with Cashfree before unlocking.
      const verifyRes = await fetch("/api/students/payments/cashfree/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!verifyRes.ok) throw new Error("Payment verification failed");
      // An unlocked recording changes its own row and the wallet balance.
      invalidateResource("/api/students/recordings");
      invalidateResource("/api/students/wallet");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setUnlockingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredRecordings = recordings.filter((r) => {
    if (filter === "locked" && r.isRecordingPaid) return false;
    if (filter === "unlocked" && !r.isRecordingPaid) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.teacherName.toLowerCase().includes(q) ||
        r.language.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // A spinner only when nothing has ever loaded.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-700 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">Check your connection and try again.</p>
        <Button onClick={() => void fetchRecordings()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isStale && <StaleDataNotice onRetry={() => void fetchRecordings()} updatedAt={updatedAt} />}

      {/* Header */}
      <div>
        <h1 className="lm-page-title">Recordings</h1>
        <p className="text-gray-600 mt-1">
          Watch your recorded class sessions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "unlocked", "locked"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-amber-700 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredRecordings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
          <Video className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">
            No recordings found
          </h3>
          <p className="text-gray-500 mt-1 text-center max-w-md">
            {recordings.length === 0
              ? "You don't have any recorded sessions yet. Recordings will appear here after your classes."
              : "No recordings match your current filter."}
          </p>
        </div>
      )}

      {/* Recordings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecordings.map((recording, index) => (
          <motion.div
            key={recording.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-gray-100">
              {recording.thumbnailUrl ? (
                <Image unoptimized width={640} height={360}
                  src={recording.thumbnailUrl}
                  alt={recording.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Video className="w-12 h-12 text-gray-300" />
                </div>
              )}

              {/* Lock Overlay */}
              {!recording.isRecordingPaid && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Lock className="w-10 h-10 text-white" />
                </div>
              )}

              {/* Duration Badge */}
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {formatDuration(recording.duration)}
              </div>

              {/* Play Button (if unlocked) */}
              {recording.isRecordingPaid && recording.videoUrl && (
                <button
                  onClick={() => recording.videoUrl && window.open(recording.videoUrl, "_blank")}
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                >
                  <div className="w-14 h-14 bg-amber-700 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                </button>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-semibold text-navy-900 line-clamp-1">
                {recording.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {recording.teacherName}
              </p>

              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(recording.scheduledStart)}
                </span>
                <Badge variant="outline">{recording.language}</Badge>
              </div>

              {/* Action */}
              <div className="mt-4">
                {recording.isRecordingPaid ? (
                  <Button
                    onClick={() =>
                      recording.videoUrl &&
                      window.open(recording.videoUrl, "_blank")
                    }
                    className="w-full bg-amber-700 hover:bg-amber-800 text-white"
                    disabled={!recording.videoUrl}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Watch Recording
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleUnlock(recording.id)}
                    className="w-full bg-navy-900 hover:bg-navy-800 text-white"
                    disabled={unlockingId === recording.id}
                  >
                    {unlockingId === recording.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Unlock for ₹{recording.unlockPrice}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
