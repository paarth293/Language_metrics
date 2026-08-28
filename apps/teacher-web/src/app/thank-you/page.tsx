import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight, BookOpen, User, Search, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Thank You — Language Metrics",
  description: "Thank you for joining Language Metrics! Here are your next steps.",
  robots: { index: false, follow: false },
};

const steps = [
  {
    title: "Verify Your Email",
    description: "Check your inbox for a verification code. Enter it to activate your account.",
    icon: MessageCircle,
    href: "/verify-email",
    linkText: "Verify Now",
  },
  {
    title: "Complete Your Profile",
    description: "Tell us about your learning goals and preferred language.",
    icon: User,
    href: "/student/profile",
    linkText: "Edit Profile",
  },
  {
    title: "Find a Teacher",
    description: "Browse our verified teachers and book your first demo class.",
    icon: Search,
    href: "/student/discover",
    linkText: "Discover Teachers",
  },
  {
    title: "Start Learning",
    description: "Join your first live 1-on-1 video class and begin your language journey.",
    icon: BookOpen,
    href: "/student/classes",
    linkText: "View Classes",
  },
];

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="w-20 h-20 rounded-3xl bg-trust/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-trust" />
          </div>
        </div>

        <h1 className="font-display text-4xl font-bold text-text mb-4">Thank You!</h1>
        <p className="text-lg text-text-muted mb-12 max-w-md mx-auto">
          Your account has been created. Here&apos;s what to do next to start your learning journey.
        </p>

        {/* Next Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12 text-left">
          {steps.map((step, i) => (
            <div key={step.title} className="p-5 rounded-2xl border border-border bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-brand">{i + 1}</span>
                </div>
                <step.icon className="w-5 h-5 text-brand" />
              </div>
              <h3 className="font-semibold text-text mb-1">{step.title}</h3>
              <p className="text-sm text-text-muted mb-3">{step.description}</p>
              <Link href={step.href} className="text-sm text-brand font-medium hover:underline inline-flex items-center gap-1">
                {step.linkText} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="http://localhost:3002/dashboard"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-navy text-white font-semibold text-sm hover:bg-navy-2 transition-all"
          >
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-border text-text font-medium text-sm hover:bg-surface-inset transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
