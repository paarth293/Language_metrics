"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginSchema } from "@/features/auth/validators/auth";
import { useAuth } from "@/lib/auth-client";

type FieldErrors = Partial<Record<"email" | "password", string>>;

export default function StudentLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const result = loginSchema.safeParse({ email, password, role: "STUDENT" });
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

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "STUDENT" }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.message || "Login failed");
      } else {
        login(data.token, data.user);
      }
    } catch (err) {
      console.error(err);
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-4">
          <span className="text-2xl">🎓</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-text mb-2">Student Login</h1>
        <p className="text-text-muted">Sign in to book classes and learn</p>
      </div>

      {serverError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {serverError}
        </div>
      )}

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
          {fieldErrors.email && (
            <p className="text-xs text-danger mt-1">{fieldErrors.email}</p>
          )}
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
          {fieldErrors.password && (
            <p className="text-xs text-danger mt-1">{fieldErrors.password}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="remember" className="rounded border-border bg-surface-inset text-gold focus:ring-gold" />
          <label htmlFor="remember" className="text-sm text-text-muted cursor-pointer">Remember me for 30 days</label>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-2" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in as Student"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        Don&apos;t have an account? <Link href="/register/student" className="font-medium text-gold hover:underline">Sign up as Student</Link>
      </p>
    </AuthLayout>
  );
}
