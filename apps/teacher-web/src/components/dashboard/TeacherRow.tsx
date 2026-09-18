import React from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";

interface TeacherRowProps {
  teacher: {
    id: string;
    name: string;
    avatar: string | null;
    language: string;
  };
}

export function TeacherRow({ teacher }: TeacherRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 hover:bg-surface-inset transition-colors duration-120 px-3 -mx-3 rounded-lg group">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={teacher.avatar || undefined} size="sm" className="w-8 h-8" />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-text truncate">{teacher.name}</div>
          <div className="text-[12px] text-text-muted truncate">{teacher.language}</div>
        </div>
      </div>
      <Link href={`/student/discover/${teacher.id}`} className="text-[12px] font-medium text-action hover:text-action-hover opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity auth-focus rounded px-1 shrink-0">
        Book
      </Link>
    </div>
  );
}
