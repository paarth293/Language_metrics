"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden bg-surface-2">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gold/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-6 text-balance leading-tight">
          Ready to speak naturally?
        </h2>
        <p className="text-lg text-text-muted mb-10 text-balance max-w-2xl mx-auto">
          Join thousands of students learning from verified professionals. Book your first demo class for just ₹49.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild variant="gold" size="lg" className="w-full sm:w-auto shadow-glow-gold">
            <Link href="/register/student">Get Started as a Student</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/register/teacher">Apply to Teach</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
