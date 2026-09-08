"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock3, GitBranch, Link2, Loader2, MapPin, Pencil, Plus, Trash2, User, Workflow, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SerializedTask } from "@/lib/serialize";
import { statusByKey } from "@/lib/constants";
import { toast } from "sonner";
import { TaskSearchSelect } from "./task-search-select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getCurrentWorkflowLocation, isWorkflowClosed } from "@/features/tasks/workflow-status";
import { elapsedDaysSinceStart } from "@/features/tasks/elapsed-days";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type WorkflowTask = { id: string; code: string; title: string; status: string; startedAt: string | null; groupId: string; groupName: string; assigneeName: string };
type Relation = { id: string; workflowName: string | null; previous: WorkflowTask; next: WorkflowTask };

function WorkflowActions({ relationIds, initialName }: { relationIds: string[]; initialName: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(initialName);
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  async function save() {
    if (!name.trim()) return toast.error("نام گردش‌کار را وارد کنید.");
    setBusy(true);
    try {
      const response = await fetch("/api/workflows", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationIds, workflowName: name }) });
      const result = await response.json();
      if (!response.ok) return toast.error(result.error ?? "ثبت نام ناموفق بود.");
      toast.success("نام گردش‌کار ذخیره شد.");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } finally { setBusy(false); }
  }
  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch("/api/workflows", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationIds }) });
      const result = await response.json();
      if (!response.ok) return toast.error(result.error ?? "حذف گردش‌کار ناموفق بود.");
      toast.success("گردش‌کار حذف شد؛ تسک‌ها حفظ شدند.");
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } finally { setDeleting(false); }
  }
  return <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
    {editing ? <><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="نام گردش‌کار" className="h-8 max-w-sm bg-background" autoFocus /><Button size="sm" variant="outline" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ذخیره"}</Button><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setName(initialName); setEditing(false); }} aria-label="انصراف"><X className="h-4 w-4" /></Button></> : <><div className="truncate font-semibold">{initialName}</div><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />ویرایش</Button></>}
    <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="destructive" className="gap-1.5" disabled={deleting}><Trash2 className="h-3.5 w-3.5" />حذف</Button></AlertDialogTrigger><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف گردش‌کار «{initialName}»؟</AlertDialogTitle><AlertDialogDescription>تمام ارتباط‌های بین مراحل این گردش‌کار حذف می‌شوند، اما خود تسک‌ها و اطلاعاتشان باقی می‌مانند.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={remove} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? "در حال حذف..." : "حذف گردش‌کار"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function WorkflowStageRow({ relation, tasks }: { relation: Relation; tasks: SerializedTask[] }) {
  const queryClient = useQueryClient();
  const [previousTaskId, setPreviousTaskId] = React.useState(relation.previous.id);
  const [nextTaskId, setNextTaskId] = React.useState(relation.next.id);
  const [busy, setBusy] = React.useState(false);
  const changed = previousTaskId !== relation.previous.id || nextTaskId !== relation.next.id;
  async function updateStage() {
    if (!previousTaskId || !nextTaskId) return toast.error("مرحله قبلی و بعدی را انتخاب کنید.");
    setBusy(true);
    try {
      const response = await fetch("/api/workflows", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationId: relation.id, previousTaskId, nextTaskId }) });
      const result = await response.json();
      if (!response.ok) return toast.error(result.error ?? "ویرایش مرحله ناموفق بود.");
      toast.success("مراحل گردش‌کار تغییر کرد.");
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } finally { setBusy(false); }
  }
  async function removeStage() {
    setBusy(true);
    try {
      const response = await fetch("/api/workflows", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ relationIds: [relation.id] }) });
      const result = await response.json();
      if (!response.ok) return toast.error(result.error ?? "حذف مرحله ناموفق بود.");
      toast.success("ارتباط این دو مرحله حذف شد؛ تسک‌ها حفظ شدند.");
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } finally { setBusy(false); }
  }
  return <div className="grid gap-2 rounded-lg border bg-background p-3 lg:grid-cols-[1fr_auto_1fr_auto_auto] lg:items-center">
    <TaskSearchSelect tasks={tasks.filter((task) => task.id !== nextTaskId)} value={previousTaskId} onChange={setPreviousTaskId} placeholder="مرحله قبلی" />
    <span className="hidden text-muted-foreground lg:block">←</span>
    <TaskSearchSelect tasks={tasks.filter((task) => task.id !== previousTaskId)} value={nextTaskId} onChange={setNextTaskId} placeholder="مرحله بعدی" />
    <Button size="sm" variant="outline" onClick={updateStage} disabled={busy || !changed}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ثبت تغییر"}</Button>
    <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" disabled={busy}><Trash2 className="h-3.5 w-3.5" />حذف مرحله</Button></AlertDialogTrigger><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>حذف این ارتباط مرحله‌ای؟</AlertDialogTitle><AlertDialogDescription>ارتباط «{relation.previous.title}» با «{relation.next.title}» حذف می‌شود؛ خود تسک‌ها باقی می‌مانند.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={removeStage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف ارتباط</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function WorkflowStageEditor({ relations, tasks, open, onOpenChange }: { relations: Relation[]; tasks: SerializedTask[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <div className="border-b bg-muted/10 px-4 py-2">
    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => onOpenChange(!open)}><Pencil className="h-3.5 w-3.5" />{open ? "بستن ویرایش مراحل" : "ویرایش مراحل و عملیات"}</Button>
    {open && <div className="mt-2 space-y-2 pb-2"><div className="text-xs text-muted-foreground">در هر ردیف می‌توانید تسک مرحله قبل یا بعد را عوض کنید، یا فقط همان ارتباط را حذف کنید.</div>{relations.map((relation) => <WorkflowStageRow key={relation.id} relation={relation} tasks={tasks} />)}</div>}
  </div>;
}

