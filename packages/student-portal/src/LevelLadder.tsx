"use client";

import React from "react";
import { motion } from "framer-motion";
import { getLanguageConfig, getLevelsForLanguage, LANGUAGES, type LanguageLevel } from "@repo/languages";
import { cn } from "@repo/ui/cn";
import { ease } from "./primitives";

/**
 * The student's level as a position on their language's own scale — CEFR
 * A1→C2, JLPT N5→N1, HSK 1→6, TOPIK 1→6. Steps below the current one read as
 * covered ground, the current one is marked, the rest are still ahead.
 *
 * Read-only on the dashboard; on the profile it doubles as the level picker.
 */

/** Level descriptions in English: the per-language ones are written in that language. */
function englishDescription(level: LanguageLevel, system: string) {
  if (system !== "CEFR") return level.description;
  return LANGUAGES[0]!.levels.find((l) => l.value === level.value)?.description ?? level.description;
}

export function levelInfo(language: string, value: string) {
  const config = getLanguageConfig(language);
  const levels = getLevelsForLanguage(language);
  const system = config?.levelSystem ?? "CEFR";
  const index = levels.findIndex((l) => l.value === value);
  const current = index >= 0 ? levels[index] : undefined;
  return {
    /** Stored values are lowercase ("spanish"); this is the display name. */
    languageName: config?.name ?? (language ? language[0]!.toUpperCase() + language.slice(1) : ""),
    levels,
    system,
    index,
    current,
    description: current ? englishDescription(current, system) : undefined,
    /** "B1 — Intermediate" in English for CEFR, the language's own label otherwise. */
    label: current
      ? system === "CEFR"
        ? (LANGUAGES[0]!.levels.find((l) => l.value === current.value)?.label ?? current.label)
        : current.label
      : undefined,
  };
}

export function LevelLadder({
  language,
  value,
  onChange,
  tone = "surface",
  className,
}: {
  language: string;
  value: string;
  /** Present on the profile, where a step can be picked. */
  onChange?: (value: string) => void;
  /** "navy" for use on the dark hero card. */
  tone?: "surface" | "navy";
  className?: string;
}) {
  const { levels, index, system } = levelInfo(language, value);
  const onNavy = tone === "navy";
  const Step = onChange ? "button" : "div";

  return (
    <div className={className}>
      <ol
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}
        aria-label={`${system} levels`}
        role={onChange ? "radiogroup" : undefined}
      >
        {levels.map((level, i) => {
          const reached = index >= 0 && i < index;
          const current = i === index;
          return (
            <li key={level.value} className="min-w-0">
              <Step
                {...(onChange
                  ? {
                      type: "button" as const,
                      role: "radio",
                      "aria-checked": current,
                      onClick: () => onChange(level.value),
                      title: englishDescription(level, system),
                    }
                  : { "aria-current": current ? ("step" as const) : undefined })}
                className={cn(
                  "group flex w-full flex-col items-stretch gap-1.5 text-left",
                  onChange && "rounded-md focus-ring"
                )}
              >
                <span className="relative h-1.5 overflow-hidden rounded-full">
                  <span className={cn("absolute inset-0", onNavy ? "bg-cream/12" : "bg-surface-inset")} />
                  {(reached || current) && (
                    <motion.span
                      className={cn("absolute inset-0 origin-left", current ? "bg-action" : onNavy ? "bg-cream/45" : "bg-brand/45")}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.5, delay: 0.15 + i * 0.06, ease }}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "truncate text-[11px] font-bold tabular-nums tracking-[0.02em] transition-colors",
                    current
                      ? onNavy
                        ? "text-gold"
                        : "text-gold-strong"
                      : reached
                        ? onNavy
                          ? "text-cream/70"
                          : "text-text-secondary"
                        : onNavy
                          ? "text-cream/35"
                          : "text-text-subtle",
                    onChange && !current && "group-hover:text-text"
                  )}
                >
                  {level.shortLabel}
                </span>
              </Step>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
