"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  GraduationCap,
  BookOpen,
  Globe,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { LANGUAGES, getLevelsForLanguage } from "@/lib/languages";

const EXPERIENCE_LEVELS = [
  { value: "FRESHER", label: "New Teacher", desc: "Just starting my teaching journey" },
  { value: "EXPERIENCED", label: "Experienced", desc: "I have teaching experience" },
];

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER";
  avatarUrl: string | null;
  emailVerified: boolean;
  languageToLearn?: string;
  proficiencyLevel?: string;
  status?: string;
  bio?: string;
  gender?: string;
  language?: string;
  experienceLevel?: string;
};

function StatusBadge({ status }: { status: string | undefined; }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    ACTIVE:               { label: "Active",               icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: "bg-success/10 text-success border-success/20" },
    PENDING:              { label: "Pending Review",        icon: <Clock className="w-3.5 h-3.5" />,        cls: "bg-warning/10 text-warning border-warning/20" },
    INTERVIEW_SCHEDULED:  { label: "Interview Scheduled",   icon: <Clock className="w-3.5 h-3.5" />,        cls: "bg-brand/10 text-brand border-brand/20" },
    APPROVED:             { label: "Approved",              icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: "bg-success/10 text-success border-success/20" },
    REJECTED:             { label: "Rejected",              icon: <XCircle className="w-3.5 h-3.5" />,      cls: "bg-danger/10 text-danger border-danger/20" },
  };
  const badge = map[status ?? ""] ?? { label: status ?? "Unknown", icon: null, cls: "bg-surface-inset text-text-muted border-border" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}>
      {badge.icon}{badge.label}
    </span>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [languageToLearn, setLanguageToLearn] = useState("");
  const [proficiencyLevel, setProficiencyLevel] = useState("");
  const [language, setLanguage] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => {
        if (r.status === 401) { router.replace("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setProfile(data);
        setName(data.name ?? "");
        setLanguageToLearn(data.languageToLearn ?? "");
        setProficiencyLevel(data.proficiencyLevel ?? "");
        setLanguage(data.language ?? "");
        setBio(data.bio ?? "");
        setGender(data.gender ?? "");
        setExperienceLevel(data.experienceLevel ?? "");
        setLoading(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    const body =
      profile?.role === "STUDENT"
        ? { name, role: "STUDENT", languageToLearn, proficiencyLevel }
        : { name, role: "TEACHER", language, bio, gender, experienceLevel };

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes.");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-border border-t-brand animate-spin" />
          <p className="text-text-muted text-sm">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const isStudent = profile?.role === "STUDENT";


  return (
    <div className="min-h-screen bg-bg">
      {/* Top nav bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/80 backdrop-blur-md px-6 py-4">
        <Link
          href={isStudent ? "http://localhost:3002/dashboard" : "/teacher/dashboard"}
          className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <span className="text-sm font-semibold text-text">My Profile</span>
        <div className="w-24" /> {/* spacer */}
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10">
        <form onSubmit={handleSave} className="space-y-6">
          {/* ── Identity Card ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-surface p-6"
          >
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="relative flex-none">
                {profile?.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt="Profile photo"
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
              </div>

              {/* Identity info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="font-display text-xl font-bold text-text truncate">{name || "—"}</h1>
                </div>
                <p className="text-sm text-text-muted mb-3 truncate">{profile?.email}</p>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      isStudent
                        ? "bg-gold/10 text-gold border-gold/20"
                        : "bg-brand/10 text-brand border-brand/20"
                    }`}
                  >
                    {isStudent ? (
                      <GraduationCap className="w-3.5 h-3.5" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5" />
                    )}
                    {isStudent ? "Student" : "Teacher"}
                  </span>
                  <StatusBadge status={profile?.status} />
                  {profile?.emailVerified && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-success/10 text-success border-success/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Email verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Personal Info ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-border bg-surface p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-text pb-3 border-b border-border">
              Personal Information
            </h2>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Full Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                minLength={2}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Email Address</label>
              <Input
                type="email"
                value={profile?.email ?? ""}
                readOnly
                className="opacity-50 cursor-not-allowed"
                tabIndex={-1}
              />
              <p className="text-xs text-text-subtle">Email cannot be changed here.</p>
            </div>
          </motion.div>

          {/* ── Student Preferences ─────────────────────────── */}
          {isStudent && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-border bg-surface p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-text pb-3 border-b border-border flex items-center gap-2">
                <Globe className="w-4 h-4 text-gold" />
                Learning Preferences
              </h2>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text">Language to Learn</label>
                <select
                  className="w-full rounded-xl border border-border bg-surface-inset text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
                  value={languageToLearn}
                  onChange={(e) => setLanguageToLearn(e.target.value)}
                  required
                >
                  <option value="">Select a language…</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.name}>{l.flag} {l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">Proficiency Level</label>
                <select
                  value={proficiencyLevel}
                  onChange={(e) => setProficiencyLevel(e.target.value)}
                  disabled={!languageToLearn}
                  className="w-full rounded-xl border border-border bg-surface text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-colors"
                >
                  <option value="">{languageToLearn ? "Select your level..." : "Pick language first"}</option>
                  {getLevelsForLanguage(languageToLearn).map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}

          {/* ── Teacher Details ─────────────────────────────── */}
          {!isStudent && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-border bg-surface p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-text pb-3 border-b border-border flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                Teaching Details
              </h2>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text">Language You Teach</label>
                <select
                  className="w-full rounded-xl border border-border bg-surface-inset text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  required
                >
                  <option value="">Select a language…</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
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
                  className="w-full rounded-xl border border-border bg-surface-inset text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors"
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
                  className="w-full rounded-xl border border-border bg-surface-inset text-text px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors resize-none"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students about yourself, your teaching style, and experience…"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-text-subtle text-right">{bio.length}/500</p>
              </div>
            </motion.div>
          )}

          {/* ── Save Actions ────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col gap-3"
          >
            {error && (
              <div className="px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-3 rounded-lg bg-success/10 border border-success/30 text-success text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                Profile saved successfully!
              </div>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                variant={isStudent ? "gold" : "primary"}
                disabled={saving}
                className="min-w-[160px]"
              >
                {saving ? "Saving…" : "Save Changes"}
                {!saving && <Check className="w-4 h-4 ml-1.5" />}
              </Button>
            </div>
          </motion.div>
        </form>
      </div>
    </div>
  );
}
