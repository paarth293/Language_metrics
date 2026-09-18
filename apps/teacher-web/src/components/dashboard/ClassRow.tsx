import React from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ClassRowProps {
  cls: {
    id: string;
    sessionId?: string;
    teacher: string;
    avatar: string | null;
    language: string;
    type: string;
    scheduledStart?: string;
  };
}

export function ClassRow({ cls }: ClassRowProps) {
  const timeStr = cls.scheduledStart ? new Date(cls.scheduledStart).toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "TBD";

  return (
    <div className="flex items-center justify-between py-3 h-auto sm:h-[64px] hover:bg-surface-inset transition-colors duration-120 px-4 -mx-4 group border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={cls.avatar || undefined} size="sm" className="w-9 h-9" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-text truncate">{cls.teacher}</span>
            <Badge variant="info" className="hidden sm:inline-flex text-[10px] uppercase py-0 px-1.5">{cls.language}</Badge>
            <Badge variant={cls.type === "DEMO" ? "warning" : "default"} className="hidden sm:inline-flex text-[10px] uppercase py-0 px-1.5">
              {cls.type === "DEMO" ? "Demo" : "Regular"}
            </Badge>
          </div>
          <div className="sm:hidden text-[13px] text-text-muted mt-0.5">
            {timeStr}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 pl-3">
        <span className="hidden sm:inline text-[13px] text-text-muted">
          {timeStr}
        </span>
        <Button asChild variant="outline" size="sm" className="auth-focus h-8 bg-transparent">
          <Link href={`/live/${cls.sessionId || cls.id}`}>
            Join
          </Link>
        </Button>
      </div>
    </div>
  );
}
