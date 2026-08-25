"use client";

import React from "react";
import { motion } from "framer-motion";
import { FileText, CalendarClock, ShieldCheck, BadgeCheck } from "lucide-react";

const steps = [
  {
    icon: FileText,
    title: "Apply as Fresher or Experienced",
    description:
      "Teachers self-declare their experience level at signup. Both types submit their educational qualifications and language proficiency certificate. Experienced teachers additionally submit an experience letter (full-time, part-time, or freelance proof).",
    color: "text-accent",
    bg: "bg-accent/10",
    step: "01",
  },
  {
    icon: CalendarClock,
    title: "Human Interview — 5 to 6 Days",
    description:
      "After document submission, an interview date is auto-assigned within 5–6 days. The evaluation is conducted by a real human — not an automated test. No shortcuts.",
    color: "text-gold",
    bg: "bg-gold/10",
    step: "02",
  },
  {
    icon: ShieldCheck,
    title: "Admin Review & Approval",
    description:
      "Once verified, teachers pay a one-time registration fee of ₹249 upon account activation. Rejected applications are not charged.",
    color: "text-success",
    bg: "bg-success/10",
    step: "03",
  },
  {
    icon: BadgeCheck,
    title: "Verified — Ready to Teach",
    description:
      "Only teachers who clear the full process appear on student search results. Every teacher you see has been manually approved by our team — so you can book with confidence.",
    color: "text-info",
    bg: "bg-info/10",
    step: "04",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55 } },
};

export default function TeacherTrust() {
  return (
    <section className="py-28 bg-surface-2 border-y border-border overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-trust-muted/30 bg-trust-subtle text-trust text-xs font-semibold uppercase tracking-widest mb-6">
            <ShieldCheck className="w-3.5 h-3.5" /> Teacher Verification
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-brand mb-5 leading-tight">
            Every teacher is manually verified. <span className="italic font-medium">No exceptions.</span>
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            We don&apos;t let anyone teach on our platform. Before a teacher can accept your booking, they go through a rigorous multi-step verification process — document review, a language test, and a human interview.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
        >
          {steps.map((step, idx) => {
            const isHighlighted = step.step === "02";
            return (
              <motion.div
                key={idx}
                variants={itemVariants}
                className={`group flex gap-5 border rounded-2xl p-7 hover:shadow-lg transition-all duration-300 ${
                  isHighlighted 
                    ? "bg-brand-subtle border-brand-muted/35 hover:border-brand-muted/60" 
                    : "bg-surface border-border hover:border-border-strong"
                }`}
              >
                {/* Icon + step number */}
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isHighlighted ? "bg-surface text-brand" : "bg-brand-subtle text-brand"
                  }`}>
                    <step.icon className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface border border-border text-[9px] font-bold text-text-muted flex items-center justify-center">
                    {step.step}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-text mb-2 group-hover:text-brand-hover transition-colors duration-300">
                    {step.title}
                  </h3>
                  <p className="text-text-muted text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Trust callout */}
        <motion.div
          className="mt-12 max-w-2xl mx-auto text-center bg-surface border border-trust-muted/30 rounded-2xl px-8 py-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <BadgeCheck className="w-8 h-8 text-trust mx-auto mb-3" />
          <p className="text-text font-semibold text-lg mb-1">
            Zero unverified teachers on the platform.
          </p>
          <p className="text-text-muted text-sm">
            Only teachers who have passed document verification, a language proficiency test, and a manual interview can appear in your search results.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
