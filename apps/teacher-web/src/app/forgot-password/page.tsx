"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, KeyRound, CheckCircle } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PASSWORD_RULES } from "@/features/auth/validators/auth";

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  
  // Form State
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  
  // Flow State
  const [resetSessionToken, setResetSessionToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const passwordRules = [
    { label: "At least 8 characters", pass: password.length >= PASSWORD_RULES.minLength },
    { label: "One uppercase letter", pass: PASSWORD_RULES.uppercase.test(password) },
    { label: "One lowercase letter", pass: PASSWORD_RULES.lowercase.test(password) },
    { label: "One number", pass: PASSWORD_RULES.digit.test(password) },
  ];

  const handleSendEmail = async (e?: React.FormEvent, isResend = false) => {
    if (e) e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    
    if (isResend) setIsResending(true);
    else setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json() as { message?: string };
      
      if (!res.ok) {
        setError(data.message ?? "Failed to send reset code.");
      } else {
        if (isResend) {
          setMessage("A new reset code has been sent.");
        } else {
          setStep("otp");
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
      setIsResending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      
      const data = await res.json() as { message?: string; resetSessionToken?: string };
      
      if (!res.ok) {
        setError(data.message ?? "Incorrect code.");
      } else if (data.resetSessionToken) {
        setResetSessionToken(data.resetSessionToken);
        setStep("password");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (passwordRules.some((r) => !r.pass)) {
      setError("Please meet all password requirements.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetSessionToken, newPassword: password, confirmPassword: confirm }),
      });
      
      const data = await res.json() as { message?: string };
      
      if (!res.ok) {
        setError(data.message ?? "Failed to reset password.");
      } else {
        setStep("success");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left flex flex-col items-center sm:items-start">
        {step === "email" && (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        )}

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 text-brand mb-4">
          {step === "success" ? <CheckCircle className="w-6 h-6 text-trust" /> : (step === "password" ? <KeyRound className="w-6 h-6" /> : <Mail className="w-6 h-6" />)}
        </div>

        <h1 className="font-display text-3xl font-bold text-text mb-2">
          {step === "email" && "Reset your password"}
          {step === "otp" && "Enter reset code"}
          {step === "password" && "Choose a new password"}
          {step === "success" && "Password updated!"}
        </h1>
        <p className="text-text-muted">
          {step === "email" && "Enter your email and we'll send you a 6-digit code."}
          {step === "otp" && (
            <>
              We sent a code to <strong>{email}</strong>.
            </>
          )}
          {step === "password" && "Make it strong and unique."}
          {step === "success" && "Your password has been successfully reset. You can now log in."}
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}
      
      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-trust/10 border border-trust/30 text-trust text-sm">
          {message}
        </div>
      )}

      {step === "email" && (
        <form onSubmit={handleSendEmail} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text">Email address</label>
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Send reset code
          </Button>
        </form>
      )}

      {step === "otp" && (
        <div className="space-y-6">
          <form onSubmit={handleVerifyOtp} className="space-y-6" noValidate>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">6-Digit Code</label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Verify Code
            </Button>
          </form>

          <div className="text-center text-sm text-text-muted">
            Didn&apos;t receive the code?{" "}
            <button
              onClick={(e) => handleSendEmail(e, true)}
              disabled={isResending}
              className="font-medium text-brand hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {step === "password" && (
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text">New password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {password && (
              <ul className="mt-2 space-y-1">
                {passwordRules.map((rule) => (
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

          <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
            Reset password
          </Button>
        </form>
      )}

      {step === "success" && (
        <Button
          asChild
          variant="primary"
          className="w-full"
        >
          <Link href="/login">Go to Login</Link>
        </Button>
      )}
    </AuthLayout>
  );
}
