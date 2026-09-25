import React from "react";
import { Avatar } from "@/components/ui/Avatar";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityRowProps {
  activity: {
    id: string;
    teacher: string;
    avatar: string | null;
    type: string;
    language: string;
    date: string;
    amount: number;
  };
}

export function ActivityRow({ activity }: ActivityRowProps) {
  const actionText = activity.type === "DEMO" ? "Booked a demo with" : "Completed a class with";
  const cost = activity.amount > 0 ? `₹${(activity.amount / 100).toLocaleString()}` : null;
  
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-b-0 hover:bg-surface-inset transition-colors duration-120 px-4 -mx-4 group">
      <Avatar src={activity.avatar || undefined} size="sm" className="w-8 h-8 shrink-0" />
      <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
        <div className="text-[13px] text-text truncate">
          <span className="text-text-muted">{actionText}</span> <span className="font-semibold">{activity.teacher}</span>
        </div>
        <div className="text-[12px] text-text-subtle text-right shrink-0">
          <div>{timeAgo(activity.date)}</div>
          {cost && <div>{cost}</div>}
        </div>
      </div>
    </div>
  );
}
