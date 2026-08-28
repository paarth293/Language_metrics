"use client";

import React, { useState } from "react";
import { Mail, MessageSquare, Phone, MapPin, Send, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">("idle");
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("submitting");
    // Simulate form submission
    await new Promise((r) => setTimeout(r, 1500));
    setFormState("success");
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-sm font-medium mb-6">Get in Touch</span>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto">
            Have a question, suggestion, or need help? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-xl font-bold text-text mb-6">Contact Information</h2>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-text">Email</div>
                    <a href="mailto:hello@languagemetrics.com" className="text-sm text-brand hover:underline">
                      hello@languagemetrics.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-text">Phone</div>
                    <a href="tel:+911234567890" className="text-sm text-brand hover:underline">
                      +91 123 456 7890
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <div className="font-medium text-text">Location</div>
                    <p className="text-sm text-text-muted">India (Remote-first)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-white">
              <h3 className="font-semibold text-text mb-2">Quick Links</h3>
              <div className="space-y-2 text-sm">
                <Link href="/faq" className="block text-brand hover:underline">FAQ →</Link>
                <Link href="/about" className="block text-brand hover:underline">About Us →</Link>
                <Link href="/waitlist" className="block text-brand hover:underline">Join Waitlist →</Link>
                <Link href="/register/teacher" className="block text-brand hover:underline">Apply to Teach →</Link>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="p-8 rounded-2xl border border-border bg-white shadow-sm">
              {formState === "success" ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-trust/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-trust" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-text mb-2">Message Sent!</h2>
                  <p className="text-text-muted mb-6">We&apos;ll get back to you within 24 hours.</p>
                  <Link href="/" className="text-brand font-medium hover:underline inline-flex items-center gap-1">
                    Back to Home <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-sm font-medium text-text block mb-1.5">Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text block mb-1.5">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text block mb-1.5">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                    >
                      <option value="">Select a topic</option>
                      <option value="general">General Inquiry</option>
                      <option value="support">Technical Support</option>
                      <option value="billing">Billing Question</option>
                      <option value="teacher">Teacher Application</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-text block mb-1.5">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-border bg-surface-inset px-4 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all resize-none"
                      placeholder="How can we help?"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={formState === "submitting"}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all duration-200 disabled:opacity-50"
                  >
                    {formState === "submitting" ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Sending...
                      </span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
