"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTMStore, type ViewKey } from "@/lib/pmo-store";
import { toPersianDigits, formatJalaliLong } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import type { SerializedMember, SerializedGroup, SerializedTask } from "@/lib/serialize";
import {
  Building2,
  Users,
  ListChecks,
  CalendarClock,
  Plus,
  Crown,
  Shield,
  ShieldCheck,
  UserCog,
  UserCheck,
  ArrowLeft,
  Clock,
  BellRing,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_COLORS: Record<string, { bg: string; text: string; bar: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUPER_ADMIN: {
    bg: "bg-rose-100 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    icon: Crown,
  },
  MANAGER: {
    bg: "bg-amber-100 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
    icon: Shield,
  },
  SUPERVISOR: {
    bg: "bg-sky-100 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    icon: UserCog,
  },
  SPECIALIST: {
    bg: "bg-slate-100 dark:bg-slate-800/50",
    text: "text-slate-600 dark:text-slate-300",
    bar: "bg-slate-400",
    icon: UserCheck,
  },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "مدیر کل",
  MANAGER: "مدیر مجموعه",
  SUPERVISOR: "سرپرست",
  SPECIALIST: "کارشناس",
};

type NotificationEvent = "OVERDUE" | "TODAY" | "DUE_SOON" | "WORKFLOW_OPEN" | "WORKFLOW_CLOSED" | "GROUP_STARTED_REPORT" | "GROUP_OVERDUE_REPORT";
type NotificationRule = { id: string; name: string; eventType: NotificationEvent; isEnabled: boolean; leadMinutes: number | null; sendTime: string | null; recipientMode: "ASSIGNEE" | "MANAGERS" | "BOTH" | "BALE_GROUP"; baleGroupDestinationId: string | null; baleGroupDestination: { id: string; name: string } | null };
type BaleGroupDestination = { id: string; name: string; chatId: string; isEnabled: boolean; orgGroup: { id: string; name: string } | null; _count: { rules: number } };

export function NotificationSystemSettings() {
  const queryClient = useQueryClient();
  const [token, setToken] = React.useState("");
  const [name, setName] = React.useState("");
  const [eventType, setEventType] = React.useState<NotificationRule["eventType"]>("DUE_SOON");
  const [recipientMode, setRecipientMode] = React.useState<NotificationRule["recipientMode"]>("ASSIGNEE");
  const [leadAmount, setLeadAmount] = React.useState("12");
  const [leadUnit, setLeadUnit] = React.useState("hours");
  const [sendTime, setSendTime] = React.useState("08:00");
  const [destinationId, setDestinationId] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [chatId, setChatId] = React.useState("");
  const [orgGroupId, setOrgGroupId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { data } = useQuery({ queryKey: ["admin-notification-settings"], queryFn: async () => { const response = await fetch("/api/admin/notifications"); if (!response.ok) throw new Error("دریافت تنظیمات اعلان ناموفق بود."); return response.json() as Promise<{ tokenConfigured: boolean; tokenSource: string; rules: NotificationRule[]; logs: { id: string; eventType: string; status: string; recipientId: string; providerMessageId: string | null; errorCode: string | null; errorMessage: string | null; createdAt: string }[]; outboxCounts: Record<string, number> }>; } });
  const { data: groupData } = useQuery({ queryKey: ["admin-bale-groups"], queryFn: async () => { const response = await fetch("/api/admin/bale-groups"); if (!response.ok) throw new Error("دریافت گروه‌های بله ناموفق بود."); return response.json() as Promise<{ destinations: BaleGroupDestination[]; orgGroups: { id: string; name: string }[] }>; } });
  async function saveToken() {
    if (!token.trim()) return toast.error("توکن جدید را وارد کنید."); setBusy(true);
    try { const response = await fetch("/api/admin/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const result = await response.json(); if (!response.ok) return toast.error(result.error || "ثبت توکن ناموفق بود."); setToken(""); toast.success("توکن آزمایش و ذخیره شد؛ ربات از توکن جدید استفاده می‌کند."); await queryClient.invalidateQueries({ queryKey: ["admin-notification-settings"] }); } finally { setBusy(false); }
  }
  async function addRule() {
    const multiplier = leadUnit === "days" ? 1440 : leadUnit === "hours" ? 60 : 1;
    const leadMinutes = Math.round(Number(leadAmount) * multiplier);
    if (!name.trim()) return toast.error("نام زمان‌بندی را وارد کنید.");
    if (recipientMode === "BALE_GROUP" && !destinationId) return toast.error("گروه مقصد بله را انتخاب کنید.");
    setBusy(true);
    try { const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, eventType, recipientMode, baleGroupDestinationId: recipientMode === "BALE_GROUP" ? destinationId : null, leadMinutes: eventType === "DUE_SOON" ? leadMinutes : null, sendTime: eventType === "DUE_SOON" ? null : sendTime }) }); const result = await response.json(); if (!response.ok) return toast.error(result.error || "ثبت زمان‌بندی ناموفق بود."); setName(""); toast.success("زمان‌بندی اعلان فعال شد."); await queryClient.invalidateQueries({ queryKey: ["admin-notification-settings"] }); } finally { setBusy(false); }
  }
  async function addBaleGroup() {
    if (!groupName.trim() || !chatId.trim()) return toast.error("نام و شناسه گروه بله را وارد کنید.");
    setBusy(true);
    try { const response = await fetch("/api/admin/bale-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupName, chatId, orgGroupId: orgGroupId || null }) }); const result = await response.json(); if (!response.ok) return toast.error(result.error || "ثبت گروه بله ناموفق بود."); setGroupName(""); setChatId(""); setOrgGroupId(""); toast.success("مقصد گروهی بله ثبت شد."); await queryClient.invalidateQueries({ queryKey: ["admin-bale-groups"] }); } finally { setBusy(false); }
  }
  async function changeBaleGroup(id: string, method: "PATCH" | "DELETE", body: object) { const response = await fetch("/api/admin/bale-groups", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) }); const result = await response.json(); if (!response.ok) return toast.error(result.error || "تغییر گروه بله ناموفق بود."); await queryClient.invalidateQueries({ queryKey: ["admin-bale-groups"] }); }
  async function changeRule(id: string, method: "PATCH" | "DELETE", body: object) { const response = await fetch("/api/admin/notifications", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) }); const result = await response.json(); if (!response.ok) return toast.error(result.error || "تغییر تنظیمات ناموفق بود."); await queryClient.invalidateQueries({ queryKey: ["admin-notification-settings"] }); }
  const eventLabels: Record<NotificationEvent, string> = { OVERDUE: "تسک‌های عقب‌افتاده تکی", TODAY: "تسک‌های روز", DUE_SOON: "یادآوری قبل از موعد", WORKFLOW_OPEN: "گردش‌کارهای باز", WORKFLOW_CLOSED: "گردش‌کارهای بسته‌شده", GROUP_STARTED_REPORT: "گزارش تسک‌های در حال انجام اعضا", GROUP_OVERDUE_REPORT: "گزارش یکپارچه تسک‌های عقب‌افتاده" };
  const recipientLabels = { ASSIGNEE: "مسئول تسک", MANAGERS: "مدیران واحد", BOTH: "مسئول و مدیران", BALE_GROUP: "گروه بله" };
  return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><MessageCircle className="h-4 w-4" />توکن ربات بله</CardTitle></CardHeader><CardContent className="space-y-3"><div className="text-xs text-muted-foreground">وضعیت: {data?.tokenConfigured ? <span className="text-emerald-600">تنظیم شده</span> : <span className="text-destructive">تنظیم نشده</span>} {data?.tokenSource === "environment" && "(از تنظیمات سرور)"}</div><Label>توکن جدید</Label><div className="flex gap-2"><Input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="توکن در صفحه نمایش داده نمی‌شود" dir="ltr" /><Button onClick={saveToken} disabled={busy || !token.trim()}>آزمایش و ذخیره</Button></div><p className="text-[11px] text-muted-foreground">توکن پیش از ذخیره با بله آزمایش و سپس به‌صورت رمزگذاری‌شده نگهداری می‌شود.</p></CardContent></Card>
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><MessageCircle className="h-4 w-4" />گروه‌های مقصد بله</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="نام نمایشی گروه" /><Input value={chatId} onChange={(event) => setChatId(event.target.value)} placeholder="شناسه chat گروه بله" dir="ltr" /><p className="text-[11px] text-muted-foreground">برای دریافت شناسه صحیح، ربات را داخل گروه اضافه کنید و دستور <span dir="ltr" className="font-mono">/chatid</span> را همان‌جا بفرستید. شناسه چت خصوصی برای ارسال گروهی مناسب نیست.</p><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={orgGroupId} onChange={(event) => setOrgGroupId(event.target.value)}><option value="">همه واحدهای سازمانی</option>{groupData?.orgGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><Button className="w-full" onClick={addBaleGroup} disabled={busy}>ثبت گروه مقصد</Button><div className="space-y-2">{groupData?.destinations.map((group) => <div key={group.id} className="flex items-center gap-2 rounded-lg border p-2"><input type="checkbox" checked={group.isEnabled} onChange={(event) => changeBaleGroup(group.id, "PATCH", { isEnabled: event.target.checked })} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{group.name}</div><div className="text-[11px] text-muted-foreground">{group.orgGroup?.name || "همه واحدها"} · {toPersianDigits(group._count.rules)} زمان‌بندی · <span dir="ltr">{group.chatId}</span></div></div><Button size="icon" variant="ghost" className="text-destructive" onClick={() => changeBaleGroup(group.id, "DELETE", {})}><Trash2 className="h-4 w-4" /></Button></div>)}</div></CardContent></Card>
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><BellRing className="h-4 w-4" />تعریف اعلان خودکار</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام زمان‌بندی؛ مثلاً گزارش گردش‌کار ساعت ۸" /><div className="grid gap-2 sm:grid-cols-2"><select className="h-9 rounded-md border bg-background px-3 text-sm" value={eventType} onChange={(event) => { const value = event.target.value as NotificationEvent; setEventType(value); if (value.startsWith("WORKFLOW_") || value.startsWith("GROUP_")) setRecipientMode("BALE_GROUP"); }}><option value="DUE_SOON">قبل از موعد تسک</option><option value="TODAY">تسک‌های روز</option><option value="OVERDUE">تسک‌های عقب‌افتاده تکی</option><option value="GROUP_OVERDUE_REPORT">گزارش یکپارچه تسک‌های عقب‌افتاده</option><option value="GROUP_STARTED_REPORT">گزارش تسک‌های در حال انجام اعضا</option><option value="WORKFLOW_OPEN">گردش‌کارهای باز</option><option value="WORKFLOW_CLOSED">گردش‌کارهای بسته‌شده</option></select><select className="h-9 rounded-md border bg-background px-3 text-sm" value={recipientMode} onChange={(event) => setRecipientMode(event.target.value as NotificationRule["recipientMode"])} disabled={eventType.startsWith("WORKFLOW_") || eventType.startsWith("GROUP_")}><option value="ASSIGNEE">ارسال به مسئول تسک</option><option value="MANAGERS">ارسال به مدیران واحد</option><option value="BOTH">ارسال به مسئول و مدیران</option><option value="BALE_GROUP">ارسال در گروه بله</option></select></div>{recipientMode === "BALE_GROUP" && <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">انتخاب گروه مقصد</option>{groupData?.destinations.filter((group) => group.isEnabled).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}{eventType === "DUE_SOON" ? <div className="grid grid-cols-[1fr_140px] gap-2"><Input type="number" min="1" step="any" value={leadAmount} onChange={(event) => setLeadAmount(event.target.value)} /><select className="h-9 rounded-md border bg-background px-3 text-sm" value={leadUnit} onChange={(event) => setLeadUnit(event.target.value)}><option value="minutes">دقیقه قبل</option><option value="hours">ساعت قبل</option><option value="days">روز قبل</option></select></div> : <div className="space-y-1"><Label>ساعت ارسال روزانه به وقت تهران</Label><Input type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} dir="ltr" /></div>}<Button className="w-full" onClick={addRule} disabled={busy}>افزودن و فعال‌سازی زمان‌بندی</Button></CardContent></Card>
    <Card className="xl:col-span-2"><CardHeader className="pb-3"><CardTitle className="text-sm">زمان‌بندی‌های اعلان</CardTitle></CardHeader><CardContent className="space-y-2">{!data?.rules.length ? <div className="py-4 text-center text-sm text-muted-foreground">هنوز زمان‌بندی اعلانی تعریف نشده است.</div> : data.rules.map((rule) => <div key={rule.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={rule.isEnabled} onChange={(event) => changeRule(rule.id, "PATCH", { isEnabled: event.target.checked })} /><div className="min-w-48 flex-1"><div className="text-sm font-medium">{rule.name}</div><div className="text-xs text-muted-foreground">{eventLabels[rule.eventType]} · {rule.baleGroupDestination?.name || recipientLabels[rule.recipientMode]} · {rule.eventType === "DUE_SOON" ? `${toPersianDigits(rule.leadMinutes || 0)} دقیقه قبل` : `ساعت ${toPersianDigits(rule.sendTime || "")}`}</div></div><Badge variant={rule.isEnabled ? "default" : "secondary"}>{rule.isEnabled ? "فعال" : "غیرفعال"}</Badge><Button size="icon" variant="ghost" className="text-destructive" onClick={() => changeRule(rule.id, "DELETE", {})}><Trash2 className="h-4 w-4" /></Button></div>)}</CardContent></Card>
    <Card className="xl:col-span-2"><CardHeader className="pb-3"><CardTitle className="text-sm">لاگ ارسال‌های بله</CardTitle></CardHeader><CardContent><div className="mb-3 flex flex-wrap gap-2">{Object.entries(data?.outboxCounts || {}).map(([status, count]) => <Badge key={status} variant="outline">{status}: {toPersianDigits(count)}</Badge>)}</div><div className="max-h-96 overflow-auto rounded-lg border"><table className="w-full text-right text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2">زمان</th><th className="p-2">نوع</th><th className="p-2">مقصد</th><th className="p-2">وضعیت</th><th className="p-2">نتیجه</th></tr></thead><tbody>{!data?.logs.length ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">هنوز لاگ ارسالی ثبت نشده است.</td></tr> : data.logs.map((log) => <tr key={log.id} className="border-t"><td className="whitespace-nowrap p-2">{formatJalaliLong(new Date(log.createdAt))}</td><td className="p-2">{log.eventType}</td><td className="p-2 font-mono" dir="ltr">{log.recipientId}</td><td className="p-2"><Badge variant={log.status === "SENT" ? "default" : "destructive"}>{log.status}</Badge></td><td className="max-w-72 truncate p-2" title={log.errorMessage || log.providerMessageId || ""}>{log.errorMessage || log.providerMessageId || "—"}</td></tr>)}</tbody></table></div></CardContent></Card>
  </div>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-tight nums-fa">{toPersianDigits(value)}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminView() {
  const setView = useTMStore((s) => s.setView);

  const { data: groupsData, isLoading: gLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { groups: SerializedGroup[] };
    },
  });

  const { data: membersData, isLoading: mLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const r = await fetch("/api/members");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { members: SerializedMember[] };
    },
  });

  const { data: tasksData, isLoading: tLoading } = useQuery({
    queryKey: ["tasks", "admin-all"],
    queryFn: async () => {
      const r = await fetch("/api/tasks");
      if (!r.ok) throw new Error("خطا");
      return (await r.json()) as { tasks: SerializedTask[] };
    },
  });

  const { data: schedulesData } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const r = await fetch("/api/schedules");
      if (!r.ok) return { schedules: [] };
      return (await r.json()) as { schedules: unknown[] };
    },
  });

  const groups = groupsData?.groups ?? [];
  const members = membersData?.members ?? [];
  const tasks = tasksData?.tasks ?? [];
  const scheduleCount = schedulesData?.schedules?.length ?? 0;

  const isLoading = gLoading || mLoading || tLoading;

  const roleDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {
      SUPER_ADMIN: 0,
      MANAGER: 0,
      SUPERVISOR: 0,
      SPECIALIST: 0,
    };
    for (const m of members) {
      if (counts[m.role] !== undefined) counts[m.role]++;
    }
    return counts;
  }, [members]);

  const totalMembers = members.length;
  const maxRoleCount = Math.max(...Object.values(roleDistribution), 1);

  const recentTasks = React.useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-1 h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1 h-[calc(100vh-6rem)] overflow-y-auto scroll-smooth">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => setView("access-groups")}><ShieldCheck className="h-4 w-4" />مدیریت دسترسی‌ها<ArrowLeft className="h-3 w-3" /></Button>
        <Button variant="outline" className="gap-1.5" onClick={() => setView("bale-management")}><MessageCircle className="h-4 w-4" />مدیریت پیام‌رسان بله<ArrowLeft className="h-3 w-3" /></Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => setView("groups")}
        >
          <Building2 className="h-4 w-4" />
          افزودن مجموعه
          <ArrowLeft className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => setView("members")}
        >
          <Users className="h-4 w-4" />
          افزودن کاربر
          <ArrowLeft className="h-3 w-3" />
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="مجموعه‌ها" value={groups.length} color="bg-violet-500" />
        <StatCard icon={Users} label="کل اعضا" value={totalMembers} color="bg-emerald-500" />
        <StatCard icon={ListChecks} label="کل تسک‌ها" value={tasks.length} color="bg-sky-500" />
        <StatCard icon={CalendarClock} label="زمان‌بندی‌ها" value={scheduleCount} color="bg-amber-500" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            توزیع نقش‌ها
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(roleDistribution).map(([roleKey, count]) => {
            const rc = ROLE_COLORS[roleKey];
            if (!rc) return null;
            const Icon = rc.icon;
            const pct = totalMembers > 0 ? (count / totalMembers) * 100 : 0;
            return (
              <div key={roleKey} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", rc.text)} />
                    <span className="font-medium">{ROLE_LABELS[roleKey] ?? roleKey}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", rc.text)}>
                      {toPersianDigits(count)} نفر
                    </span>
                    <span className="text-xs text-muted-foreground nums-fa">
                      ({toPersianDigits(Math.round(pct))}٪)
                    </span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", rc.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            آخرین تسک‌های ثبت‌شده
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              هنوز تسکی ثبت نشده است.
            </p>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {t.assigneeName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="font-mono">{t.code}</span>
                      <span>·</span>
                      <span>{t.assigneeName}</span>
                      <span>·</span>
                      <span>{t.groupName ?? "—"}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0">
                    {formatJalaliLong(new Date(t.createdAt))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="pb-4"></div>
    </div>
  );
}
