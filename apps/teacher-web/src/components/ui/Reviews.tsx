"use client";

import React from "react";
import { Star, Quote } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Learning Spanish",
    avatar: "https://i.pravatar.cc/150?u=priya",
    rating: 5,
    text: "Elena is an amazing teacher! She makes every lesson fun and engaging. I went from knowing zero Spanish to having conversations in just 3 months.",
    language: "Spanish",
  },
  {
    name: "James Wilson",
    role: "Learning Japanese",
    avatar: "https://i.pravatar.cc/150?u=james",
    rating: 5,
    text: "Kenji-sensei is incredibly patient and structured. His JLPT preparation course helped me pass N3 on my first attempt. Highly recommended!",
    language: "Japanese",
  },
  {
    name: "Maria Garcia",
    role: "Learning French",
    avatar: "https://i.pravatar.cc/150?u=maria",
    rating: 5,
    text: "Sophie brings French culture into every lesson. Learning through art and music made the language come alive. The 1-on-1 format is perfect.",
    language: "French",
  },
  {
    name: "Alex Chen",
    role: "Learning German",
    avatar: "https://i.pravatar.cc/150?u=alex",
    rating: 4,
    text: "Great platform! The coin system is flexible and the teacher verification gives me confidence. My German has improved significantly.",
    language: "German",
  },
  {
    name: "Anika Patel",
    role: "Learning English",
    avatar: "https://i.pravatar.cc/150?u=anika",
    rating: 5,
    text: "The live video sessions are high quality and my teacher corrects my pronunciation in real-time. Much better than self-study apps!",
    language: "English",
  },
  {
    name: "Kim Soo-jin",
    role: "Learning Mandarin",
    avatar: "https://i.pravatar.cc/150?u=soojin",
    rating: 5,
    text: "I love how I can choose from different teachers and try demo classes before committing. Found the perfect teacher for my learning style.",
    language: "Mandarin",
  },
];

export function Reviews({ compact = false }: { compact?: boolean }) {
  const displayReviews = compact ? testimonials.slice(0, 3) : testimonials;

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {!compact && (
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium mb-4">
              Testimonials
            </span>
            <h2 className="font-display text-3xl font-bold text-text mb-3">What Our Students Say</h2>
            <p className="text-text-muted max-w-lg mx-auto">
              Join thousands of happy learners who&apos;ve achieved their language goals with Language Metrics.
            </p>
          </div>
        )}

        <div className={`grid grid-cols-1 ${compact ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"} gap-6`}>
          {displayReviews.map((review) => (
            <div
              key={review.name}
              className="p-6 rounded-2xl border border-border bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= review.rating ? "text-amber-400 fill-amber-400" : "text-neutral-200"
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-text-muted leading-relaxed mb-4 line-clamp-4">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <Avatar src={review.avatar} size="sm" />
                <div>
                  <div className="text-sm font-semibold text-text">{review.name}</div>
                  <div className="text-xs text-text-subtle">{review.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
