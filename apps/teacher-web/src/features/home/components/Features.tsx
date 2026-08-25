"use client";

import React from "react";
import { SlidersHorizontal, Lock, MessageSquare, Clock, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: SlidersHorizontal,
    title: "Smart Teacher Discovery",
    description:
      "Filter teachers by language, hourly budget, availability, teacher gender preference, and experience level (Fresher or Experienced) — all in one place.",
    span: 2,
  },
  {
    icon: Lock,
    title: "Private by Design",
    description:
      "No phone numbers. No email addresses. Teacher contact info is never visible to students — keeping every interaction safe and on-platform.",
    span: 1,
  },
  {
    icon: MessageSquare,
    title: "1-on-1 In-App Chat",
    description:
      "Chat directly with your teacher inside the platform. Share notes, PDFs, worksheets, and Google Drive links — all in one thread.",
    span: 1,
  },
  {
    icon: Clock,
    title: "Timezone-Smart Scheduling",
    description:
      "We translate every teacher's availability into your local timezone automatically, so scheduling is always confusion-free.",
    span: 1,
  },
  {
    icon: BookOpen,
    title: "Class Recordings",
    description:
      "All classes are recorded automatically. Students can request access to their own recordings as an optional add-on subscription.",
    span: 1,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5 },
  },
};

export default function Features() {
  return (
    <section id="students" className="py-28 bg-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-muted/30 bg-brand-subtle text-brand text-xs font-semibold uppercase tracking-widest mb-6">
            Platform Features
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-brand mb-5 leading-tight">
            Built for real language learning
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Everything a student needs — from discovering the right teacher to managing their entire learning journey — on one secure platform.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`relative group rounded-2xl overflow-hidden border border-border bg-surface p-6 md:p-8 shadow-sm hover:shadow-lg hover:border-border-strong transition-all duration-300 cursor-default ${feature.span === 2 ? "md:col-span-2" : ""}`}
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <motion.div
                  whileHover={{ rotate: 8, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="w-12 h-12 rounded-xl bg-brand-subtle flex items-center justify-center text-brand mb-6"
                >
                  <feature.icon className="w-6 h-6" />
                </motion.div>
                <h3 className={`${feature.span === 2 ? "text-2xl" : "text-xl"} font-bold text-text mb-3 group-hover:text-brand-hover transition-colors duration-300`}>
                  {feature.title}
                </h3>
                <p className="text-text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
