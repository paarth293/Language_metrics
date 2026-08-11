"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Star, ShieldCheck, Clock, BookOpen } from "lucide-react";

const teachers = [
  {
    name: "Priya Sharma",
    language: "English",
    flag: "🇬🇧",
    rating: 4.9,
    reviews: 312,
    experience: "5 years",
    specialty: "Business English & IELTS Prep",
    price: "₹600/hr",
    tag: "Top Rated",
    tagColor: "bg-gold text-white",
  },
  {
    name: "Marco Ricci",
    language: "Italian",
    flag: "🇮🇹",
    rating: 4.8,
    reviews: 187,
    experience: "3 years",
    specialty: "Conversational Italian",
    price: "₹750/hr",
    tag: "Verified",
    tagColor: "bg-navy text-cream",
  },
  {
    name: "Sakura Tanaka",
    language: "Japanese",
    flag: "🇯🇵",
    rating: 5.0,
    reviews: 246,
    experience: "7 years",
    specialty: "JLPT N1-N5 & Daily Japanese",
    price: "₹900/hr",
    tag: "Top Rated",
    tagColor: "bg-gold text-white",
  },
  {
    name: "Ahmed Hassan",
    language: "Arabic",
    flag: "🇸🇦",
    rating: 4.7,
    reviews: 134,
    experience: "4 years",
    specialty: "Modern Standard & Quranic Arabic",
    price: "₹550/hr",
    tag: "Verified",
    tagColor: "bg-navy text-cream",
  },
];

const avatarColors = [
  "bg-gradient-to-br from-gold to-gold-soft",
  "bg-gradient-to-br from-navy to-navy-2",
  "bg-gradient-to-br from-rose-400 to-rose-600",
  "bg-gradient-to-br from-teal-400 to-teal-600",
];

export default function TeacherSpotlight() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="teachers" className="py-24 bg-cream overflow-hidden" ref={ref}>
      <div className="max-w-[1240px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4"
        >
          <div>
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="eyebrow-line" />
              <span className="font-script text-gold text-xl">Our community</span>
            </div>
            <h2
              className="font-display font-bold text-navy"
              style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
            >
              Meet Some of Our Teachers
            </h2>
          </div>
          <a
            href="#"
            className="btn-outline px-6 py-3 text-[14px] font-semibold shrink-0"
          >
            Browse All Teachers
          </a>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {teachers.map((teacher, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white border border-navy/8 rounded-2xl p-6 flex flex-col group hover:border-gold/40 hover:shadow-navy-md hover:-translate-y-2 transition-all duration-300"
            >
              {/* Avatar + tag */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-14 h-14 rounded-xl ${avatarColors[i]} flex items-center justify-center text-white font-display font-bold text-xl shadow-sm`}
                >
                  {teacher.name.charAt(0)}
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${teacher.tagColor}`}
                >
                  {teacher.tag}
                </span>
              </div>

              {/* Name & language */}
              <div className="mb-1">
                <h3 className="font-display font-semibold text-navy text-lg">
                  {teacher.name}
                </h3>
                <div className="flex items-center gap-1.5 text-navy/50 text-[13px]">
                  <span>{teacher.flag}</span>
                  <span>{teacher.language}</span>
                </div>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1 mb-3">
                <Star className="w-3.5 h-3.5 text-gold fill-gold" />
                <span className="text-[13px] font-semibold text-navy">
                  {teacher.rating}
                </span>
                <span className="text-[12px] text-navy/40">
                  ({teacher.reviews} reviews)
                </span>
              </div>

              {/* Specialty */}
              <p className="text-[13px] text-navy/60 leading-relaxed mb-4 flex-1">
                {teacher.specialty}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-3 text-[12px] text-navy/50 mb-4">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{teacher.experience}</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  <span>Verified</span>
                </div>
              </div>

              {/* Price + CTA */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-navy/40">from</div>
                  <div className="font-display font-bold text-navy text-lg">
                    {teacher.price}
                  </div>
                </div>
                <button className="btn-primary px-4 py-2 text-[13px] font-semibold">
                  Book Demo
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Verified badge row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-navy/50"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold" />
            <span className="text-[13px]">All teachers document-verified</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-navy/20 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-gold fill-gold" />
            <span className="text-[13px]">Language proficiency tested</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-navy/20 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            <span className="text-[13px]">Admin interview required</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
