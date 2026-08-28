import type { Metadata } from "next";
import Link from "next/link";
import { Users, Globe, Shield, Heart, Award, BookOpen, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us — Language Metrics",
  description: "Learn about Language Metrics — the platform connecting students with verified language professionals for live 1-on-1 video classes.",
  openGraph: {
    title: "About Language Metrics",
    description: "Connecting students with verified language professionals worldwide.",
  },
};

const stats = [
  { label: "Languages Offered", value: "15+", icon: Globe },
  { label: "Verified Teachers", value: "200+", icon: Users },
  { label: "Students Worldwide", value: "5,000+", icon: Heart },
  { label: "Classes Completed", value: "10,000+", icon: BookOpen },
];

const values = [
  {
    title: "Quality First",
    description: "Every teacher undergoes a rigorous verification process including document checks, interviews, and demo classes.",
    icon: Shield,
  },
  {
    title: "Personalized Learning",
    description: "1-on-1 live sessions tailored to your pace, goals, and learning style. No generic group classes.",
    icon: Users,
  },
  {
    title: "Global Community",
    description: "Connect with native speakers from around the world. Learn culture alongside language.",
    icon: Globe,
  },
  {
    title: "Affordable Excellence",
    description: "Premium language education at fair prices. Our coin system gives you flexibility and control.",
    icon: Award,
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] text-white py-20 px-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-sm font-medium mb-6">Our Story</span>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Breaking Language Barriers,<br />One Class at a Time
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Language Metrics connects learners with verified native-speaking teachers for live, personalized 1-on-1 video classes. We believe everyone deserves access to quality language education.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 bg-white border-b border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-3">
                <stat.icon className="w-6 h-6 text-brand" />
              </div>
              <div className="text-3xl font-display font-bold text-text">{stat.value}</div>
              <div className="text-sm text-text-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium mb-4">Our Mission</span>
          <h2 className="font-display text-3xl font-bold text-text mb-6">Making Language Learning Accessible</h2>
          <p className="text-text-muted text-lg max-w-2xl mx-auto">
            We&apos;re on a mission to make quality language education accessible to everyone, everywhere. By connecting students directly with verified native-speaking teachers, we eliminate the barriers of traditional language schools.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {values.map((value) => (
            <div key={value.title} className="p-6 rounded-2xl border border-border bg-white hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
                <value.icon className="w-6 h-6 text-brand" />
              </div>
              <h3 className="font-display text-xl font-bold text-text mb-2">{value.title}</h3>
              <p className="text-text-muted">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e]">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="font-display text-3xl font-bold mb-4">Ready to Start Learning?</h2>
          <p className="text-white/70 mb-8">Join thousands of students already learning with Language Metrics.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register/student"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gold text-navy font-semibold hover:bg-gold-soft transition-all duration-200"
            >
              Start Learning <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/waitlist"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/20 text-white font-medium hover:bg-white/10 transition-all duration-200"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
