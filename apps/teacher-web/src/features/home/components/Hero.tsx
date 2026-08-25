"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown, Star, ShieldCheck, Video, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

export default function Hero() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, -150]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -250]);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth) * 2 - 1;
    const y = (clientY / innerHeight) * 2 - 1;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.08,
        duration: 0.5,
        ease: "easeOut" as const
      },
    }),
  };

  return (
    <section 
      className="relative min-h-[100dvh] flex flex-col overflow-hidden pt-20 pb-24 bg-bg text-text"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Aurora Mesh Gradient Background */}
      <div className="absolute inset-0 z-0 overflow-hidden transform-gpu">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gold/15 blur-3xl" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-navy/10 blur-3xl" />
      </div>

      {/* Radial Gradient Base */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-surface to-transparent" />

      {/* Floating Script Words (Parallax) — hidden on mobile to prevent content overlap */}
      <motion.div style={{ y: y2 }} className="hidden sm:block absolute inset-0 z-0 pointer-events-none select-none opacity-20 will-change-transform overflow-hidden">
        {/* Original 4 */}
        <span className="absolute top-[15%] left-[12%] font-script text-4xl text-gold animate-float-drift">Bonjour</span>
        <span className="absolute top-[25%] right-[18%] font-script text-5xl text-accent animate-float-drift" style={{ animationDelay: "1s" }}>你好</span>
        <span className="absolute bottom-[35%] left-[20%] font-script text-4xl text-text-muted animate-float-drift" style={{ animationDelay: "2s" }}>Hola</span>
        <span className="absolute bottom-[30%] right-[12%] font-script text-5xl text-navy dark:text-gold-soft animate-float-drift" style={{ animationDelay: "1.5s" }}>Namaste</span>
        
        {/* Additional greetings scattered carefully */}
        <span className="absolute top-[10%] right-[40%] font-script text-3xl text-success animate-float-drift" style={{ animationDelay: "0.5s" }}>Ciao</span>
        <span className="absolute top-[45%] left-[6%] font-script text-5xl text-info animate-float-drift" style={{ animationDelay: "2.5s" }}>안녕하세요</span>
        <span className="absolute bottom-[15%] right-[35%] font-script text-4xl text-gold-soft animate-float-drift" style={{ animationDelay: "0.8s" }}>مرحبا</span>
        <span className="absolute bottom-[10%] left-[10%] font-script text-3xl text-warning animate-float-drift" style={{ animationDelay: "3s" }}>Hallo</span>
        <span className="absolute top-[65%] right-[6%] font-script text-4xl text-text-subtle animate-float-drift" style={{ animationDelay: "1.2s" }}>Привет</span>
        <span className="absolute top-[5%] left-[45%] font-script text-3xl text-accent animate-float-drift" style={{ animationDelay: "3.5s" }}>Olá</span>
        <span className="absolute top-[75%] left-[8%] font-script text-3xl text-danger animate-float-drift" style={{ animationDelay: "1.8s" }}>こんにちは</span>
        <span className="absolute top-[35%] right-[5%] font-script text-4xl text-gold animate-float-drift" style={{ animationDelay: "2.2s" }}>Sawasdee</span>
        <span className="absolute bottom-[5%] right-[25%] font-script text-3xl text-success animate-float-drift" style={{ animationDelay: "0.2s" }}>Merhaba</span>
        <span className="absolute top-[2%] right-[15%] font-script text-4xl text-info animate-float-drift" style={{ animationDelay: "2.8s" }}>Jambo</span>
        <span className="absolute top-[55%] left-[30%] font-script text-4xl text-text-muted animate-float-drift" style={{ animationDelay: "4s" }}>Kamusta</span>
        <span className="absolute top-[80%] right-[45%] font-script text-5xl text-gold-pale animate-float-drift" style={{ animationDelay: "2.6s" }}>Salam</span>
        <span className="absolute top-[20%] left-[35%] font-script text-3xl text-accent animate-float-drift" style={{ animationDelay: "1.1s" }}>Ahoj</span>
        <span className="absolute top-[50%] right-[25%] font-script text-4xl text-success animate-float-drift" style={{ animationDelay: "3.2s" }}>Salut</span>
        <span className="absolute top-[85%] left-[40%] font-script text-3xl text-warning animate-float-drift" style={{ animationDelay: "0.7s" }}>Guten Tag</span>
        <span className="absolute top-[90%] right-[10%] font-script text-4xl text-info animate-float-drift" style={{ animationDelay: "4.5s" }}>Xin chào</span>
        <span className="absolute top-[15%] right-[60%] font-script text-3xl text-danger animate-float-drift" style={{ animationDelay: "1.4s" }}>வணக்கம்</span>
        <span className="absolute top-[60%] left-[15%] font-script text-4xl text-gold animate-float-drift" style={{ animationDelay: "3.8s" }}>Cześć</span>
        <span className="absolute bottom-[20%] left-[40%] font-script text-3xl text-text-subtle animate-float-drift" style={{ animationDelay: "2.1s" }}>Sveiki</span>
      </motion.div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full flex flex-col lg:flex-row items-center gap-10 lg:gap-16 my-auto">

        {/* Left / Center Content */}
        <div className="flex-1 text-center lg:text-left pt-10 sm:pt-16 lg:pt-0">
          <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUpVariant}>
            <span className="font-script text-xl sm:text-2xl text-gold mb-3 inline-block tracking-wider">
              Language learning, reimagined.
            </span>
          </motion.div>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariant}
            className="font-display text-[clamp(1.75rem,5.5vw,3.75rem)] font-semibold leading-[1.1] tracking-tight mb-5 text-balance"
          >
            A place to find a language teacher who&apos;s actually been checked out.
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariant}
            className="text-base sm:text-lg md:text-xl text-text-muted mb-6 text-balance max-w-2xl mx-auto lg:mx-0"
          >
            Language Metrics is a global language learning platform connecting students with verified language professionals. Discover new languages, explore cultures, and build meaningful connections across the world.
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariant}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 mb-8"
          >
            <Button asChild variant="gold" size="lg" className="w-full sm:w-auto text-base sm:text-lg shadow-glow-gold">
              <Link href="/register/student">Find a Teacher</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base sm:text-lg bg-surface/50 backdrop-blur-md">
              <Link href="/register/teacher">Apply to Teach</Link>
            </Button>
          </motion.div>

          {/* Trust Row — wraps cleanly on mobile */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={fadeUpVariant}
            className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-xs sm:text-sm font-medium text-text-subtle"
          >
            <div className="flex items-center gap-2 whitespace-nowrap"><ShieldCheck className="w-4 h-4 text-success shrink-0" /> Verified Teachers</div>
            <div className="h-4 w-px bg-border hidden sm:block shrink-0" />
            <div className="flex items-center gap-2 whitespace-nowrap"><Video className="w-4 h-4 text-accent shrink-0" /> Custom Live Classroom</div>
            <div className="h-4 w-px bg-border hidden sm:block shrink-0" />
            <div className="flex items-center gap-2 whitespace-nowrap"><Lock className="w-4 h-4 text-gold shrink-0" /> No Contact Info Shared</div>
            <div className="h-4 w-px bg-border hidden sm:block shrink-0" />
            <div className="flex items-center gap-2 whitespace-nowrap"><Star className="w-4 h-4 text-gold fill-gold shrink-0" /> Rated 4.9/5</div>
          </motion.div>
        </div>

        {/* Right Content - Floating Glass "Proof" Card */}
        <motion.div
          style={{ y: y1 }}
          className="hidden lg:block relative flex-1 will-change-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-gold/20 to-transparent rounded-[2rem] blur-xl transform rotate-3" />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              rotate: mousePos.x * 4, 
              x: mousePos.x * -15, 
              y: mousePos.y * -15 
            }}
            transition={{ 
              opacity: { duration: 0.8, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] },
              scale: { duration: 0.8, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] },
              rotate: { type: "spring", stiffness: 100, damping: 30 },
              x: { type: "spring", stiffness: 100, damping: 30 },
              y: { type: "spring", stiffness: 100, damping: 30 }
            }}
            className="relative bg-surface/80 backdrop-blur-md border border-border-strong rounded-[2rem] p-6 shadow-xl max-w-sm ml-auto transform-gpu"
          >
            <div className="flex items-center gap-4 mb-6">
              <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="lg" online={true} />
              <div>
                <div className="font-semibold text-lg">Amélie Dupont</div>
                <div className="flex items-center gap-1 text-sm text-text-muted">
                  <span title="France">🇫🇷</span> French · Experienced Teacher
                </div>
              </div>
            </div>

            <div className="bg-surface-inset rounded-xl p-4 mb-4 border border-border">
              <div className="text-sm font-medium mb-1">Upcoming Demo Class</div>
              <div className="text-2xl font-display font-semibold mb-2">Starts in <span className="text-accent animate-pulse">10 min</span></div>
              <div className="flex justify-between items-center text-sm text-text-muted">
                <span>Today, 14:00 (Local)</span>
                <span className="font-semibold text-text flex items-center gap-1">
                  ₹29
                </span>
              </div>
            </div>

            <div className="text-xs text-text-subtle text-center mb-3 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-success" />
              Class runs on our custom, private video system
            </div>

            <Button variant="primary" className="w-full flex gap-2 items-center justify-center">
              <Video className="w-4 h-4" /> Join Live Classroom
            </Button>
          </motion.div>
        </motion.div>

      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center text-text-subtle animate-bounce"
      >
        <span className="text-xs font-medium tracking-widest uppercase mb-2">Scroll</span>
        <ChevronDown className="w-5 h-5 text-gold" />
      </motion.div>
    </section>
  );
}
