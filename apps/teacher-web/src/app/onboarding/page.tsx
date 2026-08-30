"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/Input";
import { FileUpload } from "@/components/ui/FileUpload";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Check,
  Globe,
  BarChart3,
} from "lucide-react";
import { TEACHING_LANGUAGES } from "@/lib/languages";
import { getLevelsForLanguage, type LanguageLevel } from "@/lib/languages";

const EXPERIENCE_LEVELS = [
  { value: "FRESHER", label: "New Teacher", desc: "Just starting my teaching journey" },
  { value: "EXPERIENCED", label: "Experienced", desc: "I have teaching experience" },
];

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

type UserData = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER";
  avatarUrl: string | null;
  onboardingComplete: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [languageToLearn, setLanguageToLearn] = useState("");
  const [proficiencyLevel, setProficiencyLevel] = useState("");
  const [language, setLanguage] = useState("");
  const [additionalLanguages, setAdditionalLanguages] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  // Toggle additional language
  const toggleAdditionalLanguage = (code: string) => {
    setAdditionalLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // Keep primary language in additional list
  useEffect(() => {
    if (language && !additionalLanguages.includes(language)) {
      setTimeout(() => {
        setAdditionalLanguages((prev) => [language, ...prev.filter((c) => c !== language)]);
      }, 0);
    }
  }, [language, additionalLanguages]);  

  // Document upload fields (teacher only)
  const [qualificationDocUrl, setQualificationDocUrl] = useState("");
  const [qualificationFileName, setQualificationFileName] = useState<string | null>(null);
  const [idProofDocUrl, setIdProofDocUrl] = useState("");
  const [idProofFileName, setIdProofFileName] = useState<string | null>(null);
  const [experienceDocUrl, setExperienceDocUrl] = useState("");
  const [experienceFileName, setExperienceFileName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) { router.replace("/login"); return; }
        if (user.onboardingComplete) {
          if (user.role === "STUDENT") {
            router.replace("/student/dashboard");
          } else {
            router.replace("/teacher/dashboard");
          }
          return;
        }
        setUser(user);
        setName(user.name ?? "");
        setLoading(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const body =
      user?.role === "STUDENT"
        ? { name, role: "STUDENT", languageToLearn, proficiencyLevel }
        : {
            name,
            role: "TEACHER",
            language,
            languages: Array.from(new Set([language, ...additionalLanguages])),
            bio,
            gender,
            experienceLevel,
            qualificationDocUrl,
            idProofDocUrl,
            experienceDocUrl: experienceDocUrl || undefined,
          };

    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      if (user?.role === "STUDENT") {
        router.replace("/student/dashboard");
      } else {
        router.push("/teacher/dashboard");
      }
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-border border-t-brand animate-spin" />
          <p className="text-text-muted text-sm">Setting up your account…</p>
        </div>
      </AuthLayout>
    );
  }

  const isStudent = user?.role === "STUDENT";
  const totalSteps = isStudent ? 2 : 4;

  return (
    <AuthLayout>
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i + 1 <= step
                ? isStudent
                  ? "w-8 bg-gold"
                  : "w-8 bg-brand"
                : "w-4 bg-border"
            }`}
          />
        ))}
        <span className="ml-auto text-xs text-text-muted font-medium">
          Step {step} of {totalSteps}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <AnimatePresence mode="wait">
          {/* ── Step 1: Identity ─────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Avatar */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative mb-4">
                  {user?.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt="Your Google profile photo"
                      width={80}
                      height={80}
                      className="w-20 h-20 rounded-full border-2 border-border object-cover"
                      unoptimized
                    />
                  ) : (
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
                        isStudent ? "bg-gold" : "bg-brand"
                      }`}
                    >
                      {name.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  {/* verified badge */}
                  <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-success border-2 border-bg flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                </div>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
                    isStudent
                      ? "bg-gold/10 text-gold"
                      : "bg-brand/10 text-brand"
                  }`}
                >
                  {isStudent ? (
                    <GraduationCap className="w-3.5 h-3.5" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5" />
                  )}
                  {isStudent ? "Student Account" : "Teacher Account"}
                </div>
              </div>

              <div className="mb-4">
                <h1 className="font-display text-2xl font-bold text-text mb-1">
                  Welcome! Let&apos;s get you set up
                </h1>
                <p className="text-text-muted text-sm">
                  We pulled your info from Google — feel free to update anything below.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Full Name</label>
                  <Input
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Email Address</label>
                  <Input
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                    className="opacity-50 cursor-not-allowed"
                    tabIndex={-1}
                  />
                  <p className="text-xs text-text-subtle">
                    Linked from your Google account — can&apos;t be changed here.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant={isStudent ? "gold" : "primary"}
                className="w-full mt-4"
                onClick={() => setStep(2)}
                disabled={name.trim().length < 2}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 2 Student ────────────────────────────────────── */}
          {step === 2 && isStudent && (
            <motion.div
              key="step2-student"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold/10 text-gold mb-3">
                <Globe className="w-5 h-5" />
              </div>
              <h1 className="font-display text-2xl font-bold text-text mb-1">
                What are you learning?
              </h1>
              <p className="text-text-muted text-sm mb-4">
                Tell us about your language goals so we can match you with the perfect teacher.
              </p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Language to Learn</label>
                  <select
                    className="w-full rounded-xl border border-border bg-surface text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
                    value={languageToLearn}
                    onChange={(e) => setLanguageToLearn(e.target.value)}
                    required
                  >
                    <option value="">Select a language…</option>
                    {TEACHING_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.name}>{l.flag} {l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text">Your Current Level</label>
                  {!languageToLearn ? (
                    <p className="text-xs text-text-muted">Select a language first to see available levels.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {getLevelsForLanguage(languageToLearn).map((lvl: LanguageLevel, idx: number) => (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => setProficiencyLevel(lvl.value)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                            proficiencyLevel === lvl.value
                              ? "border-gold bg-gold/10 shadow-glow-gold"
                              : "border-border bg-surface hover:border-gold/40 hover:bg-surface-inset"
                          }`}
                        >
                          <span className="text-lg font-bold text-brand">{lvl.shortLabel}</span>
                          <span className="text-[10px] font-semibold text-text leading-tight">{lvl.label}</span>
                          <span className="text-[9px] text-text-muted leading-tight">{lvl.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="flex-none"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="gold"
                  className="flex-1"
                  disabled={submitting || !languageToLearn || !proficiencyLevel}
                >
                  {submitting ? "Saving…" : "Complete Setup"}
                  {!submitting && <Check className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2 Teacher: Teaching Details ──────────────────── */}
          {step === 2 && !isStudent && (
            <motion.div
              key="step2-teacher"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 text-brand mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="font-display text-2xl font-bold text-text mb-1">
                Tell us about your teaching
              </h1>
              <p className="text-text-muted text-sm mb-4">
                Help students discover you. This info will appear on your profile.
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Primary Language You Teach *</label>
                  <select
                    className="w-full rounded-xl border border-border bg-surface text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    required
                  >
                    <option value="">Select primary language…</option>
                    {TEACHING_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                    ))}
                  </select>
                </div>

                {/* Additional Languages */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text">
                      Additional Languages <span className="text-text-subtle font-normal">(optional)</span>
                    </label>
                    {additionalLanguages.length > 0 && (
                      <span className="text-xs font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                        {additionalLanguages.length} selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {TEACHING_LANGUAGES.filter((l) => l.code !== language).map((lang) => {
                      const isSelected = additionalLanguages.includes(lang.code);
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => toggleAdditionalLanguage(lang.code)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer text-left ${
                            isSelected
                              ? "border-brand bg-brand/10 text-brand shadow-sm"
                              : "border-border bg-surface-inset text-text-muted hover:border-brand/30 hover:bg-surface hover:text-text"
                          }`}
                        >
                          <span className="text-base leading-none flex-shrink-0">{lang.flag}</span>
                          <span className="truncate">{lang.name}</span>
                          {isSelected && (
                            <svg className="w-3 h-3 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text">Experience Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXPERIENCE_LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setExperienceLevel(lvl.value)}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all ${
                          experienceLevel === lvl.value
                            ? "border-brand bg-brand/10 shadow-glow-blue"
                            : "border-border bg-surface hover:border-brand/40 hover:bg-surface-inset"
                        }`}
                      >
                        <span className="text-sm font-semibold text-text">{lvl.label}</span>
                        <span className="text-xs text-text-muted">{lvl.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Gender</label>
                  <select
                    className="w-full rounded-xl border border-border bg-surface text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">Prefer not to say</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">
                    Bio{" "}
                    <span className="text-text-subtle font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-border bg-surface text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors resize-none"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell students about yourself, your teaching style, and experience…"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-text-subtle text-right">{bio.length}/500</p>
                </div>
              </div>

              {error && (
                <div className="mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="flex-none"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  onClick={() => setStep(3)}
                  disabled={!language || !experienceLevel}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3 Teacher: Qualifications (Document Uploads) ── */}
          {step === 3 && !isStudent && (
            <motion.div
              key="step3-teacher-quals"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 text-brand mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="font-display text-2xl font-bold text-text mb-1">
                Upload your qualifications
              </h1>
              <p className="text-text-muted text-sm mb-4">
                These documents will be reviewed by our admin team before your account is approved.
              </p>

              <div className="space-y-4">
                <FileUpload
                  label="Qualification Certificate"
                  helperText="Upload your highest educational qualification (degree, diploma, teaching certificate, etc.)"
                  uploadedFileName={qualificationFileName}
                  onUpload={(url, filename) => {
                    setQualificationDocUrl(url);
                    setQualificationFileName(filename);
                  }}
                  onRemove={() => {
                    setQualificationDocUrl("");
                    setQualificationFileName(null);
                  }}
                />

                <FileUpload
                  label="Government-issued ID Proof"
                  helperText="Passport, Aadhaar card, driver's license, or any valid government ID"
                  uploadedFileName={idProofFileName}
                  onUpload={(url, filename) => {
                    setIdProofDocUrl(url);
                    setIdProofFileName(filename);
                  }}
                  onRemove={() => {
                    setIdProofDocUrl("");
                    setIdProofFileName(null);
                  }}
                />

                <div className="flex items-start gap-2 p-3 rounded-lg bg-brand/5 border border-brand/20">
                  <svg
                    className="w-4 h-4 text-brand mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-xs text-text-muted">
                    Your documents are securely stored and only accessible to our
                    admin team for verification purposes.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="flex-none"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  onClick={() => setStep(4)}
                  disabled={!qualificationDocUrl || !idProofDocUrl}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4 Teacher: Experience Document ───────────────── */}
          {step === 4 && !isStudent && (
            <motion.div
              key="step4-teacher-exp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand/10 text-brand mb-3">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="font-display text-2xl font-bold text-text mb-1">
                {experienceLevel === "EXPERIENCED"
                  ? "Upload experience proof"
                  : "Almost done!"}
              </h1>
              <p className="text-text-muted text-sm mb-4">
                {experienceLevel === "EXPERIENCED"
                  ? "Please upload a document verifying your teaching experience."
                  : "No experience document needed — you're all set to submit!"}
              </p>

              <div className="space-y-4">
                {experienceLevel === "EXPERIENCED" ? (
                  <FileUpload
                    label="Experience Document"
                    helperText="Experience letter, employment certificate, or similar proof of teaching experience"
                    uploadedFileName={experienceFileName}
                    onUpload={(url, filename) => {
                      setExperienceDocUrl(url);
                      setExperienceFileName(filename);
                    }}
                    onRemove={() => {
                      setExperienceDocUrl("");
                      setExperienceFileName(null);
                    }}
                  />
                ) : (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-inset border border-border">
                    <svg
                      className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-xs text-text-muted">
                      Many successful teachers start without formal experience.
                      You&apos;ll go through our verification process and can
                      begin teaching once approved.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(3)}
                  className="flex-none"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={
                    submitting ||
                    (experienceLevel === "EXPERIENCED" && !experienceDocUrl)
                  }
                >
                  {submitting ? "Saving…" : "Complete Setup"}
                  {!submitting && <Check className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </AuthLayout>
  );
}