function buildFlows(relations: Relation[]) {
  const tasks = new Map<string, WorkflowTask>();
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const relation of relations) {
    tasks.set(relation.previous.id, relation.previous);
    tasks.set(relation.next.id, relation.next);
    incoming.set(relation.next.id, (incoming.get(relation.next.id) ?? 0) + 1);
    if (!incoming.has(relation.previous.id)) incoming.set(relation.previous.id, incoming.get(relation.previous.id) ?? 0);
    outgoing.set(relation.previous.id, [...(outgoing.get(relation.previous.id) ?? []), relation.next.id]);
  }
  const roots = [...tasks.keys()].filter((id) => (incoming.get(id) ?? 0) === 0);
  const seen = new Set<string>();
  const walk = (root: string) => {
    const levels: string[][] = [];
    let current = [root];
    while (current.length) {
      const fresh = current.filter((id) => !seen.has(id));
      if (!fresh.length) break;
      fresh.forEach((id) => seen.add(id));
      levels.push(fresh);
      current = [...new Set(fresh.flatMap((id) => outgoing.get(id) ?? []))];
    }
    return levels;
  };
  const flows = roots.map(walk).filter((flow) => flow.length);
  for (const id of tasks.keys()) if (!seen.has(id)) flows.push(walk(id));
  return { tasks, flows };
}

