"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTMStore } from "@/lib/pmo-store";
import { PERSIAN_WEEK_DAYS, PRIORITIES, priorityByKey } from "@/lib/constants";
import { toPersianDigits } from "@/lib/jalali";
import type {
  SerializedGroup,
  SerializedMember,
  SerializedSchedule,
  SerializedTaskTemplate,
} from "@/lib/serialize";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  Upload,
  Trash2,
  UserPlus,
  CalendarClock,
  Filter,
  Users,
  Download,
  Pencil,
  ListChecks,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Priority color mapping                                              */
/* ------------------------------------------------------------------ */

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200",
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border-slate-200",
};

/* ------------------------------------------------------------------ */
/*  SchedulerView                                                       */
/* ------------------------------------------------------------------ */

export function SchedulerView() {
  const queryClient = useQueryClient();
  const member = useTMStore((s) => s.member);

  const initialGroupId = member?.groupId ?? "";
  const [groupId, setGroupId] = React.useState(initialGroupId);
  const [addOpen, setAddOpen] = React.useState(false);
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [templateMgrOpen, setTemplateMgrOpen] = React.useState(false);
  const [targetSchedule, setTargetSchedule] =
    React.useState<SerializedSchedule | null>(null);

  // Only MANAGER and SUPER_ADMIN can manage templates
  const canManageTemplates = member?.permissions.includes("template:create") ?? false;

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* ---- Queries ---- */
  const { data: groupsData } = useQuery<{
    groups: SerializedGroup[];
  }>({
    queryKey: ["groups"],
    queryFn: () => fetch("/api/groups").then((r) => r.json()),
  });
  const groups = groupsData?.groups ?? [];

  // Auto-select first group if none selected (e.g. SUPER_ADMIN has no groupId)
  React.useEffect(() => {
    if (!groupId && groups.length > 0) {
      queueMicrotask(() => setGroupId(groups[0].id));
    }
  }, [groups, groupId]);

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery<{
    schedules: SerializedSchedule[];
  }>({
    queryKey: ["schedules", groupId],
    queryFn: () => fetch(`/api/schedules?groupId=${groupId}`).then((r) => r.json()),
    enabled: !!groupId,
  });
  const schedules = schedulesData?.schedules ?? [];

  const { data: templatesData } = useQuery<{
    templates: SerializedTaskTemplate[];
  }>({
    queryKey: ["templates", groupId],
    queryFn: () => fetch(`/api/templates?groupId=${groupId}`).then((r) => r.json()),
    enabled: !!groupId,
  });
  const templates = templatesData?.templates ?? [];

  const { data: membersData } = useQuery<{
    members: SerializedMember[];
  }>({
    queryKey: ["members", groupId],
    queryFn: () => fetch(`/api/members?groupId=${groupId}`).then((r) => r.json()),
    enabled: !!groupId,
  });
  const members = membersData?.members ?? [];

  // Get template priority by id
  const templatePriorityMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    templates.forEach((t) => {
      map[t.id] = t.priority;
    });
    return map;
  }, [templates]);

  /* ---- Build table data ---- */
  const tableData = React.useMemo(() => {
    const assigneeMap = new Map<
      string,
      {
        name: string;
        slots: Map<
          string,
          Map<number, { schedule: SerializedSchedule; priority: string }[]>
        >;
      }
    >();

    for (const s of schedules) {
      const aName = s.overrideAssigneeName ?? s.assigneeName;
      const aId = s.overrideAssigneeId ?? s.assigneeId;
      if (!assigneeMap.has(aId)) {
        assigneeMap.set(aId, {
          name: aName,
          slots: new Map(),
        });
      }
      const entry = assigneeMap.get(aId)!;
      const timeKey = `${s.startTime}-${s.endTime}`;
      if (!entry.slots.has(timeKey)) {
        entry.slots.set(timeKey, new Map());
      }
      const dayMap = entry.slots.get(timeKey)!;
      if (s.dayOfWeek !== null) {
        if (!dayMap.has(s.dayOfWeek)) {
          dayMap.set(s.dayOfWeek, []);
        }
        dayMap.get(s.dayOfWeek)!.push({
          schedule: s,
          priority: templatePriorityMap[s.taskTemplateId] ?? "LOW",
        });
      }
    }

    const allTimeSlots = new Set<string>();
    for (const [, a] of assigneeMap) {
      for (const key of a.slots.keys()) {
        allTimeSlots.add(key);
      }
    }
    const sortedTimeSlots = Array.from(allTimeSlots).sort((a, b) =>
      a.localeCompare(b)
    );

    return { assigneeMap, sortedTimeSlots };
  }, [schedules, templatePriorityMap]);

  /* ---- Mutations ---- */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("خطا در حذف");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("زمان‌بندی حذف شد.");
      setDeleteOpen(false);
      setTargetSchedule(null);
    },
    onError: () => {
      toast.error("خطا در حذف زمان‌بندی.");
    },
  });

  /* ---- Excel import ---- */
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/import/excel", { method: "POST", body: fd });
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["schedules"] });
        queryClient.invalidateQueries({ queryKey: ["templates"] });
        toast.success("فایل اکسل با موفقیت وارد شد.");
      } else {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error ?? "خطا در وارد کردن فایل اکسل.");
      }
    } catch {
      toast.error("خطا در ارسال فایل.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---- Render ---- */
  if (!groupId && groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CalendarClock className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-bold truncate">زمان‌بندی هفتگی</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="w-40 gap-1.5" size="sm">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="انتخاب مجموعه" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={!groupId}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">افزودن</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={!groupId}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">ورود از اکسل</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open("/api/templates/download?type=schedules", "_blank")}
            disabled={!groupId}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">تمپلت زمان‌بندی</span>
          </Button>
          {canManageTemplates && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTemplateMgrOpen(true)}
              disabled={!groupId}
              className="gap-1.5"
            >
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">مدیریت الگوها</span>
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcelUpload}
          />
        </div>
      </div>

      {/* ---- Schedule Table ---- */}
      <div className="flex-1 overflow-auto rounded-lg border bg-background">
        {schedulesLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !groupId ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            لطفاً یک مجموعه را انتخاب کنید.
          </div>
        ) : tableData.sortedTimeSlots.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            هیچ زمان‌بندی‌ای ثبت نشده است.
          </div>
        ) : (
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="sticky right-0 z-10 bg-muted/40 min-w-[140px] text-right">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    نام تسک / مسئول
                  </div>
                </TableHead>
                {PERSIAN_WEEK_DAYS.map((d) => (
                  <TableHead key={d.key} className="text-center min-w-[120px]">
                    {d.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(tableData.assigneeMap.entries()).map(
                ([aId, aData]) =>
                  tableData.sortedTimeSlots.map((timeKey) => {
                    const dayMap = aData.slots.get(timeKey);
                    if (!dayMap || dayMap.size === 0) return null;
                    const [startTime, endTime] = timeKey.split("-");
                    const timeDisplay = `${toPersianDigits(startTime)}-${toPersianDigits(endTime)}`;

                    return (
                      <TableRow key={`${aId}-${timeKey}`}>
                        <TableCell className="sticky right-0 z-10 bg-background border-l">
                          <div className="font-medium text-sm truncate max-w-[140px]">
                            {aData.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {timeDisplay}
                          </div>
                        </TableCell>
                        {PERSIAN_WEEK_DAYS.map((d) => {
                          const items = dayMap.get(d.key) ?? [];
                          return (
                            <TableCell
                              key={d.key}
                              className="text-center align-top p-1.5"
                            >
                              {items.map(({ schedule: s, priority }) => {
                                const badgeClass =
                                  PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.LOW;
                                return (
                                  <div
                                    key={s.id}
                                    className={cn(
                                      "group relative rounded-md px-2 py-1.5 text-xs mb-1 cursor-pointer transition-colors border",
                                      badgeClass
                                    )}
                                    onClick={() => {
                                      setTargetSchedule(s);
                                      setOverrideOpen(true);
                                    }}
                                  >
                                    <div className="font-medium truncate">
                                      {s.taskTemplateName}
                                    </div>
                                    <div className="opacity-80 mt-0.5">
                                      {toPersianDigits(startTime)}-{toPersianDigits(endTime)}
                                    </div>
                                    {s.overrideAssigneeName && (
                                      <div className="absolute -top-1 -left-1 bg-background border rounded-full p-0.5">
                                        <UserPlus className="h-2.5 w-2.5 text-amber-500" />
                                      </div>
                                    )}
                                    <button
                                      className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full bg-background/80 hover:bg-rose-100 dark:hover:bg-rose-950/60"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTargetSchedule(s);
                                        setDeleteOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3 text-rose-500" />
                                    </button>
                                  </div>
                                );
                              })}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ---- Add Schedule Dialog ---- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>افزودن زمان‌بندی جدید</DialogTitle>
            <DialogDescription>
              یک قالب تسک را برای روزها و ساعات مشخص انتخاب کنید.
            </DialogDescription>
          </DialogHeader>
          {/* Key forces remount on open — resets all form state */}
          <AddScheduleForm
            key={addOpen ? "open" : "closed"}
            groupId={groupId}
            templates={templates}
            members={members}
            onSuccess={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ---- Override Assignee Dialog ---- */}
      <Dialog open={overrideOpen} onOpenChange={(open) => {
        setOverrideOpen(open);
        if (!open) setTargetSchedule(null);
      }}>
        <DialogContent className="sm:max-w-md">
          {targetSchedule && (
            <OverrideForm
              key={overrideOpen ? "open" : "closed"}
              schedule={targetSchedule}
              members={members}
              onSuccess={() => {
                setOverrideOpen(false);
                setTargetSchedule(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation ---- */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف زمان‌بندی</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این زمان‌بندی مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetSchedule(null)}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (targetSchedule) deleteMutation.mutate(targetSchedule.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "در حال حذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Template Manager Dialog ---- */}
      <Dialog open={templateMgrOpen} onOpenChange={setTemplateMgrOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>مدیریت الگوهای تسک</DialogTitle>
            <DialogDescription>
              ویرایش یا حذف الگوهای مجموعه. حذف الگو، تمام زمان‌بندی‌های مرتبط را نیز حذف می‌کند.
            </DialogDescription>
          </DialogHeader>
          <TemplateManager
            key={templateMgrOpen ? "open" : "closed"}
            templates={templates}
            groupId={groupId}
            onSuccess={() => {
              setTemplateMgrOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================== */
/*  Add Schedule Form (keyed — remounts on dialog open)                 */
/* ================================================================== */

interface AddScheduleFormProps {
  groupId: string;
  templates: SerializedTaskTemplate[];
  members: SerializedMember[];
  onSuccess: () => void;
}

function AddScheduleForm({
  groupId,
  templates,
  members,
  onSuccess,
}: AddScheduleFormProps) {
  const queryClient = useQueryClient();

  const [templateId, setTemplateId] = React.useState("");
  const [newTemplateName, setNewTemplateName] = React.useState("");
  const [useNewTemplate, setUseNewTemplate] = React.useState(false);
  const [priority, setPriority] = React.useState("MEDIUM");
  const [selectedDays, setSelectedDays] = React.useState<number[]>([]);
  const [specificDate, setSpecificDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("08:00");
  const [endTime, setEndTime] = React.useState("10:00");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [allDaysSamePerson, setAllDaysSamePerson] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "خطا در ایجاد زمان‌بندی");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("زمان‌بندی با موفقیت ایجاد شد.");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleSubmit() {
    const templateName = useNewTemplate ? newTemplateName.trim() : "";
    const tId = useNewTemplate ? undefined : templateId;

    if (!useNewTemplate && !templateId) {
      toast.error("لطفاً قالب تسک را انتخاب کنید.");
      return;
    }
    if (useNewTemplate && !templateName) {
      toast.error("لطفاً نام قالب تسک جدید را وارد کنید.");
      return;
    }
    if (selectedDays.length === 0 && !specificDate) {
      toast.error("لطفاً حداقل یک روز یا تاریخ خاص را انتخاب کنید.");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("لطفاً ساعت شروع و پایان را وارد کنید.");
      return;
    }
    if (!assigneeId) {
      toast.error("لطفاً مسئول را انتخاب کنید.");
      return;
    }

    setSubmitting(true);

    createMutation.mutate(
      {
        groupId,
        taskTemplateId: tId,
        newTemplateName: templateName || undefined,
        priority,
        dayOfWeeks: selectedDays.length > 0 ? selectedDays : undefined,
        specificDate: specificDate || undefined,
        startTime,
        endTime,
        assigneeId,
        allDaysSamePerson,
      },
      { onSettled: () => setSubmitting(false) }
    );
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* Template selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">قالب تسک</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-template-check"
              checked={useNewTemplate}
              onCheckedChange={(v) => setUseNewTemplate(!!v)}
            />
            <Label htmlFor="new-template-check" className="text-sm cursor-pointer">
              قالب جدید
            </Label>
          </div>
          {useNewTemplate ? (
            <Input
              placeholder="نام قالب تسک جدید..."
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
          ) : (
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="انتخاب قالب تسک" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Priority */}
        {useNewTemplate && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">اولویت</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-full">
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
        )}

        {/* Day selection (multi-select) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">روزهای هفته</Label>
          <div className="flex flex-wrap gap-2">
            {PERSIAN_WEEK_DAYS.map((d) => {
              const checked = selectedDays.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    checked
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Or specific date */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">یا تاریخ خاص</Label>
          <Input
            type="date"
            value={specificDate}
            onChange={(e) => setSpecificDate(e.target.value)}
            dir="ltr"
            className="w-full"
          />
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">ساعت شروع</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">ساعت پایان</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>

        {/* Assignee */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">مسئول</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="انتخاب مسئول" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* All days same person */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="all-days-check"
            checked={allDaysSamePerson}
            onCheckedChange={(v) => setAllDaysSamePerson(!!v)}
          />
          <Label htmlFor="all-days-check" className="text-sm cursor-pointer">
            همه روزها به همین شخص
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onSuccess}>
          انصراف
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "در حال ثبت..." : "ثبت زمان‌بندی"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ================================================================== */
/*  Override Assignee Form (keyed — remounts on dialog open)            */
/* ================================================================== */

interface OverrideFormProps {
  schedule: SerializedSchedule;
  members: SerializedMember[];
  onSuccess: () => void;
}

function OverrideForm({ schedule, members, onSuccess }: OverrideFormProps) {
  const queryClient = useQueryClient();
  const [overrideId, setOverrideId] = React.useState("");
  const [overrideDate, setOverrideDate] = React.useState(
    schedule.overrideDate ?? ""
  );
  const [submitting, setSubmitting] = React.useState(false);

  const overrideMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => {
      const r = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? "خطا در تغییر مسئول");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("مسئول تغییر کرد.");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleOverride() {
    if (!overrideId) {
      toast.error("لطفاً مسئول جدید را انتخاب کنید.");
      return;
    }
    setSubmitting(true);
    overrideMutation.mutate(
      {
        id: schedule.id,
        body: {
          overrideAssigneeId: overrideId,
          overrideDate: overrideDate || undefined,
        },
      },
      { onSettled: () => setSubmitting(false) }
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>تغییر مسئول</DialogTitle>
        <DialogDescription>
          مسئول را برای این زمان‌بندی تغییر دهید.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="rounded-md bg-muted/60 p-3 space-y-1">
          <div className="text-sm font-medium">{schedule.taskTemplateName}</div>
          <div className="text-xs text-muted-foreground">
            {schedule.dayOfWeekLabel && `روز: ${schedule.dayOfWeekLabel}`}
            {schedule.startTime && (
              <span>
                {" "}
                | ساعت: {toPersianDigits(schedule.startTime)}-
                {toPersianDigits(schedule.endTime)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            مسئول فعلی: {schedule.assigneeName}
            {schedule.overrideAssigneeName && (
              <span className="text-amber-600">
                {" "}
                → {schedule.overrideAssigneeName}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">مسئول جدید</Label>
          <Select value={overrideId} onValueChange={setOverrideId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="انتخاب مسئول جدید" />
            </SelectTrigger>
            <SelectContent>
              {members
                .filter((m) => m.id !== schedule.assigneeId)
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            تاریخ اعمال تغییر (اختیاری)
          </Label>
          <Input
            type="date"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
            dir="ltr"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onSuccess}>
          انصراف
        </Button>
        <Button onClick={handleOverride} disabled={submitting}>
          {submitting ? "در حال ثبت..." : "اعمال تغییر"}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ================================================================== */
/*  Template Manager — Edit / Delete templates with schedules           */
/* ================================================================== */

interface TemplateManagerProps {
  templates: SerializedTaskTemplate[];
  groupId: string;
  onSuccess: () => void;
}

function TemplateManager({ templates, groupId, onSuccess }: TemplateManagerProps) {
  const queryClient = useQueryClient();
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editPriority, setEditPriority] = React.useState("MEDIUM");
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Create new template state
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newPriority, setNewPriority] = React.useState("MEDIUM");
  const [creating, setCreating] = React.useState(false);

  const resetCreateForm = () => {
    setNewName("");
    setNewDesc("");
    setNewPriority("MEDIUM");
    setShowCreateForm(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("نام الگو الزامی است.");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
          groupId,
          priority: newPriority,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error ?? "خطا در ایجاد الگو");
        return;
      }
      toast.success("الگوی جدید با موفقیت ایجاد شد.");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      resetCreateForm();
    } catch {
      toast.error("خطا در ارسال درخواست.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (t: SerializedTaskTemplate) => {
    setEditId(t.id);
    setEditName(t.name);
    setEditDesc(t.description ?? "");
    setEditPriority(t.priority);
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditDesc("");
    setEditPriority("MEDIUM");
  };

  const handleSave = async () => {
    if (!editId || !editName.trim()) {
      toast.error("نام الگو الزامی است.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/templates/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          priority: editPriority,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error ?? "خطا در ویرایش الگو");
        return;
      }
      toast.success("الگو با موفقیت ویرایش شد.");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      cancelEdit();
    } catch {
      toast.error("خطا در ارسال درخواست.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      const r = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error ?? "خطا در حذف الگو");
        return;
      }
      toast.success("الگو و زمان‌بندی‌های مرتبط حذف شدند.");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setDeleteConfirmId(null);
    } catch {
      toast.error("خطا در ارسال درخواست.");
    } finally {
      setSubmitting(false);
    }
  };

  if (templates.length === 0 && !showCreateForm) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="text-sm text-muted-foreground">
          هیچ الگویی برای این مجموعه وجود ندارد.
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateForm(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          ایجاد الگوی اول
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          {toPersianDigits(templates.length)} الگو
        </div>
        {!showCreateForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreateForm(true)}
            className="gap-1.5 h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            الگوی جدید
          </Button>
        )}
      </div>

      {/* Create new template form */}
      {showCreateForm && (
        <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">ایجاد الگوی جدید</div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={resetCreateForm}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">نام الگو *</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="مثلاً: بروزرسانی گزارش هفتگی"
              className="text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">توضیحات</Label>
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="توضیحات اختیاری..."
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">اولویت</Label>
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="text-sm">
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
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? "در حال ایجاد..." : "ایجاد الگو"}
            </Button>
            <Button size="sm" variant="outline" onClick={resetCreateForm}>
              انصراف
            </Button>
          </div>
        </div>
      )}

      {/* Existing templates list */}
      {templates.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border p-3 space-y-2"
        >
          {editId === t.id ? (
            /* ---- Edit mode ---- */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">نام الگو</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="نام الگو..."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">توضیحات</Label>
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="توضیحات (اختیاری)..."
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">اولویت</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="text-sm">
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
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} disabled={submitting}>
                  {submitting ? "در حال ذخیره..." : "ذخیره"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  انصراف
                </Button>
              </div>
            </div>
          ) : (
            /* ---- View mode ---- */
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.name}</div>
                  {t.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {t.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => startEdit(t)}
                    title="ویرایش"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    onClick={() => {
                      setDeleteConfirmId(t.id);
                      setEditId(null);
                    }}
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", PRIORITY_BADGE[t.priority])}
                >
                  {priorityByKey(t.priority)?.label ?? t.priority}
                </Badge>
                <span>
                  {t.scheduleCount > 0
                    ? `${t.scheduleCount} زمان‌بندی فعال`
                    : "بدون زمان‌بندی"}
                </span>
              </div>

              {/* Delete confirmation inline */}
              {deleteConfirmId === t.id && (
                <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-2.5 space-y-2">
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    {t.scheduleCount > 0
                      ? `این الگو ${t.scheduleCount} زمان‌بندی فعال دارد. با حذف، تمام آن‌ها حذف خواهند شد. آیا مطمئن هستید؟`
                      : "آیا از حذف این الگو مطمئن هستید؟"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 h-7 text-xs"
                      onClick={() => handleDelete(t.id)}
                      disabled={submitting}
                    >
                      {submitting ? "در حال حذف..." : "بله، حذف شود"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
