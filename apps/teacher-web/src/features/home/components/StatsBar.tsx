"use client";

import React, { useEffect, useRef } from "react";
import { motion, useAnimation, useInView, animate } from "framer-motion";

const stats = [
  { label: "Verified Teachers", value: 73, suffix: "+", isFloat: false },
  { label: "Languages Taught", value: 14, suffix: "+", isFloat: false },
  { label: "Classes Delivered", value: 500, suffix: "+", isFloat: false },
  { label: "Average Rating", value: 4.4, suffix: "/5", isFloat: true },
];

function AnimatedNumber({ value, isFloat, isInView }: { value: number, isFloat?: boolean, isInView: boolean }) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node && isInView) {
      const controls = animate(0, value, {
        duration: 1.5,
        ease: "easeOut" as const,
        onUpdate(v) {
          if (isFloat) {
            node.textContent = v.toFixed(1);
          } else {
            node.textContent = Math.round(v).toLocaleString();
          }
        }
      });
      return () => controls.stop();
    }
  }, [value, isFloat, isInView]);

  return <span ref={nodeRef}>{isFloat ? "0.0" : "0"}</span>;
}

export default function StatsBar() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const controls = useAnimation();
  const hasAnimated = useRef(false);

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
                  transition: { duration: 0.3, ease: "easeInOut" } as const,
                },
              }}
              className="flex flex-col items-center justify-center text-center px-4"
            >
              <div className="font-display text-3xl md:text-4xl font-bold text-text mb-2 tracking-tight">
                <span className="tabular-nums">
                  <AnimatedNumber value={stat.value} isFloat={stat.isFloat} isInView={isInView} />
                </span>
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