export function WorkflowView() {
  const queryClient = useQueryClient();
  const [previousTaskId, setPreviousTaskId] = React.useState("");
  const [nextTaskId, setNextTaskId] = React.useState("");
  const [workflowName, setWorkflowName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editingFlowKey, setEditingFlowKey] = React.useState<string | null>(null);
  const [selectedFlowKey, setSelectedFlowKey] = React.useState<string | null>(null);
  const [showOpen, setShowOpen] = React.useState(true);
  const [showClosed, setShowClosed] = React.useState(false);
  const { data: taskData } = useQuery({ queryKey: ["tasks", "workflow-page"], queryFn: async () => {
    const response = await fetch("/api/workflows/candidates");
    if (!response.ok) throw new Error("دریافت تسک‌ها ناموفق بود.");
    return response.json() as Promise<{ tasks: SerializedTask[] }>;
  }});
  const { data: workflowData, isLoading } = useQuery({ queryKey: ["workflows"], queryFn: async () => {
    const response = await fetch("/api/workflows");
    if (!response.ok) throw new Error("دریافت گردش‌کارها ناموفق بود.");
    return response.json() as Promise<{ relations: Relation[] }>;
  }});
  const tasks = taskData?.tasks ?? [];
  const relations = workflowData?.relations ?? [];
  const { tasks: workflowTasks, flows } = React.useMemo(() => buildFlows(relations), [relations]);
  const flowModels = React.useMemo(() => flows.map((levels, flowIndex) => {
    const ids = new Set(levels.flat());
    const flowRelations = relations.filter((relation) => ids.has(relation.previous.id) && ids.has(relation.next.id));
    const name = flowRelations.find((relation) => relation.workflowName)?.workflowName ?? `گردش‌کار ${(flowIndex + 1).toLocaleString("fa-IR")}`;
    const current = getCurrentWorkflowLocation(levels, workflowTasks);
    const closed = isWorkflowClosed(levels.flat().map((id) => workflowTasks.get(id)!));
    return {
      key: flowRelations[0]?.id ?? levels[0]?.[0] ?? String(flowIndex),
      levels,
      relations: flowRelations,
      name,
      currentTask: current.task,
      currentStage: current.levelIndex + 1,
      closed,
    };
  }), [flows, relations, workflowTasks]);
  const openFlowCount = flowModels.filter((flow) => !flow.closed).length;
  const visibleFlowModels = flowModels.filter((flow) => (flow.closed ? showClosed : showOpen));
  const selectedFlow = flowModels.find((flow) => flow.key === selectedFlowKey) ?? null;
  const nextCandidates = tasks.filter((task) => task.id !== previousTaskId);

  function openWorkflowOperations(key: string) {
    setEditingFlowKey(key);
    setSelectedFlowKey(key);
  }

  function currentUnitDuration(flow: (typeof flowModels)[number]) {
    if (flow.closed) return "گردش‌کار بسته شده است";
    if (!flow.currentTask || flow.currentTask.status !== "STARTED") return "هنوز در این واحد شروع نشده";
    const days = elapsedDaysSinceStart(flow.currentTask.startedAt);
    if (days === null) return "زمان شروع در این واحد ثبت نشده";
    if (days === 0) return "کمتر از یک روز در این واحد";
    return `${days.toLocaleString("fa-IR")} روز در این واحد`;
  }

  async function connect() {
    if (!previousTaskId || !nextTaskId) return toast.error("تسک قبلی و بعدی را انتخاب کنید.");
    setBusy(true);
    try {
      const response = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previousTaskId, nextTaskId, workflowName }) });
      const result = await response.json();
      if (!response.ok) return toast.error(result.error ?? "ثبت ارتباط ناموفق بود.");
      toast.success("مرحله جدید به گردش‌کار اضافه شد.");
      setNextTaskId("");
      setWorkflowName("");
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4"><div className="text-xs text-muted-foreground">گردش‌کارهای باز</div><div className="mt-1 text-2xl font-bold">{openFlowCount.toLocaleString("fa-IR")}</div></Card>
      <Card className="p-4"><div className="text-xs text-muted-foreground">تسک‌های متصل</div><div className="mt-1 text-2xl font-bold">{workflowTasks.size.toLocaleString("fa-IR")}</div></Card>
      <Card className="p-4"><div className="text-xs text-muted-foreground">ارتباط مرحله‌ای</div><div className="mt-1 text-2xl font-bold">{relations.length.toLocaleString("fa-IR")}</div></Card>
    </div>

    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4" />افزودن مرحله به گردش‌کار</div>
      <div className="space-y-1.5"><div className="text-xs text-muted-foreground">نام گردش‌کار (اختیاری)</div><Input value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} placeholder="مثلاً: تأیید و ارسال درخواست خرید" /></div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
        <div className="space-y-1.5"><div className="text-xs text-muted-foreground">تسک قبلی</div><TaskSearchSelect tasks={tasks} value={previousTaskId} onChange={(value) => { setPreviousTaskId(value); setNextTaskId(""); }} placeholder="جست‌وجوی تسک قبلی" /></div>
        <div className="hidden pb-2 text-muted-foreground md:block">←</div>
        <div className="space-y-1.5"><div className="text-xs text-muted-foreground">تسک بعدی</div><TaskSearchSelect tasks={nextCandidates} value={nextTaskId} onChange={setNextTaskId} disabled={!previousTaskId} placeholder="جست‌وجوی تسک بعدی" /></div>
        <Button onClick={connect} disabled={busy || !previousTaskId || !nextTaskId}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}ثبت ارتباط</Button>
      </div>
    </Card>

    {flowModels.length > 0 && <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-52 flex-1"><div className="font-semibold">فهرست گردش‌کارها</div><div className="mt-1 text-xs text-muted-foreground">برای مشاهده جزئیات، ویرایش مراحل و انجام عملیات روی گردش‌کار کلیک کنید.</div></div>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={showOpen} onCheckedChange={(checked) => setShowOpen(checked === true)} />نمایش گردش‌کارهای باز</label>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={showClosed} onCheckedChange={(checked) => setShowClosed(checked === true)} />نمایش گردش‌کارهای بسته</label>
      </div>
      <div className="divide-y">
        {visibleFlowModels.map((flow) => <button key={flow.key} type="button" className="grid w-full gap-3 p-4 text-right transition-colors hover:bg-muted/40 md:grid-cols-[1.2fr_1.3fr_1fr_1fr_1fr_auto] md:items-center" onClick={() => openWorkflowOperations(flow.key)}>
          <div><div className="text-[11px] text-muted-foreground">نام گردش‌کار</div><div className="mt-1 flex items-center gap-2 font-semibold">{flow.name}<Badge variant={flow.closed ? "secondary" : "outline"}>{flow.closed ? "بسته" : "باز"}</Badge></div></div>
          <div><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3.5 w-3.5" />محل فعلی گردش</div><div className="mt-1 text-sm">مرحله {flow.currentStage.toLocaleString("fa-IR")} · {flow.currentTask?.title ?? "نامشخص"}</div></div>
          <div><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Building2 className="h-3.5 w-3.5" />واحد</div><div className="mt-1 text-sm font-medium">{flow.currentTask?.groupName ?? "نامشخص"}</div></div>
          <div><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><User className="h-3.5 w-3.5" />مسئول</div><div className="mt-1 text-sm font-medium">{flow.currentTask?.assigneeName ?? "نامشخص"}</div></div>
          <div><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />مدت حضور</div><div className="mt-1 text-sm font-medium">{currentUnitDuration(flow)}</div></div>
          <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm"><Pencil className="h-3.5 w-3.5" />جزئیات و عملیات</span>
        </button>)}
        {visibleFlowModels.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">گردش‌کاری مطابق فیلتر انتخاب‌شده وجود ندارد.</div>}
      </div>
    </Card>}

    {isLoading ? <Card className="p-8 text-center text-sm text-muted-foreground">در حال دریافت گردش‌کارها...</Card> : flowModels.length === 0 && <Card className="p-10 text-center"><Workflow className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><div className="font-medium">گردش‌کاری وجود ندارد</div><div className="mt-1 text-xs text-muted-foreground">دو تسک را از فرم بالا به هم متصل کنید.</div></Card>}

    <Dialog open={selectedFlow !== null} onOpenChange={(open) => { if (!open) { setSelectedFlowKey(null); setEditingFlowKey(null); } }}>
      {selectedFlow && <DialogContent dir="rtl" className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-5xl">
        <DialogHeader className="text-right"><DialogTitle>{selectedFlow.name}</DialogTitle><DialogDescription>مرحله {selectedFlow.currentStage.toLocaleString("fa-IR")} · {selectedFlow.currentTask?.groupName ?? "واحد نامشخص"} · {currentUnitDuration(selectedFlow)}</DialogDescription></DialogHeader>
        <div className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3"><GitBranch className="h-4 w-4 text-primary" /><WorkflowActions relationIds={selectedFlow.relations.map((relation) => relation.id)} initialName={selectedFlow.name} /><Badge variant={selectedFlow.closed ? "secondary" : "outline"}>{selectedFlow.closed ? "بسته" : "باز"}</Badge><Badge variant="outline">{selectedFlow.levels.flat().length.toLocaleString("fa-IR")} تسک</Badge></div>
          <WorkflowStageEditor relations={selectedFlow.relations} tasks={tasks} open={editingFlowKey === selectedFlow.key} onOpenChange={(open) => setEditingFlowKey(open ? selectedFlow.key : null)} />
          <div className="overflow-x-auto p-4"><div className="flex min-w-max items-stretch gap-3">{selectedFlow.levels.map((level, levelIndex) => <React.Fragment key={levelIndex}><div className="flex w-64 flex-col gap-2"><div className="text-center text-[11px] text-muted-foreground">مرحله {(levelIndex + 1).toLocaleString("fa-IR")}</div>{level.map((id) => { const task = workflowTasks.get(id)!; return <div key={id} className="rounded-lg border bg-background p-3 shadow-sm"><div className="flex items-start gap-2"><Badge variant="outline" className="font-mono text-[10px]">{task.code}</Badge><Badge className="mr-auto text-[10px]" variant={task.status === "DONE" ? "default" : "secondary"}>{statusByKey(task.status)?.label ?? task.status}</Badge></div><div className="mt-2 text-sm font-medium leading-6">{task.title}</div><div className="mt-2 text-[11px] text-muted-foreground">{task.assigneeName} · {task.groupName}</div></div>; })}</div>{levelIndex < selectedFlow.levels.length - 1 && <div className="flex items-center text-2xl text-primary">←</div>}</React.Fragment>)}</div></div>
        </div>
      </DialogContent>}
    </Dialog>
  </div>;
}
