import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Cookie Policy — Language Metrics",
  description: "Language Metrics cookie policy. Learn about the cookies we use and how to manage your preferences.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
          <p className="text-lg text-white/70">Last updated: August 28, 2026</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto prose prose-sm max-w-none">
          <h2 className="font-display text-2xl font-bold text-text mb-4">What Are Cookies?</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            Cookies are small text files stored on your device when you visit a website. They help us provide a better experience by remembering your preferences and keeping you logged in.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">Essential Cookies</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            These cookies are necessary for the platform to function. They handle authentication (httpOnly cookies for JWT tokens), session management, and security (CSRF protection). You cannot opt out of these cookies as the platform will not work without them.
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
              <thead className="bg-surface-inset">
                <tr>
                  <th className="text-left p-3 font-medium text-text">Cookie</th>
                  <th className="text-left p-3 font-medium text-text">Purpose</th>
                  <th className="text-left p-3 font-medium text-text">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-3 text-text-muted font-mono text-xs">lm_access_token</td>
                  <td className="p-3 text-text-muted">Authentication</td>
                  <td className="p-3 text-text-muted">15 minutes</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 text-text-muted font-mono text-xs">lm_refresh_token</td>
                  <td className="p-3 text-text-muted">Session refresh</td>
                  <td className="p-3 text-text-muted">7 days</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 text-text-muted font-mono text-xs">lm_csrf_token</td>
                  <td className="p-3 text-text-muted">CSRF protection</td>
                  <td className="p-3 text-text-muted">Session</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="font-display text-2xl font-bold text-text mb-4">Analytics Cookies</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            We use privacy-friendly analytics (Plausible) that do not use cookies and do not track you across sites. This helps us understand how the platform is used without compromising your privacy.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">Managing Cookies</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            You can manage your cookie preferences through our cookie consent banner. You can also clear cookies through your browser settings. Note that disabling essential cookies will prevent you from using the platform.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">Contact</h2>
          <p className="text-text-muted leading-relaxed">
            For questions about cookies, email us at{" "}
            <a href="mailto:hello@languagemetrics.com" className="text-brand hover:underline">hello@languagemetrics.com</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
