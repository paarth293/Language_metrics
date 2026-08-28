"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Filter,
  MessageSquare,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type TicketStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

interface Ticket {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  responses?: { message: string; createdAt: string; isAdmin: boolean }[];
}

const CATEGORIES = [
  "PAYMENT_ISSUE",
  "CLASS_QUALITY",
  "TEACHER_BEHAVIOR",
  "TECHNICAL_ISSUE",
  "BOOKING_ISSUE",
  "REFUND_REQUEST",
  "ACCOUNT_ISSUE",
  "OTHER",
];

const CATEGORY_LABELS: Record<string, string> = {
  PAYMENT_ISSUE: "Payment Issue",
  CLASS_QUALITY: "Class Quality",
  TEACHER_BEHAVIOR: "Teacher Behavior",
  TECHNICAL_ISSUE: "Technical Issue",
  BOOKING_ISSUE: "Booking Issue",
  REFUND_REQUEST: "Refund Request",
  ACCOUNT_ISSUE: "Account Issue",
  OTHER: "Other",
};

const STATUS_CONFIG: Record<
  TicketStatus,
  { color: string; bg: string; icon: any }
> = {
  PENDING: {
    color: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200",
    icon: Clock,
  },
  IN_PROGRESS: {
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: MessageSquare,
  },
  RESOLVED: {
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: CheckCircle,
  },
  CLOSED: {
    color: "text-gray-700",
    bg: "bg-gray-50 border-gray-200",
    icon: XCircle,
  },
};

export default function SupportPage() {
  const [view, setView] = useState<"list" | "new">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TicketStatus | "ALL">("ALL");
  const [submitting, setSubmitting] = useState(false);

  // New ticket form
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/students/complaints");
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/students/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, description }),
      });
      if (!res.ok) throw new Error("Failed to submit complaint");
      setView("list");
      setCategory("");
      setSubject("");
      setDescription("");
      fetchTickets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(
    (t) => filter === "ALL" || t.status === filter
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-700 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {view === "new" && (
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-navy-900 mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back to tickets
            </button>
          )}
          <h1 className="text-2xl font-bold text-navy-900">
            {view === "list" ? "My Support Tickets" : "Raise a Complaint"}
          </h1>
          <p className="text-gray-600 mt-1">
            {view === "list"
              ? "Track and manage your support requests"
              : "Describe your issue and we'll help resolve it"}
          </p>
        </div>
        {view === "list" && (
          <Button
            onClick={() => setView("new")}
            className="bg-amber-700 hover:bg-amber-800 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {view === "new" ? (
        /* New Complaint Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Brief summary of your issue"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={5}
                placeholder="Provide detailed information about your issue..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Include any relevant details like dates, teacher names, or class
                IDs.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setView("list")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-700 hover:bg-amber-800 text-white"
              disabled={submitting || !category || !subject || !description}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit Complaint
            </Button>
          </div>
        </form>
      ) : (
        /* Tickets List */
        <>
          {/* Status Filters */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["ALL", "PENDING", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filter === s
                      ? "bg-amber-700 text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {s === "ALL" ? "All" : s.replace("_", " ")}
                </button>
              )
            )}
          </div>

          {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <AlertTriangle className="w-14 h-14 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">
                {tickets.length === 0
                  ? "No support tickets yet"
                  : "No tickets match this filter"}
              </h3>
              <p className="text-gray-500 mt-1 text-center max-w-md text-sm">
                {tickets.length === 0
                  ? "If you encounter any issues, feel free to raise a complaint."
                  : "Try selecting a different status filter."}
              </p>
              {tickets.length === 0 && (
                <Button
                  onClick={() => setView("new")}
                  className="mt-4 bg-amber-700 hover:bg-amber-800 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Raise a Complaint
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket, index) => {
                const statusConf = STATUS_CONFIG[ticket.status];
                const StatusIcon = statusConf.icon;
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`bg-white rounded-xl border p-5 ${statusConf.bg}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-navy-900 text-sm">
                            {ticket.subject}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <Badge variant="outline">
                            {CATEGORY_LABELS[ticket.category] || ticket.category}
                          </Badge>
                          <span>•</span>
                          <span>{formatDate(ticket.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {ticket.description}
                        </p>
                      </div>
                      <div className={`flex items-center gap-1.5 ${statusConf.color} flex-shrink-0`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-xs font-medium whitespace-nowrap">
                          {ticket.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
