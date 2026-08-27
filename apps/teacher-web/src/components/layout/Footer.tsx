import React from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface text-text">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4 lg:gap-8">
          <div className="space-y-4">
            <Link href="/" className="inline-flex" aria-label="Language Metrics — home">
              <Logo variant="full" size={40} />
            </Link>
            <p className="text-sm text-text-muted text-balance">
              Find your perfect language teacher and actually book them in minutes. Learn naturally with 1-on-1 live video classes.
            </p>
            <div className="flex gap-4 text-sm font-medium text-text-muted">
              <a href="https://www.facebook.com/share/1DMjvSQGrU/" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">Facebook</a>
              <a href="https://www.instagram.com/languagemetrics?utm_source=qr&igsi=MW0wd25vZDExcWtvYg==" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">Instagram</a>
              <a href="https://www.linkedin.com/company/languagemetrics/" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">LinkedIn</a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-text">Product</h3>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><a href="#students" className="hover:text-gold transition-colors">For Students</a></li>
              <li><a href="#pricing" className="hover:text-gold transition-colors">Pricing & Coins</a></li>
              <li><Link href="#" className="hover:text-gold transition-colors">Browse Languages</Link></li>
              <li><Link href="#" className="hover:text-gold transition-colors">Student Reviews</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-text">For Teachers</h3>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="/register/teacher" className="hover:text-gold transition-colors">Apply to Teach</Link></li>
              <li><Link href="#" className="hover:text-gold transition-colors">Teacher Handbook</Link></li>
              <li><Link href="#" className="hover:text-gold transition-colors">Earnings & Payouts</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-text">Stay Updated</h3>
            <p className="text-sm text-text-muted mb-4">Subscribe to our newsletter for language learning tips.</p>
            <form className="flex flex-col gap-2">
              <Input type="email" placeholder="Enter your email" className="bg-bg" />
              <Button variant="primary" className="w-full">Subscribe</Button>
            </form>
          </div>
        </div>

        <div className="mt-16 border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-subtle text-center md:text-left">
          <p>© {new Date().getFullYear()} Language Metrics. All rights reserved.</p>
          <div className="flex flex-wrap justify-center md:justify-end gap-4 md:gap-6">
            <Link href="#" className="hover:text-text transition-colors">Privacy (DPDP Act)</Link>
            <Link href="#" className="hover:text-text transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-text transition-colors">Secure Payments via Razorpay</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
