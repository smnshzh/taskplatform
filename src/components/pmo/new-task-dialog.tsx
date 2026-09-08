"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTMStore } from "@/lib/pmo-store";
import { PRIORITIES, priorityByKey } from "@/lib/constants";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import type { SerializedMember, SerializedGroup, SerializedTask } from "@/lib/serialize";
import { toast } from "sonner";
import { TaskSearchSelect } from "./task-search-select";
import {
  Loader2,
  FileText,
  CalendarClock,
  Hash,
  UserCircle,
  Building2,
  Flag,
  Link2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  initialPreviousTask?: { id: string; code: string; title: string };
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function NewTaskDialog({ open, onOpenChange, onCreated, initialPreviousTask }: Props) {
  const member = useTMStore((s) => s.member);
  const queryClient = useQueryClient();

  // Form state - initialized from member (key remount handles reset)
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [rawGroupId, setRawGroupId] = React.useState<string>(member?.groupId ?? "");
  const [assigneeId, setAssigneeId] = React.useState<string>("");
  const [priority, setPriority] = React.useState<string>("MEDIUM");
  const [deadlineDate, setDeadlineDate] = React.useState("");
  const [deadlineTime, setDeadlineTime] = React.useState("");
  const [source, setSource] = React.useState<"MANUAL" | "REFERRED">("MANUAL");
  const [letterNumber, setLetterNumber] = React.useState("");
  const [letterDate, setLetterDate] = React.useState("");
  const [refererId, setRefererId] = React.useState<string>(member?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [previousTaskId, setPreviousTaskId] = React.useState(initialPreviousTask?.id ?? "");

  // Fetch data
  const { data: groupsData } = useQuery({
    queryKey: ["groups", "task-assignees"],
    queryFn: async () => {
      const r = await fetch("/api/groups?scope=task-assignees");
      if (!r.ok) return { groups: [] as SerializedGroup[] };
      return (await r.json()) as { groups: SerializedGroup[] };
    },
    enabled: open,
  });

  const { data: membersData } = useQuery({
    queryKey: ["members", "task-assignees"],
    queryFn: async () => {
      const r = await fetch("/api/members?scope=task-assignees");
      if (!r.ok) return { members: [] as SerializedMember[] };
      return (await r.json()) as { members: SerializedMember[] };
    },
    enabled: open,
  });

  const groups = groupsData?.groups ?? [];
  const members = membersData?.members ?? [];

  // Filter groups by role
  const availableGroups = React.useMemo(() => {
    if (!member) return [];
    return groups;
  }, [groups, member]);

  // Auto-set group if only one available (derived, no effect)
  const groupId = React.useMemo(() => {
    if (rawGroupId) return rawGroupId;
    if (availableGroups.length === 1) return availableGroups[0].id;
    return "";
  }, [rawGroupId, availableGroups]);

  const { data: tasksData } = useQuery({
    queryKey: ["tasks", "workflow-candidates"],
    queryFn: async () => {
      const r = await fetch("/api/workflows/candidates");
      if (!r.ok) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
    enabled: open,
  });

  // Filter members by selected group and hierarchy
  const assigneeCandidates = React.useMemo(() => {
    if (!member || !groupId) return [];
    const groupMembers = members.filter((m) => m.groupId === groupId);

    return groupMembers;
  }, [members, groupId, member]);

  // Validate assignee: clear if not in candidates (derived, no effect)
  const effectiveAssigneeId = assigneeCandidates.some((c) => c.id === assigneeId) ? assigneeId : "";

  // Referer candidates (for REFERRED source)
  const refererCandidates = React.useMemo(() => {
    if (!member) return [];
    if (member.role === "SUPER_ADMIN") return members;
    // Others can only refer from their group
    const groupMembers = members.filter((m) => m.groupId === member.groupId);
    return groupMembers;
  }, [members, member]);

  // Auto-set referer to current user (derived, no effect)
  const effectiveRefererId = refererCandidates.some((c) => c.id === refererId) ? refererId : (member?.id ?? "");

  async function submit() {
    if (!title.trim()) {
      toast.error("عنوان تسک الزامی است.");
      return;
    }
    if (!groupId) {
      toast.error("مجموعه الزامی است.");
      return;
    }
    if (!assigneeId) {
      toast.error("مسئول تسک الزامی است.");
      return;
    }
    if (!deadlineDate) {
      toast.error("مهلت تسک الزامی است.");
      return;
    }

    // For REFERRED, validate extra fields
    if (source === "REFERRED") {
      if (!letterNumber.trim() || !letterDate || !refererId) {
        toast.error("برای تسک ارجاعی، شماره نامه، تاریخ نامه و مرجع الزامی است.");
        return;
      }
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        groupId,
        assigneeId,
        priority,
        deadline: new Date(`${deadlineDate}T${deadlineTime || "23:59"}:00`).toISOString(),
        source,
        previousTaskId: previousTaskId || null,
      };

      if (source === "REFERRED") {
        body.letterNumber = letterNumber.trim();
        body.letterDate = letterDate;
        body.refererId = effectiveRefererId;
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "خطا در ثبت تسک.");
        return;
      }

      toast.success("تسک جدید با موفقیت ثبت شد.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت تسک جدید</DialogTitle>
          <DialogDescription>
            یک تسک جدید به سیستم اضافه کنید. فیلدهای ستاره‌دار الزامی هستند.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="t-title">عنوان تسک *</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: تهیه گزارش ماهانه"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">توضیحات</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات اختیاری..."
              rows={3}
            />
          </div>

          {/* Group + Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                مجموعه *
              </Label>
              <Select value={groupId} onValueChange={setRawGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب مجموعه" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5" />
                مسئول *
              </Label>
              <Select value={effectiveAssigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder={assigneeCandidates.length === 0 ? "ابتدا مجموعه را انتخاب کنید" : "انتخاب مسئول"} />
                </SelectTrigger>
                <SelectContent>
                  {assigneeCandidates.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.handle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority + Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                اولویت
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                مهلت *
              </Label>
              <div className="flex flex-col gap-1.5">
                <JalaliDatePicker
                  value={deadlineDate}
                  onChange={setDeadlineDate}
                  placeholder="انتخاب تاریخ مهلت"
                  size="sm"
                />
                <Input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  placeholder="ساعت"
                  dir="ltr"
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-800 dark:bg-sky-950/20">
            <Label className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              مرحله قبلی گردش‌کار
            </Label>
            {initialPreviousTask ? <div className="rounded-md border bg-background px-3 py-2 text-sm">{initialPreviousTask.code} — {initialPreviousTask.title}</div> : <TaskSearchSelect tasks={tasksData?.tasks ?? []} value={previousTaskId} onChange={setPreviousTaskId} placeholder="جست‌وجوی مرحله قبلی (اختیاری)" />}
            <p className="text-[11px] text-muted-foreground">با انتخاب یک تسک، این کار به‌عنوان مرحله بعدی آن ثبت می‌شود.</p>
          </div>

          {/* Source toggle */}
          <div className="space-y-2">
            <Label>منبع</Label>
            <div className="flex rounded-lg border p-1 bg-muted/30">
              <button
                type="button"
                onClick={() => setSource("MANUAL")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  source === "MANUAL"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                دستی
              </button>
              <button
                type="button"
                onClick={() => setSource("REFERRED")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  source === "REFERRED"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                ارجاع نامه‌ای
              </button>
            </div>
          </div>

          {/* Referred fields */}
          {source === "REFERRED" && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                اطلاعات نامه ارجاع
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-letter-num" className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" />
                    شماره نامه *
                  </Label>
                  <Input
                    id="t-letter-num"
                    value={letterNumber}
                    onChange={(e) => setLetterNumber(e.target.value)}
                    placeholder="مثلاً: ۱۲۳۴۵"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>تاریخ نامه *</Label>
                  <JalaliDatePicker
                    value={letterDate}
                    onChange={setLetterDate}
                    placeholder="تاریخ نامه"
                    size="sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" />
                  مرجع ارجاع *
                </Label>
                <Select value={effectiveRefererId} onValueChange={setRefererId}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب مرجع" />
                  </SelectTrigger>
                  <SelectContent>
                    {refererCandidates.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.handle})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ثبت تسک"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
