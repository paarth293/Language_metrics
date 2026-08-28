"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { OAuthErrorAlert } from "@/components/auth/OAuthErrorAlert";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { registerStudentSchema, PASSWORD_RULES } from "@/features/auth/validators/auth";
import { useAuth } from "@/lib/auth-client";
import { LANGUAGES, getLevelsForLanguage } from "@/lib/languages";

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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // OTP verification state
  const [showOtp, setShowOtp] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { refreshUser } = useAuth();
  const router = useRouter();

  const clearError = (field: keyof FieldErrors) =>
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));

  // ── Cooldown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // ── Send OTP ────────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    setOtpError(null);
    setOtpSending(true);

    try {
      const res = await fetch("/api/auth/send-registration-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setShowOtp(false);
          setFieldErrors((prev) => ({ ...prev, email: data.message || "This email is already registered." }));
          return;
        }
        setOtpError(data.message || "Failed to send code.");
        return;
      }

      setCooldown(60);
      setOtpValues(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  const verifyOtp = async (code: string) => {
    setOtpError(null);
    setOtpVerifying(true);

    try {
      const res = await fetch("/api/auth/verify-registration-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), otp: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setOtpError(data.message || "Verification failed.");
        setOtpValues(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      // Success — mark email as verified and submit the registration
      setEmailVerified(true);
      setShowOtp(false);
      // Auto-submit after OTP verification
      submitRegistration();
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── OTP input handlers ──────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newValues = [...otpValues];
    newValues[index] = value;
    setOtpValues(newValues);
    setOtpError(null);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const fullCode = newValues.join("");
    if (fullCode.length === 6 && /^\d{6}$/.test(fullCode)) {
      verifyOtp(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newValues = [...otpValues];
    for (let i = 0; i < 6; i++) {
      newValues[i] = pasted[i] || "";
    }
    setOtpValues(newValues);

    const nextEmpty = newValues.findIndex((v) => !v);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

    if (pasted.length === 6) {
      verifyOtp(pasted);
    }
  };

  // ── Submit registration ─────────────────────────────────────────────────────
  const submitRegistration = async () => {
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
      } else if (data.verificationRequired) {
        window.location.assign(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        setSuccess(true);
        setTimeout(async () => {
          await refreshUser();
          const studentUrl = process.env.NEXT_PUBLIC_STUDENT_URL || (process.env.NODE_ENV === "production" ? "https://language-metrics-student-web.vercel.app" : "http://localhost:3002");
          window.location.href = `${studentUrl}/dashboard`;
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Form submit handler ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Client-side Zod validation
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

    // If email already verified, skip OTP and submit directly
    if (emailVerified) {
      submitRegistration();
      return;
    }

    // Show OTP verification
    setShowOtp(true);
    sendOtp();
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

      <React.Suspense fallback={null}>
        <OAuthErrorAlert />
      </React.Suspense>

      {/* ── OTP Verification Overlay ─────────────────────────────────────── */}
      {showOtp && (
        <div className="animate-fade-up">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-brand-subtle text-brand flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-bold text-text mb-1">Verify your email</h2>
            <p className="text-text-muted text-sm">
              We sent a 6-digit code to <strong className="text-text">{email}</strong>
            </p>
          </div>

          {/* OTP Input Boxes */}
          <div className="flex justify-center gap-2.5 mb-4">
            {otpValues.map((val, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={val}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onPaste={i === 0 ? handleOtpPaste : undefined}
                disabled={otpVerifying}
                className={`w-11 h-13 text-center text-xl font-bold rounded-lg border-2 bg-surface-inset text-text
                  focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand
                  transition-all duration-200
                  ${otpError ? "border-danger shake" : val ? "border-brand" : "border-border"}
                  ${otpVerifying ? "opacity-60" : ""}
                `}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {otpError && (
            <p className="text-center text-sm text-danger mb-3">{otpError}</p>
          )}

          {otpVerifying && (
            <p className="text-center text-sm text-text-muted mb-3">Verifying...</p>
          )}

          <div className="flex flex-col items-center gap-2 mt-4">
            <button
              type="button"
              onClick={sendOtp}
              disabled={cooldown > 0 || otpSending}
              className={`text-sm font-medium transition-colors ${
                cooldown > 0
                  ? "text-text-muted cursor-not-allowed"
                  : "text-brand hover:text-brand-hover cursor-pointer"
              }`}
            >
              {otpSending
                ? "Sending..."
                : cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : "Resend code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowOtp(false);
                setOtpValues(["", "", "", "", "", ""]);
                setOtpError(null);
              }}
              className="text-sm text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              ← Change email
            </button>
          </div>
        </div>
      )}

      {/* ── Registration Form ────────────────────────────────────────────── */}
      {!showOtp && (
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
            <label htmlFor="student-email" className="text-sm font-medium text-text">
              Email address
              {emailVerified && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-trust">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Verified
                </span>
              )}
            </label>
            <Input
              id="student-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError("email");
                if (emailVerified) setEmailVerified(false);
              }}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "student-email-error" : undefined}
              className={`${fieldErrors.email ? "border-danger focus:ring-danger" : ""} ${emailVerified ? "border-trust focus:ring-trust/30" : ""}`}
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
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setLevel("");
                  clearError("languageToLearn");
                }}
              >
                <option value="" disabled>Select language...</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.name.toLowerCase()}> {l.flag} {l.name}</option>
                ))}
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
                onChange={(e) => setLevel(e.target.value)}
                disabled={!language}
              >
                <option value="" disabled>{language ? "Select level..." : "Pick language first"}</option>
                {getLevelsForLanguage(language).map((lvl) => (
                  <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full mt-4" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create account"}
          </Button>
        </form>
      )}

      {!showOtp && (
        <p className="mt-8 text-center text-sm text-text-muted">
          Already have an account? <Link href="/login" className="font-medium text-gold hover:underline">Sign in</Link>
        </p>
      )}
    </AuthLayout>
  );
}
