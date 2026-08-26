"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PASSWORD_RULES } from "@/features/auth/validators/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const rules = [
    { label: "At least 8 characters", pass: password.length >= PASSWORD_RULES.minLength },
    { label: "One uppercase letter", pass: PASSWORD_RULES.uppercase.test(password) },
    { label: "One lowercase letter", pass: PASSWORD_RULES.lowercase.test(password) },
    { label: "One number", pass: PASSWORD_RULES.digit.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid or missing reset token. Please use the link from your email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (rules.some((r) => !r.pass)) {
      setError("Please meet all password requirements.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Failed to reset password.");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 text-center">
        <p className="text-sm font-medium text-danger mb-1">Invalid link</p>
        <p className="text-sm text-text-muted">
          This password reset link is missing or invalid. Please{" "}
          <Link href="/forgot-password" className="text-gold underline">request a new one</Link>.
        </p>
      </div>
    );
  }

  return success ? (
    <div className="rounded-xl border border-trust/30 bg-trust/10 p-5 text-center">
      <p className="text-sm font-medium text-trust mb-1">Password updated!</p>
      <p className="text-sm text-text-muted">
        Your password has been reset. Redirecting to login…
      </p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-text">New password</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {/* Password strength rules */}
        {password && (
          <ul className="mt-2 space-y-1">
            {rules.map((rule) => (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-xs ${
                  rule.pass ? "text-trust" : "text-text-subtle"
                }`}
              >
                <span>{rule.pass ? "✓" : "○"}</span>
                {rule.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-text">Confirm new password</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={confirm && confirm !== password ? "border-danger" : ""}
        />
        {confirm && confirm !== password && (
          <p className="text-xs text-danger mt-1">Passwords do not match.</p>
        )}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
        {isLoading ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left flex flex-col items-center sm:items-start">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="font-display text-3xl font-bold text-text mb-2">
          Choose a new password
        </h1>
        <p className="text-text-muted">Make it strong and unique.</p>
      </div>

      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
