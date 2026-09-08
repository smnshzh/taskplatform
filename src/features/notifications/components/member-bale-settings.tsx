"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, Send, Unlink } from "lucide-react";
import { toast } from "sonner";

type Channel = { externalUserId: string; externalChatId: string | null; isVerified: boolean; isEnabled: boolean };

export function MemberBaleSettings({ memberId }: { memberId: string }) {
  const [userId, setUserId] = React.useState<string | null>(null);
  const [chatId, setChatId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const query = useQuery({
    queryKey: ["member-bale", memberId],
    queryFn: async () => {
      const response = await fetch(`/api/members/${memberId}/bale`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "دریافت حساب بله ناموفق بود.");
      return result.data as Channel | null;
    },
  });

  const effectiveUserId = userId ?? query.data?.externalUserId ?? "";
  const effectiveChatId = chatId ?? query.data?.externalChatId ?? "";

  async function testAndSave() {
    if (!effectiveUserId.trim()) return toast.error("UUID یا شناسه کاربر بله را وارد کنید.");
    setBusy(true);
    try {
      const response = await fetch(`/api/members/${memberId}/bale`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalUserId: effectiveUserId.trim(), externalChatId: effectiveChatId.trim() || undefined }),
      });
      const result = await response.json();
      if (!response.ok) return toast.error(result.error || "شناسه بله تأیید نشد.");
      toast.success("پیام تست ارسال و حساب بله تأیید شد.");
      await query.refetch();
    } catch { toast.error("خطا در ارتباط با سرور."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch(`/api/members/${memberId}/bale`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) return toast.error(result.error || "قطع اتصال ناموفق بود.");
      setUserId(""); setChatId("");
      toast.success("اتصال بله غیرفعال شد.");
      await query.refetch();
    } catch { toast.error("خطا در ارتباط با سرور."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> حساب بله</Label>
        <Badge variant={query.data?.isVerified && query.data?.isEnabled ? "default" : "secondary"}>
          {query.data?.isVerified && query.data?.isEnabled ? "تأییدشده" : "تأییدنشده"}
        </Badge>
      </div>
      {query.isError && <p className="text-xs text-destructive">{query.error.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="bale-user-id" className="text-xs">UUID / شناسه کاربر</Label><Input id="bale-user-id" value={effectiveUserId} onChange={(e) => setUserId(e.target.value)} dir="ltr" className="text-left" placeholder="شناسه عددی یا UUID" /></div>
        <div className="space-y-1"><Label htmlFor="bale-chat-id" className="text-xs">Chat ID (اختیاری)</Label><Input id="bale-chat-id" value={effectiveChatId} onChange={(e) => setChatId(e.target.value)} dir="ltr" className="text-left" placeholder="در صورت خالی، همان شناسه" /></div>
      </div>
      <p className="text-[11px] text-muted-foreground">ذخیره فقط پس از ارسال موفق پیام تست انجام می‌شود. شماره تلفن به‌تنهایی قابل بررسی نیست.</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={testAndSave} disabled={busy || query.isLoading} className="gap-1.5">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} تست و ذخیره</Button>
        {query.data && <Button type="button" size="sm" variant="outline" onClick={disconnect} disabled={busy} className="gap-1.5"><Unlink className="h-3.5 w-3.5" /> قطع اتصال</Button>}
      </div>
    </div>
  );
}
