"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Star, ShieldCheck, Video } from "lucide-react";

const floatingWords = [
  { word: "Bonjour", x: "8%", y: "18%", delay: 0, size: "text-2xl" },
  { word: "こんにちは", x: "72%", y: "12%", delay: 1.5, size: "text-xl" },
  { word: "Hola", x: "88%", y: "45%", delay: 0.8, size: "text-3xl" },
  { word: "Namaste", x: "5%", y: "65%", delay: 2.2, size: "text-xl" },
  { word: "Ciao", x: "80%", y: "72%", delay: 0.4, size: "text-2xl" },
  { word: "Merhaba", x: "15%", y: "85%", delay: 1.8, size: "text-lg" },
  { word: "你好", x: "55%", y: "80%", delay: 1.1, size: "text-3xl" },
  { word: "Salut", x: "42%", y: "10%", delay: 2.5, size: "text-xl" },
  { word: "Shalom", x: "65%", y: "60%", delay: 0.2, size: "text-lg" },
  { word: "Olá", x: "30%", y: "92%", delay: 1.6, size: "text-2xl" },
];

const trustBadges = [
  { icon: ShieldCheck, label: "Verified Teachers" },
  { icon: Video, label: "Custom Video Platform" },
  { icon: Star, label: "Rated 4.9 / 5" },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-cream pt-[74px]">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, #16223f0f 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Floating language words */}
      <div className="floating-layer" aria-hidden="true">
        {floatingWords.map((item, i) => (
          <motion.span
            key={i}
            className={`floating-word font-script ${item.size}`}
            style={{ left: item.x, top: item.y }}
            animate={{
              y: [0, -20, 0],
              rotate: [-2, 2, -2],
              opacity: [0.06, 0.1, 0.06],
            }}
            transition={{
              duration: 6 + i * 0.4,
              delay: item.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {item.word}
          </motion.span>
        ))}
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-navy/5 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-[900px] mx-auto px-6 text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 mb-6"
        >
          <span className="eyebrow-line" />
          <span className="font-script text-gold text-xl">
            Learn any language, with real experts
          </span>
          <span className="eyebrow-line" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-navy leading-[1.05] tracking-tight mb-6"
          style={{ fontSize: "clamp(42px, 6vw, 82px)", fontWeight: 700 }}
        >
          Find Your Perfect{" "}
          <span className="text-gradient-gold italic">Language Teacher</span>
          <br />
          in Minutes
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-navy/60 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10"
        >
          Connect with verified language professionals for live 1-on-1 classes
          via our custom video platform — no third-party tools, full control.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Link
            href="/register/student"
            id="hero-student-cta"
            className="btn-primary px-8 py-4 text-[15px] font-semibold flex items-center gap-2 group"
          >
            Find a Teacher
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link
            href="/register/teacher"
            id="hero-teacher-cta"
            className="btn-outline px-8 py-4 text-[15px] font-semibold"
          >
            Teach on Language Metrics
          </Link>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6"
        >
          {trustBadges.map((badge, i) => (
            <div key={i} className="flex items-center gap-2">
              <badge.icon className="w-4 h-4 text-gold" />
              <span className="text-[13px] font-medium text-navy/60">
                {badge.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[12px] font-medium text-navy/40 tracking-widest uppercase">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-px h-8 bg-gradient-to-b from-gold/50 to-transparent"
        />
      </motion.div>
    </section>
  );
}
