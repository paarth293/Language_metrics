import React from "react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  actionText?: string;
  actionHref?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, message, actionText, actionHref, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-10'}`}>
      <Icon className="w-6 h-6 text-text-subtle mb-3" />
      <p className="text-[13px] text-text-muted mb-4 max-w-[280px]">{message}</p>
      {actionText && actionHref && (
        <Button asChild variant="outline" size="sm" className="auth-focus bg-transparent">
          <Link href={actionHref}>{actionText}</Link>
        </Button>
      )}
    </div>
  );
}
