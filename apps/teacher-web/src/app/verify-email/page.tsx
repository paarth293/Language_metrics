"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Status = "verifying" | "success" | "error";

/**
 * Token-link flow:
 * When the page receives ?token=xxx, it automatically calls GET /api/auth/verify-email?token=xxx
 * and shows a spinner → success / error state.
 */
function TokenVerifyContent({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = (await res.json()) as { message?: string };
          setStatus("error");
          setMessage(data.message ?? "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [token]);

  return (
    <div className="flex flex-col items-center text-center py-4">
      {status === "verifying" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-12 h-12 text-brand animate-spin" />
          <p className="text-text-muted">Verifying your email…</p>
        </motion.div>
      )}

      {status === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <CheckCircle className="w-14 h-14 text-trust" />
          <div>
            <h2 className="font-display text-2xl font-bold text-text mb-2">
              Email verified!
            </h2>
            <p className="text-text-muted mb-6">
              Your email has been successfully verified. You can now log in.
            </p>
          </div>
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-full bg-brand text-brand-on text-sm font-semibold hover:bg-brand-hover transition-colors"
          >
            Go to Login
          </Link>
        </motion.div>
      )}

      {status === "error" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <XCircle className="w-14 h-14 text-danger" />
          <div>
            <h2 className="font-display text-2xl font-bold text-text mb-2">
              Verification failed
            </h2>
            <p className="text-text-muted mb-6">{message}</p>
          </div>
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-full border border-border bg-surface text-text text-sm font-semibold hover:border-gold hover:text-gold transition-colors"
          >
            Back to Login
          </Link>
        </motion.div>
      )}
    </div>
  );
}

/**
 * OTP flow:
 * When the page receives ?email=xxx, it shows a 6-digit OTP input form
 * that POSTs to /api/auth/verify-email with { email, otp }.
 */
function OtpVerifyContent({ email }: { email: string }) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!email) {
      router.replace("/login");
      return;
    }
    // Auto-send OTP on mount so the user has a code to enter
    const autoSend = async () => {
      try {
        await fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
      } catch {
        // Silently ignore — user can click Resend manually
      }
    };
    autoSend();
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
        setSuccess("Email verified! Redirecting to login…");
        setTimeout(() => router.replace("/login"), 1500);
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
    <>
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
    </>
  );
}

/**
 * Router component — dispatches to the appropriate flow based on query params.
 * - ?token=xxx  → token-link auto-verify
 * - ?email=xxx  → OTP code entry form
 */
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  if (token) {
    return <TokenVerifyContent token={token} />;
  }

  return <OtpVerifyContent email={email} />;
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout>
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold text-text mb-2">
          Email Verification
        </h1>
      </div>
      <Suspense
        fallback={
          <div className="flex justify-center">
            <Loader2 className="w-10 h-10 text-brand animate-spin" />
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </AuthLayout>
  );
}
