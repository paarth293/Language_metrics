"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Check, Zap } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Demo Class",
    price: "₹49",
    period: "one-time",
    description: "Try before you commit. One 30-minute session with any teacher.",
    features: [
      "1 live session (30 min)",
      "Any language, any teacher",
      "Custom video platform",
      "Non-refundable",
    ],
    cta: "Book a Demo",
    href: "/register/student",
    highlighted: false,
    badge: null,
  },
  {
    name: "Hourly Sessions",
    price: "₹400–₹1,200",
    period: "per hour",
    description: "Flexible, pay-as-you-go sessions. Book when you need them.",
    features: [
      "1-on-1 live class",
      "Session recording (optional)",
      "In-app chat & notes",
      "Cancel 24hr before",
    ],
    cta: "Start Learning",
    href: "/register/student",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Full Course",
    price: "Custom",
    period: "per course",
    description: "Structured curriculum packages designed by your teacher.",
    features: [
      "Multi-week curriculum",
      "Progress tracking",
      "Homework & assignments",
      "Certificate on completion",
    ],
    cta: "Explore Courses",
    href: "/register/student",
    highlighted: false,
    badge: null,
  },
];

export default function Pricing() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="pricing" className="py-24 bg-cream-2 overflow-hidden" ref={ref}>
      <div className="max-w-[1240px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="eyebrow-line" />
            <span className="font-script text-gold text-xl">Transparent pricing</span>
            <span className="eyebrow-line" />
          </div>
          <h2
            className="font-display font-bold text-navy mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 50px)" }}
          >
            Start for ₹49
          </h2>
          <p className="text-navy/60 text-lg max-w-xl mx-auto">
            No subscriptions. Pay only for what you book. Teacher rates vary by
            experience and language.
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-2xl p-7 flex flex-col ${
                plan.highlighted
                  ? "bg-navy text-cream border-2 border-gold/40 shadow-navy-lg"
                  : "bg-cream border border-navy/10"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gold text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3
                  className={`font-display font-semibold text-xl mb-1 ${
                    plan.highlighted ? "text-cream" : "text-navy"
                  }`}
                >
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span
                    className={`font-display font-bold ${
                      plan.highlighted ? "text-cream" : "text-navy"
                    }`}
                    style={{ fontSize: "2rem" }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-[13px] ${
                      plan.highlighted ? "text-cream/50" : "text-navy/50"
                    }`}
                  >
                    {plan.period}
                  </span>
                </div>
                <p
                  className={`text-[14px] leading-relaxed ${
                    plan.highlighted ? "text-cream/60" : "text-navy/60"
                  }`}
                >
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        plan.highlighted ? "bg-gold/20" : "bg-gold/15"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 text-gold" />
                    </div>
                    <span
                      className={`text-[14px] ${
                        plan.highlighted ? "text-cream/80" : "text-navy/70"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`text-center py-3.5 px-6 rounded-full text-[14px] font-semibold transition-all duration-300 ${
                  plan.highlighted
                    ? "btn-gold"
                    : "btn-outline"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="text-center text-[13px] text-navy/40 mt-8"
        >
          Platform commission: 30% · Payments via Razorpay (UPI, Card, Net Banking)
        </motion.p>
      </div>
    </section>
  );
}
