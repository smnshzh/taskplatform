"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useTMStore } from "@/lib/pmo-store";
import { formatJalaliLong, toPersianDigits } from "@/lib/jalali";
import type { SerializedGroup, SerializedMember } from "@/lib/serialize";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Users,
  Loader2,
  Crown,
  X,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock3,
} from "lucide-react";

type StartedReportTask = {
  id: string;
  code: string;
  title: string;
  priority: string;
  deadline: string;
  startedAt: string | null;
  elapsedDays: number | null;
};

type StartedReportMember = {
  id: string;
  name: string;
  handle: string;
  startedCount: number;
  tasks: StartedReportTask[];
};

type StartedReport = {
  group: { id: string; name: string };
  members: StartedReportMember[];
};

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function GroupsView() {
  const queryClient = useQueryClient();
  const currentMember = useTMStore((state) => state.member);
  const canCreateGroup = currentMember?.permissions.includes("group:create") ?? false;
  const canUpdateGroup = currentMember?.permissions.includes("group:update") ?? false;

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { groups: (SerializedGroup & { taskCount?: number })[] };
    },
  });

  const { data: membersData } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch("/api/members");
      if (!r.ok) return { members: [] as SerializedMember[] };
      return (await r.json()) as { members: SerializedMember[] };
    },
  });

  const groups = groupsData?.groups ?? [];
  const members = membersData?.members ?? [];

  // Managers (role = MANAGER)
  const managers = members.filter((m) => m.role === "MANAGER");

  // Dialog state
  const [addOpen, setAddOpen] = React.useState(false);
  const [addKey, setAddKey] = React.useState(0);
  const [editGroup, setEditGroup] = React.useState<SerializedGroup | null>(null);
  const [editKey, setEditKey] = React.useState(0);
  const [deleteTarget, setDeleteTarget] = React.useState<SerializedGroup | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [reportGroup, setReportGroup] = React.useState<SerializedGroup | null>(null);

  async function handleCreate(data: { name: string; code: string; managerIds: string[] }) {
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "ایجاد مجموعه ناموفق بود.");
        return;
      }
      toast.success(`مجموعه «${data.name}» ایجاد شد.`);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setAddOpen(false);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    }
  }

  async function handleEdit(data: { name: string; managerIds: string[] }) {
    if (!editGroup) return;
    try {
      const res = await fetch(`/api/groups/${editGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "به‌روزرسانی ناموفق بود.");
        return;
      }
      toast.success(`مجموعه «${data.name}» به‌روزرسانی شد.`);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setEditGroup(null);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      toast.info("مجموعه‌ها نمی‌توانند حذف شوند. ابتدا اعضا را جابجا کنید.");
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {toPersianDigits(groups.length)} مجموعه
        </p>
        {canCreateGroup && (
          <Button onClick={() => { setAddKey((k) => k + 1); setAddOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" />
            مجموعه جدید
          </Button>
        )}
      </div>

      {/* Grid */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
          هیچ مجموعه‌ای وجود ندارد.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} className="relative overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm shrink-0">
                        {g.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{g.name}</h3>
                        <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                          {g.code}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canUpdateGroup && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditGroup(g);
                          setEditKey((k) => k + 1);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canUpdateGroup && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                        onClick={() => setDeleteTarget(g)}
                        disabled={g.memberCount > 0}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Managers */}
                {g.managers && g.managers.length > 0 ? (
                  <div className="space-y-1">
                    {g.managers.map((gm) => (
                      <div key={gm.memberId} className="flex items-center gap-1.5 text-sm">
                        <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="font-medium truncate">{gm.memberName}</span>
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                          مدیر
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">بدون مدیر</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{toPersianDigits(g.memberCount)}</span>
                    عضو
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-auto h-8 gap-1.5 text-xs"
                    onClick={() => setReportGroup(g)}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    گزارش در حال انجام
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Group Dialog */}
      <GroupFormDialog
        key={`add-${addKey}`}
        open={addOpen}
        onOpenChange={setAddOpen}
        managers={managers}
        onSave={handleCreate}
      />

      {/* Edit Group Dialog */}
      <GroupFormDialog
        key={`edit-${editKey}`}
        open={!!editGroup}
        onOpenChange={(v) => !v && setEditGroup(null)}
        editing={editGroup}
        managers={managers}
        onSave={handleEdit}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف مجموعه</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف مجموعه <span className="font-medium">{deleteTarget?.name}</span> مطمئن هستید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StartedTasksReportDialog
        key={reportGroup?.id ?? "closed-report"}
        group={reportGroup}
        onOpenChange={(open) => !open && setReportGroup(null)}
      />
    </div>
  );
}

function StartedTasksReportDialog({
  group,
  onOpenChange,
}: {
  group: SerializedGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [expandedMemberId, setExpandedMemberId] = React.useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["group-started-report", group?.id],
    enabled: !!group,
    queryFn: async () => {
      const response = await fetch(`/api/groups/${group!.id}/started-report`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "دریافت گزارش ناموفق بود.");
      return body as { data: StartedReport };
    },
  });

  const members = data?.data.members ?? [];
  const totalStarted = members.reduce((sum, member) => sum + member.startedCount, 0);

  return (
    <Dialog open={!!group} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-600" />
            گزارش تسک‌های در حال انجام
          </DialogTitle>
          <DialogDescription>
            مجموعه «{group?.name}» — روی نام هر نفر کلیک کنید تا تسک‌های او نمایش داده شود.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            دریافت گزارش ناموفق بود.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-sky-50 px-4 py-3 text-sm dark:bg-sky-950/30">
              <span>مجموع تسک‌های در حال انجام</span>
              <Badge className="bg-sky-600 text-white">{toPersianDigits(totalStarted)}</Badge>
            </div>

            <div className="space-y-2">
              {members.map((member) => {
                const expanded = expandedMemberId === member.id;
                return (
                  <div key={member.id} className="overflow-hidden rounded-lg border">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 p-3 text-right transition-colors hover:bg-muted/50"
                      onClick={() => setExpandedMemberId(expanded ? null : member.id)}
                      aria-expanded={expanded}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">@{member.handle}</div>
                      </div>
                      <Badge variant={member.startedCount > 0 ? "default" : "secondary"}>
                        {toPersianDigits(member.startedCount)} تسک
                      </Badge>
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {expanded && (
                      <div className="space-y-2 border-t bg-muted/20 p-3">
                        {member.tasks.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">تسک در حال انجامی ندارد.</p>
                        ) : member.tasks.map((task) => (
                          <div key={task.id} className="rounded-md border bg-background p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{task.title}</div>
                                <div className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">{task.code}</div>
                              </div>
                              <Badge variant="outline" className="shrink-0 border-sky-200 text-sky-700 dark:text-sky-300">
                                در حال انجام
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock3 className="h-3.5 w-3.5" />
                              ددلاین: {formatJalaliLong(new Date(task.deadline))}
                            </div>
                            <div className="mt-1.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                              {task.elapsedDays === null
                                ? "زمان شروع ثبت نشده"
                                : task.elapsedDays === 0
                                  ? "امروز شروع شده"
                                  : `${toPersianDigits(task.elapsedDays)} روز از شروع گذشته`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Group Form Dialog (Multi-Manager)                                   */
/* ------------------------------------------------------------------ */

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: SerializedGroup | null;
  managers: SerializedMember[];
  onSave: (data: { name: string; code: string; managerIds: string[] }) => void;
}

function GroupFormDialog({ open, onOpenChange, editing, managers, onSave }: GroupFormDialogProps) {
  const [name, setName] = React.useState(() => editing?.name ?? "");
  const [code, setCode] = React.useState(() => editing?.code ?? "");
  const [selectedManagerIds, setSelectedManagerIds] = React.useState<string[]>(
    () => editing?.managers?.map((gm) => gm.memberId) ?? []
  );
  const [busy, setBusy] = React.useState(false);

  function toggleManager(id: string) {
    setSelectedManagerIds((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  }

  function removeManager(id: string) {
    setSelectedManagerIds((prev) => prev.filter((mid) => mid !== id));
  }

  async function submit() {
    if (!name.trim() || (!editing && !code.trim())) {
      toast.error(editing ? "نام الزامی است." : "نام و کد الزامی است.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        code: code.trim(),
        managerIds: selectedManagerIds,
      });
    } finally {
      setBusy(false);
    }
  }

  // Selected manager details for the "selected" display
  const selectedManagers = managers.filter((m) => selectedManagerIds.includes(m.id));
  const unselectedManagers = managers.filter((m) => !selectedManagerIds.includes(m.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? (
              <>
                <Pencil className="h-5 w-5 text-primary" />
                ویرایش مجموعه
              </>
            ) : (
              <>
                <Building2 className="h-5 w-5 text-primary" />
                مجموعه جدید
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {editing ? "اطلاعات مجموعه را ویرایش کنید." : "یک مجموعه سازمانی جدید ایجاد کنید."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">نام مجموعه *</Label>
            <Input
              id="g-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: واحد فناوری اطلاعات"
            />
          </div>

          {!editing && (
            <div className="space-y-1.5">
              <Label htmlFor="g-code">کد مجموعه *</Label>
              <Input
                id="g-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثلاً: IT"
                dir="ltr"
                className="text-left"
              />
            </div>
          )}

          {/* Multi-select managers */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              مدیران مجموعه
            </Label>

            {/* Already selected managers (removable chips) */}
            {selectedManagers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedManagers.map((m) => (
                  <Badge
                    key={m.id}
                    variant="secondary"
                    className="gap-1 pl-1.5 pr-2 py-1 text-xs cursor-pointer hover:bg-destructive/10"
                    onClick={() => removeManager(m.id)}
                  >
                    <Crown className="h-3 w-3 text-amber-500" />
                    {m.name}
                    <X className="h-3 w-3 ml-0.5 opacity-50" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Checkbox list for adding managers */}
            {managers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                هیچ کاربری با نقش «مدیر مجموعه» وجود ندارد.
              </p>
            ) : unselectedManagers.length > 0 ? (
              <div className="border rounded-md max-h-36 overflow-y-auto">
                {unselectedManagers.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm transition-colors"
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => toggleManager(m.id)}
                    />
                    <div className="min-w-0">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground mr-1.5 text-xs" dir="ltr">
                        ({m.handle})
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
