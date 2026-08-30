"use client";

import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Link href="/student/dashboard">
        <Button variant="ghost" size="sm" className="gap-1 text-gray-600">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </Link>

      <div className="text-center">
        <FileText className="w-10 h-10 text-amber-700 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-navy-900">Terms of Service</h1>
        <p className="text-sm text-gray-500 mt-2">Last updated: January 2025</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing and using Language Metrics (&quot;the Platform&quot;), you agree to be
            bound by these Terms of Service. If you do not agree, please do not use the
            Platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            2. Services
          </h2>
          <p>
            Language Metrics provides an online platform connecting students with
            language teachers for live 1-on-1 video classes. The Platform includes
            features such as class booking, live video sessions, chat, recordings, and
            a virtual coin wallet.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            3. User Accounts
          </h2>
          <p>
            You must create an account to use the Platform. You are responsible for
            maintaining the confidentiality of your credentials and for all activity
            under your account. You must provide accurate and complete information
            during registration.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            4. Payments & Refunds
          </h2>
          <p>
            All payments are processed through Razorpay. Coins purchased on the
            Platform are non-transferable and non-refundable except as required by
            applicable law. Demo classes are non-refundable. Hourly and course bookings
            may be cancelled free of charge up to 12 hours before the scheduled start
            time. Cancellations within 12 hours are non-refundable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            5. Class Attendance
          </h2>
          <p>
            Students may join a live class up to 5 minutes before the scheduled start
            time. If a student fails to join a session, it will be recorded as a
            no-show and no refund will be issued.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            6. Code of Conduct
          </h2>
          <p>
            Users must behave respectfully towards teachers and other users. Harassment,
            abuse, or inappropriate behavior during sessions or through chat will result
            in account suspension or termination.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            7. Intellectual Property
          </h2>
          <p>
            All content on the Platform, including course materials, recordings, and
            software, is the property of Language Metrics or its licensors and is
            protected by copyright laws. Recordings are for personal use only and may
            not be redistributed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            8. Limitation of Liability
          </h2>
          <p>
            Language Metrics is not liable for any indirect, incidental, or consequential
            damages arising from the use of the Platform. Our total liability shall not
            exceed the amount paid by you in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            9. Changes to Terms
          </h2>
          <p>
            We may update these Terms at any time. Continued use of the Platform after
            changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-navy-900 mb-3">
            10. Contact
          </h2>
          <p>
            For questions about these Terms, please contact us at{" "}
            <span className="text-amber-700 font-medium">support@languagemetrics.com</span>
          </p>
        </section>
      </div>
    </div>
  );
}

