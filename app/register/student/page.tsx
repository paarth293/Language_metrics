"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, Globe, ArrowRight, Check, AlertCircle, ChevronDown,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Dropdown data ──────────────────────────────────────────────────────────

const LANGUAGES = [
  "English", "Hindi", "Spanish", "French", "German", "Japanese",
  "Mandarin Chinese", "Arabic", "Korean", "Italian", "Portuguese",
  "Russian", "Turkish", "Dutch", "Bengali", "Tamil", "Telugu",
  "Marathi", "Punjabi", "Gujarati",
];

const CLASS_OPTIONS = [
  { value: "class_1", label: "Class 1" },
  { value: "class_2", label: "Class 2" },
  { value: "class_3", label: "Class 3" },
  { value: "class_4", label: "Class 4" },
  { value: "class_5", label: "Class 5" },
  { value: "class_6", label: "Class 6" },
  { value: "class_7", label: "Class 7" },
  { value: "class_8", label: "Class 8" },
  { value: "class_9", label: "Class 9" },
  { value: "class_10", label: "Class 10" },
  { value: "class_11", label: "Class 11" },
  { value: "class_12", label: "Class 12" },
  { value: "ug_year1", label: "Undergraduate — Year 1" },
  { value: "ug_year2", label: "Undergraduate — Year 2" },
  { value: "ug_year3", label: "Undergraduate — Year 3" },
  { value: "ug_year4", label: "Undergraduate — Year 4" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "professional", label: "Working Professional" },
  { value: "other", label: "Other" },
];

const GRADE_OPTIONS = [
  { value: "cbse", label: "CBSE" },
  { value: "icse", label: "ICSE / ISC" },
  { value: "state_board", label: "State Board" },
  { value: "ib", label: "IB (International Baccalaureate)" },
  { value: "igcse", label: "IGCSE / Cambridge" },
  { value: "university", label: "University / College" },
  { value: "na", label: "Not Applicable" },
];

const PROFICIENCY_LEVELS = [
  { value: "beginner", label: "Beginner", desc: "Starting from scratch" },
  { value: "elementary", label: "Elementary", desc: "Know some basics" },
  { value: "intermediate", label: "Intermediate", desc: "Can hold simple conversations" },
  { value: "advanced", label: "Advanced", desc: "Fluent, want to perfect" },
];

// ─── Generic Dropdown component ─────────────────────────────────────────────

