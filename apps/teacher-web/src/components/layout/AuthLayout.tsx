"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Logo } from "@/components/ui/Logo";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const ThemeIcon = theme === "light" ? Moon : Sun;

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Left side: Form */}
      <div className="flex w-full flex-col lg:w-1/2">
        {/* Header */}
        <header className="flex items-center justify-between p-6 md:px-12">
          <Link href="/" aria-label="Language Metrics — home">
            <Logo variant="full" size={40} />
          </Link>
          <button 
            onClick={toggleTheme}
            className="rounded-full p-2 text-text-muted hover:bg-surface-inset hover:text-text transition-colors"
          >
            <ThemeIcon className="h-[18px] w-[18px]" />
          </button>
        </header>

        {/* Form Container */}
        <div className="flex flex-1 flex-col justify-center px-6 md:px-16 lg:px-24">
          <div className="mx-auto w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>

      {/* Right side: Branded Panel (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-[#f8f4ea] overflow-hidden">
        {/* Globe zone — upper 55% of the panel */}
        <div className="relative flex-[0_0_55%] w-full overflow-hidden">
          <Image
            src="/brand/hero-globe.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="50vw"
            style={{ objectFit: "cover", objectPosition: "center top", opacity: 0.92 }}
            priority
          />
          {/* Bottom fade into the cream background below */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f8f4ea] to-transparent" />
        </div>

        {/* Text zone — lower 45%, completely clear of the image */}
        <div className="flex flex-1 flex-col items-center justify-center px-12 pb-16 text-center text-navy">
          <h2 className="font-display text-4xl font-bold text-balance leading-tight text-navy mb-4">
            Find the right teacher.<br />Learn on your own schedule.
          </h2>
          <p className="text-navy-2/75 text-base font-medium max-w-sm">
            Every teacher on our platform is manually verified before their first class. Book a ₹29 demo, then decide.
          </p>
        </div>
      </div>
    </div>
  );
}
