"use client";

import React from "react";
import { motion } from "framer-motion";
import { Coins, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

const coinPerks = [
  {
    label: "1 Coin = ₹1",
    detail: "Simple, transparent rate. Buy any amount with no hidden charges.",
  },
  {
    label: "50 Coins per Outreach",
    detail: "Use coins to contact students who haven't booked a session yet.",
  },
  {
    label: "Direct Student Access",
    detail: "Reach out to prospective students directly from your teacher dashboard.",
  },
];

export default function CoinSystem() {
  return (
    <section className="py-24 bg-bg">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="bg-surface border border-border rounded-[2rem] overflow-hidden shadow-sm"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65 }}
        >
          <div className="flex flex-col lg:flex-row items-stretch gap-0">

            {/* Left: coin badge & summary card */}
            <div className="w-full lg:w-2/5 bg-gradient-to-br from-brand/10 via-surface to-surface border-b lg:border-b-0 lg:border-r border-border p-10 lg:p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-brand-subtle border border-brand-muted/20 flex items-center justify-center mb-6 shadow-sm">
                <Coins className="w-10 h-10 text-brand" />
              </div>
              <h3 className="font-display text-2xl font-bold text-text mb-3">Teacher Coin System</h3>
              <p className="text-text-muted text-sm leading-relaxed max-w-xs mb-6">
                Simple, transparent coin credit system to start reaching interested students right away.
              </p>

              {/* Bottom stat highlights to balance height */}
              <div className="w-full max-w-xs grid grid-cols-2 gap-3 pt-6 border-t border-border/60">
                <div className="bg-surface/80 border border-border/80 rounded-xl p-3 text-center">
                  <p className="font-display text-xl font-bold text-brand">₹249</p>
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">One-Time Fee</p>
                </div>
                <div className="bg-surface/80 border border-border/80 rounded-xl p-3 text-center">
                  <p className="font-display text-xl font-bold text-brand">50</p>
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Coins / Message</p>
                </div>
              </div>
            </div>

            {/* Right: coin perks */}
            <div className="flex-1 p-10 lg:p-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-action-muted/30 bg-action-subtle text-action text-xs font-semibold uppercase tracking-widest mb-5">
                For Teachers
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-text mb-6">
                Reach students before they book you.
              </h2>

              <div className="space-y-5 mb-8">
                {coinPerks.map((perk, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-brand-subtle flex items-center justify-center text-brand font-bold text-sm shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-text">{perk.label}</p>
                      <p className="text-text-muted text-sm">{perk.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button asChild variant="gold" className="flex items-center gap-2 shadow-sm">
                <Link href="/register/teacher">
                  Apply to Teach <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
