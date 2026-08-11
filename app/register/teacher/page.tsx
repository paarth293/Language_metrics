"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, Globe, ArrowRight, Check, AlertCircle,
  Briefcase, GraduationCap, Upload, X, FileText, ShieldCheck,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Experience type options ────────────────────────────────────────────────

const EXPERIENCE_TYPES = [
  {
    value: "fresher",
    icon: GraduationCap,
    title: "Fresher Teacher",
    description:
      "Strong language skills but new to formal teaching. No experience letter required.",
    benefits: [
      "Free coins equal to registration fee on approval",
      "Admin guidance during onboarding",
      "Inclusive verification process",
    ],
    requiredDocs: ["educationCert", "languageCert"],
  },
  {
    value: "experienced",
    icon: Briefcase,
    title: "Experienced Teacher",
    description:
      "Prior teaching experience with documents to prove it. Faster profile activation.",
    benefits: [
      "Faster verification process",
      "Higher visibility in search results",
      "Premium Verified Teacher badge",
    ],
    requiredDocs: ["educationCert", "languageCert", "experienceLetter"],
  },
];

// ─── File Upload component ───────────────────────────────────────────────────

function FileUpload({
  id,
  label,
  hint,
  accept,
  file,
  onChange,
  required,
}: {
  id: string;
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="block text-[13px] font-semibold text-navy/70 mb-1.5">
        {label}
        {required && <span className="text-gold ml-1">*</span>}
      </label>

      {file ? (
        /* File chosen — show pill */
        <div className="flex items-center gap-3 bg-gold/8 border border-gold/30 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-navy truncate">{file.name}</p>
            <p className="text-[11px] text-navy/50">
              {(file.size / 1024).toFixed(0)} KB · Ready to upload
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="w-6 h-6 rounded-full bg-navy/10 hover:bg-red-100 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-navy/60 hover:text-red-500" />
          </button>
        </div>
      ) : (
        /* Drop zone */
        <button
          type="button"
          id={id}
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-navy/15 hover:border-gold/50 rounded-xl px-4 py-5 flex flex-col items-center gap-2 transition-all duration-200 hover:bg-gold/3 group"
        >
          <div className="w-9 h-9 rounded-xl bg-navy/5 group-hover:bg-gold/10 flex items-center justify-center transition-colors">
            <Upload className="w-4 h-4 text-navy/40 group-hover:text-gold transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-navy/60 group-hover:text-navy transition-colors">
              Click to upload
            </p>
            <p className="text-[11px] text-navy/40 mt-0.5">{hint}</p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RegisterTeacherPage() {
  const { login, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Revisiting users who are already signed in shouldn't see the apply form.
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
    experienceType: "",
  });
  const [docs, setDocs] = useState<{
    educationCert: File | null;
    languageCert: File | null;
    experienceLetter: File | null;
  }>({
    educationCert: null,
    languageCert: null,
    experienceLetter: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setDoc = (field: keyof typeof docs, file: File | null) =>
    setDocs((prev) => ({ ...prev, [field]: file }));

  const selectedType = EXPERIENCE_TYPES.find((t) => t.value === form.experienceType);

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

  const handleNextToStep3 = () => {
    if (!form.experienceType) {
      setError("Please select your experience type.");
      return;
    }
    setError("");
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required docs
    if (!docs.educationCert) {
      setError("Please upload your education qualification certificate.");
      return;
    }
    if (!docs.languageCert) {
      setError("Please upload your language proficiency certificate.");
      return;
    }
    if (form.experienceType === "experienced" && !docs.experienceLetter) {
      setError("Experienced teachers must upload an experience letter.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const res = await authApi.registerTeacher({
        name: form.name,
        email: form.email,
        password: form.password,
        experienceType: form.experienceType,
      });
      login(res.data.token, res.data.user);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const STEPS = [
    { s: 1, label: "Your info" },
    { s: 2, label: "Experience type" },
    { s: 3, label: "Documents" },
  ];

  return (
    <div className="min-h-screen bg-cream flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy relative overflow-hidden flex-col items-center justify-center p-12">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, #f8f4ea0a 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-gold/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-sm">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="text-5xl mb-6">👩‍🏫</div>
            <h2 className="font-display font-bold text-cream text-3xl mb-4">
              Teach on{" "}
              <span className="text-gradient-gold italic">Language Metrics</span>
            </h2>
            <p className="text-cream/50 text-[15px] leading-relaxed mb-8">
              Join 2,400+ verified teachers earning from their language expertise.
            </p>

            {[
              { icon: "💰", title: "Set your own rates", desc: "₹400–₹1,200+ per hour" },
              { icon: "📅", title: "Flexible schedule", desc: "You choose your availability" },
              { icon: "🎥", title: "Custom video platform", desc: "Built-in recording & screen share" },
            ].map((item, i) => (
              <div key={i} className="glass-dark p-4 rounded-xl flex items-start gap-3 mb-3 text-left">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="text-cream text-[13px] font-semibold">{item.title}</div>
                  <div className="text-cream/50 text-[12px]">{item.desc}</div>
                </div>
              </div>
            ))}

            {/* Verification badge */}
            <div className="mt-6 flex items-center gap-2 justify-center">
              <ShieldCheck className="w-4 h-4 text-gold" />
              <p className="text-cream/30 text-[12px]">
                Registration fee ₹399 — charged only after approval
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md py-8"
        >
          {/* Logo (mobile) */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <Globe className="w-4 h-4 text-gold" />
            </div>
            <span className="font-display font-semibold text-navy text-[16px]">Language Metrics</span>
          </Link>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mb-7">
            {STEPS.map(({ s, label }, idx) => (
              <div key={s} className="flex items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-300 ${
                    s < step ? "bg-gold text-white" : s === step ? "bg-navy text-cream" : "bg-navy/10 text-navy/40"
                  }`}
                >
                  {s < step ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                <span className={`text-[11px] font-medium hidden sm:inline ${s === step ? "text-navy" : "text-navy/40"}`}>
                  {label}
                </span>
                {idx < STEPS.length - 1 && <div className="w-5 h-px bg-navy/15 mx-1" />}
              </div>
            ))}
          </div>

          <div className="mb-6">
            <h1 className="font-display font-bold text-navy text-3xl mb-2">
              {step === 1 && "Apply to teach"}
              {step === 2 && "Your experience type"}
              {step === 3 && "Upload your certificates"}
            </h1>
            <p className="text-navy/60 text-[15px]">
              Already have an account?{" "}
              <Link href="/login" className="text-gold font-semibold hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Teacher verification notice — makes the teacher flow distinct from students */}
          {step === 1 && (
            <div className="flex items-start gap-3 bg-navy/5 border border-navy/10 rounded-xl px-4 py-3 mb-5">
              <ShieldCheck className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <p className="text-[13px] text-navy/70 leading-relaxed">
                This is a <strong>teacher application</strong>. You&apos;ll submit your
                qualification documents for admin review — your profile goes live only after
                verification. Looking to learn instead?{" "}
                <Link href="/register/student" className="text-gold font-semibold hover:underline">
                  Register as a student
                </Link>
                .
              </p>
            </div>
          )}

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

          <AnimatePresence mode="wait">

            {/* ── STEP 1: Basic info ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }} className="space-y-4"
              >
                <div>
                  <label htmlFor="t-name" className="block text-[13px] font-semibold text-navy/70 mb-1.5">Full name</label>
                  <input
                    id="t-name" type="text" autoComplete="name" required
                    value={form.name} onChange={(e) => set("name", e.target.value)}
                    placeholder="Your full name" className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="t-email" className="block text-[13px] font-semibold text-navy/70 mb-1.5">Email address</label>
                  <input
                    id="t-email" type="email" autoComplete="email" required
                    value={form.email} onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com" className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="t-password" className="block text-[13px] font-semibold text-navy/70 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      id="t-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
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
                  id="register-teacher-next"
                >
                  Continue <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: Experience type ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }} className="space-y-4"
              >
                <p className="text-[14px] text-navy/60 leading-relaxed -mt-1">
                  Select your teaching background — this determines your required documents.
                </p>

                {EXPERIENCE_TYPES.map((type) => (
                  <button
                    key={type.value} type="button"
                    onClick={() => set("experienceType", type.value)}
                    className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-300 group ${
                      form.experienceType === type.value
                        ? "border-gold bg-gold/5 shadow-gold-glow"
                        : "border-navy/10 hover:border-gold/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        form.experienceType === type.value ? "bg-gold text-white" : "bg-navy/8 text-navy/50"
                      }`}>
                        <type.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-semibold text-navy text-[16px]">{type.title}</span>
                          {form.experienceType === type.value && (
                            <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-navy/60 text-[13px] leading-relaxed mb-3">{type.description}</p>
                        {/* Required docs preview */}
                        <div className="mb-2">
                          <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider mb-1.5">
                            Required documents
                          </p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-gold/60" /><span className="text-[12px] text-navy/50">Education qualification certificate</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-gold/60" /><span className="text-[12px] text-navy/50">Language proficiency certificate</span></div>
                            {type.value === "experienced" && (
                              <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-gold/60" /><span className="text-[12px] text-navy/50">Experience letter</span></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="btn-outline flex-1 py-3.5 text-[15px] font-semibold">Back</button>
                  <button
                    type="button" onClick={handleNextToStep3}
                    disabled={!form.experienceType}
                    className="btn-primary flex-1 py-3.5 text-[15px] font-semibold flex items-center justify-center gap-2 group disabled:opacity-60"
                    id="register-teacher-next2"
                  >
                    Continue <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Document uploads ── */}
            {step === 3 && (
              <motion.form
                key="step3"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit} className="space-y-4"
              >
                {/* Info banner */}
                <div className="flex items-start gap-3 bg-navy/5 border border-navy/10 rounded-xl px-4 py-3">
                  <ShieldCheck className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  <p className="text-[13px] text-navy/70 leading-relaxed">
                    Documents are reviewed by our admin team before your profile goes live.
                    All files are stored securely.
                  </p>
                </div>

                {/* Education qualification */}
                <FileUpload
                  id="doc-education"
                  label="Education qualification certificate"
                  hint="Degree / diploma / marksheet — PDF, JPG, PNG (max 5 MB)"
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={docs.educationCert}
                  onChange={(f) => setDoc("educationCert", f)}
                  required
                />

                {/* Language proficiency certificate */}
                <FileUpload
                  id="doc-language"
                  label="Language proficiency certificate"
                  hint="IELTS / DELF / JLPT / any recognised cert — PDF, JPG, PNG"
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={docs.languageCert}
                  onChange={(f) => setDoc("languageCert", f)}
                  required
                />

                {/* Experience letter — only for experienced teachers */}
                {form.experienceType === "experienced" && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <FileUpload
                        id="doc-experience"
                        label="Experience letter"
                        hint="From your previous employer or institution — PDF, JPG, PNG"
                        accept=".pdf,.jpg,.jpeg,.png"
                        file={docs.experienceLetter}
                        onChange={(f) => setDoc("experienceLetter", f)}
                        required
                      />
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Selected type summary */}
                {selectedType && (
                  <div className="flex items-center gap-2 text-[13px] text-navy/50">
                    <selectedType.icon className="w-4 h-4" />
                    <span>Applying as: <strong className="text-navy">{selectedType.title}</strong></span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(2)} className="btn-outline flex-1 py-3.5 text-[15px] font-semibold">Back</button>
                  <button
                    type="submit" disabled={isLoading}
                    className="btn-primary flex-1 py-3.5 text-[15px] font-semibold flex items-center justify-center gap-2 group disabled:opacity-60"
                    id="register-teacher-submit"
                  >
                    {isLoading
                      ? <div className="w-5 h-5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                      : <><span>Submit Application</span><ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" /></>
                    }
                  </button>
                </div>

                <p className="text-[12px] text-navy/40 text-center leading-relaxed">
                  Registration fee of ₹399 is charged only after admin approval.
                </p>
              </motion.form>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
