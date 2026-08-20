"use client";

import React from "react";
import { ShieldCheck, Video, Wallet, Clock, Star } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Video,
    title: "Custom Video",
    description: "No external links or confusing software. Join high-quality, low-latency video classes directly in your browser with built-in chat and screen sharing.",
    color: "text-accent",
    bg: "bg-accent/10",
    span: 2,
  },
  {
    icon: ShieldCheck,
    title: "Verified Teachers",
    description: "Every teacher is manually vetted for proficiency and teaching ability before they can accept bookings.",
    color: "text-gold",
    bg: "bg-gold/10",
    span: 1,
  },
  {
    icon: Wallet,
    title: "Global Coin Wallet",
    description: "Say goodbye to currency conversion math. Buy coins once and spend them on any teacher, anywhere.",
    color: "text-success",
    bg: "bg-success/10",
    span: 1,
  },
  {
    icon: Clock,
    title: "Timezone Smart",
    description: "We handle the time math. You see every teacher&apos;s availability automatically translated to your local timezone.",
    color: "text-info",
    bg: "bg-info/10",
    span: 1,
  },
  {
    icon: Star,
    title: "Honest Ratings",
    description: "Only students who have completed a paid class can leave a review, ensuring absolute trust in our ratings.",
    color: "text-warning",
    bg: "bg-warning/10",
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
    <section className="py-28 bg-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-semibold uppercase tracking-widest mb-6">
            Platform Features
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-text mb-5 leading-tight">
            Everything you need to master a language
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            A premium, end-to-end platform built specifically for real-time human connection.
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
              className={`relative group rounded-2xl overflow-hidden border border-border bg-surface p-8 shadow-sm hover:shadow-lg hover:border-border-strong transition-all duration-300 cursor-default ${feature.span === 2 ? 'md:col-span-2' : ''}`}
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-${feature.color.replace('text-', '')}/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative z-10">
                <motion.div
                  whileHover={{ rotate: 8, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center ${feature.color} mb-6`}
                >
                  <feature.icon className="w-6 h-6" />
                </motion.div>
                <h3 className={`${feature.span === 2 ? 'text-2xl' : 'text-xl'} font-bold text-text mb-3 group-hover:text-gold transition-colors duration-300`}>
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
