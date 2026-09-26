"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Wallet,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Rate {
  id: string;
  type: string;
  amount: number;
}

interface DemoInfo {
  coins: number;
  minutes: number;
  /** False once the student has a non-cancelled demo with this teacher. */
  available: boolean;
}

/** Radio value for the demo option, which has no rate id of its own. */
const DEMO = "DEMO";

interface TeacherInfo {
  name: string;
  language: string | null;
}

export default function BookClassPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string;

  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [demo, setDemo] = useState<DemoInfo | null>(null);
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [slotStart, setSlotStart] = useState<string>("");
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch teacher profile
        const teacherRes = await fetch(`/api/students/teacher/${teacherId}`, {
          credentials: "include",
        });
        if (!teacherRes.ok) throw new Error("Teacher not found");
        const teacherData = await teacherRes.json();
        setTeacher(teacherData.teacher);
        setRates(teacherData.rates);
        const demoInfo: DemoInfo | null = teacherData.demo ?? null;
        setDemo(demoInfo);
        // "Book Demo" links arrive with ?option=demo; otherwise keep the first rate.
        const wantsDemo = new URLSearchParams(window.location.search).get("option") === "demo";
        if (demoInfo?.available && (wantsDemo || teacherData.rates.length === 0)) {
          setSelectedRate(DEMO);
        } else if (teacherData.rates.length > 0) {
          setSelectedRate(teacherData.rates[0].id);
        }

        // Fetch wallet balance
        const walletRes = await fetch("/api/students/wallet", {
          credentials: "include",
        });
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          setBalance(walletData.balance || 0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teacherId]);

  const handleBook = async () => {
    if (!selectedRate || !slotStart) return;
    setBooking(true);
    setError(null);

    const parsedStart = new Date(slotStart);
    if (parsedStart <= new Date()) {
      setError("The selected time must be in the future.");
      setBooking(false);
      return;
    }

    try {
      const res = await fetch(`/api/students/teacher/${teacherId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          selectedRate === DEMO
            ? { demo: true, slotStart: parsedStart.toISOString() }
            : { rateId: selectedRate, slotStart: parsedStart.toISOString() }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Booking failed");
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center p-8 rounded-2xl border border-border bg-white">
          <div className="w-16 h-16 rounded-2xl bg-trust/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-trust" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text mb-2">Class Booked!</h1>
          <p className="text-text-muted mb-6">
            Your class with {teacher?.name} has been confirmed. Check your schedule for details.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/classes"
              className="w-full py-3 rounded-xl bg-navy text-white font-medium text-sm text-center hover:bg-navy-2 transition-all"
            >
              View My Classes
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-brand hover:underline"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedPrice =
    selectedRate === DEMO ? demo?.coins : rates.find((r) => r.id === selectedRate)?.amount;
  const canAfford = selectedPrice !== undefined && balance >= selectedPrice;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/teacher/${teacherId}`}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Profile
      </Link>

      <div className="rounded-2xl border border-border bg-white p-8">
        <h1 className="font-display text-2xl font-bold text-text mb-2">Book a Class</h1>
        <p className="text-text-muted mb-6">
          Book a class with <strong>{teacher?.name}</strong> ({teacher?.language || "Language Teacher"})
        </p>

        {/* Start Time Selection */}
        <div className="space-y-3 mb-6">
          <label className="text-sm font-medium text-text">Select Start Time</label>
          <div className="flex items-center gap-2 p-3 rounded-xl border border-border focus-within:border-brand/50 transition-colors">
            <Clock className="w-5 h-5 text-text-muted" />
            <input
              type="datetime-local"
              className="w-full bg-transparent outline-none text-text"
              value={slotStart}
              onChange={(e) => setSlotStart(e.target.value)}
              min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            />
          </div>
        </div>

        {/* Rate Selection */}
        <div className="space-y-3 mb-6">
          <label className="text-sm font-medium text-text">Choose a Class</label>
          {demo && (
            <label
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                !demo.available
                  ? "border-border opacity-50 cursor-not-allowed"
                  : selectedRate === DEMO
                    ? "border-brand bg-brand/5 cursor-pointer"
                    : "border-border hover:border-brand/50 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="rate"
                  value={DEMO}
                  checked={selectedRate === DEMO}
                  disabled={!demo.available}
                  onChange={() => setSelectedRate(DEMO)}
                  className="accent-brand"
                />
                <div>
                  <div className="font-medium text-text">Demo class</div>
                  <div className="text-xs text-text-muted">
                    {demo.available
                      ? `${demo.minutes} min · one per teacher`
                      : "Already booked with this teacher"}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand">{demo.coins} coins</div>
              </div>
            </label>
          )}
          {rates.map((rate) => (
            <label
              key={rate.id}
              className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedRate === rate.id
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-brand/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="rate"
                  value={rate.id}
                  checked={selectedRate === rate.id}
                  onChange={() => setSelectedRate(rate.id)}
                  className="accent-brand"
                />
                <div>
                  <div className="font-medium text-text capitalize">{rate.type.toLowerCase()} rate</div>
                  <div className="text-xs text-text-muted">{rate.type === "HOURLY" ? "Per hour" : "Per course"}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-brand">{rate.amount} coins</div>
              </div>
            </label>
          ))}
        </div>

        {/* Balance Check */}          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-inset mb-6">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Wallet className="w-4 h-4" /> Your balance
          </div>
          <span className={`font-bold ${canAfford ? "text-trust" : "text-danger"}`}>
            {balance} coins
          </span>
        </div>

        {!canAfford && selectedPrice !== undefined && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 text-danger text-sm mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            You need {selectedPrice} coins. Top up your wallet to book.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 text-danger text-sm mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleBook}
          disabled={!canAfford || booking || !selectedRate || !slotStart}
          className="w-full py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {booking ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Booking...
            </span>
          ) : (
            "Confirm Booking"
          )}
        </button>
      </div>
    </div>
  );
}
