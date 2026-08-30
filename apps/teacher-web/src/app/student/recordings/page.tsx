"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Video,
  Lock,
  Unlock,
  Play,
  Download,
  Calendar,
  Clock,
  Search,
  Filter,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/students/recordings");
      if (!res.ok) throw new Error("Failed to load recordings");
      const data = await res.json();
      setRecordings(data.recordings || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to load recordings");
      } else {
        setError(String(err) || "Failed to load recordings");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (recordingId: string) => {
    setUnlockingId(recordingId);
    try {
      // Create Razorpay order
      const orderRes = await fetch("/api/students/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: recordings.find((r) => r.id === recordingId)?.unlockPrice || 0,
          type: "RECORDING_FEE",
          recordingId,
        }),
      });

      if (!orderRes.ok) throw new Error("Failed to create payment order");
      const { orderId, amount, currency, keyId } = await orderRes.json();

      // Open Razorpay
      const options = {
        key: keyId,
        amount,
        currency,
        name: "Language Metrics",
        description: "Unlock Recording",
        order_id: orderId,
        handler: async (response: any) => {
          // Verify payment
          const verifyRes = await fetch(
            "/api/students/payments/razorpay/verify",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            }
          );

          if (verifyRes.ok) {
            // Refresh recordings
            fetchRecordings();
          } else {
            throw new Error("Payment verification failed");
          }
        },
        prefill: { name: "" },
        theme: { color: "#B8860B" },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      alert(err.message || "Payment failed. Please try again.");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-700 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <Button onClick={fetchRecordings} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Recordings</h1>
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
      {filteredRecordings.length === 0 && !loading && (
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
                <img
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
