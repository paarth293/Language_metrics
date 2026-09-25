import React from "react";
import Link from "next/link";
import { Calendar, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

interface NextClassCardProps {
  cls?: {
    id: string;
    sessionId?: string;
    teacher: string;
    avatar: string | null;
    language: string;
    type: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  };
  hasHistory: boolean;
}

export function NextClassCard({ cls, hasHistory }: NextClassCardProps) {
  if (!cls) {
    if (!hasHistory) return null; // handled by tier 1 outside

    return (
      <Card className="flex-1 flex flex-col hover:shadow-level-2 transition-shadow duration-180">
        <CardContent className="p-5 sm:p-6 flex-1 flex flex-col">
          <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-[0.12em] mb-auto">
            Next Class
          </div>
          <div className="flex flex-col items-center justify-center flex-1">
            <Calendar className="w-6 h-6 text-text-subtle mb-3" />
            <p className="text-sm text-text-muted text-center mb-6">Nothing booked yet.</p>
            <Button asChild variant="primary" className="w-full auth-focus">
              <Link href="/student/discover">Find a teacher</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const startTime = cls.scheduledStart ? new Date(cls.scheduledStart) : null;
  const now = new Date();
  const diffMs = startTime ? startTime.getTime() - now.getTime() : 0;
  const diffMins = Math.floor(diffMs / 60000);
  
  const isLive = diffMins <= 0 && diffMins > -60; // rough live check
  const isSoon = diffMins > 0 && diffMins <= 15;
  const isActive = isLive || isSoon;

  const timeStr = startTime ? startTime.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "TBD";
  
  let relativeStr = "";
  if (isLive) relativeStr = "Live now";
  else if (isSoon) relativeStr = `Starts in ${diffMins} min`;
  else if (diffMins < 60) relativeStr = `in ${diffMins}m`;
  else relativeStr = `in ${Math.floor(diffMins / 60)}h`;

  return (
    <Card className={cn(
      "flex-1 flex flex-col transition-all duration-180",
      isActive ? "border border-action/30 hover:border-action/60 shadow-level-1 hover:shadow-level-2 dark:border-action/35" : "hover:shadow-level-2"
    )}>
      <CardContent className="p-5 sm:p-6 flex-1 flex flex-col">
        <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-[0.12em] mb-4">
          Next Class
        </div>
        
        <div className="flex gap-4 items-start mb-6">
          <Avatar src={cls.avatar || undefined} size="lg" />
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em] truncate mb-1">
              {cls.teacher}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="info" className="text-[10px] uppercase py-0">{cls.language}</Badge>
              <Badge variant={cls.type === "DEMO" ? "warning" : "default"} className="text-[10px] uppercase py-0">
                {cls.type === "DEMO" ? "Demo" : "Regular"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">{timeStr}</span>
            {isActive ? (
              <span className="px-2 py-0.5 rounded-full bg-trust-subtle text-trust font-medium text-xs">
                {relativeStr}
              </span>
            ) : (
              <span className="text-brand font-medium text-xs">{relativeStr}</span>
            )}
          </div>

          {isActive ? (
            <Button asChild variant="primary" className="w-full auth-focus bg-action hover:bg-action-hover text-action-on border-none">
              <Link href={`/live/${cls.sessionId || cls.id}`}>
                <Video className="w-4 h-4 mr-2" /> Join class
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="w-full auth-focus">
              <Link href={`/student/classes/${cls.id}`}>
                View details
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
