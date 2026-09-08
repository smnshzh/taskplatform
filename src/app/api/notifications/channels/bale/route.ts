import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isHttpError } from "@/lib/auth";
import { getClientIp } from "@/features/auth/server/session";
import { createBaleLinkCode } from "@/features/notifications/server/account-link.service";

export async function GET() {
  try {
    const member = await requireAuth();
    const channel = await db.notificationChannel.findUnique({
      where: { memberId_provider: { memberId: member.id, provider: "bale" } },
      select: { isVerified: true, isEnabled: true, updatedAt: true },
    });
    return NextResponse.json({ data: { connected: Boolean(channel?.isVerified), enabled: Boolean(channel?.isEnabled), updatedAt: channel?.updatedAt ?? null } });
  } catch (error) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "نشست نامعتبر است." } }, { status: 401 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "خطای سرور" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await requireAuth();
    const recent = await db.accountLinkCode.count({ where: { memberId: member.id, provider: "bale", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent >= 5) return NextResponse.json({ error: { code: "RATE_LIMITED", message: "تعداد درخواست کد بیش از حد مجاز است." } }, { status: 429 });
    const result = await createBaleLinkCode(member.id, getClientIp(request));
    await db.auditLog.create({ data: { actorId: member.id, action: "NOTIFICATION_LINK_CODE_CREATED", entityType: "Member", entityId: member.id, result: "SUCCESS", ipAddress: getClientIp(request), metadata: { provider: "bale" } } });
    return NextResponse.json({ data: { code: result.code, expiresAt: result.expiresAt, command: `/link ${result.code}` } }, { status: 201 });
  } catch (error) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "نشست نامعتبر است." } }, { status: 401 });
    const configurationError = error instanceof Error && error.message === "ACCOUNT_LINK_SECRET_NOT_CONFIGURED";
    return NextResponse.json({ error: { code: configurationError ? "NOT_CONFIGURED" : "INTERNAL_ERROR", message: configurationError ? "سرویس اتصال بله پیکربندی نشده است." : "خطای سرور" } }, { status: configurationError ? 503 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const member = await requireAuth();
    const channel = await db.notificationChannel.findUnique({ where: { memberId_provider: { memberId: member.id, provider: "bale" } }, select: { id: true } });
    if (channel) {
      await db.$transaction([
        db.notificationChannel.update({ where: { id: channel.id }, data: { isEnabled: false, isVerified: false } }),
        db.auditLog.create({ data: { actorId: member.id, action: "NOTIFICATION_CHANNEL_UNLINKED", entityType: "NotificationChannel", entityId: channel.id, result: "SUCCESS", ipAddress: getClientIp(request), metadata: { provider: "bale" } } }),
      ]);
    }
    return NextResponse.json({ data: { disconnected: true } });
  } catch (error) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "نشست نامعتبر است." } }, { status: 401 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "خطای سرور" } }, { status: 500 });
  }
}
