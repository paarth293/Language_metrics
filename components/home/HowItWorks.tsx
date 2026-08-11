"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Search, CalendarCheck, Video, Star } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Discover Teachers",
    description:
      "Browse verified teachers filtered by language, budget, availability, and experience level.",
    color: "text-gold",
    bg: "bg-gold/10",
  },
  {
    number: "02",
    icon: CalendarCheck,
    title: "Book a Demo Class",
    description:
      "Start with a ₹49 demo session to find the right fit before committing to full courses.",
    color: "text-navy-light",
    bg: "bg-navy/8",
  },
  {
    number: "03",
    icon: Video,
    title: "Learn Live",
    description:
      "Join 1-on-1 live sessions on our custom video platform — no Google Meet, full privacy.",
    color: "text-gold",
    bg: "bg-gold/10",
  },
  {
    number: "04",
    icon: Star,
    title: "Grow Together",
    description:
      "Track progress, share notes, book repeat sessions, and build your language confidence.",
    color: "text-navy-light",
    bg: "bg-navy/8",
  },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-cream-2 overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="eyebrow-line" />
            <span className="font-script text-gold text-xl">Simple process</span>
            <span className="eyebrow-line" />
          </div>
          <h2 className="font-display font-bold text-navy mb-4" style={{ fontSize: "clamp(32px, 4vw, 52px)" }}>
            How It Works
          </h2>
          <p className="text-navy/60 text-lg max-w-xl mx-auto">
            From discovery to fluency — your language journey in four steps.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connector lines (desktop) */}
          <div className="hidden lg:block absolute top-12 left-[calc(25%-0px)] right-[calc(25%-0px)] h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent pointer-events-none" />

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative"
            >
              <div className="bg-cream border border-navy/8 rounded-2xl p-6 h-full hover:border-gold/40 hover:shadow-navy-sm transition-all duration-300 group">
                {/* Step number */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                    <step.icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                  <span className="font-display font-bold text-4xl text-navy/8 select-none">
                    {step.number}
                  </span>
                </div>

                <h3 className="font-display font-semibold text-navy text-xl mb-2">
                  {step.title}
                </h3>
                <p className="text-navy/60 text-[14px] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
