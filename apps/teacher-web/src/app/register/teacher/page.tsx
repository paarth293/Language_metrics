"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { OAuthErrorAlert } from "@/components/auth/OAuthErrorAlert";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
// Import standalone step schemas instead of using .pick() on the full schema.
// .pick() breaks if the parent schema is ever wrapped in .refine()/.superRefine()
// because those return ZodEffects which has no .pick() method.
import { teacherStep1Schema, teacherStep2Schema, teacherStep3Schema } from "@/features/auth/validators/auth";
import { useAuth } from "@/lib/auth-client";

type Step1Errors = Partial<Record<"name" | "email" | "password", string>>;
type Step2Errors = Partial<Record<"language" | "gender", string>>;
type Step3Errors = Partial<Record<"experienceType", string>>;

const TOTAL_STEPS = 3;

export default function TeacherRegisterPage() {

  const { refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Step 1 fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});

  // OTP verification state
  const [showOtp, setShowOtp] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 2 fields
  const [language, setLanguage] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({});

  // Step 3 fields
  const [experienceType, setExperienceType] = useState<"fresher" | "experienced">("fresher");
  const [step3Errors, setStep3Errors] = useState<Step3Errors>({});

  const clearStep1 = (field: keyof Step1Errors) =>
    setStep1Errors((prev) => ({ ...prev, [field]: undefined }));

  // ── Cooldown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // ── Send OTP ────────────────────────────────────────────────────────────────
  const sendOtp = useCallback(async () => {
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
          // Email already registered — go back to step 1
          setShowOtp(false);
          setStep1Errors({ email: data.message || "This email is already registered." });
          return;
        }
        setOtpError(data.message || "Failed to send code.");
        return;
      }

      setCooldown(60);
      setOtpValues(["", "", "", "", "", ""]);
      // Focus the first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }, [email]);

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (code: string) => {
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

      // Success — mark email as verified and proceed to Step 2
      setEmailVerified(true);
      setShowOtp(false);
      setStep(2);
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  }, [email]);

  // ── OTP input handlers ──────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newValues = [...otpValues];
    newValues[index] = value;
    setOtpValues(newValues);
    setOtpError(null);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
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

    // Focus the next empty input or last input
    const nextEmpty = newValues.findIndex((v) => !v);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

    // Auto-submit if complete
    if (pasted.length === 6) {
      verifyOtp(pasted);
    }
  };

  // ── Step navigation ─────────────────────────────────────────────────────────
  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // ── Step 1: validate then trigger OTP ──────────────────────────────────
    if (step === 1) {
      const result = teacherStep1Schema.safeParse({ name, email, password });
      if (!result.success) {
        const errors: Step1Errors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof Step1Errors;
          if (!errors[field]) errors[field] = issue.message;
        }
        setStep1Errors(errors);
        return;
      }
      setStep1Errors({});

      // If email already verified, go straight to Step 2
      if (emailVerified) {
        setStep(2);
        return;
      }

      // Show OTP input and send OTP
      setShowOtp(true);
      sendOtp();
      return;
    }

    // ── Step 2: validate via teacherStep2Schema ──────────────────────────────
    if (step === 2) {
      const result = teacherStep2Schema.safeParse({ language, gender: gender || undefined });
      if (!result.success) {
        const errors: Step2Errors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof Step2Errors;
          if (!errors[field]) errors[field] = issue.message;
        }
        setStep2Errors(errors);
        return;
      }
      setStep2Errors({});
      setStep(3);
      return;
    }

    // ── Step 3: validate via standalone teacherStep3Schema ───────────────────
    if (step === 3) {
      const result = teacherStep3Schema.safeParse({ experienceType });
      if (!result.success) {
        const errors: Step3Errors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof Step3Errors;
          if (!errors[field]) errors[field] = issue.message;
        }
        setStep3Errors(errors);
        return;
      }
      setStep3Errors({});

      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/register/teacher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            language,
            gender: gender || undefined,
            experienceType,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setServerError(data.message || "Registration failed");
        } else {
          setSuccess(true);
          setTimeout(async () => {
            await refreshUser();
            router.push("/coming-soon");
          }, 1500);
        }
      } catch {
        setServerError("Network error. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-up">
          <div className="w-16 h-16 rounded-full bg-trust-subtle text-trust flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-brand mb-2">Application Submitted</h2>
          <p className="text-text-muted">Our team will review your profile shortly. Taking you to your portal...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-brand mb-2">Apply to teach</h1>
        <p className="text-text-muted">Join our global community of educators.</p>

        {/* Stepper */}
        <div className="flex items-center gap-2 mt-6" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-brand" : "bg-surface-inset"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-brand" : "bg-surface-inset"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? "bg-brand" : "bg-surface-inset"}`} />
        </div>
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-2 text-right">
          Step {step} of {TOTAL_STEPS}
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

          {/* OTP Error */}
          {otpError && (
            <p className="text-center text-sm text-danger mb-3">{otpError}</p>
          )}

          {/* Verifying indicator */}
          {otpVerifying && (
            <p className="text-center text-sm text-text-muted mb-3">Verifying...</p>
          )}

          {/* Resend + Change email */}
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
        <form onSubmit={handleNext} className="space-y-4 min-h-[300px] flex flex-col" noValidate>
          {/* ── Step 1: Basic info ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-up flex-1">
              {/* Name */}
              <div className="space-y-1">
                <label htmlFor="teacher-name" className="text-sm font-medium text-text">Full name</label>
                <Input
                  id="teacher-name"
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearStep1("name"); }}
                  aria-invalid={!!step1Errors.name}
                  aria-describedby={step1Errors.name ? "teacher-name-error" : undefined}
                  className={step1Errors.name ? "border-alert focus:ring-alert/30" : ""}
                />
                {step1Errors.name && (
                  <p id="teacher-name-error" role="alert" className="text-xs text-alert mt-1">{step1Errors.name}</p>
                )}
              </div>
              {/* Email */}
              <div className="space-y-1">
                <label htmlFor="teacher-email" className="text-sm font-medium text-text">
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
                  id="teacher-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearStep1("email");
                    // Reset verification if email changes
                    if (emailVerified) setEmailVerified(false);
                  }}
                  aria-invalid={!!step1Errors.email}
                  aria-describedby={step1Errors.email ? "teacher-email-error" : undefined}
                  className={`${step1Errors.email ? "border-alert focus:ring-alert/30" : ""} ${emailVerified ? "border-trust focus:ring-trust/30" : ""}`}
                />
                {step1Errors.email && (
                  <p id="teacher-email-error" role="alert" className="text-xs text-alert mt-1">{step1Errors.email}</p>
                )}
              </div>
              {/* Password */}
              <div className="space-y-1">
                <label htmlFor="teacher-password" className="text-sm font-medium text-text">Password</label>
                <Input
                  id="teacher-password"
                  type="password"
                  placeholder="Create a password (min 8 chars, uppercase, number)"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearStep1("password"); }}
                  aria-invalid={!!step1Errors.password}
                  aria-describedby={step1Errors.password ? "teacher-password-error" : undefined}
                  className={step1Errors.password ? "border-alert focus:ring-alert/30" : ""}
                />
                {step1Errors.password && (
                  <p id="teacher-password-error" role="alert" className="text-xs text-alert mt-1">{step1Errors.password}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Teaching details ────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-up flex-1">
              <div className="space-y-1">
                <label htmlFor="teacher-language" className="text-sm font-medium text-text">Language you will teach</label>
                <select 
                  id="teacher-language" 
                  className={`flex h-11 w-full rounded-md border bg-surface-inset px-3 py-2 text-sm text-text focus-ring ${step2Errors.language ? "border-danger" : "border-border"}`} 
                  value={language}
                  onChange={(e) => { setLanguage(e.target.value); setStep2Errors(prev => ({ ...prev, language: undefined })); }}
                  required
                >
                  <option value="" disabled>Select language...</option>
                  <option value="spanish">Spanish</option>
                  <option value="french">French</option>
                  <option value="english">English</option>
                  <option value="japanese">Japanese</option>
                  <option value="german">German</option>
                </select>
                {step2Errors.language && (
                  <p role="alert" className="text-xs text-danger mt-1">{step2Errors.language}</p>
                )}
              </div>
              
              <div className="space-y-1">
                <label htmlFor="teacher-gender" className="text-sm font-medium text-text">Gender (Optional)</label>
                <select 
                  id="teacher-gender" 
                  className="flex h-11 w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring" 
                  value={gender}
                  onChange={(e) => setGender(e.target.value as "male" | "female" | "other" | "")}
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label htmlFor="teacher-rate" className="text-sm font-medium text-text">Hourly Rate (Coins)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold" aria-hidden="true">🪙</span>
                  <Input id="teacher-rate" type="number" placeholder="100" className="pl-9" required min="50" max="1000" />
                </div>
                <p className="text-xs text-text-muted mt-1">1 coin = ₹1. You can change this later.</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Experience ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-up flex-1">
              <div className="space-y-1">
                <label htmlFor="teacher-experience" className="text-sm font-medium text-text">Teaching Experience</label>
                <select
                  id="teacher-experience"
                  className={`flex h-11 w-full rounded-md border bg-surface-inset px-3 py-2 text-sm text-text focus-ring ${
                    step3Errors.experienceType ? "border-alert" : "border-border"
                  }`}
                  value={experienceType}
                  aria-invalid={!!step3Errors.experienceType}
                  aria-describedby={step3Errors.experienceType ? "teacher-experience-error" : undefined}
                  onChange={(e) => {
                    setExperienceType(e.target.value as "fresher" | "experienced");
                    setStep3Errors({});
                  }}
                >
                  <option value="fresher">New / Fresher teacher</option>
                  <option value="experienced">Experienced teacher</option>
                </select>
                {step3Errors.experienceType && (
                  <p id="teacher-experience-error" role="alert" className="text-xs text-alert mt-1">{step3Errors.experienceType}</p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="teacher-bio" className="text-sm font-medium text-text">Short Bio</label>
                <textarea
                  id="teacher-bio"
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
            <Button type="submit" variant="gold" className="flex-1" disabled={isLoading}>
              {step === 3 ? (isLoading ? "Submitting..." : "Submit Application") : "Continue"}
            </Button>
          </div>
        </form>
      )}

      {step === 1 && !showOtp && (
        <p className="mt-8 text-center text-sm text-text-muted">
          Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </p>
      )}
    </AuthLayout>
  );
}
