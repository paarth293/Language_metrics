"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-client";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { login } = useAuth();

  useEffect(() => {
    if (!email) {
      router.replace("/login");
    }
  }, [email, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Verification failed.");
      } else {
        setSuccess("Email verified successfully!");
        setTimeout(() => {
          login(data.token, data.user);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to resend code.");
      } else {
        setSuccess("A new verification code has been sent.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  if (!email) return null;

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-4">
          <span className="text-2xl">✉️</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-text mb-2">Verify your email</h1>
        <p className="text-text-muted">
          We sent a 6-digit code to <strong>{email}</strong>.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-success/10 border border-success/30 text-success text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6" noValidate>
        <div className="space-y-2">
          <label className="text-sm font-medium text-text">Verification Code</label>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-widest"
          />
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Verify Email
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-text-muted">
        Didn&apos;t receive the code?{" "}
        <button
          onClick={handleResend}
          disabled={isResending}
          className="font-medium text-gold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isResending ? "Sending..." : "Resend code"}
        </button>
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <AuthLayout>
        <div className="flex items-center justify-center p-8">Loading...</div>
      </AuthLayout>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
