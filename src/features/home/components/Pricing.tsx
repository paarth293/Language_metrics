"use client";

import React, { useState } from "react";
import { Check, HelpCircle, ChevronDown, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

const packages = [
  {
    name: "Starter",
    coins: 500,
    price: "₹500",
    bonus: 0,
    popular: false,
    description: "Perfect for trying your first class",
  },
  {
    name: "Learner",
    coins: 1050,
    price: "₹1,000",
    bonus: 50,
    popular: true,
    description: "Best value for regular learners",
  },
  {
    name: "Fluency",
    coins: 2750,
    price: "₹2,500",
    bonus: 250,
    popular: false,
    description: "For committed language enthusiasts",
  },
];

const faqs = [
  {
    q: "How do coins work?",
    a: "Coins are our universal platform currency. You buy coins with your local currency and spend them to book classes with any teacher. 1 coin = ₹1.",
  },
  {
    q: "What happens if a teacher cancels?",
    a: "If a teacher cancels, 100% of the coins are instantly refunded to your wallet. If you cancel more than 12 hours in advance, you also get a full refund.",
  },
  {
    q: "Can I take a trial class?",
    a: "Yes! Most teachers offer a 30-minute demo class for a deeply discounted rate (often around 49 coins) so you can see if they are a good fit.",
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
            Simple, upfront pricing
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Top up your wallet with coins, then spend them on classes. No subscriptions, no hidden fees.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
        >
          {packages.map((pkg, idx) => (
            <motion.div
              key={idx}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`relative flex flex-col rounded-2xl border bg-surface p-8 shadow-sm transition-all duration-300 hover:shadow-lg group ${
                pkg.popular ? 'border-gold ring-2 ring-gold/20 shadow-glow-gold' : 'border-border hover:border-border-strong'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-text mb-1">{pkg.name}</h3>
                <p className="text-sm text-text-muted mb-4">{pkg.description}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-display font-bold text-text group-hover:text-gold transition-colors duration-300">{pkg.price}</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-gold/10 p-1.5 rounded-full"><Check className="w-4 h-4 text-gold" /></div>
                  <span className="text-text font-medium flex items-center gap-1">
                    <span className="text-gold">🪙</span> {pkg.coins} Coins
                  </span>
                </div>
                {pkg.bonus > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="bg-success/10 p-1.5 rounded-full"><Check className="w-4 h-4 text-success" /></div>
                    <span className="text-success text-sm font-semibold">+{pkg.bonus} Bonus Coins</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="bg-surface-inset p-1.5 rounded-full"><Check className="w-4 h-4 text-text-muted" /></div>
                  <span className="text-text-muted text-sm">Never expires</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-surface-inset p-1.5 rounded-full"><Check className="w-4 h-4 text-text-muted" /></div>
                  <span className="text-text-muted text-sm">Instant refund on cancellation</span>
                </div>
              </div>

              <Button variant={pkg.popular ? "gold" : "outline"} className="w-full">
                Buy Coins
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
                  openFaq === idx ? 'border-gold/40 shadow-sm' : 'border-border hover:border-gold/30'
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
