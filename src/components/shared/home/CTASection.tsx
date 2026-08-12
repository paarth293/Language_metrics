"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { ArrowRight, GraduationCap, Briefcase } from "lucide-react";

export default function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-navy overflow-hidden relative" ref={ref}>
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, #f8f4ea08 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Gold orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-[900px] mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 mb-5">
            <span className="eyebrow-line" />
            <span className="font-script text-gold text-xl">Join today</span>
            <span className="eyebrow-line" />
          </div>
          <h2
            className="font-display font-bold text-cream mb-6"
            style={{ fontSize: "clamp(32px, 5vw, 62px)", lineHeight: 1.08 }}
          >
            Your Language Journey{" "}
            <span className="text-gradient-gold italic">Starts Now</span>
          </h2>
          <p className="text-cream/60 text-lg max-w-xl mx-auto mb-12">
            Whether you&apos;re a student ready to learn or a teacher ready to earn —
            Language Metrics is your platform.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-5"
        >
          {/* Student CTA */}
          <Link
            href="/register/student"
            id="cta-student"
            className="btn-gold px-8 py-4 text-[15px] font-semibold flex items-center gap-2.5 group"
          >
            <GraduationCap className="w-5 h-5" />
            I want to Learn
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>

          {/* Teacher CTA */}
          <Link
            href="/register/teacher"
            id="cta-teacher"
            className="btn-outline-cream px-8 py-4 text-[15px] font-semibold flex items-center gap-2.5 group"
          >
            <Briefcase className="w-5 h-5" />
            I want to Teach
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-8 text-[13px] text-cream/40"
        >
          <span>✓ Free student registration</span>
          <span>✓ ₹49 demo class to start</span>
          <span>✓ No subscription required</span>
          <span>✓ Verified teachers only</span>
        </motion.div>
      </div>
    </section>
  );
}
