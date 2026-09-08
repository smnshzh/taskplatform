"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FOLLOW_UP_REASONS,
  priorityByKey,
  statusByKey,
} from "@/lib/constants";
import type { SerializedTask } from "@/lib/serialize";
import { toPersianDigits, isOverdue } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  FileText,
  Filter,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                      */
/* ------------------------------------------------------------------ */

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  LOW: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

const COLUMN_HEADER_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  STARTED: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  BLOCKED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const COLUMN_DOT_STYLES: Record<string, string> = {
  PENDING: "bg-slate-500",
  STARTED: "bg-sky-500",
  BLOCKED: "bg-rose-500",
  DONE: "bg-emerald-500",
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = priorityByKey(priority);
  if (!p) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        PRIORITY_STYLES[p.key]
      )}
    >
      {p.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Next status helper                                                  */
/* ------------------------------------------------------------------ */

function getNextStatus(current: string): string | null {
  if (current === "PENDING") return "STARTED";
  if (current === "STARTED") return "DONE";
  return null;
}

/* ------------------------------------------------------------------ */
/*  KanbanCard                                                         */
/* ------------------------------------------------------------------ */

function KanbanCard({
  task,
  onUpdate,
  onBlocked,
}: {
  task: SerializedTask;
  onUpdate: (taskId: string, status: string) => void;
  onBlocked: (taskId: string) => void;
}) {
  const overdue = isOverdue(new Date(task.deadline), task.status);
  const nextStatus = getNextStatus(task.status);

  return (
    <Card
      className={cn(
        "group p-3 transition-all hover:shadow-md",
        overdue && "border-r-4 border-r-rose-500"
      )}
    >
      <div className="space-y-2.5">
        {/* Code + referred indicator */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground">
            {task.code}
          </span>
          {task.source === "REFERRED" && task.letterNumber && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
              <FileText className="h-3 w-3" />
              {task.letterNumber}
            </span>
          )}
          {task.approvalStatus === "PENDING_APPROVAL" && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] px-1.5 py-0 h-5">
              در انتظار تأیید
            </Badge>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium leading-6 line-clamp-2">
          {task.title}
        </h4>

        {/* Priority + Group */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <PriorityBadge priority={task.priority} />
          {task.groupName && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-md px-1.5 py-0.5">
              {task.groupName}
            </span>
          )}
        </div>

        {/* Assignee */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
            {task.assigneeName.charAt(0)}
          </span>
          <span className="truncate">{task.assigneeName}</span>
        </div>

        {/* Deadline */}
        {overdue && (
          <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
            <AlertTriangle className="h-3 w-3" />
            عقب‌افتاده
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 pt-1 border-t">
          {task.status !== "DONE" && task.status !== "BLOCKED" && nextStatus && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-[11px] gap-1"
              onClick={() => onUpdate(task.id, nextStatus)}
            >
              {nextStatus === "STARTED" && (
                <PlayCircle className="h-3 w-3 text-sky-500" />
              )}
              {nextStatus === "DONE" && (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              )}
              {nextStatus === "STARTED" ? "شروع" : "انجام شد"}
            </Button>
          )}
          {task.status !== "BLOCKED" && task.status !== "DONE" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
              onClick={() => onBlocked(task.id)}
            >
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">مسدود</span>
            </Button>
          )}
          {task.status === "BLOCKED" && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-[11px] gap-1"
              onClick={() => onUpdate(task.id, "STARTED")}
            >
              <PlayCircle className="h-3 w-3 text-sky-500" />
              از سر گیری
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Blocked Reason Dialog                                              */
/* ------------------------------------------------------------------ */

function BlockedReasonDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (taskId: string, reason: string) => void;
}) {
  const [taskId, setTaskId] = React.useState<string>("");
  const busy = React.useRef(false);

  function handleOpen(v: boolean) {
    onOpenChange(v);
    if (!v) setTaskId("");
  }

  function handleSelect(reason: string) {
    if (busy.current) return;
    busy.current = true;
    onSelect(taskId, reason);
    busy.current = false;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-right">علت مسدود شدن</DialogTitle>
          <DialogDescription className="text-right">
            علت عدم انجام تسک را انتخاب کنید.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {FOLLOW_UP_REASONS.map((r) => (
            <Button
              key={r.key}
              variant="outline"
              size="sm"
              className="justify-start h-9 text-sm"
              onClick={() => handleSelect(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  KanbanView                                                         */
/* ------------------------------------------------------------------ */

export function KanbanView() {
  const queryClient = useQueryClient();
  const [groupFilter, setGroupFilter] = React.useState<string[]>([]);
  const [blockedTaskId, setBlockedTaskId] = React.useState<string>("");
  const [blockedDialogOpen, setBlockedDialogOpen] = React.useState(false);

  // Fetch tasks (exclude DONE, fetch all at once)
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["tasks", "kanban"],
    queryFn: async () => {
      const r = await fetch("/api/tasks?limit=200");
      if (!r.ok) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
  });
  const tasks = tasksData?.tasks ?? [];

  // Derive unique groups
  const uniqueGroups = React.useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.groupName) set.add(t.groupName);
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Filter tasks — only non-DONE, sort by deadline (soonest first)
  const filteredTasks = React.useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status === "DONE") return false;
        if (groupFilter.length > 0 && (!t.groupName || !groupFilter.includes(t.groupName))) return false;
        return true;
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  }, [tasks, groupFilter]);

  // Mutation for status change
  const statusMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      followUpReason,
    }: {
      taskId: string;
      status: string;
      followUpReason?: string;
    }) => {
      const body: Record<string, string> = { status };
      if (followUpReason) body.followUpReason = followUpReason;
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("خطا");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("وضعیت تسک به‌روزرسانی شد.");
    },
    onError: () => {
      toast.error("به‌روزرسانی وضعیت ناموفق بود.");
    },
  });

  function handleUpdateStatus(taskId: string, status: string) {
    statusMutation.mutate({ taskId, status });
  }

  function handleBlocked(taskId: string) {
    setBlockedTaskId(taskId);
    setBlockedDialogOpen(true);
  }

  function handleBlockedReason(taskId: string, reason: string) {
    statusMutation.mutate(
      { taskId, status: "BLOCKED", followUpReason: reason },
      {
        onSuccess: () => {
          setBlockedDialogOpen(false);
        },
      }
    );
  }

  // Group tasks by column status (exclude DONE)
  const KANBAN_VISIBLE = ["PENDING", "STARTED", "BLOCKED"];
  const columns = React.useMemo(() => {
    const colMap = new Map<string, SerializedTask[]>();
    KANBAN_VISIBLE.forEach((s) => colMap.set(s, []));
    filteredTasks.forEach((t) => {
      const list = colMap.get(t.status);
      if (list) list.push(t);
    });
    return colMap;
  }, [filteredTasks]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ---- Filter Bar ---- */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          فیلتر مجموعه:
        </div>
        <MultiSelect
          className="h-8 min-w-[150px]"
          value={groupFilter}
          onValueChange={setGroupFilter}
          placeholder="همه مجموعه‌ها"
          options={uniqueGroups.map((group) => ({ value: group, label: group }))}
        />
        <div className="mr-auto text-xs text-muted-foreground">
          {toPersianDigits(filteredTasks.length)} تسک
        </div>
      </div>

      {/* ---- Columns ---- */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-3 flex-1">
          {["PENDING", "STARTED", "BLOCKED"].map((s) => (
            <div key={s} className="space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* تغییر اصلی در این تگ انجام شد: ارتفاع ۱۰۰٪ داده شد تا ScrollArea به درستی کار کند */
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-3 flex-1 min-h-0 h-full">
          {KANBAN_VISIBLE.map((statusKey) => {
            const statusInfo = statusByKey(statusKey);
            const columnTasks = columns.get(statusKey) ?? [];
            return (
              <div
                key={statusKey}
                /* تغییر در این تگ: overflow-hidden حذف و ارتفاع فیکس تعریف شد */
                className="flex flex-col h-full min-h-0 rounded-xl border bg-muted/30"
              >
                {/* Column header */}
                <div
                  className={cn(
                    "shrink-0 px-3 py-2 flex items-center gap-2",
                    COLUMN_HEADER_STYLES[statusKey]
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      COLUMN_DOT_STYLES[statusKey]
                    )}
                  />
                  <span className="text-xs font-semibold flex-1">
                    {statusInfo?.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-5 px-1.5"
                  >
                    {toPersianDigits(columnTasks.length)}
                  </Badge>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1 h-full">
                  <div className="p-2 space-y-2">
                    {columnTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        تسکی وجود ندارد
                      </p>
                    )}
                    {columnTasks.map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        onUpdate={handleUpdateStatus}
                        onBlocked={handleBlocked}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      )}

      {/* Blocked reason dialog */}
      <BlockedReasonDialog
        open={blockedDialogOpen}
        onOpenChange={setBlockedDialogOpen}
        onSelect={handleBlockedReason}
      />
    </div>
  );
}
