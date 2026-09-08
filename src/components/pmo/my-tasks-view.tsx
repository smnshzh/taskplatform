"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTMStore } from "@/lib/pmo-store";
import { toPersianDigits, formatJalaliDate, formatTime, isOverdue, isToday } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { priorityByKey, statusByKey, approvalStatusByKey } from "@/lib/constants";
import type { SerializedTask } from "@/lib/serialize";
import {
  CheckCircle2,
  Circle,
  Clock,
  Pause,
  AlertTriangle,
  CalendarClock,
  PlayCircle,
  RotateCcw,
  Hourglass,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Badge class maps                                                    */
/* ------------------------------------------------------------------ */

const priorityClasses: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

const statusClasses: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  STARTED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  BLOCKED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
};

const approvalClasses: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

/* ------------------------------------------------------------------ */
/*  Mini task card                                                      */
/* ------------------------------------------------------------------ */

function TaskRow({ task, onStatusChange }: { task: SerializedTask; onStatusChange: (id: string, status: string) => void }) {
  const dl = new Date(task.deadline);
  const overdue = isOverdue(dl, task.status);
  const today = isToday(dl);
  const pInfo = priorityByKey(task.priority);
  const sInfo = statusByKey(task.status);
  // Pre-compute to avoid TS 5.9 correlated-narrowing bug with sInfo in JSX ternary chains
  const statusDisplay = sInfo ? (sInfo.short || sInfo.label) : task.status;

  return (
    <Card
      className={cn(
        "p-3 transition-all hover:shadow-md hover:border-primary/40",
        overdue && "border-r-4 border-r-rose-500",
        today && !overdue && "border-r-4 border-r-amber-500"
      )}
    >
      <div className="flex flex-col gap-2">
        {/* Top row: code + badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground">{task.code}</span>
          {pInfo && (
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", priorityClasses[task.priority])}>
              {pInfo.label}
            </span>
          )}
          {sInfo ? (
            <span className={cn("inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", statusClasses[task.status])}>
              {task.status === "DONE" ? <CheckCircle2 className="h-2.5 w-2.5" /> : task.status === "STARTED" ? <Clock className="h-2.5 w-2.5" /> : task.status === "BLOCKED" ? <Pause className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
              {statusDisplay}
            </span>
          ) : null}
          {overdue && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
              <AlertTriangle className="h-2.5 w-2.5" />
              عقب‌افتاده
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium leading-6 line-clamp-2">{task.title}</h4>

        {/* Bottom row: deadline + group */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground truncate">{task.groupName ?? "—"}</span>
          <span
            className={cn(
              "flex items-center gap-1 shrink-0",
              overdue ? "text-rose-600 dark:text-rose-400 font-medium" : today ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
            )}
          >
            <CalendarClock className="h-3 w-3" />
            <span className="nums-fa">{formatJalaliDate(dl)} {formatTime(dl)}</span>
          </span>
        </div>

        {/* Status change buttons (only for active tasks) */}
        {task.status !== "DONE" && !task.approvalStatus && (
          <div className="flex items-center gap-1.5 pt-1 border-t">
            {task.status === "PENDING" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300"
                onClick={() => onStatusChange(task.id, "STARTED")}
              >
                <PlayCircle className="h-3 w-3" />
                شروع
              </Button>
            )}
            {task.status === "STARTED" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                  onClick={() => onStatusChange(task.id, "BLOCKED")}
                >
                  <Pause className="h-3 w-3" />
                  مسدود
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                  onClick={() => onStatusChange(task.id, "DONE")}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  انجام شد
                </Button>
              </>
            )}
            {task.status === "BLOCKED" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300"
                  onClick={() => onStatusChange(task.id, "STARTED")}
                >
                  <RotateCcw className="h-3 w-3" />
                  از سر گیری
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                  onClick={() => onStatusChange(task.id, "DONE")}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  انجام شد
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Section component                                                   */
/* ------------------------------------------------------------------ */

function TaskSection({
  title,
  count,
  icon: Icon,
  iconColor,
  children,
  emptyMessage,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {toPersianDigits(count)}
        </Badge>
      </div>
      {count === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function MyTasksView() {
  const member = useTMStore((s) => s.member);
  const taskVersion = useTMStore((s) => s.taskVersion);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "my", member?.id, taskVersion],
    queryFn: async () => {
      const r = await fetch("/api/tasks");
      if (!r.ok) throw new Error("خطا در دریافت تسک‌ها");
      return (await r.json()) as { tasks: SerializedTask[] };
    },
    enabled: !!member,
  });

  const tasks = data?.tasks ?? [];

  // Categorize
  const activeTasks = tasks.filter((t) => ["PENDING", "STARTED", "BLOCKED"].includes(t.status) && !t.approvalStatus);
  const doneTasks = tasks.filter((t) => t.status === "DONE");
  const referredTasks = tasks.filter((t) => t.approvalStatus === "PENDING_APPROVAL" || t.approvalStatus === "REFERRED");

  const [changingId, setChangingId] = React.useState<string | null>(null);

  async function onStatusChange(id: string, status: string) {
    setChangingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "خطا در تغییر وضعیت");
        return;
      }
      const sLabel = statusByKey(status)?.label ?? status;
      toast.success(`وضعیت به «${sLabel}» تغییر یافت.`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setChangingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-28 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Active */}
      <TaskSection
        title="فعال"
        count={activeTasks.length}
        icon={Clock}
        iconColor="text-sky-500"
        emptyMessage="هیچ تسک فعالی ندارید."
      >
        {activeTasks.map((t) => (
          <TaskRow key={t.id} task={t} onStatusChange={onStatusChange} />
        ))}
      </TaskSection>

      {/* Done */}
      <TaskSection
        title="انجام‌شده"
        count={doneTasks.length}
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        emptyMessage="هنوز تسکی انجام نشده است."
      >
        {doneTasks.map((t) => (
          <TaskRow key={t.id} task={t} onStatusChange={onStatusChange} />
        ))}
      </TaskSection>

      {/* Referred / Pending Approval */}
      <TaskSection
        title="ارجاعی در انتظار"
        count={referredTasks.length}
        icon={Hourglass}
        iconColor="text-amber-500"
        emptyMessage="تسک ارجاعی در انتظاری ندارید."
      >
        {referredTasks.map((t) => (
          <Card key={t.id} className="p-3 border-r-4 border-r-amber-500">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", priorityClasses[t.priority])}>
                  {priorityByKey(t.priority)?.label}
                </span>
                {t.approvalStatus && (
                  <span className={cn("inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", approvalClasses[t.approvalStatus])}>
                    <Hourglass className="h-2.5 w-2.5" />
                    {approvalStatusByKey(t.approvalStatus)?.label ?? t.approvalStatus}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-medium leading-6 line-clamp-2">{t.title}</h4>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground truncate">{t.groupName ?? "—"}</span>
                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <CalendarClock className="h-3 w-3" />
                  <span className="nums-fa">{formatJalaliDate(new Date(t.deadline))}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t text-xs text-amber-600 dark:text-amber-400">
                <Hourglass className="h-3 w-3" />
                در انتظار تأیید مدیر/سرپرست
              </div>
            </div>
          </Card>
        ))}
      </TaskSection>
    </div>
  );
}