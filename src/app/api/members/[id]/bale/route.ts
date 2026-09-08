import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { getClientIp } from "@/features/auth/server/session";
import { adminBaleChannelSchema } from "@/features/notifications/schemas/admin-bale-channel.schema";
import { BaleProvider } from "@/features/notifications/server/providers/bale.provider";
import { NotificationProviderError } from "@/features/notifications/server/providers/provider-error";

async function authorize(memberId: string) {
  const actor = await getCurrentMember();
  if (!actor) return { error: NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 }) };
  if (!memberHasPermission(actor, "member:update")) return { error: NextResponse.json({ error: "دسترسی مدیریت حساب بله اعضا را ندارید." }, { status: 403 }) };
  const target = await db.member.findUnique({ where: { id: memberId }, select: { id: true, name: true, groupId: true } });
  if (!target) return { error: NextResponse.json({ error: "عضو یافت نشد." }, { status: 404 }) };
  if (actor.role === "MANAGER" && (!target.groupId || !actor.managedGroups.some((item) => item.groupId === target.groupId))) {
    return { error: NextResponse.json({ error: "این عضو در مجموعه تحت مدیریت شما نیست." }, { status: 403 }) };
  }
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "MANAGER") {
    return { error: NextResponse.json({ error: "فقط مدیر یا مدیر کل می‌تواند حساب بله را ثبت کند." }, { status: 403 }) };
  }
  return { actor, target };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error) return auth.error;
  const channel = await db.notificationChannel.findUnique({
    where: { memberId_provider: { memberId: id, provider: "bale" } },
    select: { externalUserId: true, externalChatId: true, isVerified: true, isEnabled: true, updatedAt: true },
  });
  return NextResponse.json({ data: channel });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error || !auth.actor || !auth.target) return auth.error;
  const parsed = adminBaleChannelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "شناسه بله نامعتبر است." }, { status: 400 });
  const recipientId = parsed.data.externalChatId || parsed.data.externalUserId;
  try {
    const result = await new BaleProvider().sendMessage({
      recipientId,
      text: `✅ اتصال حساب بله برای ${auth.target.name} با موفقیت آزمایش شد.`,
      idempotencyKey: `BALE_ADMIN_TEST:${id}:${Date.now()}`,
    });
    const channel = await db.notificationChannel.upsert({
      where: { memberId_provider: { memberId: id, provider: "bale" } },
      create: { memberId: id, provider: "bale", externalUserId: parsed.data.externalUserId, externalChatId: recipientId, isVerified: true, isEnabled: true },
      update: { externalUserId: parsed.data.externalUserId, externalChatId: recipientId, isVerified: true, isEnabled: true },
      select: { id: true, externalUserId: true, externalChatId: true, isVerified: true, isEnabled: true, updatedAt: true },
    });
    await db.auditLog.create({ data: { actorId: auth.actor.id, action: "BALE_CHANNEL_ADMIN_VERIFIED", entityType: "NotificationChannel", entityId: channel.id, result: "SUCCESS", ipAddress: getClientIp(request), metadata: { targetMemberId: id, providerMessageId: result.providerMessageId } } });
    return NextResponse.json({ data: channel });
  } catch (error) {
    const conflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    const providerError = error instanceof NotificationProviderError;
    await db.auditLog.create({ data: { actorId: auth.actor.id, action: "BALE_CHANNEL_ADMIN_VERIFIED", entityType: "Member", entityId: id, result: "FAILURE", ipAddress: getClientIp(request), metadata: { errorCode: conflict ? "DUPLICATE_BALE_ID" : providerError ? error.code : "UNKNOWN" } } }).catch(() => undefined);
    if (conflict) return NextResponse.json({ error: "این شناسه بله قبلاً برای عضو دیگری ثبت شده است." }, { status: 409 });
    if (providerError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.permanent ? 400 : 503 });
    return NextResponse.json({ error: "تست حساب بله ناموفق بود." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(id);
  if (auth.error || !auth.actor) return auth.error;
  const channel = await db.notificationChannel.findUnique({ where: { memberId_provider: { memberId: id, provider: "bale" } }, select: { id: true } });
  if (channel) await db.$transaction([
    db.notificationChannel.update({ where: { id: channel.id }, data: { isVerified: false, isEnabled: false } }),
    db.auditLog.create({ data: { actorId: auth.actor.id, action: "BALE_CHANNEL_ADMIN_UNLINKED", entityType: "NotificationChannel", entityId: channel.id, result: "SUCCESS", ipAddress: getClientIp(request), metadata: { targetMemberId: id } } }),
  ]);
  return NextResponse.json({ data: { disconnected: true } });
}
