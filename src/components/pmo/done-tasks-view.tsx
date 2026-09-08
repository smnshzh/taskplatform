"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTMStore } from "@/lib/pmo-store";
import {
  toPersianDigits,
  toJalali,
  toGregorian,
  tehranNow,
  formatJalaliDate,
  formatTime,
  daysBetween,
  JALALI_MONTHS,
} from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { priorityByKey } from "@/lib/constants";
import type { SerializedTask } from "@/lib/serialize";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const priorityClasses: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

/** Number of days in each Jalali month (regular year) */
function jalaliMonthDays(jm: number): number {
  return jm <= 6 ? 31 : 30;
}

/** First day of Jalali month as a Gregorian Date (midnight Tehran) */
function startOfJalaliMonth(jy: number, jm: number): Date {
  const [gy, gm, gd] = toGregorian(jy, jm, 1);
  return new Date(gy, gm - 1, gd);
}

/** Last day of Jalali month as a Gregorian Date (23:59:59 Tehran) */
function endOfJalaliMonth(jy: number, jm: number): Date {
  const days = jalaliMonthDays(jm);
  const [gy, gm, gd] = toGregorian(jy, jm, days);
  return new Date(gy, gm - 1, gd, 23, 59, 59);
}

/** Difference label: positive = before deadline (early), negative = after deadline (late) */
function deadlineDiffLabel(doneAt: Date, deadline: Date): { text: string; color: string; icon: React.ComponentType<{ className?: string }> } {
  const diff = daysBetween(doneAt, deadline); // deadline - doneAt

  if (diff > 0) {
    return {
      text: `${toPersianDigits(diff)} روز زودتر`,
      color: "text-emerald-600 dark:text-emerald-400",
      icon: ArrowUpRight,
    };
  }
  if (diff < 0) {
    return {
      text: `${toPersianDigits(Math.abs(diff))} روز دیرتر`,
      color: "text-rose-600 dark:text-rose-400",
      icon: ArrowDownRight,
    };
  }
  return {
    text: "دقیقاً سر وقت",
    color: "text-sky-600 dark:text-sky-400",
    icon: Minus,
  };
}

/* ------------------------------------------------------------------ */
/*  Task card                                                          */
/* ------------------------------------------------------------------ */

