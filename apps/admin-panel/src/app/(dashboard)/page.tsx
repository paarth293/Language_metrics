import { Wallet, GraduationCap, Users, CalendarDays, Radio, Download, ChevronDown, MoreHorizontal } from "lucide-react";
import { requireAdmin } from "@/lib/guards";
import { getDashboardStats } from "@/lib/analytics";

export const dynamic = 'force-dynamic';

function inr(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const stats = await getDashboardStats();

  const cards = [
    { label: "TOTAL STUDENTS", value: stats.totalStudents.toLocaleString("en-IN"), icon: Users },
    { label: "TOTAL TEACHERS", value: stats.totalTeachers.toLocaleString("en-IN"), icon: GraduationCap },
    { label: "ACTIVE TEACHERS", value: stats.activeTeachers.toLocaleString("en-IN"), icon: GraduationCap },
    { label: "PENDING APPROVALS", value: stats.pendingApprovals.toLocaleString("en-IN"), icon: CalendarDays, accent: true },
    { label: "TOTAL REVENUE", value: inr(stats.totalRevenue), icon: Wallet },
    { label: "LM COMMISSION", value: inr(stats.commissionEarned), icon: Wallet },
    { label: "PAYOUTS PENDING", value: inr(stats.pendingPayouts), icon: Wallet },
    { label: "ACTIVE COURSES", value: stats.activeCourses.toLocaleString("en-IN"), icon: GraduationCap },
    { label: "CLASSES COMPLETED", value: stats.completedClasses.toLocaleString("en-IN"), icon: Radio },
    { label: "CLASSES TODAY", value: stats.todayClasses.toLocaleString("en-IN"), icon: CalendarDays },
    { label: "NEW REGISTRATIONS (30d)", value: stats.newRegistrations.toLocaleString("en-IN"), icon: Users },
    { label: "OPEN COMPLAINTS", value: stats.openComplaints.toLocaleString("en-IN"), icon: MoreHorizontal, accent: true },
    { label: "AVG TEACHER RATING", value: stats.avgRating.toString(), icon: GraduationCap },
    { label: "CANCELLED BOOKINGS", value: stats.cancelledBookings.toLocaleString("en-IN"), icon: CalendarDays },
  ];

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border)",
  };

  return (
    <div className="p-8 space-y-8 pb-12 max-w-[1400px]">
      <div className="flex justify-between items-end">
        <div>
          <h1 style={{ color: "var(--lm-accent)" }} className="text-3xl font-bold tracking-tight mb-1">Executive Overview</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">Welcome back, {admin.name}. Real-time platform health.</p>
        </div>
        <div className="flex items-center gap-3">
          <button style={{ border: "1px solid var(--lm-border)", color: "var(--lm-accent)" }} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold hover:bg-[var(--lm-surface)] transition-colors">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-5">
        {cards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} style={cardStyle} className="p-5 rounded-xl flex flex-col justify-between h-[130px]">
              <div className="flex justify-between items-start w-full">
                <div style={{ background: "var(--lm-surface2)" }} className="p-2 rounded-md">
                  <Icon size={16} style={{ color: stat.accent ? "var(--lm-accent)" : "var(--lm-text-muted)" }} />
                </div>
              </div>
              <div>
                <p style={{ color: "var(--lm-text-muted)" }} className="text-[11px] font-bold tracking-widest mb-1">{stat.label}</p>
                <h3 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
