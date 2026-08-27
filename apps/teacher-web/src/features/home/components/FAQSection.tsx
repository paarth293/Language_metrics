"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function FAQSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 bg-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-8 justify-center">
            <HelpCircle className="w-6 h-6 text-gold" />
            <h2 className="text-2xl font-display font-bold text-text">Frequently Asked Questions</h2>
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
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 text-left transition-colors duration-200"
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
                      transition={{ duration: 0.3, ease: "easeInOut" as const }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 sm:px-6 pb-4 sm:pb-5 text-text-muted leading-relaxed text-sm sm:text-base border-t border-border/50 pt-3 sm:pt-4">
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
