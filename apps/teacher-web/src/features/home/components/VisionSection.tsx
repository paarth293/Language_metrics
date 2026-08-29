"use client";
import React from "react";
import { motion } from "framer-motion";

interface FounderCardProps {
  role: string;
  initials: string;
  name: string;
  subtitle: string;
  paragraphs: string[];
  signature: string;
  delay?: number;
}

function FounderCard({ role, initials, name, subtitle, paragraphs, signature, delay = 0 }: FounderCardProps) {
  return (
    <motion.div
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
      className="relative bg-surface rounded-[2rem] p-8 md:p-10 shadow-sm border border-border overflow-hidden"
      suppressHydrationWarning
    >
      {/* Decorative quotation mark */}
      <span
        aria-hidden="true"
        className="absolute top-4 right-6 font-display text-[5rem] leading-none text-text-muted opacity-10 select-none pointer-events-none"
      >
        &ldquo;
      </span>

      {/* Role label */}
      <span className="font-script text-lg text-gold mb-4 block">{role}</span>

      {/* Avatar + Name row */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[hsl(220,15%,88%)] flex items-center justify-center">
          <span className="font-display text-sm font-bold text-text tracking-wide">{initials}</span>
        </div>
        <div>
          <h3 className="font-display text-2xl font-bold text-text leading-tight">{name}</h3>
          <p className="text-text-muted text-sm mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Body paragraphs */}
      <div className="space-y-4 text-text-muted text-sm leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* Signature */}
      <p className="font-script text-xl text-text mt-6">— {signature}</p>
    </motion.div>
  );
}

export default function VisionSection() {
  // Render as a Server Component – no client‑only hooks or random values.
  return (
    <section className="relative py-24 bg-bg overflow-hidden" suppressHydrationWarning>
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
        {/* Section heading */}
        <div className="mb-12 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
            <div className="w-8 h-px bg-gold"></div>
            <span className="font-script text-xl text-gold">Leadership</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-text">
            The Vision Behind Language Metrics
          </h2>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Riyansh Gupta */}
          <FounderCard
            role="Founder"
            initials="RG"
            name="Riyansh Gupta"
            subtitle="Founder, Language Metrics"
            delay={0}
            paragraphs={[
              "I started Language Metrics with a simple belief: language should open doors, not create barriers.",
              "For many people, learning a language is not just about knowing words or grammar. It is about being able to express yourself, connect with others, study, work, travel, and feel confident in a world that is becoming more connected every day.",
              "I want Language Metrics to make that journey simpler and more meaningful. We are building a platform where people can understand their language abilities, identify where they need to improve, and see their progress in a way that is clear and measurable.",
              "My vision is to build something that genuinely helps people—not just another platform, but a trusted space where learners, teachers, and institutions can come together.",
              "We are starting from India, but the dream is much bigger. I want Language Metrics to eventually help people across the world measure their language, understand their potential, and communicate without limits."
            ]}
            signature="Riyansh Gupta"
          />

          {/* Priyanshu Raj */}
          <FounderCard
            role="Co-Founder"
            initials="PR"
            name="Priyanshu Raj"
            subtitle="Co-Founder,  Language Metrics"
            delay={0.2}
            paragraphs={[
              "I'm building Language Metrics because I believe technology should make learning more personal, measurable, and accessible.",
              "As the technical co‑founder, I, with my team, am responsible for turning the vision behind Language Metrics into something people can actually experience. We enjoy working through complex problems, building the systems that power the product, and finding better ways to make technology serve the people using it.",
              "What excites me most is taking an idea and turning it into something people can actually use—whether that involves designing a backend system or figuring out how AI can make learning smarter. I'm particularly interested in how intelligent systems can move language learning beyond traditional methods to make it more adaptive and meaningful.",
              "With Language Metrics, we want to build more than just another learning platform—technology that understands where a learner stands, identifies where they can improve, and helps them see their progress clearly. We're starting from India, but the ambition is global."
            ]}
            signature="Priyanshu Raj"
          />
        </div>
      </div>
    </section>
  );
}
