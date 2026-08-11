"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Video, Coins, CreditCard, Lock, MessageSquare, Bell } from "lucide-react";

const features = [
  {
    icon: Video,
    title: "Custom Video Platform",
    description:
      "Live 1-on-1 classes powered by LiveKit — no Google Meet, Zoom, or Jio Meet. Full control, auto-recording, screen sharing.",
    tag: "Powered by LiveKit",
    accent: "gold",
  },
  {
    icon: Coins,
    title: "Teacher Coin System",
    description:
      "Freshers earn free coins on approval. Teachers use coins to reach out to prospective students and grow their practice.",
    tag: "Unique to Language Metrics",
    accent: "navy",
  },
  {
    icon: CreditCard,
    title: "Seamless Payments",
    description:
      "UPI, card, and net banking via Razorpay. ₹49 demo classes to test chemistry before committing to full courses.",
    tag: "Razorpay Powered",
    accent: "gold",
  },
  {
    icon: Lock,
    title: "Verified Teachers Only",
    description:
      "Every teacher goes through document review, language proficiency testing, and admin interview before going live.",
    tag: "Multi-step Verification",
    accent: "navy",
  },
  {
    icon: MessageSquare,
    title: "In-App 1-on-1 Chat",
    description:
      "Private messaging between student and teacher — share notes, PDFs, Drive links. No personal contact info exposed.",
    tag: "Privacy First",
    accent: "gold",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "Push notifications for booking confirmations, class reminders, and teacher approval updates — never miss a session.",
    tag: "Real-time Alerts",
    accent: "navy",
  },
];

export default function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-navy overflow-hidden" ref={ref}>
      <div className="max-w-[1240px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="eyebrow-line" />
            <span className="font-script text-gold text-xl">What makes us different</span>
            <span className="eyebrow-line" />
          </div>
          <h2
            className="font-display font-bold text-cream mb-4"
            style={{ fontSize: "clamp(30px, 4vw, 50px)" }}
          >
            Everything You Need to Learn
          </h2>
          <p className="text-cream/50 text-lg max-w-xl mx-auto">
            From custom video to verified teachers — we&apos;ve built a complete platform just for language learning.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass-dark p-6 group hover:border-gold/30 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 ${
                  feature.accent === "gold"
                    ? "bg-gold/15 border border-gold/20"
                    : "bg-cream/5 border border-cream/10"
                }`}
              >
                <feature.icon
                  className={`w-6 h-6 ${
                    feature.accent === "gold" ? "text-gold" : "text-cream/70"
                  }`}
                />
              </div>

              {/* Tag */}
              <div className="inline-flex items-center mb-3">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    feature.accent === "gold"
                      ? "text-gold bg-gold/10"
                      : "text-cream/50 bg-cream/5"
                  }`}
                >
                  {feature.tag}
                </span>
              </div>

              <h3 className="font-display font-semibold text-cream text-xl mb-2">
                {feature.title}
              </h3>
              <p className="text-cream/50 text-[14px] leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
