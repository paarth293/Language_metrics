"use client";

import React from "react";
import Link from "next/link";
import { motion, cubicBezier } from "framer-motion";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-client";

const stagger = {
  container: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: cubicBezier(0.16, 1, 0.3, 1) } },
  },
};

export default function ComingSoonPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden selection:bg-gold selection:text-white">

      {/* Subtle dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, #c7982f22 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient warm glow top-center */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gold/10 blur-[140px] rounded-full" />
      </div>

      {/* Minimal top bar */}
      <header className="relative z-20 flex items-center justify-between px-8 md:px-16 py-6">
        <span className="font-display text-base font-semibold text-navy/70 tracking-tight">
          Language Metrics
        </span>
        {user && (
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-navy transition-colors group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Sign out
          </button>
        )}
      </header>

      {/* Main Stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20 relative z-10">
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center text-center max-w-3xl w-full"
        >

          {/* Logo mark */}
          <motion.div variants={stagger.item} className="mb-10">
            <div className="relative inline-block">
              <div className="absolute -inset-4 bg-gold/20 blur-2xl rounded-full" />
              <Image
                src="/brand/logo-full.png"
                alt="Language Metrics"
                width={100}
                height={100}
                style={{ objectFit: "contain", width: "auto", height: 100 }}
                className="relative drop-shadow-lg"
                priority
              />
            </div>
          </motion.div>


          {/* Status pill */}
          <motion.div variants={stagger.item} className="mb-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-navy/5 border border-navy/10 text-navy/60 text-[11px] font-bold uppercase tracking-[0.15em]">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              In Development &middot; {new Date().getFullYear()}
            </span>
          </motion.div>

          {/* Primary wordmark headline */}
          <motion.div variants={stagger.item} className="mb-6">
            <h1 className="font-display text-[2.75rem] md:text-[4.5rem] lg:text-[5.5rem] font-bold text-navy tracking-[-0.03em] leading-[1.05]">
              Language Metrics
            </h1>
            <p className="font-display text-[2.75rem] md:text-[4.5rem] lg:text-[5.5rem] font-light text-transparent bg-clip-text bg-gradient-to-r from-gold to-warning tracking-[-0.03em] leading-[1.05] italic">
              is almost here.
            </p>
          </motion.div>

          {/* Divider */}
          <motion.div
            variants={stagger.item}
            className="w-16 h-px bg-gradient-to-r from-transparent via-gold to-transparent my-8 opacity-50"
          />

          {/* Body text — personalised when logged in */}
          <motion.p variants={stagger.item} className="text-base md:text-lg text-text-muted leading-relaxed max-w-lg font-light">
            {user
              ? `Welcome back, ${user.name.split(" ")[0]}. Your ${user.role.toLowerCase()} portal is being meticulously crafted. We\u2019ll notify you the moment it\u2019s ready.`
              : "We\u2019re meticulously building the platform that redefines language learning. Something extraordinary is on its way."}
          </motion.p>

          {/* User role badge */}
          {user && (
            <motion.div variants={stagger.item} className="mt-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/25 text-gold text-xs font-bold uppercase tracking-widest">
                {user.role} Account
              </span>
            </motion.div>
          )}

          {/* CTA buttons */}
          <motion.div
            variants={stagger.item}
            className="flex flex-col sm:flex-row gap-3 mt-12 w-full justify-center"
          >
            <Link
              href="/"
              className="px-7 py-3 rounded-full bg-navy text-white text-sm font-semibold hover:bg-navy-2 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(22,34,63,0.22)] transition-all duration-300"
            >
              &larr; Back to Home
            </Link>
            <a
              href="mailto:hello@languagemetrics.com"
              className="px-7 py-3 rounded-full border border-border bg-white text-navy text-sm font-semibold hover:border-gold hover:text-gold hover:-translate-y-px transition-all duration-300 shadow-sm"
            >
              Contact Us
            </a>
          </motion.div>

        </motion.div>
      </main>

      {/* Bottom strip */}
      <div className="relative z-10 border-t border-navy/[0.07] bg-white/60 backdrop-blur-sm px-8 md:px-16 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="h-9 relative">
          <Image
            src="/brand/mission-banner.png"
            alt="Language Metrics Mission"
            width={200}
            height={36}
            className="h-9 w-auto object-contain opacity-70"
          />
        </div>
        <p className="text-xs text-text-subtle font-medium text-center md:text-right">
          &copy; {new Date().getFullYear()} Language Metrics &middot; All rights reserved
        </p>
      </div>

    </div>
  );
}
