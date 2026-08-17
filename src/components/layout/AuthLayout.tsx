"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

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
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-text">
            <BookOpen className="h-6 w-6 text-gold" />
            <span>LM</span>
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
      <div className="hidden lg:flex lg:w-1/2 relative bg-navy overflow-hidden flex-col items-center justify-center p-12 text-center text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-navy-2 z-0" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 mix-blend-overlay z-0" />
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gold/10 blur-[100px] z-0" />
        
        <div className="relative z-10 max-w-md space-y-6">
          <h2 className="font-display text-4xl font-bold text-balance leading-tight">
            The world&apos;s most effective way to learn a language.
          </h2>
          <p className="text-cream-2/80 text-lg">
            1-on-1 live video classes with verified native speakers. Pay securely with coins and learn anywhere.
          </p>
        </div>

        <div className="absolute inset-0 z-0 pointer-events-none select-none opacity-10">
          <span className="absolute top-[20%] left-[20%] font-script text-4xl text-gold animate-float-drift">Learn</span>
          <span className="absolute bottom-[30%] right-[20%] font-script text-5xl text-gold-soft animate-float-drift" style={{ animationDelay: "1s" }}>Fluency</span>
        </div>
      </div>
    </div>
  );
}
