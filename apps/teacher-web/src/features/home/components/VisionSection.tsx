"use client";

import React from "react";
import { motion } from "framer-motion";

export default function VisionSection() {
  return (
    <section className="relative py-24 bg-bg overflow-hidden">
      {/* Background Floating Text */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none opacity-10 overflow-hidden">
        <span className="absolute top-[10%] left-[10%] font-script text-5xl text-text-muted">Hello</span>
        <span className="absolute top-[5%] right-[30%] font-script text-4xl text-text-muted">Hallo</span>
        <span className="absolute top-[15%] right-[10%] font-script text-5xl text-text-muted">Bonjour</span>
        <span className="absolute top-[40%] left-[5%] font-script text-4xl text-text-muted">নমস্কার</span>
        <span className="absolute bottom-[30%] left-[8%] font-script text-4xl text-text-muted">Γεια σου</span>
        <span className="absolute bottom-[10%] left-[15%] font-script text-5xl text-text-muted">Hola</span>
        <span className="absolute top-[35%] right-[15%] font-script text-4xl text-text-muted">Olá</span>
        <span className="absolute bottom-[25%] right-[10%] font-script text-5xl text-text-muted">مرحباً</span>
        <span className="absolute bottom-[10%] right-[40%] font-script text-4xl text-text-muted">안녕하세요</span>
        <span className="absolute top-[20%] left-[25%] font-script text-4xl text-text-muted">Ciao</span>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
            <div className="w-8 h-px bg-gold"></div>
            <span className="font-script text-xl text-gold">Leadership</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text">
            The Vision Behind Language<br className="hidden lg:block" /> Metrics
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Riyansh Gupta Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="bg-surface rounded-[2rem] p-8 md:p-12 shadow-sm border border-border"
          >
            <div className="mb-8">
              <span className="font-script text-xl text-gold mb-2 block">Founder</span>
              <h3 className="font-display text-3xl font-bold text-text">Riyansh Gupta</h3>
              <p className="text-text-muted text-sm mt-1">Founder, Language Metrics</p>
            </div>
            <div className="space-y-6 text-text-muted leading-relaxed">
              <p>I started Language Metrics with a simple belief: language should open doors, not create barriers.</p>
              <p>For many people, learning a language is not just about knowing words or grammar. It is about being able to express yourself, connect with others, study, work, travel, and feel confident in a world that is becoming more connected every day.</p>
              <p>I want Language Metrics to make that journey simpler and more meaningful. We are building a platform where people can understand their language abilities, identify where they need to improve, and see their progress in a way that is clear and measurable.</p>
              <p>My vision is to build something that genuinely helps people—not just another platform, but a trusted space where learners, teachers, and institutions can come together.</p>
              <p>We are starting from India, but the dream is much bigger. I want Language Metrics to eventually help people across the world measure their language, understand their potential, and communicate without limits.</p>
              <p className="font-script text-2xl text-text pt-4">— Riyansh Gupta</p>
            </div>
          </motion.div>

          {/* Mohit Gupta Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-surface rounded-[2rem] p-8 md:p-12 shadow-sm border border-border"
          >
            <div className="mb-8">
              <span className="font-script text-xl text-gold mb-2 block">Co-Founder</span>
              <h3 className="font-display text-3xl font-bold text-text">Mohit Gupta</h3>
              <p className="text-text-muted text-sm mt-1">Co-Founder, Language Metrics</p>
            </div>
            <div className="space-y-6 text-text-muted leading-relaxed">
              <p>I joined Language Metrics because I believe language has the power to change how people learn, connect, and create opportunities.</p>
              <p>My vision is to help turn this idea into something practical, accessible, and impactful—something that genuinely makes a difference in the way people experience language learning.</p>
              <p className="font-script text-2xl text-text pt-4">— Mohit Gupta</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
