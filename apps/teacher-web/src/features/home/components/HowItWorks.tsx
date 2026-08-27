"use client";

import React, { useRef } from "react";
import { Globe, SlidersHorizontal, CalendarCheck, Video, MessageSquare } from "lucide-react";
import { motion, useInView } from "framer-motion";

const steps = [
  {
    icon: Globe,
    title: "Pick Your Language",
    step: "01",
    description:
      "Select the language you want to learn and set your proficiency level — Beginner, Intermediate, or Advanced.",
    color: "text-accent",
    glow: "shadow-accent/20",
    bg: "bg-accent/10",
  },
  {
    icon: SlidersHorizontal,
    title: "Filter & Browse",
    step: "02",
    description:
      "Browse verified teachers filtered by budget, availability, teacher gender, and experience level to find your perfect match.",
    color: "text-success",
    glow: "shadow-success/20",
    bg: "bg-success/10",
  },
  {
    icon: CalendarCheck,
    title: "Book a ₹29 Demo",
    step: "03",
    description:
      "Start with a ₹29 demo class to see if the teacher is right for you — then upgrade to hourly sessions or a full course.",
    color: "text-gold",
    glow: "shadow-gold/20",
    bg: "bg-gold/10",
  },
  {
    icon: Video,
    title: "Join Live Classroom",
    step: "04",
    description:
      "Attend your class through our custom-built LiveKit video system — with whiteboard, screen sharing, and automatic recording. No Zoom, no Meet.",
    color: "text-danger",
    glow: "shadow-danger/20",
    bg: "bg-danger/10",
  },
  {
    icon: MessageSquare,
    title: "Chat & Manage",
    step: "05",
    description:
      "Message your teacher 1-on-1, share files and notes, and manage your upcoming bookings — all from your dashboard.",
    color: "text-info",
    glow: "shadow-info/20",
    bg: "bg-info/10",
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
    transition: { duration: 1.4, delay: 0.2 },
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
    <section id="how-it-works" className="py-20 bg-surface-2 border-y border-border overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={headerVariants}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-semibold uppercase tracking-widest mb-6">
            How It Works
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text mb-5 leading-tight">
            From first search to live class in minutes
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto text-balance">
            A seamless, student-first flow — from picking your language to attending your first live session.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative" ref={ref}>

          {/* Animated connecting line — 5-col layout on xl */}
          <motion.div
            className="hidden xl:block absolute top-[52px] left-[9%] right-[9%] h-px bg-gradient-to-r from-accent via-gold to-danger origin-left z-0"
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={lineVariants}
          />

          {/* Dotted track behind */}
          <div className="hidden xl:block absolute top-[52px] left-[9%] right-[9%] h-px border-t border-dashed border-border z-0 opacity-40" />

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-8 sm:gap-10 relative z-10"
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
                  className={`relative w-16 h-16 sm:w-[104px] sm:h-[104px] rounded-full bg-surface border-4 border-surface-2 flex items-center justify-center shadow-xl ${step.glow} mb-6`}
                >
                  {/* Glowing ring on hover */}
                  <span className={`absolute inset-0 rounded-full ${step.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                  {/* Step number badge */}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-border text-[10px] font-bold text-text-muted flex items-center justify-center z-10">
                    {step.step}
                  </span>

                  <step.icon className={`w-7 h-7 sm:w-10 sm:h-10 relative z-10 ${step.color} transition-transform duration-300 group-hover:scale-110`} />
                </motion.div>

                <h3 className="text-lg font-bold text-text mb-2 group-hover:text-gold transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed max-w-[190px]">
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
