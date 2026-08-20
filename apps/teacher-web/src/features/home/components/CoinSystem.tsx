"use client";

import React from "react";
import { motion } from "framer-motion";
import { Coins, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

const coinPerks = [
  {
    label: "1 Coin = ₹1",
    detail: "Simple, transparent rate. Buy any amount.",
  },
  {
    label: "50 Coins per Outreach",
    detail: "Use coins to contact students who haven't booked yet.",
  },
  {
    label: "399 Free Coins for Freshers",
    detail: "One-time bonus credited automatically on account activation — equal to the registration fee.",
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
          <div className="flex flex-col lg:flex-row items-center gap-0">

            {/* Left: coin badge illustration */}
            <div className="w-full lg:w-2/5 bg-gradient-to-br from-gold/10 via-surface to-surface border-b lg:border-b-0 lg:border-r border-border p-10 lg:p-14 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mb-5 shadow-lg ring-4 ring-gold/10">
                <Coins className="w-10 h-10 text-gold" />
              </div>
              <h3 className="font-display text-2xl font-bold text-text mb-2">Teacher Coin System</h3>
              <p className="text-text-muted text-sm max-w-xs">
                Fresher teachers get free credit to start reaching students right away — no upfront spend needed.
              </p>

              <div className="mt-6 inline-flex items-center gap-2 bg-gold/10 border border-gold/20 text-gold text-sm font-semibold px-4 py-2 rounded-full">
                <Zap className="w-4 h-4" />
                399 Free Coins on Signup
              </div>
            </div>

            {/* Right: coin perks */}
            <div className="flex-1 p-10 lg:p-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-semibold uppercase tracking-widest mb-5">
                For Teachers
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold text-text mb-6">
                Reach students before they book you.
              </h2>

              <div className="space-y-5 mb-8">
                {coinPerks.map((perk, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold text-sm shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-text">{perk.label}</p>
                      <p className="text-text-muted text-sm">{perk.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button asChild variant="outline" className="flex items-center gap-2 border-gold/30 text-gold hover:border-gold hover:bg-gold/5">
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
