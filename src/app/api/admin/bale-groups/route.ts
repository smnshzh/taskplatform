import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

const groupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  chatId: z.string().trim().min(2).max(128).regex(/^-?[A-Za-z0-9_:@.+]+$/, "شناسه گروه بله معتبر نیست."),
  orgGroupId: z.string().cuid().nullable().optional(),
  isEnabled: z.boolean().optional(),
});

async function authorize() {
  const member = await getCurrentMember();
  return member && memberHasPermission(member, "panel:admin") ? member : null;
}

export async function GET() {
  const member = await authorize();
  if (!member) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const [destinations, orgGroups] = await Promise.all([
    db.baleGroupDestination.findMany({ include: { orgGroup: { select: { id: true, name: true } }, _count: { select: { rules: true } } }, orderBy: { createdAt: "desc" } }),
    db.orgGroup.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ destinations, orgGroups });
}

export async function POST(request: NextRequest) {
  const member = await authorize();
  if (!member) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const parsed = groupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "اطلاعات گروه بله نامعتبر است." }, { status: 400 });
  const destination = await db.baleGroupDestination.create({ data: { ...parsed.data, createdById: member.id } });
  await db.auditLog.create({ data: { actorId: member.id, action: "BALE_GROUP_DESTINATION_CREATED", entityType: "BaleGroupDestination", entityId: destination.id, result: "SUCCESS", metadata: { name: destination.name } } });
  return NextResponse.json({ destination }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const member = await authorize();
  if (!member) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const parsed = groupSchema.partial().safeParse(body);
  if (!body.id || !parsed.success) return NextResponse.json({ error: "اطلاعات گروه بله نامعتبر است." }, { status: 400 });
  const destination = await db.baleGroupDestination.update({ where: { id: String(body.id) }, data: parsed.data });
  await db.auditLog.create({ data: { actorId: member.id, action: "BALE_GROUP_DESTINATION_UPDATED", entityType: "BaleGroupDestination", entityId: destination.id, result: "SUCCESS" } });
  return NextResponse.json({ destination });
}

export async function DELETE(request: NextRequest) {
  const member = await authorize();
  if (!member) return NextResponse.json({ error: "دسترسی مدیریت سیستم را ندارید." }, { status: 403 });
  const id = String((await request.json().catch(() => ({}))).id ?? "");
  if (!id) return NextResponse.json({ error: "گروه مقصد نامعتبر است." }, { status: 400 });
  const used = await db.notificationRule.count({ where: { baleGroupDestinationId: id } });
  if (used) return NextResponse.json({ error: "این گروه در زمان‌بندی اعلان استفاده می‌شود؛ ابتدا زمان‌بندی‌های وابسته را حذف کنید." }, { status: 409 });
  await db.baleGroupDestination.delete({ where: { id } });
  await db.auditLog.create({ data: { actorId: member.id, action: "BALE_GROUP_DESTINATION_DELETED", entityType: "BaleGroupDestination", entityId: id, result: "SUCCESS" } });
  return NextResponse.json({ ok: true });
}
