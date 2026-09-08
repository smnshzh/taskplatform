"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTMStore } from "@/lib/pmo-store";
import { toPersianDigits, formatJalaliLong } from "@/lib/jalali";
import { MultiSelect } from "@/components/ui/multi-select";
import { MemberBaleSettings } from "@/features/notifications/components/member-bale-settings";
import { cn } from "@/lib/utils";
import { buildCompanyMemberHandle } from "@/lib/company-handle";
import { ROLES, roleByKey } from "@/lib/constants";
import type { SerializedMember, SerializedGroup } from "@/lib/serialize";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  Save,
  KeyRound,
  Loader2,
  Building2,
  UserCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Role badge classes                                                  */
/* ------------------------------------------------------------------ */

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  MANAGER: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  SUPERVISOR: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  SPECIALIST: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
};

/* ------------------------------------------------------------------ */
/*  Main view                                                           */
/* ------------------------------------------------------------------ */

export function MembersView() {
  const member = useTMStore((s) => s.member);
  const queryClient = useQueryClient();

  // Data fetching
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch("/api/members");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { members: SerializedMember[] };
    },
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) return { groups: [] as SerializedGroup[] };
      return (await r.json()) as { groups: SerializedGroup[] };
    },
  });

  const members = membersData?.members ?? [];
  const groups = groupsData?.groups ?? [];

  // Filters
  const [search, setSearch] = React.useState("");
  const [groupFilter, setGroupFilter] = React.useState<string[]>([]);

  // Dialogs
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogKey, setDialogKey] = React.useState(0);
  const [editing, setEditing] = React.useState<SerializedMember | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SerializedMember | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  // Filtered members
  const filtered = React.useMemo(() => {
    let list = members;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.handle.toLowerCase().includes(q)
      );
    }
    if (groupFilter.length > 0) {
      list = list.filter((m) => m.groupId && groupFilter.includes(m.groupId));
    }
    return list;
  }, [members, search, groupFilter]);

  // Hierarchy: sort supervisors first, then specialists under them
  const sorted = React.useMemo(() => {
    const supervisors = filtered.filter((m) => m.role === "SUPERVISOR" || m.role === "MANAGER");
    const specialists = filtered.filter((m) => m.role === "SPECIALIST");
    const result: (SerializedMember & { indent?: boolean })[] = [];

    for (const sup of supervisors) {
      result.push(sup);
      const subs = specialists.filter((s) => s.supervisorId === sup.id);
      for (const sub of subs) {
        result.push({ ...sub, indent: true });
      }
    }

    // Remaining specialists with no supervisor match
    const addedIds = new Set(result.map((r) => r.id));
    for (const sp of specialists) {
      if (!addedIds.has(sp.id)) {
        result.push(sp);
      }
    }

    return result;
  }, [filtered]);

  // Allowed roles for creation
  const allowedRoles = React.useMemo(() => {
    if (!member) return [];
    if (member.role === "SUPER_ADMIN") return ROLES.map((r) => r.key);
    if (member.role === "MANAGER") return ["SUPERVISOR", "SPECIALIST"];
    return [];
  }, [member]);

  // Supervisor candidates filtered by group
  function getSupervisorCandidates(groupId: string | null) {
    if (!groupId) return members.filter((m) => m.role === "SUPERVISOR");
    return members.filter(
      (m) => (m.role === "SUPERVISOR") && m.groupId === groupId
    );
  }

  // Delete handler
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/members/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "حذف ناموفق بود.");
        return;
      }
      toast.success(`${deleteTarget.name} حذف شد.`);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setDeleteTarget(null);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setDeleteBusy(false);
    }
  }

  // Open edit
  function openEdit(m: SerializedMember) {
    setEditing(m);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  // Open add
  function openAdd() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4 p-1">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام یا هندل..."
            className="pr-9"
          />
        </div>
        <MultiSelect
          className="w-full sm:w-48"
          value={groupFilter}
          onValueChange={setGroupFilter}
          placeholder="همه مجموعه‌ها"
          options={groups.map((group) => ({ value: group.id, label: group.name }))}
        />
        <Button onClick={openAdd} className="gap-1.5 shrink-0">
          <UserPlus className="h-4 w-4" />
          افزودن عضو
        </Button>
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        {membersLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            عضوی یافت نشد.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>نام</TableHead>
                <TableHead>هندل</TableHead>
                <TableHead>نقش</TableHead>
                <TableHead>مجموعه</TableHead>
                <TableHead>سرپرست</TableHead>
                <TableHead className="text-center">تسک</TableHead>
                <TableHead className="text-center">فعال</TableHead>
                <TableHead>آخرین ورود</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => (
                <TableRow
                  key={m.id}
                  className={cn(m.indent && "bg-muted/30")}
                >
                  <TableCell>
                    {m.indent && (
                      <div className="w-4 border-r-2 border-muted-foreground/20 h-full min-h-[24px] mr-2" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className={cn("text-xs font-bold", ROLE_BADGE[m.role] ?? "bg-muted")}>
                          {m.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {m.handle}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", ROLE_BADGE[m.role] ?? "bg-muted")}>
                      {m.roleLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{m.groupName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.supervisorName ?? "—"}</TableCell>
                  <TableCell className="text-center text-sm">
                    <Badge variant="secondary" className="font-mono">
                      {toPersianDigits(m.taskCount)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {m.activeCount > 0 && (
                      <Badge className="bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 font-mono">
                        {toPersianDigits(m.activeCount)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.lastLoginAt ? formatJalaliLong(new Date(m.lastLoginAt)) : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4 ml-2" />
                          ویرایش
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-700"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {membersLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            عضوی یافت نشد.
          </div>
        ) : (
          sorted.map((m) => (
            <Card key={m.id} className={cn("p-3", m.indent && "mr-4 border-r-2 border-r-muted-foreground/20")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className={cn("text-xs font-bold", ROLE_BADGE[m.role] ?? "bg-muted")}>
                      {m.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground font-mono" dir="ltr">{m.handle}</div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(m)}>
                      <Pencil className="h-4 w-4 ml-2" />
                      ویرایش
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-700"
                      onClick={() => setDeleteTarget(m)}
                    >
                      <Trash2 className="h-4 w-4 ml-2" />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium", ROLE_BADGE[m.role] ?? "bg-muted")}>
                  {m.roleLabel}
                </span>
                {m.groupName && (
                  <span className="text-[10px] text-muted-foreground bg-muted rounded-md px-1.5 py-0.5">
                    {m.groupName}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {toPersianDigits(m.taskCount)} تسک · {toPersianDigits(m.activeCount)} فعال
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <MemberFormDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        groups={groups}
        allMembers={members}
        allowedRoles={allowedRoles}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["members"] });
          setDialogOpen(false);
        }}
        getSupervisorCandidates={getSupervisorCandidates}
        member={member}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف عضو</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف <span className="font-medium">{deleteTarget?.name}</span> (
              {deleteTarget?.handle}) مطمئن هستید؟ این عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف کاربر"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Member Form Dialog                                                  */
/* ------------------------------------------------------------------ */

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SerializedMember | null;
  groups: SerializedGroup[];
  allMembers: SerializedMember[];
  allowedRoles: string[];
  onSaved: () => void;
  getSupervisorCandidates: (groupId: string | null) => SerializedMember[];
  member: { role: string; groupId: string | null; companySlug: string | null } | null;
}

function MemberFormDialog({
  open,
  onOpenChange,
  editing,
  groups,
  allMembers,
  allowedRoles,
  onSaved,
  getSupervisorCandidates,
  member,
}: MemberFormDialogProps) {
  const [name, setName] = React.useState(() => editing?.name ?? "");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState(() => editing?.role ?? allowedRoles[0] ?? "");
  const [groupId, setGroupId] = React.useState(() => editing?.groupId ?? member?.groupId ?? "");
  const [supervisorId, setSupervisorId] = React.useState(() => editing?.supervisorId ?? "");
  const [busy, setBusy] = React.useState(false);
  const generatedHandle = React.useMemo(() => {
    if (editing) return editing.handle;
    return buildCompanyMemberHandle(member?.companySlug ?? "company", name);
  }, [editing, member?.companySlug, name]);

  // Compute effective supervisor: only valid for SPECIALIST role
  const effectiveSupervisorId = role === "SPECIALIST" ? supervisorId : "";

  const supervisorCandidates = React.useMemo(
    () => (role === "SPECIALIST" ? getSupervisorCandidates(groupId || null) : []),
    [groupId, getSupervisorCandidates, role]
  );

  // Groups the current user can assign
  const availableGroups = React.useMemo(() => {
    if (!member) return groups;
    if (member.role === "SUPER_ADMIN") return groups;
    if (member.role === "MANAGER") return groups.filter((g) => g.id === member.groupId);
    return groups.filter((g) => g.id === member.groupId);
  }, [groups, member]);

  async function save() {
    if (!name.trim() || !role || (!editing && password.length < 8)) {
      toast.error("نام، نقش و رمز عبور حداقل ۸ کاراکتری الزامی است.");
      return;
    }
    const finalHandle = editing ? editing.handle : generatedHandle;

    setBusy(true);
    try {
      const url = editing ? `/api/members/${editing.id}` : "/api/members";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          handle: finalHandle,
          ...(!editing || password.trim()
            ? { password: password.trim() }
            : {}),
          role,
          groupId: groupId || null,
          supervisorId: effectiveSupervisorId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ذخیره ناموفق بود.");
        return;
      }
      toast.success(editing ? "اطلاعات کاربر به‌روزرسانی شد." : "کاربر جدید اضافه شد.");
      onSaved();
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
          <DialogTitle className="flex items-center gap-2">
            {editing ? (
              <>
                <Save className="h-5 w-5 text-primary" />
                ویرایش کاربر
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5 text-primary" />
                افزودن کاربر جدید
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {editing ? "اطلاعات کاربر را ویرایش کنید." : "یک کاربر جدید به سیستم اضافه کنید."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-name">نام کامل *</Label>
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: علی محمدی"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>هندل *</Label>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm font-mono text-foreground" dir="ltr">
                {generatedHandle}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-pwd" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                رمز عبور
              </Label>
              <Input
                id="m-pwd"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نقش *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب نقش" />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((rKey) => {
                    const rInfo = roleByKey(rKey);
                    return (
                      <SelectItem key={rKey} value={rKey}>
                        {rInfo?.label ?? rKey}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>مجموعه</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="بدون مجموعه" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون مجموعه</SelectItem>
                  {availableGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {role === "SPECIALIST" && (
            <div className="space-y-1.5">
              <Label>سرپرست</Label>
              <Select value={effectiveSupervisorId} onValueChange={setSupervisorId}>
                <SelectTrigger>
                  <SelectValue placeholder={supervisorCandidates.length === 0 ? "سرپرستی یافت نشد" : "انتخاب سرپرست"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون سرپرست</SelectItem>
                  {supervisorCandidates.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.handle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supervisorCandidates.length === 0 && groupId && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  ابتدا یک سرپرست در این مجموعه ایجاد کنید.
                </p>
              )}
            </div>
          )}

          {editing && (member?.role === "SUPER_ADMIN" || member?.role === "MANAGER") && (
            <MemberBaleSettings memberId={editing.id} />
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
