"use client";

import React, { useState } from "react";
import { Check, HelpCircle, ChevronDown, Sparkles, Zap, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

const pricingPlans = [
  {
    name: "Demo Class",
    price: "₹29",
    priceSub: "one-time",
    popular: false,
    icon: Zap,
    description: "Required before booking hourly or course sessions. A 30-min trial with any teacher to see if it's the right fit.",
    features: [
      "30-minute live class with your chosen teacher",
      "Runs on our custom video system (not Google Meet)",
      "Recorded automatically",
      "No obligation to continue after demo",
      "Full ₹29 goes to the platform (not teacher)",
    ],
    cta: "Book a Demo",
    ctaHref: "/register/student",
    ctaVariant: "outline" as const,
  },
  {
    name: "Hourly Learning",
    price: "₹500–₹600",
    priceSub: "per hour",
    popular: true,
    icon: Sparkles,
    description: "Pay per session at your teacher's rate. Flexible, no long-term commitment.",
    features: [
      "1-on-1 live class with your chosen teacher",
      "Rates set by each teacher (₹500–₹600/hr typical)",
      "Custom LiveKit video classroom — whiteboard & screen share included",
      "Automatic class recording",
      "Pay per session — no subscription required",
    ],
    cta: "Find a Teacher",
    ctaHref: "/register/student",
    ctaVariant: "gold" as const,
  },
  {
    name: "Full Course",
    price: "₹15,000–₹30,000",
    priceSub: "per level, one-time",
    popular: false,
    icon: BookOpen,
    description: "Complete a full language proficiency level. Pay once upfront — teacher is paid in installments as the course progresses.",
    features: [
      "Complete language level (e.g. Beginner → Intermediate)",
      "One-time upfront payment",
      "Teacher paid in installments as course progresses",
      "All classes recorded automatically",
      "Schedule managed from your dashboard",
    ],
    cta: "Explore Courses",
    ctaHref: "/register/student",
    ctaVariant: "outline" as const,
  },
];

const faqs = [
  {
    q: "Why does the ₹29 demo fee go to the platform, not the teacher?",
    a: "The ₹29 demo fee goes 100% to the platform — not the teacher. This structure prevents ghosting and abuse (students not showing up to free trials), and ensures both teacher and student are committed to the session.",
  },
  {
    q: "How are payments collected?",
    a: "Payments are collected directly on the platform via UPI, credit/debit card, or net banking — powered by a secure payment gateway. You never pay a teacher outside the platform.",
  },
  {
    q: "Can I get a recording of my class?",
    a: "Yes. All classes are automatically recorded. Students can request access to their own class recordings as an optional subscription add-on.",
  },
  {
    q: "What if I want to cancel a session?",
    a: "Cancellation policies are enforced on the platform. If the teacher cancels, your payment is refunded in full. Student cancellation terms depend on how far in advance you cancel.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section id="pricing" className="py-28 bg-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-success/30 bg-success/5 text-success text-xs font-semibold uppercase tracking-widest mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Transparent Pricing
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text mb-5 leading-tight">
            Simple, upfront pricing for students
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Start with a ₹29 demo class. Then choose hourly sessions or a full course — you decide the pace.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
        >
          {pricingPlans.map((plan, idx) => (
            <motion.div
              key={idx}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`relative flex flex-col rounded-2xl border bg-surface p-8 shadow-sm transition-all duration-300 hover:shadow-lg group ${
                plan.popular
                  ? "border-gold ring-2 ring-gold/20 shadow-glow-gold"
                  : "border-border hover:border-border-strong"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </div>
              )}

              <div className="mb-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.popular ? "bg-gold/10 text-gold" : "bg-surface-inset text-text-muted"}`}>
                  <plan.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-text mb-1">{plan.name}</h3>
                <p className="text-sm text-text-muted mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display font-bold text-text group-hover:text-gold transition-colors duration-300">
                    {plan.price}
                  </span>
                  <span className="text-sm text-text-muted">{plan.priceSub}</span>
                </div>
              </div>

              <div className="flex-1 space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1 rounded-full shrink-0 ${plan.popular ? "bg-gold/10" : "bg-surface-inset"}`}>
                      <Check className={`w-3.5 h-3.5 ${plan.popular ? "text-gold" : "text-text-muted"}`} />
                    </div>
                    <span className="text-text-muted text-sm leading-snug">{f}</span>
                  </div>
                ))}
              </div>

              <Button asChild variant={plan.ctaVariant} className="w-full">
                <Link href={plan.ctaHref}>{plan.cta}</Link>
              </Button>
            </motion.div>
          ))}
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-8 justify-center">
            <HelpCircle className="w-6 h-6 text-gold" />
            <h3 className="text-2xl font-display font-bold text-text">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className={`border rounded-xl bg-surface overflow-hidden transition-all duration-300 ${
                  openFaq === idx ? "border-gold/40 shadow-sm" : "border-border hover:border-gold/30"
                }`}
              >
                <button
                  className="w-full text-left px-6 py-5 flex items-center justify-between focus:outline-none group"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span className="font-semibold text-text group-hover:text-gold transition-colors duration-200">{faq.q}</span>
                  <motion.div
                    animate={{ rotate: openFaq === idx ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <ChevronDown className="w-5 h-5 text-text-muted" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-text-muted leading-relaxed border-t border-border pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