function Dropdown({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-navy/70 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen(!open)}
          className="input-field flex items-center justify-between cursor-pointer text-left"
        >
          <span className={selected ? "text-ink" : "text-muted opacity-70"}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-navy/40 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 mt-1 w-full bg-cream border border-navy/10 rounded-xl shadow-navy-md overflow-hidden"
            >
              <div className="max-h-52 overflow-y-auto py-1">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-navy/5 transition-colors ${
                      value === opt.value ? "text-gold font-semibold bg-gold/5" : "text-navy/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RegisterStudentPage() {
  const { login, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Redirect already-signed-in users to their dashboard.
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === "TEACHER") router.replace("/teacher/dashboard");
    else if (user.role === "ADMIN") router.replace("/admin/dashboard");
    else router.replace("/student/dashboard");
  }, [user, authLoading, router]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    languageToLearn: "",
    proficiencyLevel: "beginner",
    studentClass: "",
    studentGrade: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleNext = () => {
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.languageToLearn) { setError("Please select a language."); return; }
    if (!form.studentClass)     { setError("Please select your class."); return; }
    if (!form.studentGrade)     { setError("Please select your grade/board."); return; }
    setError("");
    setIsLoading(true);
    try {
      const res = await authApi.registerStudent({
        name: form.name,
        email: form.email,
        password: form.password,
        languageToLearn: form.languageToLearn,
        proficiencyLevel: form.proficiencyLevel,
      });
      login(res.data.token, res.data.user);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex">
      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy relative overflow-hidden flex-col items-center justify-center p-12">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, #f8f4ea0a 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

        {/* Floating words */}
        {["Bonjour", "こんにちは", "Hola", "Namaste", "Ciao", "Merhaba"].map((word, i) => (
          <motion.span
            key={i}
            className="font-script text-cream absolute"
            style={{
              opacity: 0.07,
              fontSize: `${1.2 + (i % 3) * 0.4}rem`,
              left: `${10 + (i * 15) % 70}%`,
              top: `${15 + (i * 13) % 70}%`,
            }}
            animate={{ y: [0, -16, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 5 + i, delay: i * 0.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {word}
          </motion.span>
        ))}

        <div className="relative z-10 text-center max-w-sm">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="text-5xl mb-6">🎓</div>
            <h2 className="font-display font-bold text-cream text-3xl mb-4">
              Start your language{" "}
              <span className="text-gradient-gold italic">journey today</span>
            </h2>
            <p className="text-cream/50 text-[15px] leading-relaxed mb-8">
              Join 18,000+ students learning languages with verified teachers on Language Metrics.
            </p>
            {[
              "Free registration, no credit card needed",
              "₹49 demo class to find the right teacher",
              "Custom video — no third-party apps",
              "1-on-1 personalised attention",
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3 mb-3 text-left">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-gold" />
                </div>
                <span className="text-cream/70 text-[14px]">{b}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Logo (mobile) */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <Globe className="w-4 h-4 text-gold" />
            </div>
            <span className="font-display font-semibold text-navy text-[16px]">Language Metrics</span>
          </Link>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-7">
            {[
              { s: 1, label: "Your info" },
              { s: 2, label: "Language & Class" },
            ].map(({ s, label }, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-300 ${
                    s < step ? "bg-gold text-white" : s === step ? "bg-navy text-cream" : "bg-navy/10 text-navy/40"
                  }`}
                >
                  {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                <span className={`text-[12px] font-medium ${s === step ? "text-navy" : "text-navy/40"}`}>
                  {label}
                </span>
                {idx < 1 && <div className="w-8 h-px bg-navy/15 mx-1" />}
              </div>
            ))}
          </div>

          <div className="mb-6">
            <h1 className="font-display font-bold text-navy text-3xl mb-2">
              {step === 1 ? "Create your account" : "Language & class details"}
            </h1>
            <p className="text-navy/60 text-[15px]">
              Already have an account?{" "}
              <Link href="/login" className="text-gold font-semibold hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-[14px]">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── STEP 1: Basic info ── */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="s-name" className="block text-[13px] font-semibold text-navy/70 mb-1.5">Full name</label>
                  <input
                    id="s-name" type="text" autoComplete="name" required
                    value={form.name} onChange={(e) => set("name", e.target.value)}
                    placeholder="Aarav Singh" className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="s-email" className="block text-[13px] font-semibold text-navy/70 mb-1.5">Email address</label>
                  <input
                    id="s-email" type="email" autoComplete="email" required
                    value={form.email} onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com" className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="s-password" className="block text-[13px] font-semibold text-navy/70 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      id="s-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                      value={form.password} onChange={(e) => set("password", e.target.value)}
                      placeholder="Min. 8 characters" className="input-field pr-11"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-navy/40 hover:text-navy">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button" onClick={handleNext}
                  className="btn-primary w-full py-3.5 text-[15px] font-semibold flex items-center justify-center gap-2 group"
                  id="register-student-next"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: Language, class, grade, proficiency ── */}
            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit} className="space-y-4"
              >
                {/* Language dropdown */}
                <Dropdown
                  id="language-select"
                  label="Language you want to learn"
                  placeholder="Select a language"
                  options={LANGUAGES.map((l) => ({ value: l, label: l }))}
                  value={form.languageToLearn}
                  onChange={(v) => set("languageToLearn", v)}
                />

                {/* Class dropdown */}
                <Dropdown
                  id="class-select"
                  label="Your current class / level"
                  placeholder="Select your class"
                  options={CLASS_OPTIONS}
                  value={form.studentClass}
                  onChange={(v) => set("studentClass", v)}
                />

                {/* Grade / Board dropdown */}
                <Dropdown
                  id="grade-select"
                  label="Grade / Board"
                  placeholder="Select your grade or board"
                  options={GRADE_OPTIONS}
                  value={form.studentGrade}
                  onChange={(v) => set("studentGrade", v)}
                />

                {/* Proficiency level */}
                <div>
                  <label className="block text-[13px] font-semibold text-navy/70 mb-2">
                    Current language proficiency
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PROFICIENCY_LEVELS.map((level) => (
                      <button
                        key={level.value} type="button"
                        onClick={() => set("proficiencyLevel", level.value)}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                          form.proficiencyLevel === level.value
                            ? "border-gold bg-gold/8 shadow-gold-glow"
                            : "border-navy/10 hover:border-gold/40"
                        }`}
                      >
                        <div className="text-[13px] font-semibold text-navy mb-0.5">{level.label}</div>
                        <div className="text-[11px] text-navy/50">{level.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="btn-outline flex-1 py-3.5 text-[15px] font-semibold">
                    Back
                  </button>
                  <button
                    type="submit" disabled={isLoading}
                    className="btn-primary flex-1 py-3.5 text-[15px] font-semibold flex items-center justify-center gap-2 group disabled:opacity-60"
                    id="register-student-submit"
                  >
                    {isLoading
                      ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                      : <><span>Create Account</span><ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" /></>
                    }
                  </button>
                </div>

                <p className="text-[12px] text-navy/40 text-center leading-relaxed">
                  By registering you agree to our{" "}
                  <a href="#" className="text-gold hover:underline">Terms</a>{" "}and{" "}
                  <a href="#" className="text-gold hover:underline">Privacy Policy</a>
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
