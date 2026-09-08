export const PERMISSIONS = [
  { key: "panel:overview", label: "پنل داشبورد", category: "پنل‌ها" },
  { key: "panel:kanban", label: "پنل کانبان", category: "پنل‌ها" },
  { key: "panel:task-list", label: "پنل لیست تسک‌ها", category: "پنل‌ها" },
  { key: "panel:workflow", label: "پنل گردش‌کار", category: "پنل‌ها" },
  { key: "panel:scheduler", label: "پنل زمان‌بندی", category: "پنل‌ها" },
  { key: "panel:referrals", label: "پنل ارجاعات", category: "پنل‌ها" },
  { key: "panel:my-tasks", label: "پنل کارهای من", category: "پنل‌ها" },
  { key: "panel:members", label: "پنل اعضا", category: "پنل‌ها" },
  { key: "panel:groups", label: "پنل مجموعه‌ها", category: "پنل‌ها" },
  { key: "panel:done-tasks", label: "پنل گزارش انجام‌شده", category: "پنل‌ها" },
  { key: "panel:trash", label: "پنل سطل زباله", category: "پنل‌ها" },
  { key: "panel:admin", label: "پنل مدیریت سیستم", category: "پنل‌ها" },
  { key: "task:create", label: "ایجاد تسک", category: "تسک‌ها" },
  { key: "task:update", label: "ویرایش تسک و وضعیت", category: "تسک‌ها" },
  { key: "task:delete", label: "انتقال تسک به سطل", category: "تسک‌ها" },
  { key: "task:restore", label: "بازیابی تسک", category: "تسک‌ها" },
  { key: "task:delete-permanently", label: "حذف دائمی تسک", category: "تسک‌ها" },
  { key: "task:approve-referral", label: "تأیید یا رد ارجاع", category: "تسک‌ها" },
  { key: "task:import", label: "ورود گروهی تسک", category: "تسک‌ها" },
  { key: "member:create", label: "افزودن عضو", category: "اعضا" },
  { key: "member:update", label: "ویرایش عضو", category: "اعضا" },
  { key: "member:delete", label: "حذف عضو", category: "اعضا" },
  { key: "member:change-role", label: "تغییر نقش عضو", category: "اعضا" },
  { key: "group:create", label: "ایجاد مجموعه", category: "مجموعه‌ها" },
  { key: "group:update", label: "ویرایش مجموعه", category: "مجموعه‌ها" },
  { key: "template:create", label: "ایجاد الگوی تسک", category: "زمان‌بندی" },
  { key: "template:update", label: "ویرایش الگوی تسک", category: "زمان‌بندی" },
  { key: "template:delete", label: "حذف الگوی تسک", category: "زمان‌بندی" },
  { key: "schedule:create", label: "ایجاد زمان‌بندی", category: "زمان‌بندی" },
  { key: "schedule:update", label: "ویرایش زمان‌بندی", category: "زمان‌بندی" },
  { key: "schedule:delete", label: "حذف زمان‌بندی", category: "زمان‌بندی" },
  { key: "schedule:import", label: "ورود گروهی زمان‌بندی", category: "زمان‌بندی" },
  { key: "access-group:manage", label: "مدیریت گروه‌های دسترسی", category: "مدیریت" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS = new Set<string>(PERMISSIONS.map((item) => item.key));
const COMMON: PermissionKey[] = ["panel:overview", "panel:kanban", "panel:task-list", "panel:workflow", "panel:referrals", "panel:my-tasks", "panel:done-tasks", "task:create", "task:update"];
const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: PERMISSIONS.map((item) => item.key),
  MANAGER: [...COMMON, "panel:scheduler", "panel:members", "panel:groups", "panel:trash", "task:create", "task:delete", "task:restore", "task:delete-permanently", "task:approve-referral", "task:import", "member:create", "member:update", "member:delete", "template:create", "template:update", "template:delete", "schedule:create", "schedule:update", "schedule:delete", "schedule:import"],
  SUPERVISOR: [...COMMON, "panel:scheduler", "panel:members", "task:create", "task:approve-referral", "member:create", "member:update", "schedule:create", "schedule:update", "schedule:delete"],
  SPECIALIST: [...COMMON],
};

export function resolvePermissions(role: string, groupPermissions: readonly string[] = []): PermissionKey[] {
  const effective = new Set<string>([...(ROLE_PERMISSIONS[role] ?? []), ...groupPermissions]);
  return PERMISSIONS.map((item) => item.key).filter((key) => effective.has(key));
}
export function getGroupPermissions(member: { accessGroups?: { accessGroup: { permissions: string[] } }[] }) { return member.accessGroups?.flatMap((item) => item.accessGroup.permissions) ?? []; }
export function memberHasPermission(member: { role: string; accessGroups?: { accessGroup: { permissions: string[] } }[] }, permission: PermissionKey) { return resolvePermissions(member.role, getGroupPermissions(member)).includes(permission); }
export function hasPermission(role: string, groupPermissions: readonly string[], permission: PermissionKey) { return resolvePermissions(role, groupPermissions).includes(permission); }