function DoneTaskCard({ task }: { task: SerializedTask }) {
  const deadline = new Date(task.deadline);
  const doneAt = task.doneAt ? new Date(task.doneAt) : new Date(task.updatedAt);
  const pInfo = priorityByKey(task.priority);
  const diff = deadlineDiffLabel(doneAt, deadline);
  const DiffIcon = diff.icon;

  return (
    <Card className="p-3 transition-all hover:shadow-md">
      <div className="flex flex-col gap-2">
        {/* Top row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground">{task.code}</span>
          {pInfo && (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                priorityClasses[task.priority]
              )}
            >
              {pInfo.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium leading-6 line-clamp-2">{task.title}</h4>

        {/* Assignee */}
        <span className="text-xs text-muted-foreground">{task.assigneeName}</span>

        {/* Dates row */}
        <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t">
          <div className="flex items-center gap-1 text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            <span className="nums-fa">{formatJalaliDate(deadline)}</span>
          </div>
          <div className={cn("flex items-center gap-1 font-medium", diff.color)}>
            <DiffIcon className="h-3 w-3" />
            <span className="text-[11px]">{diff.text}</span>
          </div>
        </div>

        {/* Done at */}
        <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          <span>انجام: </span>
          <span className="nums-fa">{formatJalaliDate(doneAt)} {formatTime(doneAt)}</span>
        </div>

        {/* Done description */}
        {task.doneDescription && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5 line-clamp-2">
            {task.doneDescription}
          </p>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Day section                                                        */
/* ------------------------------------------------------------------ */

function DaySection({
  dayLabel,
  jalaliDate,
  tasks,
}: {
  dayLabel: string;
  jalaliDate: string;
  tasks: SerializedTask[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-sm py-1 z-10">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <h3 className="text-sm font-semibold">{dayLabel}</h3>
        <span className="text-xs text-muted-foreground nums-fa">{jalaliDate}</span>
        <Badge variant="secondary" className="text-[10px]">
          {toPersianDigits(tasks.length)} تسک
        </Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((t) => (
          <DoneTaskCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export function DoneTasksView() {
  const member = useTMStore((s) => s.member);
  const taskVersion = useTMStore((s) => s.taskVersion);

  // Current Jalali year/month for the selector
  const now = tehranNow();
  const [jyNow, jmNow] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [selectedYear, setSelectedYear] = React.useState(jyNow);
  const [selectedMonth, setSelectedMonth] = React.useState(jmNow);

  // Compute date range for the selected month
  const monthStart = startOfJalaliMonth(selectedYear, selectedMonth);
  const monthEnd = endOfJalaliMonth(selectedYear, selectedMonth);

  const dateFromStr = `${selectedYear}/${String(selectedMonth).padStart(2, "0")}/01`;
  const lastDay = jalaliMonthDays(selectedMonth);
  const dateToStr = `${selectedYear}/${String(selectedMonth).padStart(2, "0")}/${String(lastDay).padStart(2, "0")}`;

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "done", selectedYear, selectedMonth, taskVersion],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: "DONE",
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        dateField: "doneAt",
        limit: "200",
      });
      const r = await fetch(`/api/tasks?${params}`);
      if (!r.ok) throw new Error("خطا در دریافت تسک‌ها");
      return (await r.json()) as { tasks: SerializedTask[] };
    },
    enabled: !!member,
  });

  const tasks = data?.tasks ?? [];

  // Group tasks by done date (Jalali)
  const grouped = React.useMemo(() => {
    const map = new Map<string, { label: string; dateKey: string; tasks: SerializedTask[] }>();
    const sorted = [...tasks].sort((a, b) => {
      const da = a.doneAt ? new Date(a.doneAt).getTime() : new Date(a.updatedAt).getTime();
      const db = b.doneAt ? new Date(b.doneAt).getTime() : new Date(b.updatedAt).getTime();
      return db - da; // newest first
    });

    for (const t of sorted) {
      const doneDate = t.doneAt ? new Date(t.doneAt) : new Date(t.updatedAt);
      const [jy, jm, jd] = toJalali(
        doneDate.getFullYear(),
        doneDate.getMonth() + 1,
        doneDate.getDate()
      );
      const key = `${jy}-${String(jm).padStart(2, "0")}-${String(jd).padStart(2, "0")}`;
      const dayName = getJalaliWeekdayName(doneDate);
      const label = `${dayName} ${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]}`;

      if (!map.has(key)) {
        map.set(key, { label, dateKey: key, tasks: [] });
      }
      map.get(key)!.tasks.push(t);
    }

    // Sort groups by date descending
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [tasks]);

  // Month navigation
  function goToPrevMonth() {
    let ny = selectedYear;
    let nm = selectedMonth - 1;
    if (nm < 1) {
      nm = 12;
      ny--;
    }
    setSelectedYear(ny);
    setSelectedMonth(nm);
  }

  function goToNextMonth() {
    let ny = selectedYear;
    let nm = selectedMonth + 1;
    if (nm > 12) {
      nm = 1;
      ny++;
    }
    setSelectedYear(ny);
    setSelectedMonth(nm);
  }

  // Year options (3 years around current)
  const yearOptions = [jyNow - 1, jyNow, jyNow + 1];

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Header + month picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <ClipboardCheck className="h-5 w-5 text-emerald-500" />
        <h2 className="text-lg font-semibold">کارهای انجام‌شده</h2>
        <div className="flex items-center gap-2 mr-auto">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrevMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-24 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {toPersianDigits(y)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JALALI_MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 text-sm">
        <Badge variant="secondary" className="text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {toPersianDigits(tasks.length)} تسک انجام‌شده
        </Badge>
      </div>

      {/* Task groups by day */}
      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p>در این ماه تسک انجام‌شده‌ای یافت نشد.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <DaySection
              key={g.dateKey}
              dayLabel={g.label}
              jalaliDate={g.dateKey}
              tasks={g.tasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weekday name helper                                                 */
/* ------------------------------------------------------------------ */

const WEEKDAY_NAMES = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

function getJalaliWeekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()];
}
