"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { LANGUAGES, getLevelsForLanguage, type LanguageLevel } from "@/lib/languages";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("");
  const [proficiencyLevel, setProficiencyLevel] = useState("");

  useEffect(() => {
    if (user) {
      setLoading(false);
    }
  }, [user, router]);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/students/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ languageToLearn: language, proficiencyLevel, onboardingComplete: true }),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      await refreshUser();
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-gold" : "bg-border"}`} />
          ))}
          <span className="ml-auto text-xs text-text-muted font-medium">Step {step} of 2</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/10 text-gold mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h1 className="font-display text-3xl font-bold text-text mb-2">What do you want to learn?</h1>
              <p className="text-text-muted mb-6">Choose the language you&apos;d like to study.</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLanguage(l.name.toLowerCase()); setProficiencyLevel(""); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      language === l.name.toLowerCase()
                        ? "border-gold bg-gold/10 shadow-glow-gold"
                        : "border-border bg-surface hover:border-gold/40"
                    }`}
                  >
                    <span className="text-xl">{l.flag}</span>
                    <span className="text-sm font-medium text-text">{l.name}</span>
                  </button>
                ))}
              </div>

              {error && <p className="text-danger text-sm mt-4">{error}</p>}

              <button
                onClick={() => setStep(2)}
                disabled={!language}
                className="w-full mt-6 py-3 rounded-xl bg-gold text-navy font-semibold text-sm hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 text-brand mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h1 className="font-display text-3xl font-bold text-text mb-2">Your current level</h1>
              <p className="text-text-muted mb-6">Help us match you with the right teacher.</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {getLevelsForLanguage(language).map((lvl: LanguageLevel) => (
                  <button
                    key={lvl.value}
                    onClick={() => setProficiencyLevel(lvl.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      proficiencyLevel === lvl.value
                        ? "border-brand bg-brand/10 shadow-glow-blue"
                        : "border-border bg-surface hover:border-brand/40"
                    }`}
                  >
                    <span className="text-lg font-bold text-brand">{lvl.shortLabel}</span>
                    <span className="text-xs font-semibold text-text text-center">{lvl.label}</span>
                    <span className="text-[10px] text-text-muted text-center">{lvl.description}</span>
                  </button>
                ))}
              </div>

              {error && <p className="text-danger text-sm mt-4">{error}</p>}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="py-3 px-4 rounded-xl border border-border text-text font-medium text-sm hover:bg-surface-inset transition-all">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !proficiencyLevel}
                  className="flex-1 py-3 rounded-xl bg-gold text-navy font-semibold text-sm hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Complete Setup <Check className="w-4 h-4" /></>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
