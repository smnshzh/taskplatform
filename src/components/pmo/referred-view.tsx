"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTMStore } from "@/lib/pmo-store";
import { APPROVAL_STATUSES, PRIORITIES } from "@/lib/constants";
import { toPersianDigits } from "@/lib/jalali";
import type {
  SerializedTask,
  SerializedGroup,
  SerializedMember,
} from "@/lib/serialize";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Approval badge styles                                               */
/* ------------------------------------------------------------------ */

const APPROVAL_BADGE: Record<string, string> = {
  PENDING_APPROVAL:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200",
  APPROVED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200",
  REJECTED:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200",
};

type TabKey = "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

/* ------------------------------------------------------------------ */
/*  ReferredView                                                        */
/* ------------------------------------------------------------------ */

export function ReferredView() {
  const queryClient = useQueryClient();
  const member = useTMStore((s) => s.member);

  const [activeTab, setActiveTab] = React.useState<TabKey>("ALL");
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [approveDialog, setApproveDialog] = React.useState<{
    open: boolean;
    task: SerializedTask | null;
    action: "APPROVED" | "REJECTED";
  }>({ open: false, task: null, action: "APPROVED" });
  const [reassignId, setReassignId] = React.useState("");

  const canRegister = member?.permissions.includes("task:create") ?? false;
  const canApprove = member?.permissions.includes("task:approve-referral") ?? false;

  /* ---- Query referred tasks ---- */
  const { data, isLoading } = useQuery<{
    tasks: SerializedTask[];
  }>({
    queryKey: ["tasks", "REFERRED"],
    queryFn: () =>
      fetch("/api/tasks?source=REFERRED").then((r) => r.json()),
    enabled: !!member,
  });
  const allTasks = data?.tasks ?? [];

  /* ---- Group query for register dialog ---- */
  const { data: groupsData } = useQuery<{
    groups: SerializedGroup[];
  }>({
    queryKey: ["groups"],
    queryFn: () => fetch("/api/groups").then((r) => r.json()),
  });
  const groups = groupsData?.groups ?? [];

  /* ---- Members query for reassignment ---- */
  const { data: membersData } = useQuery<{
    members: SerializedMember[];
  }>({
    queryKey: ["members"],
    queryFn: () => fetch("/api/members").then((r) => r.json()),
  });
  const allMembers = membersData?.members ?? [];

  /* ---- Filtered tasks ---- */
  const filteredTasks =
    activeTab === "ALL"
      ? allTasks
      : allTasks.filter((t) => t.approvalStatus === activeTab);

  /* ---- Badge counts ---- */
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: allTasks.length };
    for (const a of APPROVAL_STATUSES) {
      c[a.key] = allTasks.filter((t) => t.approvalStatus === a.key).length;
    }
    return c;
  }, [allTasks]);

  /* ---- Approve/Reject mutation ---- */
  const approveMutation = useMutation({
    mutationFn: async ({
      taskId,
      action,
      reassignToId,
    }: {
      taskId: string;
      action: "APPROVED" | "REJECTED";
      reassignToId?: string;
    }) => {
      const body: Record<string, unknown> = { action };
      if (reassignToId) body.reassignToId = reassignToId;
      const r = await fetch(`/api/tasks/${taskId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "خطا در عملیات تأیید");
      }
      return r.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(
        vars.action === "APPROVED" ? "تسک تأیید شد." : "تسک رد شد."
      );
      setApproveDialog({ open: false, task: null, action: "APPROVED" });
      setReassignId("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleApproveAction() {
    if (!approveDialog.task) return;
    approveMutation.mutate({
      taskId: approveDialog.task.id,
      action: approveDialog.action,
      reassignToId:
        approveDialog.action === "APPROVED" && reassignId
          ? reassignId
          : undefined,
    });
  }

  function closeApproveDialog() {
    setApproveDialog({ open: false, task: null, action: "APPROVED" });
    setReassignId("");
  }

  /* ---- Render ---- */
  return (
    <div className="h-full flex flex-col gap-4">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-bold truncate">تسک‌های ارجاع نامه‌ای</h2>
          {/* Status badges */}
          <div className="flex items-center gap-1.5">
            {APPROVAL_STATUSES.map((a) => {
              const count = counts[a.key] ?? 0;
              if (count === 0) return null;
              return (
                <Badge
                  key={a.key}
                  variant="outline"
                  className={cn("gap-1 text-[11px]", APPROVAL_BADGE[a.key])}
                >
                  {toPersianDigits(count)} {a.label}
                </Badge>
              );
            })}
          </div>
        </div>

        {canRegister && (
          <Button
            size="sm"
            onClick={() => setRegisterOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">ثبت ارجاع جدید</span>
          </Button>
        )}
      </div>

      {/* ---- Tabs ---- */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="ALL" className="gap-1.5 text-xs">
            همه
            {counts.ALL > 0 && (
              <span className="bg-muted text-muted-foreground rounded-md px-1.5 text-[10px]">
                {toPersianDigits(counts.ALL)}
              </span>
            )}
          </TabsTrigger>
          {APPROVAL_STATUSES.map((a) => (
            <TabsTrigger key={a.key} value={a.key} className="gap-1.5 text-xs">
              {a.label}
              {(counts[a.key] ?? 0) > 0 && (
                <span className="bg-muted text-muted-foreground rounded-md px-1.5 text-[10px]">
                  {toPersianDigits(counts[a.key])}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 min-h-0 mt-2">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  تسک ارجاعی یافت نشد.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-background overflow-auto max-h-[calc(100vh-18rem)]">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-right min-w-[100px]">کد</TableHead>
                    <TableHead className="text-right min-w-[160px]">عنوان</TableHead>
                    <TableHead className="text-right min-w-[120px]">شماره نامه</TableHead>
                    <TableHead className="text-right min-w-[110px]">تاریخ نامه</TableHead>
                    <TableHead className="text-right min-w-[120px]">ارجاع‌دهنده</TableHead>
                    <TableHead className="text-right min-w-[120px]">مسئول</TableHead>
                    <TableHead className="text-right min-w-[100px]">مجموعه</TableHead>
                    <TableHead className="text-right min-w-[130px]">وضعیت تأیید</TableHead>
                    <TableHead className="text-center min-w-[140px]">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const approvalBadgeClass =
                      APPROVAL_BADGE[task.approvalStatus ?? ""] ?? "";
                    const approvalLabel = task.approvalStatusLabel ?? "—";
                    const isPending = task.approvalStatus === "PENDING_APPROVAL";

                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-xs">
                          {task.code}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm truncate max-w-[200px]">
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                              {task.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {task.letterNumber ? (
                            <span dir="ltr" className="inline-block">
                              {task.letterNumber}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {task.letterDate ? (
                            toPersianDigits(
                              new Date(task.letterDate).toLocaleDateString("fa-IR")
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {task.refererName ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {task.assigneeName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {task.groupName ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-[11px] gap-1", approvalBadgeClass)}
                          >
                            {task.approvalStatus === "PENDING_APPROVAL" && (
                              <Clock className="h-3 w-3" />
                            )}
                            {task.approvalStatus === "APPROVED" && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {task.approvalStatus === "REJECTED" && (
                              <XCircle className="h-3 w-3" />
                            )}
                            {approvalLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canApprove && isPending ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40 text-[11px] px-2"
                                onClick={() =>
                                  setApproveDialog({
                                    open: true,
                                    task,
                                    action: "APPROVED",
                                  })
                                }
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                تأیید
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40 text-[11px] px-2"
                                onClick={() =>
                                  setApproveDialog({
                                    open: true,
                                    task,
                                    action: "REJECTED",
                                  })
                                }
                              >
                                <XCircle className="h-3 w-3" />
                                رد
                              </Button>
                            </div>
                          ) : !canApprove && isPending ? (
                            <Badge variant="secondary" className="text-[11px] gap-1">
                              <Clock className="h-3 w-3" />
                              در انتظار
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Register New Referred Task Dialog ---- */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Key forces remount — resets all form state on open */}
          <RegisterReferredForm
            key={registerOpen ? "open" : "closed"}
            groups={groups}
            member={member}
            onSuccess={() => setRegisterOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ---- Approve/Reject Dialog ---- */}
      <Dialog open={approveDialog.open} onOpenChange={(open) => {
        if (!open) closeApproveDialog();
        else setApproveDialog((prev) => ({ ...prev, open: true }));
      }}>
        <DialogContent className="sm:max-w-md">
          {approveDialog.task && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {approveDialog.action === "APPROVED" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-500" />
                  )}
                  {approveDialog.action === "APPROVED" ? "تأیید تسک" : "رد تسک"}
                </DialogTitle>
                <DialogDescription>
                  {approveDialog.action === "APPROVED"
                    ? "آیا از تأیید این تسک ارجاعی مطمئن هستید؟"
                    : "آیا از رد این تسک ارجاعی مطمئن هستید؟"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-md bg-muted/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">کد:</span>
                    <span className="text-xs font-mono">
                      {approveDialog.task.code}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-muted-foreground shrink-0">
                      عنوان:
                    </span>
                    <span className="text-sm font-medium text-left">
                      {approveDialog.task.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      شماره نامه:
                    </span>
                    <span className="text-xs" dir="ltr">
                      {approveDialog.task.letterNumber ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      ارجاع‌دهنده:
                    </span>
                    <span className="text-xs">
                      {approveDialog.task.refererName ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      مسئول:
                    </span>
                    <span className="text-xs">
                      {approveDialog.task.assigneeName}
                    </span>
                  </div>
                </div>

                {approveDialog.action === "APPROVED" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" />
                      تغییر مسئول (اختیاری)
                    </Label>
                    <Select value={reassignId} onValueChange={setReassignId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="تغییر مسئول به..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allMembers
                          .filter(
                            (m) =>
                              m.id !== approveDialog.task?.assigneeId &&
                              m.groupId === approveDialog.task?.groupId
                          )
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {approveDialog.action === "REJECTED" && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-2.5 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    پس از رد، تسک از لیست فعال‌ها حذف خواهد شد.
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeApproveDialog}>
                  انصراف
                </Button>
                <Button
                  className={
                    approveDialog.action === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }
                  onClick={handleApproveAction}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending
                    ? "در حال انجام..."
                    : approveDialog.action === "APPROVED"
                      ? "تأیید نهایی"
                      : "رد نهایی"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================== */
/*  Register Referred Form (keyed — remounts on dialog open)            */
/* ================================================================== */

interface RegisterReferredFormProps {
  groups: SerializedGroup[];
  member: ReturnType<typeof useTMStore.getState>["member"];
  onSuccess: () => void;
}

function RegisterReferredForm({
  groups,
  member,
  onSuccess,
}: RegisterReferredFormProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState("");
  const [letterNumber, setLetterNumber] = React.useState("");
  const [letterDate, setLetterDate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [deadline, setDeadline] = React.useState("");
  const [groupId, setGroupId] = React.useState(member?.groupId ?? "");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  /* ---- Members filtered by group (keyed to reset on groupId change) ---- */
  const { data: membersData } = useQuery<{
    members: SerializedMember[];
  }>({
    queryKey: ["members", groupId],
    queryFn: () => fetch(`/api/members?groupId=${groupId}`).then((r) => r.json()),
    enabled: !!groupId,
  });
  const members = membersData?.members ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "خطا در ثبت ارجاع");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("ارجاع نامه‌ای با موفقیت ثبت شد و در انتظار تأیید است.");
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("عنوان تسک الزامی است.");
      return;
    }
    if (!groupId) {
      toast.error("لطفاً مجموعه را انتخاب کنید.");
      return;
    }
    if (!deadline) {
      toast.error("لطفاً مهلت انجام را مشخص کنید.");
      return;
    }

    setSubmitting(true);

    createMutation.mutate(
      {
        title: title.trim(),
        letterNumber: letterNumber.trim() || undefined,
        letterDate: letterDate || undefined,
        description: description.trim() || undefined,
        priority,
        deadline,
        groupId,
        assigneeId: assigneeId || undefined,
        source: "REFERRED",
        refererId: member?.id,
        approvalStatus: "PENDING_APPROVAL",
      },
      { onSettled: () => setSubmitting(false) }
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          ثبت ارجاع نامه‌ای جدید
        </DialogTitle>
        <DialogDescription>
          اطلاعات نامه و تسک مربوطه را وارد کنید. پس از ثبت، تسک در انتظار
          تأیید مدیر قرار می‌گیرد.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            عنوان تسک <span className="text-rose-500">*</span>
          </Label>
          <Input
            placeholder="عنوان تسک ارجاعی..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Letter Number & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">شماره نامه</Label>
            <Input
              placeholder="شماره نامه..."
              value={letterNumber}
              onChange={(e) => setLetterNumber(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">تاریخ نامه</Label>
            <Input
              type="date"
              value={letterDate}
              onChange={(e) => setLetterDate(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">شرح</Label>
          <Textarea
            placeholder="شرح مختصر تسک..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Priority & Group */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              مجموعه <span className="text-rose-500">*</span>
            </Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-full">
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
          </div>
        </div>

        {/* Assignee (filtered by group) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">مسئول (اختیاری)</Label>
          {/* key resets select when group changes */}
          <Select key={groupId} value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="انتخاب مسئول" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} ({m.roleLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            مهلت انجام <span className="text-rose-500">*</span>
          </Label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            dir="ltr"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onSuccess}>
          انصراف
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "در حال ثبت..." : "ثبت ارجاع"}
        </Button>
      </DialogFooter>
    </>
  );
}
