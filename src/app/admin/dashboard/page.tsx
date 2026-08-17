"use client";

import { useAuth } from "@/hooks/use-auth";
import { adminApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Globe, LogOut, Users, Clock, CheckCircle2, XCircle, ShieldCheck,
  Briefcase, GraduationCap, RefreshCw, Inbox,
} from "lucide-react";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import type { VerificationStatus } from "@/types";

interface TeacherRow {
  id: string;
  experienceType: string;
  status: VerificationStatus;
  user: { id: string; name: string; email: string; createdAt: string };
}

interface Summary { pending: number; approved: number; rejected: number; total: number; }
type Filter = "pending" | "approved" | "rejected" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function AdminDashboard() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "ADMIN")) router.push("/login");
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listTeachers(filter === "all" ? undefined : filter);
      setTeachers(res.data.teachers);
      setSummary(res.data.summary);
    } catch {
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (isLoading || !user || user.role !== "ADMIN") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [user, isLoading, load]);

  const act = async (id: string, status: "approved" | "rejected") => {
    setActioningId(id);
    try {
      await adminApi.setTeacherStatus(id, status);
      await load();
    } finally {
      setActioningId(null);
    }
  };

  if (isLoading || !user) {
    return <div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" /></div>;
  }

  const statCards = [
    { label: "Pending Review", value: summary.pending, icon: Clock },
    { label: "Approved", value: summary.approved, icon: CheckCircle2 },
    { label: "Rejected", value: summary.rejected, icon: XCircle },
    { label: "Total Teachers", value: summary.total, icon: Users },
  ];

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
            { icon: ShieldCheck, label: "Verification Queue", active: true },
            { icon: Users, label: "All Users", active: false },
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
              <div className="text-cream/40 text-[11px]">Administrator</div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-cream/50 hover:text-cream hover:bg-cream/5 transition-colors">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </div>

      <div className="lg:ml-64 p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-navy text-3xl mb-1">Admin Panel</h1>
            <p className="text-navy/60">Review teacher applications and manage verifications.</p>
          </div>
          <button onClick={load} className="btn-outline flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-cream border border-navy/8 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center mb-3"><stat.icon className="w-5 h-5 text-gold" /></div>
              <div className="font-display font-bold text-navy text-2xl mb-0.5">{stat.value}</div>
              <div className="text-[12px] text-navy/50">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${filter === f.key ? "bg-navy text-cream" : "bg-cream text-navy/60 border border-navy/10 hover:border-gold/40"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-cream border border-navy/8 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center"><div className="w-7 h-7 border-2 border-navy/20 border-t-navy rounded-full animate-spin" /></div>
          ) : teachers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-navy/5 flex items-center justify-center mx-auto mb-3"><Inbox className="w-6 h-6 text-navy/30" /></div>
              <p className="text-navy/60 font-medium">No teachers in this view.</p>
              <p className="text-navy/40 text-[13px] mt-1">Teacher applications will appear here for review.</p>
            </div>
          ) : (
            <div className="divide-y divide-navy/8">
              {teachers.map((t) => (
                <div key={t.id} className="p-4 md:p-5 flex items-center gap-4 flex-wrap md:flex-nowrap hover:bg-navy/[0.02] transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
                    <span className="text-gold font-bold">{t.user.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-navy truncate">{t.user.name}</div>
                    <div className="text-[13px] text-navy/50 truncate">{t.user.email}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] text-navy/60 shrink-0">
                    {t.experienceType === "experienced" ? <Briefcase className="w-4 h-4 text-navy/40" /> : <GraduationCap className="w-4 h-4 text-navy/40" />}
                    <span className="capitalize">{t.experienceType}</span>
                  </div>
                  <div className="shrink-0"><StatusBadge status={t.status} /></div>
                  <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
                    {t.status !== "approved" && (
                      <button onClick={() => act(t.id, "approved")} disabled={actioningId === t.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-[13px] font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-60">
                        <CheckCircle2 className="w-4 h-4" />Approve
                      </button>
                    )}
                    {t.status !== "rejected" && (
                      <button onClick={() => act(t.id, "rejected")} disabled={actioningId === t.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cream border border-red-200 text-red-600 text-[13px] font-semibold hover:bg-red-50 transition-colors disabled:opacity-60">
                        <XCircle className="w-4 h-4" />Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
