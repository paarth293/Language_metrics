"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { registerStudentSchema, PASSWORD_RULES } from "@/features/auth/validators/auth";
import { useAuth } from "@/lib/auth-client";

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "languageToLearn" | "proficiencyLevel", string>
>;

// Password strength: returns 0-4.
// Intentionally uses PASSWORD_RULES from the schema — single source of truth
// so the meter can never silently drift out of sync with actual validation.
function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= PASSWORD_RULES.minLength) score++;
  if (PASSWORD_RULES.uppercase.test(password)) score++;
  if (PASSWORD_RULES.lowercase.test(password)) score++;
  if (PASSWORD_RULES.digit.test(password)) score++;
  return score;
}

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["", "bg-danger", "bg-warning", "bg-info", "bg-success"];

export default function StudentRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { login } = useAuth();

  const clearError = (field: keyof FieldErrors) =>
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // ── Client-side Zod validation ───────────────────────────────────────────
    const result = registerStudentSchema.safeParse({
      name,
      email,
      password,
      languageToLearn: language,
      proficiencyLevel: level,
    });

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
      const res = await fetch("/api/auth/register/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          languageToLearn: language,
          proficiencyLevel: level,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.message || "Registration failed");
      } else {
        setSuccess(true);
        setTimeout(() => {
          login(data.token, data.user);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const strength = passwordStrength(password);

  if (success) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-up">
          <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-text mb-2">Account Created!</h2>
          <p className="text-text-muted">Taking you to your dashboard...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-text mb-2">Start learning</h1>
        <p className="text-text-muted">Create a free student account</p>
      </div>

      {serverError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Name */}
        <div className="space-y-1">
          <label htmlFor="student-name" className="text-sm font-medium text-text">Full name</label>
          <Input
            id="student-name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError("name"); }}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? "student-name-error" : undefined}
            className={fieldErrors.name ? "border-danger focus:ring-danger" : ""}
          />
          {fieldErrors.name && <p id="student-name-error" role="alert" className="text-xs text-danger mt-1">{fieldErrors.name}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="student-email" className="text-sm font-medium text-text">Email address</label>
          <Input
            id="student-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "student-email-error" : undefined}
            className={fieldErrors.email ? "border-danger focus:ring-danger" : ""}
          />
          {fieldErrors.email && <p id="student-email-error" role="alert" className="text-xs text-danger mt-1">{fieldErrors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label htmlFor="student-password" className="text-sm font-medium text-text">Password</label>
          <Input
            id="student-password"
            type="password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={[
              fieldErrors.password ? "student-password-error" : "",
              password.length > 0 ? "student-password-strength" : "",
            ].filter(Boolean).join(" ") || undefined}
            className={fieldErrors.password ? "border-danger focus:ring-danger" : ""}
          />
          {/* Strength meter — rules sourced from PASSWORD_RULES, not hardcoded */}
          <div className="flex gap-1 mt-2" aria-hidden="true">
            {[1, 2, 3, 4].map((lvl) => (
              <div
                key={lvl}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  password.length > 0 && strength >= lvl ? strengthColors[strength] : "bg-surface-inset"
                }`}
              />
            ))}
          </div>
          {password.length > 0 && (
            <p id="student-password-strength" className={`text-xs mt-1 ${strengthColors[strength].replace("bg-", "text-")}`}>
              {strengthLabels[strength]}
            </p>
          )}
          {fieldErrors.password && <p id="student-password-error" role="alert" className="text-xs text-danger mt-1">{fieldErrors.password}</p>}
        </div>

        {/* Language + Level */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-text">I want to learn</label>
            <select
              className={`flex h-11 w-full rounded-md border bg-surface-inset px-3 py-2 text-sm text-text focus-ring ${
                fieldErrors.languageToLearn ? "border-danger" : "border-border"
              }`}
              value={language}
              onChange={(e) => { setLanguage(e.target.value); clearError("languageToLearn"); }}
            >
              <option value="" disabled>Select language...</option>
              <option value="spanish">Spanish 🇪🇸</option>
              <option value="french">French 🇫🇷</option>
              <option value="japanese">Japanese 🇯🇵</option>
              <option value="english">English 🇬🇧</option>
            </select>
            {fieldErrors.languageToLearn && (
              <p className="text-xs text-danger mt-1">{fieldErrors.languageToLearn}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-text">My level is</label>
            <select
              className="flex h-11 w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring"
              value={level}
              onChange={(e) => setLevel(e.target.value as "beginner" | "intermediate" | "advanced")}
            >
              <option value="beginner">Beginner (A1-A2)</option>
              <option value="intermediate">Intermediate (B1-B2)</option>
              <option value="advanced">Advanced (C1-C2)</option>
            </select>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-4" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        Already have an account? <Link href="/login" className="font-medium text-gold hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
