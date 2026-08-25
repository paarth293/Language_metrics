"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";

type Status = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setTimeout(() => {
        setStatus("error");
        setMessage("No verification token found. Please use the link from your email.");
      }, 0);
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json() as { message?: string };
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
              Your email has been successfully verified. You can now use all features of Language Metrics.
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
