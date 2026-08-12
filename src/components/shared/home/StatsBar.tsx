"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const stats = [
  { value: 2400, suffix: "+", label: "Verified Teachers" },
  { value: 18000, suffix: "+", label: "Active Students" },
  { value: 42, suffix: "", label: "Languages Offered" },
  { value: 4.9, suffix: "/5", label: "Average Rating", decimal: true },
];

function AnimatedCounter({
  target,
  suffix,
  decimal,
}: {
  target: number;
  suffix: string;
  decimal?: boolean;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(decimal ? Math.round(current * 10) / 10 : Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target, decimal]);

  return (
    <span ref={ref}>
      {decimal ? count.toFixed(1) : count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function StatsBar() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="relative z-10 bg-navy py-12 overflow-hidden"
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, #f8f4ea08 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="max-w-[1240px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x md:divide-cream/10">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center px-6"
            >
              <div className="font-display font-bold text-cream mb-1" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  decimal={stat.decimal}
                />
              </div>
              <div className="text-[13px] font-medium text-cream/50 uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
