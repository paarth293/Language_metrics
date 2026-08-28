import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — Language Metrics",
  description: "Language Metrics terms of service. Read the rules and guidelines for using our platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-lg text-white/70">Last updated: August 28, 2026</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto prose prose-sm max-w-none">
          <h2 className="font-display text-2xl font-bold text-text mb-4">1. Acceptance of Terms</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            By accessing or using Language Metrics, you agree to these Terms of Service. If you do not agree, please do not use our platform. These terms apply to all users, including students, teachers, and visitors.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">2. Account Registration</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            You must provide accurate and complete information during registration. You are responsible for maintaining the security of your account credentials. One account per person — duplicate accounts may be suspended.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">3. Platform Usage</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            Language Metrics connects language learners with verified teachers for live video sessions. Students book classes using coins (virtual currency). Teachers receive payouts based on completed sessions. Abuse, harassment, or inappropriate behavior will result in account termination.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">4. Payments & Refunds</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            Coins are purchased through Razorpay and are non-refundable once used. If a teacher cancels a session, the student receives a full refund of coins. Cancellations within 24 hours of a session may not be refunded. See our <Link href="/faq" className="text-brand hover:underline">FAQ</Link> for details.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">5. Intellectual Property</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            All content on Language Metrics, including logos, design, and code, is our intellectual property. Session recordings are owned by the platform and may be used for quality assurance. Teachers retain rights to their teaching materials.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">6. Termination</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time through your profile settings. Upon termination, access to the platform is revoked.
          </p>

          <h2 className="font-display text-2xl font-bold text-text mb-4">7. Contact</h2>
          <p className="text-text-muted leading-relaxed">
            For questions about these terms, contact us at{" "}
            <a href="mailto:hello@languagemetrics.com" className="text-brand hover:underline">hello@languagemetrics.com</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
