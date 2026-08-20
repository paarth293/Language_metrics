"use client";

import React from "react";
import { motion } from "framer-motion";
import { Video, PenLine, MonitorPlay, Mic2, Lock, Layers } from "lucide-react";

const liveFeatures = [
  {
    icon: PenLine,
    title: "Interactive Whiteboard",
    description: "Teachers draw, annotate, and write in real-time — directly inside the classroom screen. No external tools needed.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: MonitorPlay,
    title: "Screen Sharing",
    description: "Share presentations, browser tabs, or documents instantly — from within the class without switching apps.",
    color: "text-gold",
    bg: "bg-gold/10",
  },
  {
    icon: Mic2,
    title: "Auto Class Recording",
    description: "Every class is automatically recorded from the moment it begins. No manual setup by teacher or student.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: Lock,
    title: "Full Data Privacy",
    description: "No data is shared with Google, Meta, Zoom, or Jio. Recordings are stored on client-owned servers only.",
    color: "text-danger",
    bg: "bg-danger/10",
  },
  {
    icon: Layers,
    title: "Multiple Simultaneous Classes",
    description: "Our LiveKit engine handles many classes at once — no scheduling conflicts, no interference between rooms.",
    color: "text-info",
    bg: "bg-info/10",
  },
  {
    icon: Video,
    title: "No Third-Party Redirects",
    description: "Students and teachers never leave the app for class. No Google Meet links, no Zoom installs, no Jio Meet codes.",
    color: "text-warning",
    bg: "bg-warning/10",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function LiveClassExperience() {
  return (
    <section className="py-28 bg-bg relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-semibold uppercase tracking-widest mb-6">
            <Video className="w-3.5 h-3.5" /> Custom Live Classroom
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text mb-5 leading-tight">
            Classes built for learning —{" "}
            <span className="bg-gradient-to-r from-accent to-gold bg-clip-text text-transparent">
              not borrowed from video call apps.
            </span>
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto mb-4">
            All live classes run on our own custom-built video system powered by <strong className="text-text">LiveKit</strong> — an open-source, self-hosted WebRTC engine. No Google Meet. No Zoom. No Jio Meet.
          </p>
          <div className="inline-flex items-center gap-2 text-sm font-medium text-text-subtle bg-surface border border-border rounded-full px-4 py-2">
            <Lock className="w-3.5 h-3.5 text-success" />
            Recordings stored on client-owned servers. Zero data shared with third parties.
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
        >
          {liveFeatures.map((feat, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.22 } }}
              className="group rounded-2xl border border-border bg-surface p-7 shadow-sm hover:shadow-lg hover:border-border-strong transition-all duration-300 cursor-default"
            >
              <div className={`w-11 h-11 rounded-xl ${feat.bg} flex items-center justify-center ${feat.color} mb-5`}>
                <feat.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2 group-hover:text-gold transition-colors duration-300">
                {feat.title}
              </h3>
              <p className="text-text-muted text-sm leading-relaxed">
                {feat.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
