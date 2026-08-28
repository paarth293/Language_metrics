"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    category: "Getting Started",
    items: [
      {
        q: "How do I sign up as a student?",
        a: "Click 'Sign Up' or 'Start Learning' on our homepage. You can register with your email or sign in with Google. After registration, complete your profile to start booking classes.",
      },
      {
        q: "Do I need to verify my email?",
        a: "Yes, we send a verification code to your email after registration. You must verify your email before you can book classes or access the dashboard.",
      },
      {
        q: "How do I add coins to my wallet?",
        a: "Go to your Wallet page and click 'Top Up Coins'. You can purchase coins via Razorpay using UPI, credit/debit cards, or net banking. 1 Coin = ₹1.",
      },
    ],
  },
  {
    category: "Booking Classes",
    items: [
      {
        q: "How do I book a class?",
        a: "Go to the Discover page, browse available teachers, and click 'Book Demo' or 'Book Class'. Select your preferred time slot and confirm the booking using your coins.",
      },
      {
        q: "What is a demo class?",
        a: "A demo class is a discounted introductory session (49 coins) that lets you meet the teacher and assess if they're the right fit before committing to regular classes.",
      },
      {
        q: "Can I cancel or reschedule a booking?",
        a: "Yes, you can cancel or reschedule up to 24 hours before the class. Cancellations within 24 hours may not be refunded. Check the Cancellation Policy for details.",
      },
      {
        q: "How do I join a live class?",
        a: "When your class is about to start, a 'Join Class' button will appear on your dashboard or classes page. Click it to enter the video classroom. The button activates 10 minutes before the scheduled time.",
      },
    ],
  },
  {
    category: "Teachers",
    items: [
      {
        q: "How are teachers verified?",
        a: "Every teacher goes through a multi-step verification process: document verification (education, ID proof), a live interview, and a demo class review. Only approved teachers can receive bookings.",
      },
      {
        q: "Can I choose my teacher?",
        a: "Yes! Browse teachers on the Discover page, filter by language, rating, and price. You can view their profile, reviews, and availability before booking.",
      },
      {
        q: "How do teacher ratings work?",
        a: "After completing a class, students can leave a 1-5 star rating and optional review. Ratings help other students find the best teachers.",
      },
    ],
  },
  {
    category: "Payments & Wallet",
    items: [
      {
        q: "What payment methods are accepted?",
        a: "We accept UPI, credit/debit cards, and net banking through Razorpay. All payments are secure and encrypted.",
      },
      {
        q: "Do coins expire?",
        a: "No, coins never expire. You can use them anytime to book classes.",
      },
      {
        q: "What is the refund policy?",
        a: "If a teacher cancels, you get an automatic full refund. For student cancellations, refunds depend on timing. Contact support for specific cases.",
      },
    ],
  },
  {
    category: "Technical",
    items: [
      {
        q: "What are the system requirements?",
        a: "You need a modern web browser (Chrome, Firefox, Safari, Edge), a stable internet connection (5+ Mbps recommended), a webcam, and a microphone.",
      },
      {
        q: "Is there a mobile app?",
        a: "Currently, we offer a web-based platform optimized for both desktop and mobile browsers. A dedicated mobile app is coming soon — join the waitlist to be notified!",
      },
      {
        q: "What if I have connection issues during a class?",
        a: "If you lose connection, rejoin using the same link. If the teacher disconnects, they will rejoin. Session recordings are available for completed classes.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-inset/50 transition-colors"
      >
        <span className="font-medium text-text pr-4">{q}</span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-text-muted leading-relaxed border-t border-border pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-sm font-medium mb-6">Help Center</span>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto">
            Everything you need to know about Language Metrics. Can&apos;t find an answer? Contact us.
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-12">
          {faqs.map((section) => (
            <div key={section.category}>
              <h2 className="font-display text-xl font-bold text-text mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand" />
                {section.category}
              </h2>
              <div className="space-y-3">
                {section.items.map((faq) => (
                  <FAQItem key={faq.q} q={faq.q} a={faq.a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-2xl font-bold text-text mb-3">Still have questions?</h2>
          <p className="text-text-muted mb-6">Our support team is here to help.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all"
            >
              Contact Us
            </Link>
            <Link
              href="/register/student"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border text-text font-medium text-sm hover:bg-surface-inset transition-all"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
