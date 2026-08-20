"use client";

import React, { useEffect } from "react";
import { motion, useAnimation, useInView } from "framer-motion";

const stats = [
  { label: "Verified Teachers", value: "2,500+", suffix: "" },
  { label: "Languages Taught", value: "45", suffix: "+" },
  { label: "Classes Delivered", value: "120", suffix: "k" },
  { label: "Average Rating", value: "4.9", suffix: "/5" },
];

export default function StatsBar() {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const controls = useAnimation();
  const hasAnimated = React.useRef(false);

  useEffect(() => {
    if (isInView && !hasAnimated.current) {
      controls.start("visible");
      hasAnimated.current = true;
    }
  }, [isInView, controls]);

  return (
    <section className="py-12 border-y border-border bg-surface-2" ref={ref}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:divide-x md:divide-border">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial="hidden"
              animate={controls}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
                },
              }}
              className="flex flex-col items-center justify-center text-center px-4"
            >
              <div className="font-display text-4xl font-bold text-text mb-2 tracking-tight">
                <span className="tabular-nums">{stat.value}</span>
                <span className="text-gold">{stat.suffix}</span>
              </div>
              <div className="text-sm font-medium text-text-muted uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
