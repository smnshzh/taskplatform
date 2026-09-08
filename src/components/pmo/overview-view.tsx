"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SerializedTask, SerializedGroup } from "@/lib/serialize";
import {
  priorityByKey,
  statusByKey,
} from "@/lib/constants";
import {
  toPersianDigits,
  isOverdue,
  formatJalaliDate,
  formatJalaliLong,
} from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { useTMStore } from "@/lib/pmo-store";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Eye,
  Users,
  BarChart3,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Priority & Status badge helpers                                     */
/* ------------------------------------------------------------------ */

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  STARTED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  BLOCKED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = priorityByKey(priority);
  if (!p) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        PRIORITY_STYLES[p.key]
      )}
    >
      {p.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = statusByKey(status);
  if (!s) return null;
  const Icon =
    s.key === "DONE"
      ? CheckCircle2
      : s.key === "STARTED"
        ? Clock
        : s.key === "BLOCKED"
          ? AlertTriangle
          : ListTodo;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[s.key]
      )}
    >
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass: string;
  loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold mt-1">
                {toPersianDigits(value)}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl",
              colorClass
            )}
          >
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  OverviewView                                                       */
/* ------------------------------------------------------------------ */

export function OverviewView() {
  const setView = useTMStore((s) => s.setView);
  const [selectedTask, setSelectedTask] = React.useState<SerializedTask | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Fetch tasks
  const {
    data: tasksData,
    isLoading: tasksLoading,
  } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const r = await fetch("/api/tasks");
      if (!r.ok) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
  });
  const tasks = tasksData?.tasks ?? [];

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) return { groups: [] as SerializedGroup[] };
      return (await r.json()) as { groups: SerializedGroup[] };
    },
  });
  const groups = groupsData?.groups ?? [];

  // Compute stats
  const totalTasks = tasks.length;
  const startedTasks = tasks.filter((t) => t.status === "STARTED").length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const overdueTasks = tasks.filter((t) =>
    isOverdue(new Date(t.deadline), t.status)
  ).length;

  // Recent tasks (last 10 by creation date)
  const recentTasks = React.useMemo(() => {
    return [...tasks]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10);
  }, [tasks]);

  // Tasks by group
  const tasksByGroup = React.useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      const name = t.groupName ?? "بدون مجموعه";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    const maxCount = Math.max(...Array.from(map.values()), 1);
    return { map, maxCount };
  }, [tasks]);

  function openTaskDetail(task: SerializedTask) {
    setSelectedTask(task);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ---- Stats Grid ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={ListTodo}
          label="کل تسک‌ها"
          value={totalTasks}
          colorClass="bg-primary/10 text-primary"
          loading={tasksLoading}
        />
        <StatCard
          icon={Clock}
          label="در حال انجام"
          value={startedTasks}
          colorClass="bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
          loading={tasksLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="عقب‌افتاده"
          value={overdueTasks}
          colorClass="bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          loading={tasksLoading}
        />
        <StatCard
          icon={CheckCircle2}
          label="انجام‌شده"
          value={doneTasks}
          colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          loading={tasksLoading}
        />
      </div>

      {/* ---- Bottom Row: Recent Tasks + Group Chart ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Tasks Table */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              آخرین تسک‌ها
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setView("list")}
            >
              مشاهده همه
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {tasksLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                هنوز تسکی ثبت نشده است.
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">کد</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">عنوان</TableHead>
                      <TableHead className="text-xs whitespace-nowrap hidden sm:table-cell">مسئول</TableHead>
                      <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">مجموعه</TableHead>
                      <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">اولویت</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">وضعیت</TableHead>
                      <TableHead className="text-xs whitespace-nowrap w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTasks.map((task) => (
                      <TableRow
                        key={task.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openTaskDetail(task)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {task.code}
                        </TableCell>
                        <TableCell className="text-sm font-medium max-w-[180px] sm:max-w-[260px] truncate">
                          {task.title}
                        </TableCell>
                        <TableCell className="text-xs hidden sm:table-cell whitespace-nowrap">
                          {task.assigneeName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {task.groupName}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <PriorityBadge priority={task.priority} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={task.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTaskDetail(task);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Group */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              تسک‌ها بر اساس مجموعه
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tasksLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : tasksByGroup.map.size === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                داده‌ای موجود نیست.
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {Array.from(tasksByGroup.map.entries()).map(([name, count]) => (
                  <div key={name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium truncate">
                        <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                        {name}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {toPersianDigits(count)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${Math.max((count / tasksByGroup.maxCount) * 100, 4)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Task Detail Sheet (simple inline version) ---- */}
      <TaskQuickDetailSheet
        key={selectedTask?.id ?? "closed"}
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick detail sheet for overview                                    */
/* ------------------------------------------------------------------ */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

function TaskQuickDetailSheet({
  task,
  open,
  onOpenChange,
}: {
  task: SerializedTask | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [logs, setLogs] = React.useState<
    { id: string; message: string; createdAt: string }[]
  >([]);

  React.useEffect(() => {
    if (!task) return;
    let cancelled = false;
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setLogs(d.logs ?? []);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [task]);

  if (!task) return null;

  const overdue = isOverdue(new Date(task.deadline), task.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="font-mono text-[11px]">
              {task.code}
            </Badge>
            {overdue && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 text-[11px]">
                عقب‌افتاده
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg text-right leading-7">
            {task.title}
          </SheetTitle>
          <SheetDescription className="sr-only">جزئیات تسک</SheetDescription>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-4 text-sm">
            {/* Meta fields */}
            <div className="grid grid-cols-1 gap-3">
              <MetaItem label="مسئول" value={task.assigneeName} />
              <MetaItem label="مجموعه" value={task.groupName ?? "—"} />
              <MetaItem
                label="ددلاین"
                value={formatJalaliLong(new Date(task.deadline))}
                warn={overdue}
              />
              <MetaItem
                label="منبع"
                value={task.sourceLabel}
              />
              {task.source === "REFERRED" && task.letterNumber && (
                <MetaItem label="شماره نامه" value={task.letterNumber} />
              )}
            </div>

            {task.description && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">توضیحات</p>
                  <p className="leading-6">{task.description}</p>
                </div>
              </>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    تاریخچه فعالیت
                  </p>
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                        <div>
                          <p>{log.message}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {formatJalaliDate(new Date(log.createdAt))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MetaItem({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={cn(warn && "text-rose-600 dark:text-rose-400 font-medium")}>
        {value}
      </p>
    </div>
  );
}
