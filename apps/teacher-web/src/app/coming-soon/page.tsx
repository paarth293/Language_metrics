"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-client";
import { Logo } from "@/components/ui/Logo";

export default function ComingSoonPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 md:px-12 border-b border-border bg-surface">
        <Link href="/" aria-label="Language Metrics — home">
          <Logo variant="full" size={40} />
        </Link>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-text hidden sm:inline-block">
              Hello, {user.name.split(" ")[0]}
            </span>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-inset hover:text-text transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-sm font-medium text-gold hover:text-gold-dark transition-colors">
            Sign in
          </Link>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-[500px] h-[500px] bg-gold blur-[120px] rounded-full opacity-20 absolute top-1/4 -left-32"></div>
          <div className="w-[400px] h-[400px] bg-navy blur-[100px] rounded-full opacity-10 absolute bottom-1/4 -right-32"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 text-gold mb-6 border border-gold/20 shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-navy mb-6 tracking-tight">
            Something extraordinary is in the works
          </h1>
          
          <p className="text-lg md:text-xl text-text-muted mb-10 max-w-xl mx-auto leading-relaxed">
            We&apos;re building the ultimate language learning experience. Your {user?.role.toLowerCase() || 'account'} portal will be available very soon. Thank you for being an early member!
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-navy text-white font-medium hover:bg-navy-2 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Homepage
            </Link>
            
            <a 
              href="mailto:hello@languagemetrics.com"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-xl border-2 border-border bg-surface text-text font-medium hover:bg-surface-inset transition-all"
            >
              Contact Support
            </a>
          </div>
        </motion.div>
      </main>

      {/* Footer minimal */}
      <footer className="py-6 text-center border-t border-border bg-surface text-sm text-text-muted">
        <p>© {new Date().getFullYear()} Language Metrics. All rights reserved.</p>
      </footer>
    </div>
  );
}
