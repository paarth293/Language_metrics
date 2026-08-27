"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { OAuthErrorAlert } from "@/components/auth/OAuthErrorAlert";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginSchema } from "@/features/auth/validators/auth";
import { useAuth } from "@/lib/auth-client";

type FieldErrors = Partial<Record<"email" | "password", string>>;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function TeacherLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = loginSchema.safeParse({ email, password, role: "TEACHER" });
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsLoading(true);

    const outcome = await login(email, password, "TEACHER");
    if (!outcome.success) {
      if (outcome.message === "UNVERIFIED_EMAIL") {
        window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
        return;
      }
      if (outcome.message === "USER_NOT_FOUND") {
        window.location.href = `/register/teacher?email=${encodeURIComponent(email)}`;
        return;
      }
      setServerError(outcome.message ?? "Login failed.");
    }
    setIsLoading(false);
  };


  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left flex flex-col items-center sm:items-start">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 text-brand mb-4">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="font-display text-3xl font-bold text-text mb-2">Teacher Login</h1>
        <p className="text-text-muted">Sign in to manage your classes</p>
      </div>

      {/* Google OAuth */}
      <a
        href="/api/auth/oauth/google?role=teacher"
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-text hover:bg-surface-inset transition-colors mb-6"
      >
        <GoogleIcon />
        Continue with Google
      </a>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-bg px-3 text-text-subtle font-medium tracking-widest">
            or sign in with email
          </span>
        </div>
      </div>

      {serverError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {serverError}
        </div>
      )}

      <React.Suspense fallback={null}>
        <OAuthErrorAlert />
      </React.Suspense>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label className="text-sm font-medium text-text">Email address</label>
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: undefined })); }}
            aria-invalid={!!fieldErrors.email}
            className={fieldErrors.email ? "border-danger focus:ring-danger" : ""}
          />
          {fieldErrors.email && <p className="text-xs text-danger mt-1">{fieldErrors.email}</p>}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text">Password</label>
            <Link href="/forgot-password" className="text-sm font-medium text-gold hover:text-gold-dark transition-colors">
              Forgot password?
            </Link>
          </div>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: undefined })); }}
            aria-invalid={!!fieldErrors.password}
            className={fieldErrors.password ? "border-danger focus:ring-danger" : ""}
          />
          {fieldErrors.password && <p className="text-xs text-danger mt-1">{fieldErrors.password}</p>}
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="remember" className="rounded border-border bg-surface-inset text-gold focus:ring-gold" />
          <label htmlFor="remember" className="text-sm text-text-muted cursor-pointer">Remember me for 30 days</label>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? "Signing in…" : "Sign in as Teacher"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register/teacher" className="font-medium text-gold hover:underline">Apply to Teach</Link>
      </p>
    </AuthLayout>
  );
}
