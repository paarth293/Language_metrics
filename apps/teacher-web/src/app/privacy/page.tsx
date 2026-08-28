import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Language Metrics",
  description: "Language Metrics privacy policy. Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-white/70">Last updated: August 28, 2026</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto prose prose-sm max-w-none">
          <h2 className="font-display text-2xl font-bold text-text mb-4">1. Information We Collect</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            When you use Language Metrics, we collect information you provide directly, such as your name, email address, and profile information. We also collect usage data including session recordings, chat messages, and interaction patterns to improve our platform.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">2. How We Use Your Information</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            We use your information to provide language learning services, match students with teachers, process payments, send notifications about classes, and improve our platform. We do not sell your personal information to third parties.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">3. Data Storage & Security</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            Your data is stored on secure servers provided by Supabase and encrypted in transit using TLS. We implement industry-standard security measures including HTTP-only cookies for authentication tokens and encrypted database storage.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">4. Cookies</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            We use essential cookies for authentication and session management. You can manage your cookie preferences through our cookie consent banner. See our <Link href="/cookies" className="text-brand hover:underline">Cookie Policy</Link> for details.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">5. Your Rights</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            You have the right to access, correct, or delete your personal data. You can manage most of your information through your profile settings. For additional requests, contact us at hello@languagemetrics.com.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">6. Contact</h2>
          <p className="text-text-muted leading-relaxed">
            For privacy-related questions, email us at{" "}
            <a href="mailto:hello@languagemetrics.com" className="text-brand hover:underline">hello@languagemetrics.com</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
