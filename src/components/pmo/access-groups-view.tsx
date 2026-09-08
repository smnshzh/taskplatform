"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { SerializedMember } from "@/lib/serialize";

type Permission = { key: string; label: string; category: string };
type AccessGroup = { id: string; name: string; description: string | null; permissions: string[]; isSystem: boolean; members: { member: { id: string; name: string; handle: string } }[] };

export function AccessGroupsView() {
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<AccessGroup | null | undefined>(undefined);
  const { data, isLoading } = useQuery({ queryKey: ["access-groups"], queryFn: async () => { const r = await fetch("/api/access-groups"); if (!r.ok) throw new Error(); return r.json() as Promise<{ groups: AccessGroup[]; permissions: Permission[] }>; } });
  const { data: membersData } = useQuery({ queryKey: ["members"], queryFn: async () => { const r = await fetch("/api/members"); if (!r.ok) throw new Error(); return r.json() as Promise<{ members: SerializedMember[] }>; } });
  async function remove(group: AccessGroup) {
    if (!confirm(`گروه «${group.name}» حذف شود؟ اعضا حذف نخواهند شد.`)) return;
    const r = await fetch(`/api/access-groups/${group.id}`, { method: "DELETE" }); const body = await r.json();
    if (!r.ok) return toast.error(body.error ?? "حذف ناموفق بود.");
    toast.success("گروه دسترسی حذف شد."); qc.invalidateQueries({ queryKey: ["access-groups"] });
  }
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">در حال بارگذاری...</div>;
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5" />گروه‌های دسترسی</h2><p className="text-sm text-muted-foreground">مجوزها را یک‌بار تعریف و به چند کاربر اختصاص دهید. این مجوزها به نقش فعلی اضافه می‌شوند.</p></div><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" />گروه جدید</Button></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data?.groups.map((group) => <Card key={group.id}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base"><span>{group.name}</span><div><Button size="icon" variant="ghost" onClick={() => setEditing(group)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={group.isSystem} onClick={() => remove(group)}><Trash2 className="h-4 w-4 text-rose-500" /></Button></div></CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xs text-muted-foreground min-h-8">{group.description || "بدون توضیح"}</p><div className="flex flex-wrap gap-1">{group.permissions.map((p) => <Badge key={p} variant="secondary">{data.permissions.find((x) => x.key === p)?.label ?? p}</Badge>)}</div><div className="text-xs text-muted-foreground">{group.members.length} عضو: {group.members.slice(0, 3).map((m) => m.member.name).join("، ")}{group.members.length > 3 ? "…" : ""}</div></CardContent></Card>)}</div>
    {data && <AccessGroupDialog key={editing?.id ?? "new"} open={editing !== undefined} group={editing ?? null} permissions={data.permissions} members={membersData?.members ?? []} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); qc.invalidateQueries({ queryKey: ["access-groups"] }); }} />}
  </div>;
}

function AccessGroupDialog({ open, group, permissions, members, onClose, onSaved }: { open: boolean; group: AccessGroup | null; permissions: Permission[]; members: SerializedMember[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = React.useState(group?.name ?? ""); const [description, setDescription] = React.useState(group?.description ?? ""); const [selectedPermissions, setSelectedPermissions] = React.useState<string[]>(group?.permissions ?? []); const [memberIds, setMemberIds] = React.useState<string[]>(group?.members.map((m) => m.member.id) ?? []); const [busy, setBusy] = React.useState(false);
  async function save() { if (name.trim().length < 2) return toast.error("نام گروه حداقل دو حرف باشد."); setBusy(true); try { const r = await fetch(group ? `/api/access-groups/${group.id}` : "/api/access-groups", { method: group ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: description || null, permissions: selectedPermissions, memberIds }) }); const body = await r.json(); if (!r.ok) return toast.error(body.error ?? "ذخیره ناموفق بود."); toast.success("گروه دسترسی ذخیره شد."); onSaved(); } finally { setBusy(false); } }
  const toggle = (list: string[], value: string, setter: (v: string[]) => void) => setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{group ? "ویرایش گروه دسترسی" : "ساخت گروه دسترسی"}</DialogTitle><DialogDescription>مجوزها افزایشی هستند و سطح دسترسی نقش کاربر را کاهش نمی‌دهند.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>نام گروه</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div><div><Label>توضیح</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div><div><Label>مجوزها</Label><div className="grid gap-2 sm:grid-cols-2 mt-2">{permissions.map((p) => <label key={p.key} className="flex items-center gap-2 rounded border p-2 text-sm"><Checkbox checked={selectedPermissions.includes(p.key)} onCheckedChange={() => toggle(selectedPermissions, p.key, setSelectedPermissions)} /><span>{p.label}</span><span className="mr-auto text-[10px] text-muted-foreground">{p.category}</span></label>)}</div></div><div><Label>اعضا</Label><div className="grid gap-2 sm:grid-cols-2 mt-2 max-h-52 overflow-y-auto">{members.map((m) => <label key={m.id} className="flex items-center gap-2 rounded border p-2 text-sm"><Checkbox checked={memberIds.includes(m.id)} onCheckedChange={() => toggle(memberIds, m.id, setMemberIds)} /><span>{m.name}</span><span className="mr-auto text-xs text-muted-foreground" dir="ltr">{m.handle}</span></label>)}</div></div></div><DialogFooter><Button variant="ghost" onClick={onClose}>انصراف</Button><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره"}</Button></DialogFooter></DialogContent></Dialog>;
}
