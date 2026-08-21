"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { TrendPoint } from "./types";

interface PlatformPulseChartProps {
  data: TrendPoint[];
  preview?: boolean;
  totalRevenue: string;
}

const WIDTH = 680;
const HEIGHT = 238;
const PADDING = { top: 18, right: 12, bottom: 30, left: 42 };

function chartPath(values: number[], maxValue: number, close = false): string {
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const points = values.map((value, index) => {
    const x = PADDING.left + (index / Math.max(values.length - 1, 1)) * innerWidth;
    const y = PADDING.top + innerHeight - (value / maxValue) * innerHeight;
    return [x, y] as const;
  });

  if (!points.length) return "";
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  if (!close) return line;
  const last = points[points.length - 1];
  const first = points[0];
  const baseline = HEIGHT - PADDING.bottom;
  return `${line} L ${last[0].toFixed(1)} ${baseline} L ${first[0].toFixed(1)} ${baseline} Z`;
}

export function PlatformPulseChart({ data, preview = false, totalRevenue }: PlatformPulseChartProps) {
  const [activeIndex, setActiveIndex] = useState(data.length - 1);
  const reduceMotion = useReducedMotion();
  const maxValue = useMemo(() => Math.max(...data.flatMap((point) => [point.current, point.previous]), 1) * 1.12, [data]);
  const currentPath = useMemo(() => chartPath(data.map((point) => point.current), maxValue), [data, maxValue]);
  const currentArea = useMemo(() => chartPath(data.map((point) => point.current), maxValue, true), [data, maxValue]);
  const previousPath = useMemo(() => chartPath(data.map((point) => point.previous), maxValue), [data, maxValue]);
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const activePoint = data[activeIndex] ?? data[data.length - 1];

  return (
    <section className="lm-panel min-w-0 p-6" aria-labelledby="platform-pulse-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="lm-kicker">Platform pulse</p>
            <span className="lm-status lm-status--teal">{preview ? "Preview" : "Live"}</span>
          </div>
          <h2 id="platform-pulse-title" className="mt-2 text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Revenue performance</h2>
          <p className="mt-1 text-[11px] text-[var(--lm-muted)]">Collected revenue compared with the previous period.</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-semibold text-[var(--lm-muted)]">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--lm-teal)]" />Current period</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#b8c9c8]" />Previous</span>
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <span className="lm-mono text-[25px] font-semibold tracking-[-0.06em] text-[var(--lm-ink-strong)]">{totalRevenue}</span>
        <span className="text-[11px] font-semibold text-[var(--lm-teal-deep)]">+12.4%</span>
        <span className="text-[10px] text-[var(--lm-subtle)]">vs last period</span>
      </div>

      <div className="mt-4 overflow-hidden" role="img" aria-label="Revenue trend chart comparing current and previous period">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto max-h-[238px] w-full min-w-[500px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lmPulseFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--lm-teal)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--lm-teal)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = PADDING.top + innerHeight - fraction * innerHeight;
            return <line key={fraction} x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} className="lm-chart-grid" />;
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const value = Math.round(maxValue * fraction);
            const y = PADDING.top + innerHeight - fraction * innerHeight + 4;
            return <text key={fraction} x={2} y={y} className="lm-chart-label">₹{value}k</text>;
          })}
          <motion.path d={currentArea} fill="url(#lmPulseFill)" stroke="none" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
          <motion.path d={previousPath} fill="none" stroke="#b8c9c8" strokeWidth="1.5" strokeDasharray="5 5" initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
          <motion.path d={currentPath} fill="none" stroke="var(--lm-teal)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
          {data.map((point, index) => {
            const x = PADDING.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
            const y = PADDING.top + innerHeight - (point.current / maxValue) * innerHeight;
            return (
              <circle
                key={point.label}
                cx={x}
                cy={y}
                r={activeIndex === index ? 5 : 3}
                fill="var(--lm-surface)"
                stroke="var(--lm-teal)"
                strokeWidth={activeIndex === index ? 3 : 2}
                tabIndex={0}
                aria-label={`${point.label}: current ₹${point.current}k, previous ₹${point.previous}k`}
                onFocus={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className="cursor-pointer outline-none"
              />
            );
          })}
          {data.filter((_, index) => index === 0 || index === data.length - 1 || index === Math.floor(data.length / 2)).map((point) => {
            const index = data.indexOf(point);
            const x = PADDING.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
            return <text key={`label-${point.label}`} x={x} y={HEIGHT - 7} textAnchor="middle" className="lm-chart-label">{point.label}</text>;
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--lm-line)] pt-3 text-[10px] text-[var(--lm-subtle)]">
        <span>{preview ? "Trend preview · historical analytics not connected" : "01–20 Aug 2026 · INR"}</span>
        <span className="flex items-center gap-1 font-semibold text-[var(--lm-teal-deep)]">{activePoint?.label} · ₹{activePoint?.current}k <ArrowUpRight size={12} aria-hidden="true" /></span>
      </div>
    </section>
  );
}
