import React from "react";

interface DashboardGreetingProps {
  name: string;
  subtitle: string;
  /** Optional pill after the subtitle, e.g. the student's proficiency level. */
  badge?: string;
}

/** "Good morning, <name>" header in the admin panel's compact style. */
export function DashboardGreeting({ name, subtitle, badge }: DashboardGreetingProps) {
  const firstName = name.split(" ")[0];
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <h1 className="lm-page-title">
        {greeting}, {firstName}
      </h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-text-subtle">
        <span>{now.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
        <span aria-hidden="true">·</span>
        <span>{subtitle}</span>
        {badge && (
          <span className="rounded bg-brand/10 px-1.5 py-px text-[10px] font-bold text-brand">{badge}</span>
        )}
      </p>
    </div>
  );
}
