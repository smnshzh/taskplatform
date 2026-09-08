import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJalali, toPersianDigits } from "@/lib/jalali";
import { getCurrentMember, getVisibleMemberIds, getManagedGroupIds } from "@/lib/auth";

// GET /api/dashboard/stats
// Aggregated statistics for the BI dashboard:
//  - counts by status
//  - overdue share per group (pie)
//  - weekly done trend (bar)
//  - delay heatmap by weekday x hour
//  - obstacle analysis (blocked reasons)
export async function GET() {
  const me = await getCurrentMember();
  if (!me) {
    return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
  }

  // SUPER_ADMIN and MANAGER can access stats
  if (me.role !== "SUPER_ADMIN" && me.role !== "MANAGER") {
    return NextResponse.json(
      { error: "داشبورد فقط برای مدیر قابل دسترسی است." },
      { status: 403 }
    );
  }

  // Role-based visibility
  const visibleIds = await getVisibleMemberIds(me);

  // Use Prisma aggregation instead of loading all tasks into memory
  const now = new Date();
  const nowMs = now.getTime();

  // ---- Status counts (single query) ----
  const statusCountsRaw = await db.task.groupBy({
    by: ["status"],
    where: { assigneeId: { in: visibleIds }, deletedAt: null },
    _count: { status: true },
  });
  const statusCounts: Record<string, number> = {
    PENDING: 0,
    STARTED: 0,
    BLOCKED: 0,
    DONE: 0,
  };
  for (const sc of statusCountsRaw) {
    statusCounts[sc.status] = sc._count.status;
  }
  const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // ---- Overdue per group (use SQL-level filtering) ----
  const overdueTasks = await db.task.findMany({
    where: {
      assigneeId: { in: visibleIds },
      status: { not: "DONE" },
      deadline: { lt: now },
      deletedAt: null,
    },
    select: { groupId: true },
  });

  // Count overdue by group
  const overdueByGroupMap = new Map<string, number>();
  for (const t of overdueTasks) {
    overdueByGroupMap.set(t.groupId, (overdueByGroupMap.get(t.groupId) ?? 0) + 1);
  }

  // Get all groups for the current user's scope
  const groupsWhere: Record<string, unknown> = {};
  if (me.role === "MANAGER") {
    const ids = getManagedGroupIds(me);
    if (ids.length > 0) groupsWhere.id = { in: ids };
    else groupsWhere.id = "__none__";
  }
  const groups = await db.orgGroup.findMany({
    where: groupsWhere,
    orderBy: { createdAt: "asc" },
  });

  const groupColors = [
    "bg-blue-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-violet-500", "bg-cyan-500",
    "bg-orange-500", "bg-pink-500",
  ];

  const overdueByGroup = groups.map((g, i) => ({
    key: g.id,
    label: g.name,
    color: groupColors[i % groupColors.length],
    value: overdueByGroupMap.get(g.id) ?? 0,
  }));

  // ---- Group workload summary ----
  const groupTaskCounts = await db.task.groupBy({
    by: ["groupId", "status"],
    where: { assigneeId: { in: visibleIds }, deletedAt: null },
    _count: { status: true },
  });

  const groupSummaryMap = new Map<string, { total: number; done: number; active: number; overdue: number; blocked: number }>();
  for (const g of groups) {
    groupSummaryMap.set(g.id, { total: 0, done: 0, active: 0, overdue: 0, blocked: 0 });
  }
  for (const tc of groupTaskCounts) {
    const summary = groupSummaryMap.get(tc.groupId);
    if (summary) {
      summary.total += tc._count.status;
      if (tc.status === "DONE") summary.done += tc._count.status;
      else summary.active += tc._count.status;
      if (tc.status === "BLOCKED") summary.blocked += tc._count.status;
    }
  }
  // Add overdue counts
  for (const t of overdueTasks) {
    const summary = groupSummaryMap.get(t.groupId);
    if (summary) summary.overdue++;
  }

  const deptSummary = groups.map((g, i) => {
    const s = groupSummaryMap.get(g.id) ?? { total: 0, done: 0, active: 0, overdue: 0, blocked: 0 };
    return {
      key: g.id,
      label: g.name,
      color: groupColors[i % groupColors.length],
      total: s.total,
      done: s.done,
      active: s.active,
      overdue: s.overdue,
      blocked: s.blocked,
    };
  });

  // ---- Weekly done trend (last 8 ISO weeks) ----
  const weekMap = new Map<string, number>();
  for (let i = 7; i >= 0; i--) {
    const ref = new Date(nowMs - i * 7 * 86400000);
    const year = ref.getFullYear();
    const firstJan = new Date(year, 0, 1);
    const week = Math.ceil(((ref.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    weekMap.set(key, 0);
  }
  const doneTasksWeekly = await db.task.findMany({
    where: {
      assigneeId: { in: visibleIds },
      status: "DONE",
      doneAt: { not: null },
      deletedAt: null,
    },
    select: { doneAt: true },
  });
  for (const t of doneTasksWeekly) {
    if (t.doneAt) {
      const year = t.doneAt.getFullYear();
      const firstJan = new Date(year, 0, 1);
      const week = Math.ceil(((t.doneAt.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      if (weekMap.has(key)) weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
    }
  }
  const weeklyDone = Array.from(weekMap.entries()).map(([k, v]) => ({
    week: k.split("-")[1],
    label: toPersianDigits(k.split("-")[1]),
    value: v,
  }));

  // ---- Delay heatmap: weekday x hour bucket ----
  const hourBuckets = [
    { key: "08-12", label: "\u06F8\u2013\u06F1\u06F2 \u0635\u0628\u062D" },
    { key: "12-14", label: "\u06F1\u06F2\u2013\u06F1\u06F4 \u0638\u0647\u0631" },
    { key: "14-18", label: "\u06F1\u06F4\u2013\u06F1\u06F8 \u0639\u0635\u0631" },
    { key: "18-22", label: "\u06F1\u06F8\u2013\u06F2\u06F2 \u0634\u0628" },
  ];
  const persianWeekOrder = [6, 0, 1, 2, 3, 4, 5];
  const persianWeekLabels = ["\u0634\u0646\u0628\u0647", "\u06CC\u06A9\u0634\u0646\u0628\u0647", "\u062F\u0648\u0634\u0646\u0628\u0647", "\u0633\u0647\u200C\u0634\u0646\u0628\u0647", "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647", "\u067E\u0646\u062C\u0634\u0646\u0628\u0647", "\u062C\u0645\u0639\u0647"];

  // Initialize heatmap
  const heatmap: Record<string, Record<string, number>> = {};
  for (const dIdx of persianWeekOrder) {
    heatmap[dIdx] = {};
    for (const b of hourBuckets) heatmap[dIdx][b.key] = 0;
  }

  // Use overdue tasks already loaded (they have deadlines in DB)
  const overdueTasksFull = await db.task.findMany({
    where: {
      assigneeId: { in: visibleIds },
      status: { not: "DONE" },
      deadline: { lt: now },
      deletedAt: null,
    },
    select: { deadline: true },
  });
  for (const t of overdueTasksFull) {
    const d = t.deadline;
    const dayIdx = d.getDay();
    const h = d.getHours();
    let bucket: string | null = null;
    if (h >= 8 && h < 12) bucket = "08-12";
    else if (h >= 12 && h < 14) bucket = "12-14";
    else if (h >= 14 && h < 18) bucket = "14-18";
    else if (h >= 18 && h < 22) bucket = "18-22";
    if (bucket) heatmap[dayIdx][bucket] += 1;
  }

  const heatmapRows = persianWeekOrder.map((dIdx, i) => ({
    day: persianWeekLabels[i],
    cells: hourBuckets.map((b) => ({
      bucket: b.key,
      bucketLabel: b.label,
      value: heatmap[dIdx][b.key],
    })),
  }));

  // ---- Obstacle analysis (blocked reasons) ----
  const blockedTasks = await db.task.findMany({
    where: {
      assigneeId: { in: visibleIds },
      status: "BLOCKED",
      followUpReason: { not: null },
      deletedAt: null,
    },
    select: { followUpReason: true },
  });
  const reasonMap: Record<string, number> = {};
  for (const t of blockedTasks) {
    if (t.followUpReason) {
      reasonMap[t.followUpReason] = (reasonMap[t.followUpReason] ?? 0) + 1;
    }
  }
  const obstacles = [
    { key: "DEPENDENT_ON_OTHERS", label: "\u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0634\u062E\u0635 \u062F\u06CC\u06AF\u0631", value: reasonMap["DEPENDENT_ON_OTHERS"] ?? 0 },
    { key: "LACK_OF_INFO", label: "\u06A9\u0645\u0628\u0648\u062F \u0627\u0637\u0644\u0627\u0639\u0627\u062A", value: reasonMap["LACK_OF_INFO"] ?? 0 },
    { key: "HIGH_WORKLOAD", label: "\u062D\u062C\u0645 \u0628\u0627\u0644\u0627\u06CC \u06A9\u0627\u0631", value: reasonMap["HIGH_WORKLOAD"] ?? 0 },
    { key: "TECHNICAL_ISSUE", label: "\u0645\u0634\u06A9\u0644 \u0641\u0646\u06CC", value: reasonMap["TECHNICAL_ISSUE"] ?? 0 },
    { key: "OTHER", label: "\u0633\u0627\u06CC\u0631", value: reasonMap["OTHER"] ?? 0 },
  ];

  // ---- Today's date in Jalali ----
  const [jy, jm, jd] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const today = `${toPersianDigits(jy)}/${toPersianDigits(String(jm).padStart(2, "0"))}/${toPersianDigits(String(jd).padStart(2, "0"))}`;

  // Today's due count
  const todayDue = await db.task.count({
    where: {
      assigneeId: { in: visibleIds },
      status: { not: "DONE" },
      deadline: {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      },
      deletedAt: null,
    },
  });

  return NextResponse.json({
    today,
    totals: {
      all: totalTasks,
      ...statusCounts,
      overdue: overdueTasks.length,
      todayDue,
    },
    overdueByGroup,
    weeklyDone,
    hourBuckets,
    heatmapRows,
    obstacles,
    deptSummary,
  });
}