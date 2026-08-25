"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Japanese", "Korean", "Mandarin Chinese", "Arabic", "Hindi", "Russian",
  "Dutch", "Swedish", "Turkish", "Polish", "Vietnamese", "Thai",
];

const PROFICIENCY_LEVELS = [
  { value: "BEGINNER", label: "Beginner", desc: "I know little to no words", icon: BarChart3, bars: 1 },
  { value: "INTERMEDIATE", label: "Intermediate", desc: "I can hold basic conversations", icon: BarChart3, bars: 2 },
  { value: "ADVANCED", label: "Advanced", desc: "I'm nearly fluent", icon: BarChart3, bars: 3 },
];

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
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(({ user }) => {
        if (!user) { router.replace("/login"); return; }
        if (user.onboardingComplete) {
          router.replace(user.role === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard");
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
        : { name, role: "TEACHER", language, bio, gender, experienceLevel };

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
      router.push(user?.role === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard");
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

  const totalSteps = 2;
  const isStudent = user?.role === "STUDENT";

  return (
    <AuthLayout>
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
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
              <div className="flex flex-col items-center mb-8">
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
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

              <div className="mb-6">
                <h1 className="font-display text-3xl font-bold text-text mb-2">
                  Welcome! Let&apos;s get you set up
                </h1>
                <p className="text-text-muted text-sm">
                  We pulled your info from Google — feel free to update anything below.
                </p>
              </div>

              <div className="space-y-4">
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
                className="w-full mt-6"
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
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h1 className="font-display text-3xl font-bold text-text mb-2">
                What are you learning?
              </h1>
              <p className="text-text-muted text-sm mb-6">
                Tell us about your language goals so we can match you with the perfect teacher.
              </p>

              <div className="space-y-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Language to Learn</label>
                  <select
                    className="w-full rounded-xl border border-border bg-surface text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
                    value={languageToLearn}
                    onChange={(e) => setLanguageToLearn(e.target.value)}
                    required
                  >
                    <option value="">Select a language…</option>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text">Your Current Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PROFICIENCY_LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setProficiencyLevel(lvl.value)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                          proficiencyLevel === lvl.value
                            ? "border-gold bg-gold/10 shadow-glow-gold"
                            : "border-border bg-surface hover:border-gold/40 hover:bg-surface-inset"
                        }`}
                      >
                        {/* bars icon */}
                        <div className="flex items-end gap-0.5 h-5">
                          {[1, 2, 3].map((b) => (
                            <div
                              key={b}
                              className={`w-1.5 rounded-sm transition-colors ${
                                b <= lvl.bars
                                  ? proficiencyLevel === lvl.value
                                    ? "bg-gold"
                                    : "bg-text-muted"
                                  : "bg-border"
                              }`}
                              style={{ height: `${b * 5 + 5}px` }}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-text">{lvl.label}</span>
                        <span className="text-[10px] text-text-muted leading-tight">{lvl.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
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

          {/* ── Step 2 Teacher ────────────────────────────────────── */}
          {step === 2 && !isStudent && (
            <motion.div
              key="step2-teacher"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 text-brand mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h1 className="font-display text-3xl font-bold text-text mb-2">
                Tell us about your teaching
              </h1>
              <p className="text-text-muted text-sm mb-6">
                Help students discover you. This info will appear on your profile.
              </p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Language You Teach</label>
                  <select
                    className="w-full rounded-xl border border-border bg-surface text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    required
                  >
                    <option value="">Select a language…</option>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
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
                  <label className="text-sm font-medium text-text">
                    Gender{" "}
                    <span className="text-text-subtle font-normal">(optional)</span>
                  </label>
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

              <div className="flex gap-3 mt-6">
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
                  variant="primary"
                  className="flex-1"
                  disabled={submitting || !language || !experienceLevel}
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
