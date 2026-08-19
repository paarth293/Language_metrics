"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function TeacherRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) setStep(step + 1);
    else {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setSuccess(true);
        setTimeout(() => {
          router.push("/teacher/dashboard"); // Demo redirect
        }, 2000);
      }, 1500);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-up">
          <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-text mb-2">Application Submitted</h2>
          <p className="text-text-muted">Our team will review your profile shortly. Taking you to your portal...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-text mb-2">Apply to teach</h1>
        <p className="text-text-muted">Join our global community of educators.</p>
        
        {/* Stepper */}
        <div className="flex items-center gap-2 mt-6">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-gold' : 'bg-surface-inset'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-gold' : 'bg-surface-inset'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-gold' : 'bg-surface-inset'}`} />
        </div>
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-2 text-right">
          Step {step} of 3
        </div>
      </div>

      <form onSubmit={handleNext} className="space-y-4 min-h-[300px] flex flex-col">
        {step === 1 && (
          <div className="space-y-4 animate-fade-up flex-1">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Full name</label>
              <Input type="text" placeholder="Jane Doe" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Email address</label>
              <Input type="email" placeholder="name@example.com" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Password</label>
              <Input type="password" placeholder="Create a password" required />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-up flex-1">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Language you will teach</label>
              <select className="flex h-11 w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring" required>
                <option value="" disabled>Select language...</option>
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
                <option value="english">English</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Hourly Rate (Coins)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold">🪙</span>
                <Input type="number" placeholder="100" className="pl-9" required min="50" max="1000" />
              </div>
              <p className="text-xs text-text-muted mt-1">1 coin = ₹1. You can change this later.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-fade-up flex-1">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Teaching Experience</label>
              <select className="flex h-11 w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring" required>
                <option value="informal">Informal tutoring</option>
                <option value="professional">Professional teaching (Certified)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Short Bio</label>
              <textarea 
                className="flex w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring min-h-[100px] resize-none" 
                placeholder="Tell students about your teaching style..."
                required
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 mt-auto">
          {step > 1 && (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-1" disabled={isLoading}>
            {step === 3 ? (isLoading ? "Submitting..." : "Submit Application") : "Continue"}
          </Button>
        </div>
      </form>

      {step === 1 && (
        <p className="mt-8 text-center text-sm text-text-muted">
          Already have an account? <Link href="/login" className="font-medium text-gold hover:underline">Sign in</Link>
        </p>
      )}
    </AuthLayout>
  );
}
