"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Moon, Monitor, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("auto");
    else setTheme("light");
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-surface/80 backdrop-blur-md shadow-sm border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="Language Metrics — home">
          <Logo variant="full" size={44} />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-text-muted">
          <Link href="#students" className="hover:text-text transition-colors">For Students</Link>
          <Link href="#teachers" className="hover:text-text transition-colors">For Teachers</Link>
          <Link href="#how-it-works" className="hover:text-text transition-colors">How It Works</Link>
          <Link href="#pricing" className="hover:text-text transition-colors">Pricing</Link>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="rounded-full p-2 text-text-muted hover:bg-surface-inset hover:text-text transition-colors"
          >
            {theme === "light" && <Sun className="h-5 w-5" />}
            {theme === "dark" && <Moon className="h-5 w-5" />}
            {theme === "auto" && <Monitor className="h-5 w-5" />}
          </button>
          
          <Link href="/login" className="text-sm font-medium text-text hover:text-gold transition-colors">
            Sign in
          </Link>
          <Button asChild variant="gold">
            <Link href="/register/student">Get Started</Link>
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 text-text" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute inset-x-0 top-16 bg-surface shadow-lg border-b border-border md:hidden">
          <div className="flex flex-col space-y-4 px-4 py-6">
            <Link href="#students" className="text-text hover:text-gold" onClick={() => setMobileMenuOpen(false)}>For Students</Link>
            <Link href="#teachers" className="text-text hover:text-gold" onClick={() => setMobileMenuOpen(false)}>For Teachers</Link>
            <Link href="#how-it-works" className="text-text hover:text-gold" onClick={() => setMobileMenuOpen(false)}>How It Works</Link>
            <Link href="#pricing" className="text-text hover:text-gold" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            
            <div className="pt-4 border-t border-border flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-text">Theme</span>
                <button onClick={toggleTheme} className="p-2 bg-surface-inset rounded-full text-text">
                  {theme === "light" && <Sun className="h-5 w-5" />}
                  {theme === "dark" && <Moon className="h-5 w-5" />}
                  {theme === "auto" && <Monitor className="h-5 w-5" />}
                </button>
              </div>
              <Button asChild variant="outline" className="w-full justify-center">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
              </Button>
              <Button asChild variant="gold" className="w-full justify-center">
                <Link href="/register/student" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
