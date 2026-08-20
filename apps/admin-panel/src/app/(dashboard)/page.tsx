import { Wallet, GraduationCap, UserPlus, Radio, Download, ChevronDown, MoreHorizontal, ArrowRight } from "lucide-react";
import { db } from "@repo/database";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [teacherCount, studentCount, pendingVerifications, completedClasses] = await Promise.all([
    db.teacherProfile.count({ where: { status: 'APPROVED' } }),
    db.studentProfile.count(),
    db.teacherProfile.count({ where: { status: 'PENDING' } }),
    db.classSession.count({ where: { status: 'COMPLETED' } })
  ]);

  const stats = [
    { label: "TOTAL REVENUE", value: "$124,500.00", change: "+12.5%", icon: Wallet },
    { label: "ACTIVE TUTORS", value: teacherCount.toString(), change: "+3.2%", icon: GraduationCap },
    { label: "NEW ENROLLMENTS", value: studentCount.toString(), change: "+8.4%", icon: UserPlus },
    { label: "ACTIVE SESSIONS", value: completedClasses.toString(), change: "LIVE NOW", icon: Radio, isLive: true },
  ];

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border)",
  };

  return (
    <div className="p-8 space-y-8 pb-12 max-w-[1400px]">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 style={{ color: "var(--lm-accent)" }} className="text-3xl font-bold tracking-tight mb-1">Executive Overview</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">Real-time metrics and platform analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button style={{ border: "1px solid var(--lm-border)", color: "var(--lm-accent)" }} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold hover:bg-[var(--lm-surface)] transition-colors">
            <Download size={14} /> Export Report
          </button>
          <button style={{ border: "1px solid var(--lm-border)", color: "var(--lm-text)" }} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold bg-[var(--lm-surface)] hover:bg-[var(--lm-surface2)] transition-colors">
            📅 Last 30 Days <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} style={cardStyle} className="p-6 rounded-xl flex flex-col justify-between h-[140px]">
              <div className="flex justify-between items-start w-full">
                <div style={{ background: "var(--lm-surface2)" }} className="p-2 rounded-md">
                  <Icon size={16} style={{ color: stat.isLive ? "#ef4444" : "var(--lm-text-muted)" }} />
                </div>
                {stat.isLive ? (
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 text-red-500 tracking-wider">
                    {stat.change}
                  </span>
                ) : (
                  <span style={{ background: "var(--lm-ok-bg)", color: "var(--lm-ok)" }} className="text-[10px] font-bold px-2 py-1 rounded tracking-wider flex items-center gap-1">
                    ↗ {stat.change}
                  </span>
                )}
              </div>
              <div>
                <p style={{ color: "var(--lm-text-muted)" }} className="text-[11px] font-bold tracking-widest mb-1">{stat.label}</p>
                <h3 style={{ color: "var(--lm-text)" }} className="text-3xl font-bold tracking-tight">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Section */}
        <div style={cardStyle} className="lg:col-span-2 rounded-xl p-6 flex flex-col">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 style={{ color: "var(--lm-text)" }} className="text-[16px] font-bold mb-1">Revenue Analytics</h2>
              <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">Daily volume vs target trajectory</p>
            </div>
            <button style={{ color: "var(--lm-text-subtle)" }} className="hover:text-white transition-colors">
              <MoreHorizontal size={20} />
            </button>
          </div>
          
          <div className="flex-1 w-full relative min-h-[300px]">
            {/* Y Axis Labels */}
            <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[11px] font-medium" style={{ color: "var(--lm-text-subtle)" }}>
              <span>$15k</span>
              <span>$10k</span>
              <span>$5k</span>
              <span>$0</span>
            </div>
            
            {/* Grid Lines */}
            <div className="absolute left-8 right-0 top-2 bottom-8 flex flex-col justify-between">
              <div className="w-full h-px" style={{ background: "var(--lm-border)" }}></div>
              <div className="w-full h-px" style={{ background: "var(--lm-border)" }}></div>
              <div className="w-full h-px" style={{ background: "var(--lm-border)" }}></div>
              <div className="w-full h-px" style={{ background: "var(--lm-border)" }}></div>
            </div>

            {/* SVG Chart */}
            <div className="absolute left-8 right-0 top-2 bottom-8">
              <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1000 300">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--lm-accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--lm-accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 250 L150 200 L250 260 L350 140 L500 160 L650 40 L750 80 L900 10 L1000 0 V300 H0 Z" fill="url(#chartGradient)" />
                <path d="M0 250 L150 200 L250 260 L350 140 L500 160 L650 40 L750 80 L900 10 L1000 0" fill="none" stroke="var(--lm-accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                {/* Data Points */}
                <circle cx="350" cy="140" r="4" fill="var(--lm-bg)" stroke="var(--lm-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <circle cx="650" cy="40" r="4" fill="var(--lm-bg)" stroke="var(--lm-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>

            {/* X Axis Labels */}
            <div className="absolute left-8 right-0 bottom-0 flex justify-between text-[11px] font-medium px-4" style={{ color: "var(--lm-text-subtle)" }}>
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>
        </div>

        {/* Side Panels */}
        <div className="space-y-6">
          {/* Pending Verification */}
          <div style={cardStyle} className="rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 style={{ color: "var(--lm-text)" }} className="text-[16px] font-bold leading-tight">Pending<br/>Verification</h2>
              <span className="text-[9px] font-bold px-2 py-1 rounded bg-red-500/10 text-red-500 tracking-wider uppercase text-right">
                {pendingVerifications} Requires<br/>Action
              </span>
            </div>
            
            <div className="space-y-4 mb-6">
              {[
                { name: "Dr. Elena Rossi", sub: "Italian Literature" },
                { name: "Prof. James Chen", sub: "Mandarin Business" }
              ].map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ background: "var(--lm-surface2)" }} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-[var(--lm-border)]">
                      <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${t.name}&backgroundColor=transparent`} className="w-8 h-8 rounded-full" />
                    </div>
                    <div>
                      <h4 style={{ color: "var(--lm-text)" }} className="text-[13px] font-bold">{t.name}</h4>
                      <p style={{ color: "var(--lm-text-muted)" }} className="text-[11px]">{t.sub}</p>
                    </div>
                  </div>
                  <button style={{ background: "var(--lm-surface2)" }} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors">
                    <ChevronDown size={14} style={{ color: "var(--lm-text-muted)", transform: "rotate(-90deg)" }} />
                  </button>
                </div>
              ))}
            </div>
            
            <button style={{ color: "var(--lm-accent)" }} className="w-full text-center text-[11px] font-bold tracking-widest uppercase hover:underline">
              View All Queue
            </button>
          </div>

          {/* Live Activity */}
          <div style={cardStyle} className="rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 style={{ color: "var(--lm-text)" }} className="text-[16px] font-bold">Live Activity</h2>
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>
            </div>
            
            <div className="space-y-5 relative">
              <div className="absolute left-1.5 top-2 bottom-2 w-px bg-[var(--lm-border)]"></div>
              {[
                { time: "Just now", desc: "New enterprise bulk enrollment (TechCorp Inc.)" },
                { time: "12 mins ago", desc: "System payout processed successfully: $42k" },
                { time: "1 hr ago", desc: "Server capacity scaled automatically in EU region." }
              ].map((act, i) => (
                <div key={i} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-[var(--lm-surface)]" style={{ background: i === 0 ? "var(--lm-accent)" : "var(--lm-text-subtle)" }}></span>
                  <p style={{ color: "var(--lm-text-muted)" }} className="text-[11px] font-semibold mb-0.5">{act.time}</p>
                  <p style={{ color: "var(--lm-text)" }} className="text-[12px] font-medium leading-tight">{act.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
