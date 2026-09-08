import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, isHttpError } from "@/lib/auth";
import { PERMISSIONS, PERMISSION_KEYS } from "@/features/access-control/server/permissions";

const schema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).nullable().optional(), permissions: z.array(z.string()).max(PERMISSIONS.length), memberIds: z.array(z.string().min(1)).max(500) });
const include = { members: { include: { member: { select: { id: true, name: true, handle: true } } } } } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requirePermission("access-group:manage");
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || parsed.data.permissions.some((p) => !PERMISSION_KEYS.has(p))) return NextResponse.json({ error: "اطلاعات یا مجوزها نامعتبر است." }, { status: 400 });
    const memberIds = [...new Set(parsed.data.memberIds)];
    if (memberIds.length && await db.member.count({ where: { id: { in: memberIds } } }) !== memberIds.length) return NextResponse.json({ error: "یک یا چند عضو معتبر نیستند." }, { status: 400 });
    const group = await db.$transaction(async (tx) => {
      await tx.accessGroupMember.deleteMany({ where: { accessGroupId: id } });
      const updated = await tx.accessGroup.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description || null, permissions: [...new Set(parsed.data.permissions)], members: { create: memberIds.map((memberId) => ({ memberId })) } }, include });
      await tx.auditLog.create({ data: { actorId: me.id, action: "ACCESS_GROUP_UPDATE", entityType: "AccessGroup", entityId: id, result: "SUCCESS", metadata: { permissions: parsed.data.permissions, memberIds } } });
      return updated;
    });
    return NextResponse.json({ group });
  } catch (error) {
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    return NextResponse.json({ error: "گروه یافت نشد یا نام تکراری است." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requirePermission("access-group:manage");
    const { id } = await params;
    const group = await db.accessGroup.findUnique({ where: { id }, select: { isSystem: true } });
    if (!group) return NextResponse.json({ error: "گروه یافت نشد." }, { status: 404 });
    if (group.isSystem) return NextResponse.json({ error: "گروه سیستمی قابل حذف نیست." }, { status: 409 });
    await db.$transaction([db.accessGroup.delete({ where: { id } }), db.auditLog.create({ data: { actorId: me.id, action: "ACCESS_GROUP_DELETE", entityType: "AccessGroup", entityId: id, result: "SUCCESS" } })]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
