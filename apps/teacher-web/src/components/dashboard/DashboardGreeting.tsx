import React from "react";
import { Badge } from "@/components/ui/Badge";

interface DashboardGreetingProps {
  name: string;
  language: string;
  proficiencyLevel: string;
}

export function DashboardGreeting({ name, language, proficiencyLevel }: DashboardGreetingProps) {
  const firstName = name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Date pill: "FRI, 18 SEPTEMBER"
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).toUpperCase();

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div>
        <h1 className="text-[32px] sm:text-[36px] lg:text-[44px] leading-[1.05] font-display font-bold text-text tracking-[-0.02em]">
          {greeting}, {firstName}
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <p className="text-base text-text-muted">
            Ready to continue your {language} journey?
          </p>
          {proficiencyLevel && (
            <Badge variant="info" className="text-[10px] uppercase py-0.5">{proficiencyLevel}</Badge>
          )}
        </div>
      </div>
      <div className="inline-flex px-3 py-1.5 rounded-full bg-surface-inset text-text-muted text-[11px] font-semibold tracking-[0.14em] uppercase">
        {dateStr}
      </div>
    </div>
  );
}
