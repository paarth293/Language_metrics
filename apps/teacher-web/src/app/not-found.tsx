import type { Metadata } from "next";
import Link from "next/link";
import { Home, Search, ArrowLeft, BookOpen, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Not Found — Language Metrics",
  description: "The page you're looking for doesn't exist or has been moved.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Large 404 */}
        <div className="mb-8">
          <span className="text-[120px] font-display font-bold text-brand/10 leading-none">404</span>
        </div>

        <h1 className="text-3xl font-display font-bold text-text mb-3">Page not found</h1>
        <p className="text-text-muted mb-8 max-w-md mx-auto">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have been moved or doesn&apos;t exist.
        </p>

        {/* Internal Links */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all duration-200"
          >
            <Home className="w-4 h-4" /> Go Home
          </Link>
          <Link
            href="/login/teacher"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-text font-medium text-sm hover:bg-surface-inset transition-all duration-200"
          >
            <BookOpen className="w-4 h-4" /> Teacher Login
          </Link>
          <Link
            href="/login/student"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-text font-medium text-sm hover:bg-surface-inset transition-all duration-200"
          >
            <Search className="w-4 h-4" /> Student Login
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="border-t border-border pt-6">
          <p className="text-xs text-text-subtle mb-3 uppercase tracking-wider font-medium">Helpful Links</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/about" className="text-sm text-brand hover:underline">About Us</Link>
            <span className="text-text-subtle">·</span>
            <Link href="/contact" className="text-sm text-brand hover:underline">Contact</Link>
            <span className="text-text-subtle">·</span>
            <Link href="/faq" className="text-sm text-brand hover:underline">FAQ</Link>
            <span className="text-text-subtle">·</span>
            <Link href="/waitlist" className="text-sm text-brand hover:underline">Join Waitlist</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
