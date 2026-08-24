"use client";

import { useAuth } from "@/hooks/use-auth";
import { studentApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, BookOpen, Calendar, MessageSquare, Star, ArrowRight, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Classes Booked", value: "0", icon: BookOpen, color: "text-gold" },
  { label: "Upcoming Sessions", value: "0", icon: Calendar, color: "text-navy" },
  { label: "Messages", value: "0", icon: MessageSquare, color: "text-gold" },
  { label: "Avg. Rating", value: "—", icon: Star, color: "text-navy" },
];

interface StudentProfile {
  id: string;
  languageToLearn: string;
  proficiencyLevel: string;
  user: { name: string; email: string; createdAt: string };
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function StudentDashboard() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "STUDENT")) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || !user || user.role !== "STUDENT") return;
    studentApi
      .getProfile()
      .then((res) => setProfile(res.data.student))
      .catch(() => setProfile(null));
  }, [user, isLoading]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-2">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-navy text-cream sticky top-0 z-40 shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-navy-2 border border-cream/10 flex items-center justify-center">
            <Globe className="w-4 h-4 text-gold" />
          </div>
          <span className="font-display font-semibold text-[15px]">Language Metrics</span>
        </Link>
        <button onClick={() => setSidebarOpen(true)} className="p-2 -mr-2 text-cream/70 hover:text-cream">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 bottom-0 w-64 bg-navy flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 border-b border-cream/8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-2 border border-cream/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-gold" />
            </div>
            <span className="font-display font-semibold text-cream text-[15px]">Language Metrics</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 -mr-1 text-cream/50 hover:text-cream">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { icon: BookOpen, label: "My Classes", active: true },
            { icon: Calendar, label: "Schedule", active: false },
            { icon: MessageSquare, label: "Messages", active: false },
            { icon: Star, label: "My Teachers", active: false },
          ].map((item, i) => (
            <button key={i}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                item.active ? "bg-gold/15 text-gold" : "text-cream/50 hover:text-cream hover:bg-cream/5"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-cream/8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center">
              <span className="text-gold font-bold text-[14px]">{user.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-cream text-[13px] font-semibold truncate">{user.name}</div>
              <div className="text-cream/40 text-[11px] truncate">{user.email}</div>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-cream/50 hover:text-cream hover:bg-cream/5 transition-colors">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64 p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="font-display font-bold text-navy text-3xl mb-1">
            Welcome back, {user.name.split(" ")[0]} 👋
          </h1>
          {profile ? (
            <p className="text-navy/60">
              Learning <span className="font-semibold text-navy">{profile.languageToLearn}</span>
              <span className="mx-2 text-navy/30">·</span>
              <span className="capitalize">{cap(profile.proficiencyLevel)}</span> level
            </p>
          ) : (
            <p className="text-navy/60">Ready to continue your language journey?</p>
          )}
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-cream border border-navy/8 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center mb-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="font-display font-bold text-navy text-2xl mb-0.5">{stat.value}</div>
              <div className="text-[12px] text-navy/50">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-navy rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🎓</div>
          <h2 className="font-display font-bold text-cream text-2xl mb-3">Start with a ₹29 Demo Class</h2>
          <p className="text-cream/60 text-[15px] max-w-md mx-auto mb-6">
            Find your perfect language teacher, book a 30-minute demo, and experience our custom live platform.
          </p>
          <Link href="/#teachers" className="btn-gold inline-flex items-center gap-2 px-6 py-3 text-[14px] font-semibold group">
            Find a Teacher
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
