"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Clock,
  Globe,
  Award,
  Video,
  Calendar,
  BookOpen,
} from "lucide-react";

interface TeacherData {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  experienceLevel: string;
  language: string | null;
  languages: string[];
  demoVideoUrl: string | null;
}

interface Rate {
  id: string;
  type: string;
  amount: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  studentName: string;
  createdAt: string;
}

interface Availability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface TeacherProfile {
  teacher: TeacherData;
  rates: Rate[];
  reviews: Review[];
  availability: Availability[];
  stats: { totalReviews: number; averageRating: number };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TeacherProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeacher = async () => {
      try {
        const res = await fetch(`/api/students/teacher/${id}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load teacher profile");
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchTeacher();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-text-muted mb-4">{error || "Teacher not found"}</p>
          <Link href="/student/discover" className="text-brand hover:underline">
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  const { teacher, rates, reviews, availability, stats } = data;

  // Group availability by day
  const groupedAvailability: Record<number, Availability[]> = {};
  availability.forEach((slot) => {
    if (!groupedAvailability[slot.dayOfWeek]) groupedAvailability[slot.dayOfWeek] = [];
    groupedAvailability[slot.dayOfWeek].push(slot);
  });

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/student/discover"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Discover
      </Link>

      {/* Profile Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] p-8 text-white">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold flex-shrink-0">
            {teacher.name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1">{teacher.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/70 mb-3">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-gold fill-gold" /> {stats.averageRating || "No"} rating
                {stats.totalReviews > 0 && ` (${stats.totalReviews} reviews)`}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-4 h-4" /> {teacher.languages.join(", ") || teacher.language || "Multiple"}
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-4 h-4" /> {teacher.experienceLevel}
              </span>
            </div>
            {teacher.bio && (
              <p className="text-white/80 text-sm leading-relaxed max-w-2xl">{teacher.bio}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {rates.length > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-gold">{rates[0].amount}</div>
                <div className="text-xs text-white/60">coins ({rates[0].type.toLowerCase()})</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Rates & Availability */}
        <div className="space-y-6">
          {/* Rates */}
          {rates.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-6">
              <h2 className="font-display text-lg font-bold text-text mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand" /> Class Rates
              </h2>
              <div className="space-y-3">
                {rates.map((rate) => (
                  <div
                    key={rate.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-inset"
                  >
                    <span className="text-sm text-text capitalize">{rate.type.toLowerCase()} rate</span>
                    <span className="font-bold text-brand">{rate.amount} coins</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Availability */}
          <div className="rounded-2xl border border-border bg-white p-6">
            <h2 className="font-display text-lg font-bold text-text mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand" /> Availability
            </h2>
            {Object.keys(groupedAvailability).length > 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                  const slots = groupedAvailability[day];
                  if (!slots) return null;
                  return (
                    <div key={day}>
                      <div className="text-xs font-medium text-text-muted mb-1">{DAYS[day]}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {slots.map((slot) => (
                          <span
                            key={slot.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-trust/10 text-trust font-medium"
                          >
                            {slot.startTime} – {slot.endTime}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No availability set</p>
            )}
          </div>

          {/* Book Button */}
          <Link
            href={`/teacher/${id}/book`}
            className="block w-full text-center py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all"
          >
            Book a Class
          </Link>
        </div>

        {/* Right Column — Reviews */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-white p-6">
            <h2 className="font-display text-lg font-bold text-text mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-gold" /> Reviews ({stats.totalReviews})
            </h2>
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="p-4 rounded-xl bg-surface-inset/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-xs font-bold text-brand">
                          {review.studentName[0]}
                        </div>
                        <span className="text-sm font-medium text-text">{review.studentName}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= review.rating
                                ? "text-gold fill-gold"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-text-muted">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No reviews yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
