"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Globe, LayoutDashboard, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";

const navLinks = [
  { label: "For Students", href: "#students" },
  { label: "For Teachers", href: "#teachers" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

function dashboardPath(role: string) {
  if (role === "TEACHER") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/student/dashboard";
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "backdrop-blur-md bg-cream/90 shadow-navy-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1240px] mx-auto px-6 h-[74px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center shadow-navy-sm transition-transform duration-300 group-hover:-rotate-6">
              <Globe className="w-5 h-5 text-gold" />
            </div>
            <span className="font-display font-semibold text-navy text-[17px] tracking-tight">
              Language Metrics
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-[14px] font-medium text-navy/70 hover:text-navy rounded-full hover:bg-navy/5 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href={dashboardPath(user.role)}
                  className="flex items-center gap-2 px-5 py-2 text-[14px] font-semibold text-navy hover:text-gold transition-colors duration-200"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-5 py-2 text-[14px] font-semibold text-navy hover:text-gold transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/register/student"
                  className="btn-primary px-5 py-2.5 text-[14px] font-semibold"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-navy/5 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-navy" />
            ) : (
              <Menu className="w-5 h-5 text-navy" />
            )}
          </button>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[74px] inset-x-0 z-40 backdrop-blur-md bg-cream/95 border-b border-navy/10 px-6 py-4 md:hidden"
          >
            <nav className="flex flex-col gap-1 mb-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-[15px] font-medium text-navy/80 hover:text-navy hover:bg-navy/5 rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex flex-col gap-2">
              {user ? (
                <>
                  <Link
                    href={dashboardPath(user.role)}
                    onClick={() => setMobileOpen(false)}
                    className="btn-outline px-5 py-3 text-[14px] font-semibold text-center"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="btn-primary px-5 py-3 text-[14px] font-semibold text-center"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="btn-outline px-5 py-3 text-[14px] font-semibold text-center"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register/student"
                    onClick={() => setMobileOpen(false)}
                    className="btn-primary px-5 py-3 text-[14px] font-semibold text-center"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
