"use client";

import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="gap-1 text-gray-600">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </Link>

      <div className="text-center">
        <Shield className="w-10 h-10 text-amber-700 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-navy-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mt-2">Last updated: January 2025</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            1. Information We Collect
          </h2>
          <p>
            We collect information you provide directly: name, email, language
            preferences, payment information (processed securely via Razorpay), and
            communications with teachers. We also collect device tokens for push
            notifications when you opt in.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            2. How We Use Your Information
          </h2>
          <p>
            Your information is used to: provide and improve our services, process
            payments, connect you with teachers, send class reminders and notifications,
            ensure platform security, and communicate important updates.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            3. Data Sharing
          </h2>
          <p>
            We do not sell your personal information. We share data with teachers only
            as necessary for class delivery (name, language preferences). Payment data
            is handled exclusively by Razorpay and never stored on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            4. Chat & Recordings
          </h2>
          <p>
            Chat messages may be auto-deleted after a set period. Class recordings are
            stored securely and accessible only to the enrolled student and teacher.
            You can request deletion of recordings by contacting support.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            5. Data Security
          </h2>
          <p>
            We implement industry-standard security measures including encryption in
            transit (TLS), encrypted storage for sensitive data, and regular security
            audits. However, no method of transmission is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            6. Your Rights
          </h2>
          <p>
            You have the right to: access your personal data, correct inaccurate data,
            request deletion of your data, export your data, and opt out of
            non-essential communications. To exercise these rights, contact us at{" "}
            <span className="text-amber-700 font-medium">privacy@languagemetrics.com</span>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            7. Account Deletion
          </h2>
          <p>
            You may request account deletion through the Profile settings or by
            contacting support. Upon deletion, your personal data will be removed or
            anonymized within 30 days, except where retention is required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            8. Cookies
          </h2>
          <p>
            We use essential cookies for authentication and session management. Optional
            analytics cookies help us improve the platform. You can manage cookie
            preferences through the cookie consent banner.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            9. Changes to Policy
          </h2>
          <p>
            We may update this Privacy Policy at any time. Significant changes will be
            communicated via email or in-app notification.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            10. Contact
          </h2>
          <p>
            For privacy-related questions, contact our Data Protection Officer at{" "}
            <span className="text-amber-700 font-medium">privacy@languagemetrics.com</span>
          </p>
        </section>
      </div>
    </div>
  );
}
