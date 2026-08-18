import React from "react";
import Image from "next/image";

interface LogoProps {
  /**
   * "full"  — logo mark + "Language Metrics"
   * "mark"  — logo image only, compact square (sidebar, favicon context)
   */
  variant?: "full" | "mark";
  /** Size of the logo mark in px */
  size?: number;
  className?: string;
}

export function Logo({ variant = "full", size = 36, className = "" }: LogoProps) {
  const isMark = variant === "mark";

  return (
    <span
      className={[
        "inline-flex items-center gap-3 shrink-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Logo mark image ── */}
      <span
        className="relative shrink-0 flex items-center justify-center overflow-hidden rounded-[0.4rem] bg-[#f8f4ea] shadow-sm border border-black/5 dark:border-white/10"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/logo-full.png"
          alt="Language Metrics Logo"
          fill
          sizes={`${size}px`}
          style={{
            objectFit: "cover",
            objectPosition: "50% 5%", // Crop perfectly to the emblem at the top
            transform: "scale(1.25)", // Zoom in slightly to hide the bottom text
          }}
          priority
          draggable={false}
        />
      </span>

      {/* ── Wordmark text (full variant only) ── */}
      {!isMark && (
        <span 
          className="font-display font-semibold text-text tracking-tight whitespace-nowrap" 
          style={{ fontSize: size * 0.55 }}
        >
          Language Metrics
        </span>
      )}
    </span>
  );
}
