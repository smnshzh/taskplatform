import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, isHttpError } from "@/lib/auth";
import { PERMISSIONS, PERMISSION_KEYS } from "@/features/access-control/server/permissions";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).nullable().optional(),
  permissions: z.array(z.string()).max(PERMISSIONS.length),
  memberIds: z.array(z.string().min(1)).max(500).default([]),
}).superRefine((value, ctx) => {
  value.permissions.forEach((permission) => {
    if (!PERMISSION_KEYS.has(permission)) ctx.addIssue({ code: "custom", message: `مجوز نامعتبر: ${permission}` });
  });
});

const include = { members: { include: { member: { select: { id: true, name: true, handle: true } } } } } as const;

export async function GET() {
  try {
    await requirePermission("access-group:manage");
    const groups = await db.accessGroup.findMany({ include, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ groups, permissions: PERMISSIONS });
  } catch (error) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission("access-group:manage");
    const parsed = inputSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است." }, { status: 400 });
    const { name, description, permissions, memberIds } = parsed.data;
    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length && await db.member.count({ where: { id: { in: uniqueMemberIds } } }) !== uniqueMemberIds.length) {
      return NextResponse.json({ error: "یک یا چند عضو معتبر نیستند." }, { status: 400 });
    }
    const group = await db.$transaction(async (tx) => {
      const created = await tx.accessGroup.create({ data: { name, description: description || null, permissions: [...new Set(permissions)], members: { create: uniqueMemberIds.map((memberId) => ({ memberId })) } }, include });
      await tx.auditLog.create({ data: { actorId: me.id, action: "ACCESS_GROUP_CREATE", entityType: "AccessGroup", entityId: created.id, result: "SUCCESS", metadata: { permissions, memberIds: uniqueMemberIds } } });
      return created;
    });
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    if (error instanceof Error && error.message.includes("Unique constraint")) return NextResponse.json({ error: "نام گروه تکراری است." }, { status: 409 });
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
