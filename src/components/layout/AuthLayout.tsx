"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Logo } from "@/components/ui/Logo";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("auto");
    else setTheme("light");
  };

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
            {theme === "light" && <Sun className="h-5 w-5" />}
            {theme === "dark" && <Moon className="h-5 w-5" />}
            {theme === "auto" && <Monitor className="h-5 w-5" />}
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
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#f8f4ea] overflow-hidden flex-col items-center justify-center p-12 text-center text-navy">
        {/* Crisp globe illustration in full colour */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src="/brand/hero-globe.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="50vw"
            style={{ objectFit: "cover", objectPosition: "center", opacity: 0.9 }}
            priority
          />
        </div>
        
        {/* Soft gradient fade so text at the bottom is highly readable */}
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#f8f4ea] via-[#f8f4ea]/90 to-transparent z-0" />
        
        <div className="relative z-10 max-w-md space-y-6 mt-auto mb-12">
          <h2 className="font-display text-4xl font-bold text-balance leading-tight text-navy">
            The world&apos;s most effective way to learn a language.
          </h2>
          <p className="text-navy-2/80 text-lg font-medium">
            1-on-1 live video classes with verified native speakers. Pay securely with coins and learn anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}
