"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const languages = [
  { name: "English", flag: "🇬🇧" },
  { name: "Spanish", flag: "🇪🇸" },
  { name: "French", flag: "🇫🇷" },
  { name: "German", flag: "🇩🇪" },
  { name: "Italian", flag: "🇮🇹" },
  { name: "Portuguese", flag: "🇵🇹" },
  { name: "Chinese", flag: "🇨🇳" },
  { name: "Japanese", flag: "🇯🇵" },
  { name: "Korean", flag: "🇰🇷" },
  { name: "Hindi", flag: "🇮🇳" },
  { name: "Arabic", flag: "🇸🇦" },
  { name: "Russian", flag: "🇷🇺" },
];

export default function LanguageMarquee() {
  const repeatedLanguages = [...languages, ...languages, ...languages];

  return (
    <section className="py-16 overflow-hidden bg-bg">
      <motion.div
        className="mx-auto max-w-7xl px-4 mb-10 text-center"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-widest">
          Learn any of our 45+ supported languages
        </h3>
      </motion.div>

      <div className="relative flex w-full overflow-hidden group">
        <div className="absolute left-0 top-0 z-10 h-full w-32 bg-gradient-to-r from-bg to-transparent" />

        <div className="flex animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap">
          {repeatedLanguages.map((lang, idx) => (
            <Link
              key={`${lang.name}-${idx}`}
              href={`/discover?lang=${lang.name.toLowerCase()}`}
              className="flex items-center gap-2.5 px-6 py-3 mx-2 rounded-xl border border-border bg-surface text-text shadow-sm hover:border-gold hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <span className="text-xl">{lang.flag}</span>
              <span className="font-medium text-sm">{lang.name}</span>
            </Link>
          ))}
        </div>

        <div className="absolute right-0 top-0 z-10 h-full w-32 bg-gradient-to-l from-bg to-transparent" />
      </div>

      <div className="relative flex w-full overflow-hidden mt-4 group">
        <div className="absolute left-0 top-0 z-10 h-full w-32 bg-gradient-to-r from-bg to-transparent" />

        <div className="flex animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap" style={{ animationDirection: "reverse" }}>
          {repeatedLanguages.slice().reverse().map((lang, idx) => (
            <Link
              key={`rev-${lang.name}-${idx}`}
              href={`/discover?lang=${lang.name.toLowerCase()}`}
              className="flex items-center gap-2.5 px-6 py-3 mx-2 rounded-xl border border-border bg-surface text-text shadow-sm hover:border-gold hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <span className="text-xl">{lang.flag}</span>
              <span className="font-medium text-sm">{lang.name}</span>
            </Link>
          ))}
        </div>

        <div className="absolute right-0 top-0 z-10 h-full w-32 bg-gradient-to-l from-bg to-transparent" />
      </div>
    </section>
  );
}
