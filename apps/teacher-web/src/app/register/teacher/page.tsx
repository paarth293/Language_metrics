"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { OAuthErrorAlert } from "@/components/auth/OAuthErrorAlert";
import { Input } from "@/components/ui/Input";
import { FileUpload } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import {
  teacherStep1Schema,
  teacherStep2Schema,
  teacherStep3Schema,
  teacherStep4Schema,
} from "@/features/auth/validators/auth";
import { useAuth } from "@/lib/auth-client";
import { TEACHING_LANGUAGES } from "@/lib/languages";

type Step1Errors = Partial<Record<"name" | "email" | "password", string>>;
type Step2Errors = Partial<Record<"language" | "languages", string>>;
type Step3Errors = Partial<
  Record<"qualificationDocUrl" | "idProofDocUrl", string>
>;
type Step4Errors = Partial<
  Record<"experienceType" | "experienceDocUrl", string>
>;

const TOTAL_STEPS = 5;

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

  // Step 2 fields — Languages & Gender
  const [primaryLanguage, setPrimaryLanguage] = useState("");
  const [additionalLanguages, setAdditionalLanguages] = useState<string[]>([]);
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({});

  // Step 3 fields — Qualifications
  const [qualificationDocUrl, setQualificationDocUrl] = useState("");
  const [qualificationFileName, setQualificationFileName] = useState<string | null>(null);
  const [idProofDocUrl, setIdProofDocUrl] = useState("");
  const [idProofFileName, setIdProofFileName] = useState<string | null>(null);
  const [step3Errors, setStep3Errors] = useState<Step3Errors>({});

  // Step 4 fields — Experience
  const [experienceType, setExperienceType] = useState<"fresher" | "experienced">("fresher");
  const [experienceDocUrl, setExperienceDocUrl] = useState("");
  const [experienceFileName, setExperienceFileName] = useState<string | null>(null);
  const [experienceDescription, setExperienceDescription] = useState("");
  const [step4Errors, setStep4Errors] = useState<Step4Errors>({});

  const clearStep1 = (field: keyof Step1Errors) =>
    setStep1Errors((prev) => ({ ...prev, [field]: undefined }));

  // Toggle an additional language
  const toggleAdditionalLanguage = (code: string) => {
    setAdditionalLanguages((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      // Clear error when at least one is selected
      if (next.length > 0) {
        setStep2Errors((e) => ({ ...e, languages: undefined }));
      }
      return next;
    });
  };

  // When primary language changes, ensure it's in additionalLanguages too
  useEffect(() => {
    if (primaryLanguage && !additionalLanguages.includes(primaryLanguage)) {
      setTimeout(() => {
        setAdditionalLanguages((prev) => [primaryLanguage, ...prev.filter((c) => c !== primaryLanguage)]);
      }, 0);
    }
  }, [primaryLanguage, additionalLanguages]);  

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
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) {
        if (res.status === 409) {
          setShowOtp(false);
          setStep1Errors({ email: (data.message as string) || "This email is already registered." });
          return;
        }
        setOtpError((data.message as string) || "Failed to send code.");
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
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) {
        setOtpError((data.message as string) || "Verification failed.");
        setOtpValues(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }
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
    if (value && !/^\d$/.test(value)) return;
    const newValues = [...otpValues];
    newValues[index] = value;
    setOtpValues(newValues);
    setOtpError(null);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    const fullCode = newValues.join("");
    if (fullCode.length === 6 && /^\d{6}$/.test(fullCode)) verifyOtp(fullCode);
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
    for (let i = 0; i < 6; i++) newValues[i] = pasted[i] || "";
    setOtpValues(newValues);
    const nextEmpty = newValues.findIndex((v) => !v);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    if (pasted.length === 6) verifyOtp(pasted);
  };

  // ── Step navigation ─────────────────────────────────────────────────────────
  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

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
      if (emailVerified) { setStep(2); return; }
      setShowOtp(true);
      sendOtp();
      return;
    }

    if (step === 2) {
      const allLanguages = Array.from(new Set([primaryLanguage, ...additionalLanguages]));
      const result = teacherStep2Schema.safeParse({
        language: primaryLanguage,
        languages: allLanguages,
        gender: gender || undefined,
      });
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

    if (step === 3) {
      const result = teacherStep3Schema.safeParse({ qualificationDocUrl, idProofDocUrl });
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
      setStep(4);
      return;
    }

    if (step === 4) {
      const result = teacherStep4Schema.safeParse({
        experienceType,
        experienceDocUrl: experienceDocUrl || undefined,
        experienceDescription: experienceDescription || undefined,
      });
      if (!result.success) {
        const errors: Step4Errors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof Step4Errors;
          if (!errors[field]) errors[field] = issue.message;
        }
        setStep4Errors(errors);
        return;
      }
      if (experienceType === "experienced" && !experienceDocUrl) {
        setStep4Errors({ experienceDocUrl: "Please upload your experience document." });
        return;
      }
      setStep4Errors({});
      setStep(5);
      return;
    }
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setServerError(null);
    setIsLoading(true);

    const allLanguages = Array.from(new Set([primaryLanguage, ...additionalLanguages]));

    try {
      const res = await fetch("/api/auth/register/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          language: primaryLanguage,
          languages: allLanguages,
          gender: gender || undefined,
          qualificationDocUrl,
          idProofDocUrl,
          experienceType,
          experienceDocUrl: experienceDocUrl || undefined,
          experienceDescription: experienceDescription || undefined,
        }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) {
        setServerError((data.message as string) || "Registration failed");
      } else if (data.verificationRequired) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        setSuccess(true);
        setTimeout(async () => {
          await refreshUser();
          router.push("/coming-soon");
        }, 1500);
      }
    } catch (err) {
      console.error("[Register] Submit error:", err);
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
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
          <p className="text-text-muted">Our team will review your profile and documents shortly. Taking you to your portal...</p>
        </div>
      </AuthLayout>
    );
  }

  const stepLabels = ["Account", "Details", "Qualifications", "Experience", "Review"];

  return (
    <AuthLayout>
      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-brand mb-2">Apply to teach</h1>
        <p className="text-text-muted">Join our global community of educators.</p>

        <div className="flex items-center gap-1.5 mt-6" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i + 1 <= step ? "bg-brand" : "bg-surface-inset"}`} />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{stepLabels[step - 1]}</span>
          <span className="text-xs font-semibold text-text-muted">Step {step} of {TOTAL_STEPS}</span>
        </div>
      </div>

      {serverError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">{serverError}</div>
      )}

      <React.Suspense fallback={null}><OAuthErrorAlert /></React.Suspense>

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
            <p className="text-text-muted text-sm">We sent a 6-digit code to <strong className="text-text">{email}</strong></p>
          </div>
          <div className="flex justify-center gap-2.5 mb-4">
            {otpValues.map((val, i) => (
              <input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={val}
                onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onPaste={i === 0 ? handleOtpPaste : undefined} disabled={otpVerifying}
                className={`w-11 h-13 text-center text-xl font-bold rounded-lg border-2 bg-surface-inset text-text focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all duration-200 ${otpError ? "border-danger shake" : val ? "border-brand" : "border-border"} ${otpVerifying ? "opacity-60" : ""}`}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
          {otpError && <p className="text-center text-sm text-danger mb-3">{otpError}</p>}
          {otpVerifying && <p className="text-center text-sm text-text-muted mb-3">Verifying...</p>}
          <div className="flex flex-col items-center gap-2 mt-4">
            <button type="button" onClick={sendOtp} disabled={cooldown > 0 || otpSending}
              className={`text-sm font-medium transition-colors ${cooldown > 0 ? "text-text-muted cursor-not-allowed" : "text-brand hover:text-brand-hover cursor-pointer"}`}>
              {otpSending ? "Sending..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button type="button" onClick={() => { setShowOtp(false); setOtpValues(["", "", "", "", "", ""]); setOtpError(null); }}
              className="text-sm text-text-muted hover:text-text transition-colors cursor-pointer">← Change email</button>
          </div>
        </div>
      )}

      {/* ── Registration Form ────────────────────────────────────────────── */}
      {!showOtp && (
        <form onSubmit={step === 5 ? undefined : handleNext} className="space-y-4 min-h-[300px] flex flex-col" noValidate>

          {/* ── Step 1: Basic info ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-up flex-1">
              <div className="space-y-1">
                <label htmlFor="teacher-name" className="text-sm font-medium text-text">Full name</label>
                <Input id="teacher-name" type="text" placeholder="Jane Doe" value={name}
                  onChange={(e) => { setName(e.target.value); clearStep1("name"); }}
                  aria-invalid={!!step1Errors.name} aria-describedby={step1Errors.name ? "teacher-name-error" : undefined}
                  className={step1Errors.name ? "border-alert focus:ring-alert/30" : ""} />
                {step1Errors.name && <p id="teacher-name-error" role="alert" className="text-xs text-alert mt-1">{step1Errors.name}</p>}
              </div>
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
                <Input id="teacher-email" type="email" placeholder="name@example.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); clearStep1("email"); if (emailVerified) setEmailVerified(false); }}
                  aria-invalid={!!step1Errors.email} aria-describedby={step1Errors.email ? "teacher-email-error" : undefined}
                  className={`${step1Errors.email ? "border-alert focus:ring-alert/30" : ""} ${emailVerified ? "border-trust focus:ring-trust/30" : ""}`} />
                {step1Errors.email && <p id="teacher-email-error" role="alert" className="text-xs text-alert mt-1">{step1Errors.email}</p>}
              </div>
              <div className="space-y-1">
                <label htmlFor="teacher-password" className="text-sm font-medium text-text">Password</label>
                <Input id="teacher-password" type="password" placeholder="Create a password (min 8 chars, uppercase, number)" value={password}
                  onChange={(e) => { setPassword(e.target.value); clearStep1("password"); }}
                  aria-invalid={!!step1Errors.password} aria-describedby={step1Errors.password ? "teacher-password-error" : undefined}
                  className={step1Errors.password ? "border-alert focus:ring-alert/30" : ""} />
                {step1Errors.password && <p id="teacher-password-error" role="alert" className="text-xs text-alert mt-1">{step1Errors.password}</p>}
              </div>
            </div>
          )}

          {/* ── Step 2: Teaching details ────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-up flex-1">
              {/* Primary Language */}
              <div className="space-y-1">
                <label htmlFor="teacher-language" className="text-sm font-medium text-text">Primary language you teach *</label>
                <select id="teacher-language"
                  className={`flex h-11 w-full rounded-md border bg-surface-inset px-3 py-2 text-sm text-text focus-ring ${step2Errors.language ? "border-danger" : "border-border"}`}
                  value={primaryLanguage}
                  onChange={(e) => { setPrimaryLanguage(e.target.value); setStep2Errors((prev) => ({ ...prev, language: undefined })); }}
                  required>
                  <option value="" disabled>Select primary language...</option>
                  {TEACHING_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                  ))}
                </select>
                {step2Errors.language && <p role="alert" className="text-xs text-danger mt-1">{step2Errors.language}</p>}
              </div>

              {/* Additional Languages */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text">
                  Additional languages{" "}
                  <span className="text-text-muted font-normal">(optional — select all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto p-1">
                  {TEACHING_LANGUAGES.filter((l) => l.code !== primaryLanguage).map((lang) => {
                    const isSelected = additionalLanguages.includes(lang.code);
                    return (
                      <button key={lang.code} type="button" onClick={() => toggleAdditionalLanguage(lang.code)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-border bg-surface-inset text-text-muted hover:border-brand/40 hover:text-text"
                        }`}>
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
                {additionalLanguages.length > 0 && (
                  <p className="text-xs text-brand">{additionalLanguages.length + 1} language{additionalLanguages.length > 0 ? "s" : ""} selected</p>
                )}
                {step2Errors.languages && <p role="alert" className="text-xs text-danger mt-1">{step2Errors.languages}</p>}
              </div>

              {/* Gender */}
              <div className="space-y-1">
                <label htmlFor="teacher-gender" className="text-sm font-medium text-text">Gender (Optional)</label>
                <select id="teacher-gender"
                  className="flex h-11 w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring"
                  value={gender} onChange={(e) => setGender(e.target.value as "male" | "female" | "other" | "")}>
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Step 3: Qualifications (PDF Uploads) ─────────────────────── */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-up flex-1">
              <div>
                <h2 className="font-display text-lg font-bold text-text mb-1">Upload your qualifications</h2>
                <p className="text-sm text-text-muted">These documents will be reviewed by our admin team before your account is approved.</p>
              </div>

              <FileUpload label="Qualification Certificate"
                helperText="Upload your highest educational qualification (degree, diploma, teaching certificate, etc.)"
                uploadedFileName={qualificationFileName}
                onUpload={(url, filename) => { setQualificationDocUrl(url); setQualificationFileName(filename); setStep3Errors((prev) => ({ ...prev, qualificationDocUrl: undefined })); }}
                onRemove={() => { setQualificationDocUrl(""); setQualificationFileName(null); }} />
              {step3Errors.qualificationDocUrl && <p role="alert" className="text-xs text-danger -mt-3">{step3Errors.qualificationDocUrl}</p>}

              <FileUpload label="Government-issued ID Proof"
                helperText="Passport, Aadhaar card, driver's license, or any valid government ID"
                uploadedFileName={idProofFileName}
                onUpload={(url, filename) => { setIdProofDocUrl(url); setIdProofFileName(filename); setStep3Errors((prev) => ({ ...prev, idProofDocUrl: undefined })); }}
                onRemove={() => { setIdProofDocUrl(""); setIdProofFileName(null); }} />
              {step3Errors.idProofDocUrl && <p role="alert" className="text-xs text-danger -mt-3">{step3Errors.idProofDocUrl}</p>}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-brand/5 border border-brand/20">
                <svg className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-text-muted">Your documents are securely stored and only accessible to our admin team for verification purposes. They will not be shared with third parties.</p>
              </div>
            </div>
          )}

          {/* ── Step 4: Experience ──────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-up flex-1">
              <div>
                <h2 className="font-display text-lg font-bold text-text mb-1">Teaching experience</h2>
                <p className="text-sm text-text-muted">Let us know about your teaching background. This helps us tailor your experience on the platform.</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="teacher-experience" className="text-sm font-medium text-text">Teaching Experience</label>
                <select id="teacher-experience"
                  className={`flex h-11 w-full rounded-md border bg-surface-inset px-3 py-2 text-sm text-text focus-ring ${step4Errors.experienceType ? "border-alert" : "border-border"}`}
                  value={experienceType} aria-invalid={!!step4Errors.experienceType}
                  aria-describedby={step4Errors.experienceType ? "teacher-experience-error" : undefined}
                  onChange={(e) => { setExperienceType(e.target.value as "fresher" | "experienced"); setStep4Errors({}); }}>
                  <option value="fresher">New / Fresher teacher</option>
                  <option value="experienced">Experienced teacher</option>
                </select>
                {step4Errors.experienceType && <p id="teacher-experience-error" role="alert" className="text-xs text-alert mt-1">{step4Errors.experienceType}</p>}
              </div>

              {experienceType === "experienced" && (
                <div className="space-y-3 animate-fade-up">
                  <FileUpload label="Experience Document"
                    helperText="Upload an experience letter, employment certificate, or similar proof of teaching experience"
                    uploadedFileName={experienceFileName}
                    onUpload={(url, filename) => { setExperienceDocUrl(url); setExperienceFileName(filename); setStep4Errors((prev) => ({ ...prev, experienceDocUrl: undefined })); }}
                    onRemove={() => { setExperienceDocUrl(""); setExperienceFileName(null); }} />
                  {step4Errors.experienceDocUrl && <p role="alert" className="text-xs text-danger -mt-2">{step4Errors.experienceDocUrl}</p>}

                  <div className="space-y-1">
                    <label htmlFor="teacher-experience-desc" className="text-sm font-medium text-text">
                      Brief experience description <span className="text-text-muted font-normal">(optional)</span>
                    </label>
                    <textarea id="teacher-experience-desc"
                      className="flex w-full rounded-md border border-border bg-surface-inset px-3 py-2 text-sm text-text focus-ring min-h-[80px] resize-none"
                      placeholder="e.g., 3 years teaching Spanish to adult learners, tutored 50+ students..."
                      value={experienceDescription} onChange={(e) => setExperienceDescription(e.target.value)} maxLength={500} />
                    <p className="text-xs text-text-muted text-right">{experienceDescription.length}/500</p>
                  </div>
                </div>
              )}

              {experienceType === "fresher" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-inset border border-border">
                  <svg className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-text-muted">No worries! Many successful teachers start without formal experience. You&apos;ll still go through our verification process and can begin teaching once approved.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 5: Review & Submit ──────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4 animate-fade-up flex-1">
              <div>
                <h2 className="font-display text-lg font-bold text-text mb-1">Review your application</h2>
                <p className="text-sm text-text-muted">Please verify all details before submitting. Our team will review your application and documents.</p>
              </div>

              <div className="p-4 rounded-lg border border-border bg-surface-inset/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text">Account Details</h3>
                  <button type="button" onClick={() => setStep(1)} className="text-xs text-brand hover:underline cursor-pointer">Edit</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-text-muted text-xs">Name</p><p className="text-text">{name}</p></div>
                  <div><p className="text-text-muted text-xs">Email</p><p className="text-text">{email}</p></div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-surface-inset/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text">Teaching Details</h3>
                  <button type="button" onClick={() => setStep(2)} className="text-xs text-brand hover:underline cursor-pointer">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-text-muted text-xs">Languages</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {additionalLanguages.map((code) => {
                        const lang = TEACHING_LANGUAGES.find((l) => l.code === code);
                        return (
                          <span key={code} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${code === primaryLanguage ? "bg-brand/10 text-brand border border-brand/20" : "bg-surface-inset text-text-muted border border-border"}`}>
                            {lang?.flag} {lang?.name} {code === primaryLanguage && "(Primary)"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div><p className="text-text-muted text-xs">Gender</p><p className="text-text capitalize">{gender || "Not specified"}</p></div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-surface-inset/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text">Qualifications</h3>
                  <button type="button" onClick={() => setStep(3)} className="text-xs text-brand hover:underline cursor-pointer">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-trust flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-text-muted">Qualification Certificate:</span>
                    <span className="text-text truncate">{qualificationFileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-trust flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-text-muted">ID Proof:</span>
                    <span className="text-text truncate">{idProofFileName}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-surface-inset/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text">Experience</h3>
                  <button type="button" onClick={() => setStep(4)} className="text-xs text-brand hover:underline cursor-pointer">Edit</button>
                </div>
                <div className="space-y-2 text-sm">
                  <div><p className="text-text-muted text-xs">Level</p><p className="text-text capitalize">{experienceType === "fresher" ? "New / Fresher" : "Experienced"}</p></div>
                  {experienceType === "experienced" && experienceFileName && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-trust flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-text-muted">Experience Document:</span>
                      <span className="text-text truncate">{experienceFileName}</span>
                    </div>
                  )}
                  {experienceDescription && <div><p className="text-text-muted text-xs">Description</p><p className="text-text">{experienceDescription}</p></div>}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-gold/5 border border-gold/20">
                <svg className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-text-muted">After submission, our admin team will review your documents and profile. You&apos;ll receive an email once your application is approved. This typically takes 1–3 business days.</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 mt-auto">
            {step > 1 && (
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>Back</Button>
            )}
            {step === 5 ? (
              <Button type="button" variant="gold" className="flex-1" disabled={isLoading} onClick={handleSubmit}>
                {isLoading ? "Submitting..." : "Submit Application"}
              </Button>
            ) : (
              <Button type="submit" variant="gold" className="flex-1">Continue</Button>
            )}
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
