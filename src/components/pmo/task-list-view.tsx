"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  STATUSES,
  PRIORITIES,
  TASK_SOURCES,
  FOLLOW_UP_REASONS,
  APPROVAL_STATUSES,
  approvalStatusByKey,
  statusByKey,
  priorityByKey,
  sourceByKey,
} from "@/lib/constants";
import type { SerializedTask, SerializedLog, SerializedMember } from "@/lib/serialize";
import {
  toPersianDigits,
  isOverdue,
  formatJalaliDate,
  formatJalaliLong,
  formatTime,
  toJalali,
} from "@/lib/jalali";
import { tehranCalendarDaysBetween } from "@/shared/lib/date/tehran-time";
import { cn } from "@/lib/utils";
import { useTMStore } from "@/lib/pmo-store";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  PlayCircle,
  FileText,
  Eye,
  Upload,
  Download,
  Search,
  Filter,
  CalendarClock,
  User,
  Link2,
  History,
  MessageSquare,
  FileArchive,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Pencil,
  Save,
  X,
  ChevronsLeft,
  ChevronsRight,
  ChevronsLeftRight,
  Columns3,
  Trash2,
  GitBranch,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { NewTaskDialog } from "./new-task-dialog";

/* ------------------------------------------------------------------ */
/*  Badge helpers                                                      */
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

const SOURCE_STYLES: Record<string, string> = {
  MANUAL: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  SCHEDULED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  REFERRED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
};

function PriorityBadge({ priority }: { priority: string }) {
  const p = priorityByKey(priority);
  if (!p) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
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
          : Circle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_STYLES[s.key]
      )}
    >
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "REFERRED") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
          SOURCE_STYLES.REFERRED
        )}
      >
        <FileText className="h-3 w-3" />
        نامه‌ای
      </span>
    );
  }
  const s = sourceByKey(source);
  if (!s) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        SOURCE_STYLES[source] ?? SOURCE_STYLES.MANUAL
      )}
    >
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskListView                                                       */
/* ------------------------------------------------------------------ */

