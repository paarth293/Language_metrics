"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden bg-surface-2 border-t border-border">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gold/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Student CTA */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-start hover:border-gold/40 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-6">
              <span className="text-2xl">🎓</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text mb-3 group-hover:text-gold transition-colors duration-300">
              Ready to start learning?
            </h2>
            <p className="text-text-muted mb-8 text-balance">
              Find a verified teacher, book a ₹29 demo class, and join your first live session today — no long-term commitment required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild variant="gold" size="lg" className="shadow-glow-gold flex items-center gap-2">
                <Link href="/register/student">
                  Find a Teacher <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#pricing">Book a Demo — ₹29</Link>
              </Button>
            </div>
          </motion.div>

          {/* Teacher CTA */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-start hover:border-accent/40 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
              <span className="text-2xl">👨‍🏫</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-text mb-3 group-hover:text-accent transition-colors duration-300">
              Teach on your terms.
            </h2>
            <p className="text-text-muted mb-4 text-balance">
              Apply as a Fresher or Experienced teacher. Submit your documents, pass a language test interview, and start earning once approved.
            </p>
            <div className="flex items-center gap-1.5 text-sm text-text-subtle mb-8">
              <ShieldCheck className="w-4 h-4 text-success" />
              Manual review — not instant. Quality matters.
            </div>
            <Button asChild variant="outline" size="lg" className="flex items-center gap-2 border-accent/40 hover:border-accent text-accent hover:bg-accent/5">
              <Link href="/register/teacher">
                Apply to Teach <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
