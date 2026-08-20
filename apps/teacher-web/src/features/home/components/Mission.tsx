"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Mission() {
  return (
    <section className="py-24 relative overflow-hidden bg-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col lg:flex-row items-stretch"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
        >
          {/* Content side */}
          <div className="w-full lg:w-1/2 p-12 lg:p-16 flex flex-col justify-center order-2 lg:order-1">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text mb-6">
              One platform. Every language. Total privacy.
            </h2>
            <p className="text-lg text-text-muted mb-6 text-balance">
              Language Metrics connects students with manually verified language professionals for 1-on-1 live classes — hourly or as full courses. Every class runs on our own custom-built video system, so your learning stays private, recorded, and fully in your control.
            </p>
            <p className="text-base text-text-muted text-balance">
              No Google Meet. No Zoom. No third-party redirects. Just you, your teacher, and a classroom built specifically for language learning.
            </p>
            <div className="flex gap-12 mt-8">
              <div>
                <p className="font-display font-bold text-3xl text-gold mb-1">₹49</p>
                <p className="text-sm text-text-subtle uppercase tracking-wider font-semibold">Demo Class</p>
              </div>
              <div>
                <p className="font-display font-bold text-3xl text-gold mb-1">100%</p>
                <p className="text-sm text-text-subtle uppercase tracking-wider font-semibold">Verified Teachers</p>
              </div>
            </div>
          </div>

          {/* Image side */}
          <div className="w-full lg:w-1/2 relative min-h-[300px] lg:min-h-[auto] bg-[#f8f4ea] order-1 lg:order-2">
            <Image 
              src="/brand/mission-banner.png" 
              alt="Language Metrics — Custom live classroom" 
              fill 
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>

        </motion.div>
      </div>
    </section>
  );
}
