"use client";

import React, { useState } from "react";
import { CheckCircle2, ArrowRight, Sparkles, Users, Star, Globe } from "lucide-react";
import Link from "next/link";

const benefits = [
  "Early access to new features",
  "Priority teacher matching",
  "Exclusive launch discounts",
  "Free first class credit",
];

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg">
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Coming Soon
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-text mb-6 leading-tight">
              The Future of<br />Language Learning
            </h1>
            <p className="text-lg text-text-muted mb-8 max-w-lg">
              We&apos;re building something special. Join the waitlist to be the first to experience our new features, exclusive teacher partnerships, and launch rewards.
            </p>

            <div className="space-y-3 mb-8">
              {benefits.map((b) => (
                <div key={b} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-trust/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-trust" />
                  </div>
                  <span className="text-text text-sm font-medium">{b}</span>
                </div>
              ))}
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-6 text-sm text-text-muted">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand" />
                <span><strong className="text-text">2,500+</strong> on waitlist</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-gold fill-gold" />
                <span><strong className="text-text">4.9</strong> teacher rating</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-trust" />
                <span><strong className="text-text">15+</strong> languages</span>
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="p-8 rounded-2xl border border-border bg-white shadow-lg">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-trust/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-trust" />
                </div>
                <h2 className="font-display text-2xl font-bold text-text mb-2">You&apos;re on the list!</h2>
                <p className="text-text-muted mb-6">
                  We&apos;ll notify you at <strong>{email}</strong> when we launch.
                </p>
                <Link href="/" className="text-brand font-medium hover:underline inline-flex items-center gap-1">
                  Back to Home <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold text-text mb-2">Join the Waitlist</h2>
                <p className="text-text-muted text-sm mb-6">Enter your email to reserve your spot.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-border bg-surface-inset px-4 py-3 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    ) : (
                      <>
                        Join Waitlist <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-text-subtle text-center">
                    No spam, ever. Unsubscribe anytime.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
