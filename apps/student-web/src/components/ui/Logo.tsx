import React from "react";
import Image from "next/image";

interface LogoProps {
  /**
   * "full"  -- logo image + "Language Metrics" wordmark text beside it
   * "mark"  -- logo image only, no text
   */
  variant?: "full" | "mark";
  /** Height of the logo image in px (width scales proportionally via aspect ratio) */
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
      {/* Full logo image � no crop, no background box, aspect-ratio preserved */}
      <Image
        src="/brand/logo-full.png"
        alt="Language Metrics"
        width={size}
        height={size}
        style={{
          objectFit: "contain",
          width: "auto",
          height: size,
        }}
        priority
        draggable={false}
      />

      {/* Wordmark text beside logo (full variant only) */}
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