export function TaskListView() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = React.useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = React.useState<string[]>([]);
  const [groupFilter, setGroupFilter] = React.useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = React.useState<string[]>([]);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [groupByPerson, setGroupByPerson] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 12;

  // Column visibility
  type ColKey = "code" | "title" | "group" | "assignee" | "creator" | "priority" | "source" | "status" | "deadline" | "actions";
  const defaultCols: Record<ColKey, boolean> = {
    code: true, title: true, group: true, assignee: true, creator: true,
    priority: true, source: true, status: true, deadline: true, actions: true,
  };
  const [visibleCols, setVisibleCols] = React.useState<Record<ColKey, boolean>>(defaultCols);
  const [colMenuOpen, setColMenuOpen] = React.useState(false);

  // Close column menu on outside click
  const colMenuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!colMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colMenuOpen]);

  // Detail sheet
  const [detailTask, setDetailTask] = React.useState<SerializedTask | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  // Excel import
  const taskFileRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);

  const handleTaskImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/tasks/import", { method: "POST", body: fd });
      const data = await r.json();
      if (r.ok || r.status === 201) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        const msg = data.created
          ? `${data.created} تسک با موفقیت وارد شد.`
          : "تسکی وارد نشد.";
        toast.success(msg);
        if (data.errors?.length > 0) {
          toast.error(`${toPersianDigits(data.errors.length)} خطا: ${data.errors.slice(0, 3).join(" | ")}`);
        }
      } else {
        toast.error(data.error ?? "خطا در وارد کردن فایل اکسل.");
      }
    } catch {
      toast.error("خطا در ارسال فایل.");
    } finally {
      setImporting(false);
      if (taskFileRef.current) taskFileRef.current.value = "";
    }
  };

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Reset page when filters or server-side search change
  React.useEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [statusFilter, priorityFilter, sourceFilter, groupFilter, assigneeFilter, dateFrom, dateTo, debouncedSearch]);

  // Build query params
  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams();
    statusFilter.forEach((value) => params.append("status", value));
    priorityFilter.forEach((value) => params.append("priority", value));
    sourceFilter.forEach((value) => params.append("source", value));
    groupFilter.forEach((value) => params.append("groupId", value));
    assigneeFilter.forEach((value) => params.append("assigneeId", value));
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [statusFilter, priorityFilter, sourceFilter, groupFilter, assigneeFilter, dateFrom, dateTo, debouncedSearch, page]);

  // Fetch tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: [
      "tasks",
      "filtered",
      statusFilter.join(","),
      priorityFilter.join(","),
      sourceFilter.join(","),
      groupFilter.join(","),
      assigneeFilter.join(","),
      dateFrom,
      dateTo,
      debouncedSearch,
      page,
    ],
    queryFn: async () => {
      const r = await fetch(`/api/tasks${queryParams}`);
      if (!r.ok) return { tasks: [] as SerializedTask[], pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 } };
      return (await r.json()) as { tasks: SerializedTask[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
    },
  });
  const tasks = tasksData?.tasks ?? [];
  const pagination = tasksData?.pagination;
  const { data: filterOptionsData } = useQuery({
    queryKey: ["members", "task-filter-options"],
    queryFn: async () => {
      const response = await fetch("/api/members");
      if (!response.ok) return { members: [] as SerializedMember[] };
      return (await response.json()) as { members: SerializedMember[] };
    },
  });
  const filterMembers = filterOptionsData?.members ?? [];

  const filteredTasks = tasks;

  // Derive unique groups from fetched tasks
  const uniqueGroups = React.useMemo(() => {
    const set = new Set<string>();
    filterMembers.forEach((member) => {
      if (member.groupId) set.add(member.groupId);
    });
    const map = new Map<string, string>();
    filterMembers.forEach((member) => {
      if (member.groupName && member.groupId) map.set(member.groupId, member.groupName);
    });
    tasks.forEach((t) => {
      if (t.groupName && t.groupId && !map.has(t.groupId)) {
        map.set(t.groupId, t.groupName);
      }
    });
    return { ids: Array.from(set), names: map };
  }, [filterMembers, tasks]);

  // Derive unique assignees from fetched tasks
  const uniqueAssignees = React.useMemo(() => {
    const map = new Map<string, string>();
    filterMembers.forEach((member) => {
      if (!map.has(member.id)) {
        map.set(member.id, member.name);
      }
    });
    tasks.forEach((task) => {
      if (task.assigneeId && task.assigneeName && !map.has(task.assigneeId)) {
        map.set(task.assigneeId, task.assigneeName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [filterMembers, tasks]);

  // Group tasks by assignee for per-person view
  const tasksByPerson = React.useMemo(() => {
    const grouped = new Map<string, { name: string; tasks: typeof filteredTasks }>();
    for (const t of filteredTasks) {
      if (!grouped.has(t.assigneeId)) {
        grouped.set(t.assigneeId, { name: t.assigneeName, tasks: [] });
      }
      grouped.get(t.assigneeId)!.tasks.push(t);
    }
    return Array.from(grouped.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    );
  }, [filteredTasks]);

  function openDetail(task: SerializedTask) {
    setDetailTask(task);
    setDetailOpen(true);
  }

  function refreshAfterUpdate() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const activeFilterCount =
    statusFilter.length +
    priorityFilter.length +
    sourceFilter.length +
    groupFilter.length +
    assigneeFilter.length +
    Number(Boolean(dateFrom)) +
    Number(Boolean(dateTo));

  function clearFilters() {
    setStatusFilter([]);
    setPriorityFilter([]);
    setSourceFilter([]);
    setGroupFilter([]);
    setAssigneeFilter([]);
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ---- Toolbar ---- */}
      <Card className="shrink-0 p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو در همه تسک‌ها؛ عنوان، کد یا مسئول..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-8 h-9 text-sm"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Group */}
            <MultiSelect
              value={groupFilter}
              onValueChange={setGroupFilter}
              placeholder="همه مجموعه‌ها"
              options={Array.from(uniqueGroups.names.entries()).map(([value, label]) => ({ value, label }))}
            />

            {/* Assignee (نفر) */}
            <MultiSelect
              value={assigneeFilter}
              onValueChange={setAssigneeFilter}
              placeholder="همه افراد"
              options={uniqueAssignees.map((item) => ({ value: item.id, label: item.name }))}
            />

            {/* Status */}
            <MultiSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="همه وضعیت‌ها" options={STATUSES.map((item) => ({ value: item.key, label: item.label }))} />

            {/* Priority */}
            <MultiSelect value={priorityFilter} onValueChange={setPriorityFilter} placeholder="همه اولویت‌ها" options={PRIORITIES.map((item) => ({ value: item.key, label: item.label }))} />

            {/* Source */}
            <MultiSelect value={sourceFilter} onValueChange={setSourceFilter} placeholder="همه منابع" options={TASK_SOURCES.map((item) => ({ value: item.key, label: item.label }))} />

            {/* Date from (Jalali) */}
            <Input
              type="text"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[130px] h-9 text-xs"
              dir="ltr"
              placeholder="1404/01/01"
            />

            {/* Date to (Jalali) */}
            <Input
              type="text"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[130px] h-9 text-xs"
              dir="ltr"
              placeholder="1404/12/29"
            />

            {/* Clear date filter */}
            {(dateFrom || dateTo) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs text-muted-foreground hover:text-foreground px-2"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                title="پاک کردن فیلتر تاریخ"
              >
                <CalendarClock className="h-3.5 w-3.5" />
              </Button>
            )}
            {activeFilterCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 gap-1.5 text-xs text-rose-600 hover:text-rose-700"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                پاک کردن همه
                <Badge variant="secondary" className="h-5 px-1 text-[10px]">
                  {toPersianDigits(activeFilterCount)}
                </Badge>
              </Button>
            )}
          </div>

          {/* Count + Group-by toggle + Column toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Column visibility dropdown */}
            <div className="relative" ref={colMenuRef}>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-9 text-xs"
                onClick={() => setColMenuOpen(!colMenuOpen)}
                title="ستون‌ها"
              >
                <Columns3 className="h-3.5 w-3.5" />
                <ChevronDown className="h-3 w-3" />
              </Button>
              {colMenuOpen && (
                <div className="absolute top-full mt-1 right-0 z-50 bg-popover border rounded-lg shadow-md p-2 min-w-[160px]">
                  {(["code", "title", "group", "assignee", "creator", "priority", "source", "status", "deadline"] as ColKey[]).map((col) => {
                    const labels: Record<string, string> = {
                      code: "کد", title: "عنوان", group: "مجموعه", assignee: "مسئول", creator: "تعریف‌کننده",
                      priority: "اولویت", source: "منبع", status: "وضعیت", deadline: "ددلاین",
                    };
                    return (
                      <label key={col} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded">
                        <input
                          type="checkbox"
                          checked={visibleCols[col]}
                          onChange={(e) => setVisibleCols((prev) => ({ ...prev, [col]: e.target.checked }))}
                          className="rounded"
                        />
                        {labels[col]}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant={groupByPerson ? "default" : "outline"}
              className={cn("gap-1.5 h-9 text-xs", groupByPerson && "bg-primary")}
              onClick={() => setGroupByPerson(!groupByPerson)}
              title="نمایش به تفکیک نفر"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden md:inline">تفکیک نفر</span>
            </Button>

            <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
              {pagination ? toPersianDigits(pagination.total) : "—"} تسک
            </div>
          </div>

          {/* Excel actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-9 text-xs"
              onClick={() => window.open("/api/templates/download?type=tasks", "_blank")}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">تمپلت تسک</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-9 text-xs"
              disabled={importing}
              onClick={() => taskFileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{importing ? "در حال ورود..." : "ورود از اکسل"}</span>
            </Button>
            <input
              ref={taskFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleTaskImport}
            />
          </div>
        </div>
      </Card>

      {/* ---- Table ---- */}
      <Card className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full py-16">
            <div className="text-center text-sm text-muted-foreground">
              <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>تسکی یافت نشد.</p>
              <p className="text-xs mt-1">
                فیلترها را تغییر دهید یا جستجوی دیگری انجام دهید.
              </p>
            </div>
          </div>
        ) : groupByPerson ? (
          /* ---- Grouped by Person ---- */
          <ScrollArea className="h-full">
            <div className="divide-y">
              {tasksByPerson.map(([assigneeId, group]) => {
                const doneCount = group.tasks.filter((t) => t.status === "DONE").length;
                const total = group.tasks.length;
                return (
                  <div key={assigneeId} className="py-2">
                    {/* Person header row */}
                    <button
                      className="flex items-center gap-2 w-full px-4 py-2 hover:bg-muted/50 transition-colors text-right"
                      onClick={() => {
                        const el = document.getElementById(`person-${assigneeId}`);
                        el?.classList.toggle("hidden");
                        const chevron = document.getElementById(`chevron-${assigneeId}`);
                        chevron?.classList.toggle("rotate-90");
                      }}
                    >
                      <ChevronRight
                        id={`chevron-${assigneeId}`}
                        className="h-4 w-4 text-muted-foreground transition-transform rotate-90 shrink-0"
                      />
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                        {group.name.charAt(0)}
                      </span>
                      <span className="text-sm font-semibold">{group.name}</span>
                      <Badge variant="outline" className="text-[10px] mr-auto">
                        {toPersianDigits(total)} تسک | {toPersianDigits(doneCount)} انجام‌شده
                      </Badge>
                    </button>

                    {/* Person's task table */}
                    <div id={`person-${assigneeId}`} className="px-4 pb-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs whitespace-nowrap w-[90px]">کد</TableHead>
                            <TableHead className="text-xs whitespace-nowrap min-w-[160px]">عنوان</TableHead>
                            <TableHead className="text-xs whitespace-nowrap hidden md:table-cell">مجموعه</TableHead>
                            <TableHead className="text-xs whitespace-nowrap hidden lg:table-cell">اولویت</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">وضعیت</TableHead>
                            <TableHead className="text-xs whitespace-nowrap hidden xl:table-cell">ددلاین</TableHead>
                            <TableHead className="text-xs whitespace-nowrap w-16 text-center">عملیات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.tasks.map((task) => {
                            const overdue = isOverdue(new Date(task.deadline), task.status);
                            const overdueDays = overdue ? tehranCalendarDaysBetween(new Date(task.deadline)) : 0;
                            return (
                              <TableRow key={task.id} className="group">
                                <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                  {task.code}
                                </TableCell>
                                <TableCell
                                  className="text-sm font-medium max-w-[200px] sm:max-w-[280px] cursor-pointer truncate"
                                  onClick={() => openDetail(task)}
                                >
                                  <span className="hover:text-primary transition-colors">
                                    {task.title}
                                  </span>
                                  {overdue && (
                                    <span className="inline-flex items-center gap-0.5 mr-1.5 text-[10px] text-rose-600 dark:text-rose-400">
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                    </span>
                                  )}
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
                                <TableCell className="hidden xl:table-cell whitespace-nowrap">
                                  <div
                                    className={cn(
                                      "text-xs",
                                      overdue
                                        ? "text-rose-600 dark:text-rose-400 font-medium"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {formatJalaliDate(new Date(task.deadline))}
                                    {overdue && <div className="mt-0.5 text-[10px]">{toPersianDigits(overdueDays)} روز گذشته</div>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openDetail(task)}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        ) : (
          /* ---- Normal flat table ---- */
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleCols.code && <TableHead className="text-xs whitespace-nowrap w-[90px]">کد</TableHead>}
                  {visibleCols.title && <TableHead className="text-xs whitespace-nowrap min-w-[160px]">عنوان</TableHead>}
                  {visibleCols.group && <TableHead className="text-xs whitespace-nowrap">مجموعه</TableHead>}
                  {visibleCols.assignee && <TableHead className="text-xs whitespace-nowrap">مسئول</TableHead>}
                  {visibleCols.creator && <TableHead className="text-xs whitespace-nowrap">تعریف‌کننده</TableHead>}
                  {visibleCols.priority && <TableHead className="text-xs whitespace-nowrap">اولویت</TableHead>}
                  {visibleCols.source && <TableHead className="text-xs whitespace-nowrap">منبع</TableHead>}
                  {visibleCols.status && <TableHead className="text-xs whitespace-nowrap">وضعیت</TableHead>}
                  {visibleCols.deadline && <TableHead className="text-xs whitespace-nowrap">ددلاین</TableHead>}
                  {visibleCols.actions && <TableHead className="text-xs whitespace-nowrap w-16 text-center">عملیات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const overdue = isOverdue(new Date(task.deadline), task.status);
                  const overdueDays = overdue ? tehranCalendarDaysBetween(new Date(task.deadline)) : 0;
                  return (
                    <TableRow
                      key={task.id}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-muted/60",
                        overdue && "border-r-2 border-r-rose-500"
                      )}
                      onClick={() => openDetail(task)}
                    >
                      {visibleCols.code && (
                        <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {task.code}
                        </TableCell>
                      )}
                      {visibleCols.title && (
                        <TableCell className="max-w-[220px] sm:max-w-[340px]">
                          <div className="text-sm font-medium leading-5 group-hover:text-primary transition-colors line-clamp-2">
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground">
                              {task.description.replace(/[#*_>`]/g, "").slice(0, 90)}
                            </div>
                          )}
                          {overdue && (
                            <span className="inline-flex items-center gap-0.5 mr-1.5 text-[10px] text-rose-600 dark:text-rose-400">
                              <AlertTriangle className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </TableCell>
                      )}
                      {visibleCols.group && (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {task.groupName}
                        </TableCell>
                      )}
                      {visibleCols.assignee && (
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold shrink-0">
                              {task.assigneeName.charAt(0)}
                            </span>
                            <span className="truncate max-w-[100px]">{task.assigneeName}</span>
                          </div>
                        </TableCell>
                      )}
                      {visibleCols.creator && (
                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                          {task.creatorName ?? "نامشخص (تسک قدیمی)"}
                        </TableCell>
                      )}
                      {visibleCols.priority && (
                        <TableCell>
                          <PriorityBadge priority={task.priority} />
                        </TableCell>
                      )}
                      {visibleCols.source && (
                        <TableCell>
                          <SourceBadge source={task.source} />
                        </TableCell>
                      )}
                      {visibleCols.status && (
                        <TableCell>
                          <StatusBadge status={task.status} />
                        </TableCell>
                      )}
                      {visibleCols.deadline && (
                        <TableCell className="whitespace-nowrap">
                          <div
                            className={cn(
                              "text-xs",
                              overdue
                                ? "text-rose-600 dark:text-rose-400 font-medium"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatJalaliDate(new Date(task.deadline))}
                            {overdue && <div className="mt-0.5 text-[10px]">{toPersianDigits(overdueDays)} روز گذشته</div>}
                          </div>
                        </TableCell>
                      )}
                      {visibleCols.actions && (
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetail(task);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              title="اولین صفحه"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              title="صفحه قبل"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[100px] text-center">
              {toPersianDigits(page)} از {toPersianDigits(pagination.totalPages)}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              title="صفحه بعد"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(pagination.totalPages)}
              title="آخرین صفحه"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </Card>

      {/* ---- Task Detail Sheet ---- */}
      <TaskDetailSheet
        key={detailTask?.id ?? "closed"}
        task={detailTask}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setDetailTask(null);
        }}
        onUpdated={refreshAfterUpdate}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TaskDetailSheet — full detail with status change & logs             */
/* ------------------------------------------------------------------ */

function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  onUpdated,
}: {
  task: SerializedTask | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}) {
  const member = useTMStore((s) => s.member);
  const [logs, setLogs] = React.useState<SerializedLog[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [showReasonPicker, setShowReasonPicker] = React.useState(false);
  const [showArchivePrompt, setShowArchivePrompt] = React.useState(false);
  const [doneDesc, setDoneDesc] = React.useState("");
  const [showDoneInput, setShowDoneInput] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editPriority, setEditPriority] = React.useState("");
  const [editDeadline, setEditDeadline] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [workflow, setWorkflow] = React.useState<{ previous: Array<{ id: string; code: string; title: string; status: string }>; next: Array<{ id: string; code: string; title: string; status: string }> }>({ previous: [], next: [] });
  const [showNextTaskDialog, setShowNextTaskDialog] = React.useState(false);

  React.useEffect(() => {
    if (!task) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/tasks/${task.id}`).then((r) => r.json()),
      fetch(`/api/tasks/${task.id}/workflow`).then((r) => r.json()),
    ]).then(([detail, workflowData]) => {
      if (cancelled) return;
      setLogs(detail.logs ?? []);
      setWorkflow(workflowData.workflow ?? { previous: [], next: [] });
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
  const dl = new Date(task.deadline);

  async function updateStatus(status: string, extra?: Record<string, unknown>) {
    if (!task) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error ?? "به‌روزرسانی وضعیت ناموفق بود.");
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
      if (extra?.nextTaskId) {
        const workflowRes = await fetch(`/api/tasks/${task.id}/workflow`);
        const workflowData = await workflowRes.json();
        setWorkflow(workflowData.workflow ?? { previous: [], next: [] });
      }
      toast.success(
        status === "STARTED"
          ? "شروع کردم — وضعیت به‌روزرسانی شد."
          : status === "DONE"
            ? "تسک به‌عنوان انجام‌شده ثبت شد."
            : "وضعیت به‌روزرسانی شد."
      );
      if (status === "DONE") setShowArchivePrompt(true);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "به‌روزرسانی وضعیت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function setReason(reason: string) {
    if (!task) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpReason: reason, status: "BLOCKED" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs ?? []);
      toast.success("علت عدم انجام ثبت شد.");
      setShowReasonPicker(false);
      onUpdated();
    } catch {
      toast.error("ثبت علت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (!task) return;
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
    setEditPriority(task.priority);
    setEditDeadline(task.deadline.slice(0, 10));
    setEditing(true);
  }

  async function saveEdit() {
    if (!task) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc || null,
          priority: editPriority,
          deadline: new Date(editDeadline).toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs ?? []);
      toast.success("تسک به‌روزرسانی شد.");
      setEditing(false);
      onUpdated();
    } catch {
      toast.error("به‌روزرسانی ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "خطا در حذف تسک");
        return;
      }
      toast.success("تسک به سطل زباله منتقل شد.");
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onUpdated();
    } catch {
      toast.error("خطا در حذف تسک.");
    } finally {
      setDeleting(false);
    }
  }

  const canDelete = member?.permissions.includes("task:delete") ?? false;

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-lg p-0 flex flex-col"
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
            {task.approvalStatus && (
              <ApprovalBadge approvalStatus={task.approvalStatus} />
            )}
          </div>
          <SheetTitle className="text-lg text-right leading-7">
            {task.title}
          </SheetTitle>
          <SheetDescription className="sr-only">جزئیات تسک</SheetDescription>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            <SourceBadge source={task.source} />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-4">
            {/* Referred task info */}
            {task.source === "REFERRED" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  اطلاعات نامه ارجاع
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <MetaItem label="شماره نامه" value={task.letterNumber ?? "—"} />
                  <MetaItem label="تاریخ نامه" value={task.letterDate ?? "—"} />
                  <MetaItem label="مرجع" value={task.refererName ?? "—"} />
                  <MetaItem
                    label="وضعیت تأیید"
                    value={task.approvalStatusLabel ?? "—"}
                  />
                </div>
              </div>
            )}

            {/* Edit form */}
            {editing && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <Pencil className="h-4 w-4" />
                    ویرایش تسک
                  </span>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="gap-1 text-xs h-8" onClick={saveEdit} disabled={busy}>
                      <Save className="h-3.5 w-3.5" />
                      ذخیره
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">عنوان</label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">توضیحات</label>
                  <Textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="text-sm min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">اولویت</label>
                    <Select value={editPriority} onValueChange={setEditPriority}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">ددلاین</label>
                    <JalaliDatePicker
                      value={editDeadline}
                      onChange={setEditDeadline}
                      placeholder="انتخاب ددلاین"
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Meta fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <MetaRow
                icon={<User className="h-4 w-4" />}
                label="مسئول"
                value={`${task.assigneeName} (${task.assigneeHandle})`}
              />
              <MetaRow
                icon={<User className="h-4 w-4" />}
                label="تعریف‌کننده"
                value={task.creatorName ?? "نامشخص (تسک قدیمی)"}
              />
              <MetaRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="ددلاین"
                value={`${formatJalaliLong(dl)} — ${toPersianDigits(formatTime(dl))}`}
                highlight={overdue}
              />
              {task.startTime && (
                <MetaRow
                  icon={<PlayCircle className="h-4 w-4" />}
                  label="زمان شروع"
                  value={`${formatJalaliLong(new Date(task.startTime))} — ${toPersianDigits(formatTime(new Date(task.startTime)))}`}
                />
              )}
              <MetaRow
                icon={<Clock className="h-4 w-4" />}
                label="تاریخ ثبت"
                value={`${formatJalaliDate(new Date(task.createdAt))} ${toPersianDigits(formatTime(new Date(task.createdAt)))}`}
              />
              {task.startedAt && (
                <MetaRow
                  icon={<PlayCircle className="h-4 w-4" />}
                  label="شروع واقعی"
                  value={`${formatJalaliDate(new Date(task.startedAt))} ${toPersianDigits(formatTime(new Date(task.startedAt)))}`}
                />
              )}
              {task.doneAt && (
                <MetaRow
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="انجام شده در"
                  value={`${formatJalaliDate(new Date(task.doneAt))} ${toPersianDigits(formatTime(new Date(task.doneAt)))}`}
                />
              )}
              {task.doneDescription && (
                <div className="flex items-start gap-2 py-1.5">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground mb-0.5">توضیحات انجام کار</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{task.doneDescription}</p>
                  </div>
                </div>
              )}
              <MetaRow
                icon={<Circle className="h-4 w-4" />}
                label="مجموعه"
                value={task.groupName ?? "—"}
              />
              <MetaRow
                icon={<FileText className="h-4 w-4" />}
                label="منبع"
                value={task.sourceLabel}
              />
            </div>

            {task.description && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-6">
                {task.description}
              </div>
            )}

            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-800 dark:bg-sky-950/20 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5"><GitBranch className="h-4 w-4" />گردش‌کار این تسک</p>
              {workflow.previous.length === 0 && workflow.next.length === 0 ? (
                <p className="text-xs text-muted-foreground">هنوز ارتباطی ثبت نشده است.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {workflow.previous.map((item) => <div key={item.id}>مرحله قبلی: <b>{item.code}</b> — {item.title}</div>)}
                  {workflow.next.map((item) => <div key={item.id}>مرحله بعدی: <b>{item.code}</b> — {item.title}</div>)}
                </div>
              )}
            </div>

            {task.link && (
              <a
                href={task.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Link2 className="h-4 w-4" />
                لینک مرتبط
              </a>
            )}

            {overdue && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                این تسک{" "}
                {toPersianDigits(
                  tehranCalendarDaysBetween(dl)
                )}{" "}
                روز از ددلاین گذشته است.
              </div>
            )}

            <Separator />

            {/* Edit & Delete buttons */}
            {!editing && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-9"
                  disabled={busy}
                  onClick={startEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش تسک
                </Button>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-9 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    disabled={busy}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف تسک
                  </Button>
                )}
              </div>
            )}

            <Separator />

            {/* Action buttons */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                اعلام وضعیت
              </div>

              {showArchivePrompt ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <div className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                    <FileArchive className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">این تسک دارای گردش‌کار است؟</p>
                      <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">
                        در صورت انتخاب «بله»، تسک مرحله بعد را برای فرد یا واحد مقصد تعریف کنید.
                      </p>
                      <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => { setShowArchivePrompt(false); setShowNextTaskDialog(true); }}>بله، تعریف مرحله بعد</Button><Button size="sm" variant="outline" onClick={() => setShowArchivePrompt(false)}>خیر، پایان گردش‌کار</Button></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <ActionBtn
                    disabled={
                      busy ||
                      task.status === "STARTED" ||
                      task.status === "DONE"
                    }
                    onClick={() => updateStatus("STARTED")}
                    active={task.status === "STARTED"}
                    className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    <PlayCircle className="h-4 w-4" />
                    شروع کردم
                  </ActionBtn>
                  <ActionBtn
                    disabled={busy || task.status === "DONE"}
                    onClick={() => setShowReasonPicker(true)}
                    active={task.status === "BLOCKED"}
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    انجام نمی‌شود
                  </ActionBtn>
                  <ActionBtn
                    disabled={busy || task.status === "DONE"}
                    onClick={() => {
                      if (task.status === "DONE") return;
                      setDoneDesc("");
                      setShowDoneInput(true);
                    }}
                    active={task.status === "DONE"}
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    انجام شد
                  </ActionBtn>
                </div>
              )}

              {showDoneInput && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    توضیحات انجام تسک را بنویسید:
                  </p>
                  <Textarea
                    value={doneDesc}
                    onChange={(e) => setDoneDesc(e.target.value)}
                    placeholder="چه کاری انجام دادید؟..."
                    rows={3}
                    className="text-sm resize-none"
                    dir="rtl"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDoneInput(false)}
                      disabled={busy}
                    >
                      <X className="h-3.5 w-3.5 ml-1" />
                      انصراف
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setShowDoneInput(false);
                        updateStatus("DONE", { doneDescription: doneDesc || null });
                      }}
                      disabled={busy}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                      ثبت انجام تسک
                    </Button>
                  </div>
                </div>
              )}

              {showReasonPicker && (
                <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">
                    علت عدم انجام را انتخاب کنید:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FOLLOW_UP_REASONS.map((r) => (
                      <Button
                        key={r.key}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setReason(r.key)}
                        className="justify-start text-xs"
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Activity log */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" />
                تاریخچه فعالیت
              </div>
              <div className="space-y-2">
                {logs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    هنوز فعالیتی ثبت نشده است.
                  </p>
                )}
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    <div className="flex-1">
                      <p className="text-foreground/90">{log.message}</p>
                      <p className="text-muted-foreground mt-0.5">
                        {formatJalaliDate(new Date(log.createdAt))}{" "}
                        {toPersianDigits(formatTime(new Date(log.createdAt)))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
    <NewTaskDialog open={showNextTaskDialog} onOpenChange={setShowNextTaskDialog} initialPreviousTask={{ id: task.id, code: task.code, title: task.title }} onCreated={() => { setShowNextTaskDialog(false); onUpdated(); }} />

    {/* Delete confirmation */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>انتقال به سطل زباله</AlertDialogTitle>
          <AlertDialogDescription>
            آیا از انتقال تسک «{task?.title}» به سطل زباله مطمئن هستید؟ این تسک قابل بازیابی خواهد بود.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 hover:bg-rose-700"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "در حال حذف..." : "حذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ApprovalBadge({ approvalStatus }: { approvalStatus: string }) {
  const a = approvalStatusByKey(approvalStatus);
  if (!a) return null;
  const colorMap: Record<string, string> = {
    PENDING_APPROVAL:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    APPROVED:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    REJECTED:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        colorMap[approvalStatus] ?? colorMap.PENDING_APPROVAL
      )}
    >
      {a.label}
    </span>
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
      <p className={cn("text-xs", warn && "text-rose-600 dark:text-rose-400 font-medium")}>
        {value}
      </p>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            highlight && "text-rose-600 dark:text-rose-400 font-medium"
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  active,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn(
        "justify-center gap-1.5 text-xs h-9",
        active && "ring-2 ring-offset-1 ring-current/30",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
