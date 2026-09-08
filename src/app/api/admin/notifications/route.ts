import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { hasDatabaseBaleToken, setBaleBotToken } from "@/features/notifications/server/system-settings.service";

async function authorize() {
  const me = await getCurrentMember();
  return me && memberHasPermission(me, "panel:admin") ? me : null;
}

const ruleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  eventType: z.enum(["OVERDUE", "TODAY", "DUE_SOON", "WORKFLOW_OPEN", "WORKFLOW_CLOSED", "GROUP_STARTED_REPORT", "GROUP_OVERDUE_REPORT"]),
  leadMinutes: z.number().int().min(1).max(525600).nullable().optional(),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  recipientMode: z.enum(["ASSIGNEE", "MANAGERS", "BOTH", "BALE_GROUP"]),
  baleGroupDestinationId: z.string().cuid().nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export async function GET() {
  const me = await authorize();
  if (!me) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const [rules, logs, outboxCounts, databaseTokenConfigured] = await Promise.all([
    db.notificationRule.findMany({ include: { baleGroupDestination: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    db.notificationLog.findMany({
      where: { provider: "bale" },
      select: { id: true, eventType: true, status: true, recipientId: true, providerMessageId: true, errorCode: true, errorMessage: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.notificationOutbox.groupBy({ where: { provider: "bale" }, by: ["status"], _count: { _all: true } }),
    hasDatabaseBaleToken(),
  ]);
  return NextResponse.json({
    tokenConfigured: databaseTokenConfigured || Boolean(process.env.BALE_BOT_TOKEN?.trim()),
    tokenSource: databaseTokenConfigured ? "system" : "environment",
    rules,
    logs,
    outboxCounts: Object.fromEntries(outboxCounts.map((item) => [item.status, item._count._all])),
  });
}

export async function PUT(request: NextRequest) {
  const me = await authorize();
  if (!me) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const token = String((await request.json().catch(() => ({}))).token ?? "").trim();
  if (token.length < 20 || token.length > 256) return NextResponse.json({ error: "توکن بله معتبر نیست." }, { status: 400 });
  const apiBase = (process.env.BALE_API_BASE_URL?.trim() || "https://tapi.bale.ai").replace(/\/$/, "");
  const probe = await fetch(`${apiBase}/bot${token}/getMe`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const body = probe ? await probe.json().catch(() => ({})) as { ok?: boolean; description?: string } : {};
  if (!probe?.ok || body.ok === false) return NextResponse.json({ error: body.description || "آزمایش توکن بله ناموفق بود." }, { status: 400 });
  await setBaleBotToken(token, me.id);
  await db.auditLog.create({ data: { actorId: me.id, action: "BALE_BOT_TOKEN_UPDATED", entityType: "SystemSetting", entityId: "BALE_BOT_TOKEN", result: "SUCCESS" } });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const me = await authorize();
  if (!me) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const parsed = ruleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "تنظیمات اعلان نامعتبر است." }, { status: 400 });
  if (parsed.data.eventType === "DUE_SOON" && !parsed.data.leadMinutes) return NextResponse.json({ error: "فاصله یادآوری تا موعد را مشخص کنید." }, { status: 400 });
  if (parsed.data.eventType !== "DUE_SOON" && !parsed.data.sendTime) return NextResponse.json({ error: "ساعت ارسال را مشخص کنید." }, { status: 400 });
  if (parsed.data.recipientMode === "BALE_GROUP" && !parsed.data.baleGroupDestinationId) return NextResponse.json({ error: "گروه مقصد بله را انتخاب کنید." }, { status: 400 });
  if (["WORKFLOW_OPEN", "WORKFLOW_CLOSED", "GROUP_STARTED_REPORT", "GROUP_OVERDUE_REPORT"].includes(parsed.data.eventType) && parsed.data.recipientMode !== "BALE_GROUP") return NextResponse.json({ error: "این گزارش فقط برای مقصد گروهی بله قابل تعریف است." }, { status: 400 });
  const rule = await db.notificationRule.create({ data: { ...parsed.data, createdById: me.id } });
  await db.auditLog.create({ data: { actorId: me.id, action: "NOTIFICATION_RULE_CREATED", entityType: "NotificationRule", entityId: rule.id, result: "SUCCESS" } });
  return NextResponse.json({ rule }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const me = await authorize();
  if (!me) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const parsed = ruleSchema.partial().safeParse(body);
  if (!body.id || !parsed.success) return NextResponse.json({ error: "قاعده اعلان نامعتبر است." }, { status: 400 });
  const rule = await db.notificationRule.update({ where: { id: String(body.id) }, data: parsed.data });
  await db.auditLog.create({ data: { actorId: me.id, action: "NOTIFICATION_RULE_UPDATED", entityType: "NotificationRule", entityId: rule.id, result: "SUCCESS" } });
  return NextResponse.json({ rule });
}

export async function DELETE(request: NextRequest) {
  const me = await authorize();
  if (!me) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const id = String((await request.json().catch(() => ({}))).id ?? "");
  if (!id) return NextResponse.json({ error: "قاعده نامعتبر است." }, { status: 400 });
  await db.notificationRule.delete({ where: { id } });
  await db.auditLog.create({ data: { actorId: me.id, action: "NOTIFICATION_RULE_DELETED", entityType: "NotificationRule", entityId: id, result: "SUCCESS" } });
  return NextResponse.json({ ok: true });
}
