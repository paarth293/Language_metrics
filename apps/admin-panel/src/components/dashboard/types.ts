import type { LucideIcon } from "lucide-react";

export type MetricIcon = "revenue" | "teachers" | "approvals" | "classes";
export type MetricTone = "default" | "teal" | "amber";
export type QueueTone = "teal" | "amber" | "red";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "INTERVIEW_SCHEDULED";

export interface DashboardMetric {
  label: string;
  value: string;
  helper: string;
  delta?: string;
  tone: MetricTone;
  icon: MetricIcon;
}

export interface TrendPoint {
  label: string;
  current: number;
  previous: number;
}

export interface QueueItem {
  label: string;
  detail: string;
  value: string;
  href: string;
  tone: QueueTone;
  icon: LucideIcon;
}

export interface TeacherApprovalRow {
  userId: string;
  name: string;
  email?: string;
  language: string;
  createdAt: string;
  status: ApprovalStatus;
  href: string;
}
