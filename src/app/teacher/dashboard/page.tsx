"use client";

import { useAuth } from "@/hooks/use-auth";
import { teacherApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, Clock, DollarSign, Coins, Users, CheckCircle, AlertCircle, CheckCircle2, XCircle, LogOut } from "lucide-react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import type { VerificationStatus } from "@/types";

interface TeacherProfile {
  id: string;
  experienceType: string;
  status: VerificationStatus;
  user: { name: string; email: string; createdAt: string };
}

export default function TeacherDashboard() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "TEACHER")) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || !user || user.role !== "TEACHER") return;
    teacherApi.getProfile()
      .then((res) => setTeacher(res.data.teacher))
      .catch(() => setTeacher(null))
      .finally(() => setLoadingProfile(false));
  }, [user, isLoading]);

  if (isLoading || !user) {
    return <div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" /></div>;
  }

  const status: VerificationStatus = teacher?.status ?? "pending";

  return (
    <div className="min-h-screen bg-cream-2">
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-navy flex-col hidden lg:flex z-30">
        <div className="p-6 border-b border-cream/8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy-2 border border-cream/10 flex items-center justify-center"><Globe className="w-4 h-4 text-gold" /></div>
            <span className="font-display font-semibold text-cream text-[15px]">Language Metrics</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { icon: CheckCircle, label: "Dashboard", active: true },
            { icon: Clock, label: "Schedule", active: false },
            { icon: Users, label: "My Students", active: false },
            { icon: DollarSign, label: "Earnings", active: false },
            { icon: Coins, label: "Coins", active: false },
          ].map((item, i) => (
            <button key={i} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${item.active ? "bg-gold/15 text-gold" : "text-cream/50 hover:text-cream hover:bg-cream/5"}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-cream/8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center"><span className="text-gold font-bold text-[14px]">{user.name.charAt(0)}</span></div>
            <div className="flex-1 min-w-0">
              <div className="text-cream text-[13px] font-semibold truncate">{user.name}</div>
              <div className="text-cream/40 text-[11px]">Teacher</div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-cream/50 hover:text-cream hover:bg-cream/5 transition-colors">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </div>

      <div className="lg:ml-64 p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-navy text-3xl mb-1">Teacher Dashboard</h1>
            <p className="text-navy/60">Hello, {user.name.split(" ")[0]}! Here&apos;s your overview.</p>
          </div>
          {!loadingProfile && <StatusBadge status={status} className="mt-1" />}
        </motion.div>

        {!loadingProfile && status === "pending" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-gold/10 border border-gold/30 rounded-2xl p-5 mb-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-navy mb-1">Verification Pending</div>
              <p className="text-[14px] text-navy/70">Your application is under review. Our admin team will verify your documents and schedule a language proficiency interview. You&apos;ll be notified within 2–3 business days.</p>
            </div>
          </motion.div>
        )}

        {!loadingProfile && status === "approved" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex items-start gap-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-navy mb-1">You&apos;re verified — welcome aboard!</div>
              <p className="text-[14px] text-navy/70">Your documents have been approved. Set up your availability and rates to start receiving bookings from students.</p>
            </div>
          </motion.div>
        )}

        {!loadingProfile && status === "rejected" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex items-start gap-4">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-navy mb-1">Application not approved</div>
              <p className="text-[14px] text-navy/70">Unfortunately your application didn&apos;t pass verification this time. No registration fee has been charged. Please contact support if you&apos;d like to re-apply with updated documents.</p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Earnings", value: "₹0", icon: DollarSign },
            { label: "Classes Taught", value: "0", icon: CheckCircle },
            { label: "Coin Balance", value: "0", icon: Coins },
            { label: "Active Students", value: "0", icon: Users },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-cream border border-navy/8 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center mb-3">
                <stat.icon className="w-5 h-5 text-gold" />
              </div>
              <div className="font-display font-bold text-navy text-2xl mb-0.5">{stat.value}</div>
              <div className="text-[12px] text-navy/50">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-navy rounded-2xl p-8">
          <h2 className="font-display font-bold text-cream text-2xl mb-6">What happens next?</h2>
          <div className="space-y-4">
            {[
              { step: "01", title: "Document Review", desc: "Admin reviews your education qualification and language proficiency certificate." },
              { step: "02", title: "Language Interview", desc: "A scheduled call to verify your language proficiency level." },
              { step: "03", title: "Approval & Activation", desc: "On approval, ₹399 fee is charged and your profile goes live." },
              { step: "04", title: "Start Teaching", desc: "Students find you, book demo classes, and your teaching journey begins!" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="font-display font-bold text-gold text-2xl w-12 shrink-0">{item.step}</span>
                <div>
                  <div className="font-semibold text-cream mb-0.5">{item.title}</div>
                  <div className="text-cream/50 text-[14px]">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
