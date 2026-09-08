// Central domain constants for the Hierarchical Task Manager.

export const ROLES = [
  { key: "SUPER_ADMIN", label: "مدیر کل", color: "rose" },
  { key: "MANAGER", label: "مدیر مجموعه", color: "amber" },
  { key: "SUPERVISOR", label: "سرپرست", color: "sky" },
  { key: "SPECIALIST", label: "کارشناس", color: "slate" },
] as const;

export type RoleKey = (typeof ROLES)[number]["key"];

export const PRIORITIES = [
  { key: "HIGH", label: "بالا", color: "rose", weight: 3 },
  { key: "MEDIUM", label: "متوسط", color: "amber", weight: 2 },
  { key: "LOW", label: "پایین", color: "slate", weight: 1 },
] as const;

export type PriorityKey = (typeof PRIORITIES)[number]["key"];

export const STATUSES = [
  { key: "PENDING", label: "در صف انجام", short: "صف", color: "slate" },
  { key: "STARTED", label: "در حال انجام", short: "در حال", color: "sky" },
  { key: "BLOCKED", label: "مسدود شده", short: "مسدود", color: "rose" },
  { key: "DONE", label: "انجام شده", short: "انجام‌شده", color: "emerald" },
] as const;

export type StatusKey = (typeof STATUSES)[number]["key"];

export const TASK_SOURCES = [
  { key: "MANUAL", label: "دستی" },
  { key: "SCHEDULED", label: "زمان‌بندی شده" },
  { key: "REFERRED", label: "ارجاع نامه‌ای" },
] as const;

export type TaskSourceKey = (typeof TASK_SOURCES)[number]["key"];

export const APPROVAL_STATUSES = [
  { key: "PENDING_APPROVAL", label: "در انتظار تأیید", color: "amber" },
  { key: "APPROVED", label: "تأیید شده", color: "emerald" },
  { key: "REJECTED", label: "رد شده", color: "rose" },
] as const;

export type ApprovalStatusKey = (typeof APPROVAL_STATUSES)[number]["key"];

export const KANBAN_ORDER: StatusKey[] = ["PENDING", "STARTED", "BLOCKED", "DONE"];

export const FOLLOW_UP_REASONS = [
  { key: "DEPENDENT_ON_OTHERS", label: "وابسته به شخص دیگر", icon: "users" },
  { key: "LACK_OF_INFO", label: "کمبود اطلاعات", icon: "info" },
  { key: "HIGH_WORKLOAD", label: "حجم بالای کار", icon: "layers" },
  { key: "TECHNICAL_ISSUE", label: "مشکل فنی", icon: "wrench" },
  { key: "OTHER", label: "سایر", icon: "more-horizontal" },
] as const;

export type FollowUpReasonKey = (typeof FOLLOW_UP_REASONS)[number]["key"];

// Persian week days (Saturday=0 ... Friday=6)
export const PERSIAN_WEEK_DAYS = [
  { key: 0, label: "شنبه" },
  { key: 1, label: "یکشنبه" },
  { key: 2, label: "دوشنبه" },
  { key: 3, label: "سه‌شنبه" },
  { key: 4, label: "چهارشنبه" },
  { key: 5, label: "پنجشنبه" },
  { key: 6, label: "جمعه" },
] as const;

// Simple (non-literal) lookup types — avoids TS 5.9 correlated-narrowing bugs with as-const arrays.
type LookupItem = { readonly key: string; readonly label: string };
type LookupItemWithColor = LookupItem & { readonly color: string };
type StatusLookupItem = LookupItemWithColor & { readonly short: string };

export function roleByKey(key: string): LookupItemWithColor | undefined {
  return ROLES.find((r) => r.key === key);
}
export function priorityByKey(key: string): (LookupItemWithColor & { readonly weight: number }) | undefined {
  return PRIORITIES.find((p) => p.key === key);
}
export function statusByKey(key: string): StatusLookupItem | undefined {
  return STATUSES.find((s) => s.key === key);
}
export function sourceByKey(key: string): LookupItem | undefined {
  return TASK_SOURCES.find((s) => s.key === key);
}
export function approvalStatusByKey(key: string): LookupItemWithColor | undefined {
  return APPROVAL_STATUSES.find((a) => a.key === key);
}