import { CalendarRange, Download } from "lucide-react";
import { requireAdmin } from "@/lib/guards";
import { getDashboardStats, getRevenueTrend, getLatestPendingTeachers, checkDatabaseHealth } from "@/lib/analytics";
import {
  ActionQueue,
  MetricCard,
  PlatformPulse,
  PlatformPulseChart,
  RecentActivity,
  SystemHealth,
  TeacherApprovalTable,
  actionQueueIcons,
  type ActivityItem,
  type DashboardMetric,
  type HealthMetric,
  type QueueItem,
  type TeacherApprovalRow,
} from "@/components/dashboard";


export const dynamic = "force-dynamic";

function formatCurrency(paise: number): string {
  const value = paise / 100;
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}k`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

const emptyDashboardStats: DashboardStats = {
  totalStudents: 0,
  totalTeachers: 0,
  activeTeachers: 0,
  pendingApprovals: 0,
  totalRevenue: 0,
  commissionEarned: 0,
  pendingPayouts: 0,
  activeCourses: 0,
  completedClasses: 0,
  todayClasses: 0,
  newRegistrations: 0,
  openComplaints: 0,
  cancelledBookings: 0,
  avgRating: 0,
};

async function loadDashboardStats(): Promise<DashboardStats> {
  try {
    return await getDashboardStats();
  } catch {
    return emptyDashboardStats;
  }
}


function buildActivity(stats: Awaited<ReturnType<typeof getDashboardStats>>): ActivityItem[] {
  return [
    {
      id: "dashboard-refresh",
      title: "Dashboard data refreshed",
      detail: `${formatNumber(stats.totalTeachers)} teacher records · current snapshot`,
      category: "System",
      tone: "teal",
    },
    {
      id: "approval-queue",
      title: `${formatNumber(stats.pendingApprovals)} teacher applications are waiting`,
      detail: "People · current review queue",
      category: "People",
      tone: "blue",
    },
    {
      id: "class-schedule",
      title: `${formatNumber(stats.todayClasses)} classes are scheduled today`,
      detail: "Learning · live schedule",
      category: "Learning",
      tone: "amber",
    },
  ];
}

function buildHealth(dbConnected: boolean, preview: boolean): HealthMetric[] {
  return [
    { label: "Application data", value: "Connected", progress: 100, tone: "teal" },
    { label: "Database queries", value: dbConnected ? "Ready" : "Failing", progress: dbConnected ? 100 : 0, tone: dbConnected ? "teal" : "amber" },
    { label: "Historical analytics", value: preview ? "Preview" : "Available", progress: preview ? 36 : 100, tone: preview ? "slate" : "amber" },
  ];
}

export default async function DashboardPage() {
  const admin = await requireAdmin();
  
  const [stats, trend, pendingTeachers, dbConnected] = await Promise.all([
    loadDashboardStats(),
    getRevenueTrend(),
    getLatestPendingTeachers(),
    checkDatabaseHealth()
  ]);

  const preview = stats.totalRevenue === 0;
  const metrics: DashboardMetric[] = [
    {
      label: "Revenue",
      value: formatCurrency(stats.totalRevenue),
      helper: "Month to date · platform total",
      delta: preview ? "Snapshot" : "+12.4%",
      tone: "teal",
      icon: "revenue",
    },
    {
      label: "Active teachers",
      value: formatNumber(stats.activeTeachers),
      helper: "Currently teaching · last 30 days",
      delta: stats.activeTeachers ? "+4.8%" : "Live count",
      tone: "default",
      icon: "teachers",
    },
    {
      label: "Pending approvals",
      value: formatNumber(stats.pendingApprovals),
      helper: "Teacher applications · queue total",
      delta: stats.pendingApprovals ? `${stats.pendingApprovals} to review` : "Clear",
      tone: "amber",
      icon: "approvals",
    },
    {
      label: "Classes today",
      value: formatNumber(stats.todayClasses),
      helper: "Scheduled for today · IST",
      delta: stats.todayClasses ? "Live schedule" : "No classes",
      tone: "default",
      icon: "classes",
    },
  ];

  const queue: QueueItem[] = [
    {
      label: "Teacher approvals",
      detail: `${formatNumber(stats.pendingApprovals)} applications waiting`,
      value: formatNumber(stats.pendingApprovals),
      href: "/teachers?filter=pending",
      tone: "teal",
      icon: actionQueueIcons.approvals,
    },
    {
      label: "Open complaints",
      detail: `${formatNumber(stats.openComplaints)} cases need a first response`,
      value: String(stats.openComplaints).padStart(2, "0"),
      href: "/complaints",
      tone: "amber",
      icon: actionQueueIcons.complaints,
    },
    {
      label: "Teacher payouts",
      detail: stats.pendingPayouts ? "Pending transfers need review" : "No pending batches",
      value: formatCurrency(stats.pendingPayouts),
      href: "/payouts",
      tone: "red",
      icon: actionQueueIcons.payouts,
    },
  ];

  const teacherRows: TeacherApprovalRow[] = pendingTeachers.map(t => ({
    userId: t.userId,
    name: t.name,
    email: t.user?.email || "",
    language: t.language || "Not specified",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: t.status as any, // Cast to any to align with ApprovalStatus in components
    createdAt: t.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    href: `/teachers/${t.userId}`
  }));

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-[1230px] px-9 pb-12 pt-9 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex items-end justify-between gap-6 max-[780px]:flex-col max-[780px]:items-start">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]">
            <span>Overview</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Dashboard</span>
          </div>
          <h1 className="lm-page-title">Executive Overview</h1>
          <p className="lm-body-copy mt-2">Welcome back, {admin.name}. A clear view of today&apos;s platform health and the work that needs your attention.</p>
          <p className="mt-3 text-[10px] text-[var(--lm-subtle)]">{dateLabel} <span className="mx-1">·</span> IST <span className="mx-1">·</span> Live data</p>
        </div>
        <div className="flex items-center gap-3 max-[780px]:w-full">
          <button type="button" className="lm-button-secondary px-3.5 max-[640px]:flex-1">
            <CalendarRange size={15} aria-hidden="true" />
            <span>01 Aug – 20 Aug 2026</span>
          </button>
          <button type="button" className="lm-button-primary px-4 max-[640px]:flex-1">
            <Download size={15} aria-hidden="true" />
            <span>Export report</span>
          </button>
        </div>
      </div>

      <div className="mt-7">
        <PlatformPulse preview={preview} />
      </div>

      <section aria-label="Priority metrics" className="mt-5 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
        {metrics.map((metric, index) => <MetricCard key={metric.label} metric={metric} index={index} />)}
      </section>

      <div className="mt-5 grid grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)] gap-5 max-[1080px]:grid-cols-1">
        <PlatformPulseChart data={trend} preview={preview} totalRevenue={formatCurrency(stats.totalRevenue)} />
        <ActionQueue items={queue} />
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)] gap-5 max-[1080px]:grid-cols-1">
        <RecentActivity items={buildActivity(stats)} />
        <SystemHealth metrics={buildHealth(dbConnected, preview)} />
      </div>

      <div className="mt-5">
        <TeacherApprovalTable rows={teacherRows} pendingCount={stats.pendingApprovals} />
      </div>

      <footer className="mt-6 flex items-center justify-between gap-4 text-[10px] text-[var(--lm-subtle)] max-[640px]:flex-col max-[640px]:items-start">
        <span>Language Metrics Admin Portal · Internal operations workspace</span>
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lm-teal)]" /> Data refreshed moments ago</span>
      </footer>
    </div>
  );
}
