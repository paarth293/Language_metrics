"use client";

import React from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
const Instagram = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const Facebook = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const footerLinks = {
  Product: [
    { label: "Find a Teacher", href: "/student/discover" },
    { label: "How It Works", href: "/about" },
    { label: "Pricing", href: "/faq" },
    { label: "Demo Class", href: "/register/student" },
  ],
  Teachers: [
    { label: "Apply to Teach", href: "/register/teacher" },
    { label: "Teacher Dashboard", href: "/login/teacher" },
    { label: "Teacher FAQ", href: "/faq" },
    { label: "Earnings Guide", href: "/faq" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "FAQ", href: "/faq" },
    { label: "Join Waitlist", href: "/waitlist" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cancellation Policy", href: "/cancellation" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">LM</span>
              </div>
              <span className="font-display font-bold text-text">Language Metrics</span>
            </Link>
            <p className="text-sm text-text-muted mb-4">
              Connect with verified language professionals for live 1-on-1 video classes.
            </p>
            <div className="flex gap-3">
              <a href="https://www.instagram.com/languagemetrics?utm_source=qr&igsi=MW0wd25vZDExcWtvYg==" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-surface-inset flex items-center justify-center text-text-muted hover:text-brand hover:bg-brand/10 transition-colors" aria-label="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://www.facebook.com/share/1DMjvSQGrU/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-surface-inset flex items-center justify-center text-text-muted hover:text-brand hover:bg-brand/10 transition-colors" aria-label="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="mailto:hello@languagemetrics.com" className="w-8 h-8 rounded-lg bg-surface-inset flex items-center justify-center text-text-muted hover:text-brand hover:bg-brand/10 transition-colors">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-text mb-3">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-text-muted hover:text-brand transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-subtle">
          <p>© {new Date().getFullYear()} Language Metrics. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-text transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-text transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-text transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
