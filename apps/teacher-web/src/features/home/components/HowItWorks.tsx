"use client";

import React, { useRef } from "react";
import { Search, CalendarCheck, Coins, Video } from "lucide-react";
import { motion, useInView } from "framer-motion";

const steps = [
  {
    icon: Search,
    title: "Discover",
    step: "01",
    description: "Find the perfect teacher by language, timezone, price, and rating.",
    color: "text-accent",
    glow: "shadow-accent/20",
    bg: "bg-accent/10",
  },
  {
    icon: CalendarCheck,
    title: "Book",
    step: "02",
    description: "Choose an open slot. We lock it instantly to prevent double-booking.",
    color: "text-success",
    glow: "shadow-success/20",
    bg: "bg-success/10",
  },
  {
    icon: Coins,
    title: "Pay seamlessly",
    step: "03",
    description: "Use your platform coin wallet. Simple, upfront pricing with no hidden fees.",
    color: "text-gold",
    glow: "shadow-gold/20",
    bg: "bg-gold/10",
  },
  {
    icon: Video,
    title: "Learn live",
    step: "04",
    description: "Join your custom video classroom directly from your dashboard.",
    color: "text-danger",
    glow: "shadow-danger/20",
    bg: "bg-danger/10",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

const lineVariants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 1.2, delay: 0.2 },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
};

export default function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-28 bg-surface-2 border-y border-border overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={headerVariants}
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text mb-5 leading-tight">
            How Language Metrics Works
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            From finding a teacher to saying your first words, we&apos;ve made the process completely frictionless.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative" ref={ref}>

          {/* Animated connecting line */}
          <motion.div
            className="hidden md:block absolute top-[52px] left-[12%] right-[12%] h-px bg-gradient-to-r from-accent via-gold to-danger origin-left z-0"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={lineVariants}
          />

          {/* Dotted track behind */}
          <div className="hidden md:block absolute top-[52px] left-[12%] right-[12%] h-px border-t border-dashed border-border z-0 opacity-40" />

          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-10 relative z-10"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
          >
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="flex flex-col items-center text-center group"
              >
                {/* Icon ring */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className={`relative w-[104px] h-[104px] rounded-full bg-surface border-4 border-surface-2 flex items-center justify-center shadow-xl ${step.glow} mb-6`}
                >
                  {/* Glowing ring on hover */}
                  <span className={`absolute inset-0 rounded-full ${step.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                  {/* Step number badge */}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-border text-[10px] font-bold text-text-muted flex items-center justify-center z-10">
                    {step.step}
                  </span>

                  <step.icon className={`w-10 h-10 relative z-10 ${step.color} transition-transform duration-300 group-hover:scale-110`} />
                </motion.div>

                {/* Pulse dot on the line */}
                <div className="hidden md:block absolute top-[44px] w-4 h-4">
                  <span className={`absolute inset-0 rounded-full ${step.bg} animate-ping opacity-60`} />
                  <span className={`relative block w-4 h-4 rounded-full ${step.bg} border-2 border-current ${step.color}`} />
                </div>

                <h3 className="text-xl font-bold text-text mb-2 group-hover:text-gold transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed max-w-[200px]">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
