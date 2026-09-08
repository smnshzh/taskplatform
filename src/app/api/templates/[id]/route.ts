import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTaskTemplate } from "@/lib/serialize";
import { PRIORITIES } from "@/lib/constants";
import { getCurrentMember, isManagerOfGroup } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// GET /api/templates/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { id } = await params;

    const template = await db.taskTemplate.findUnique({
      where: { id },
      include: {
        group: true,
        _count: { select: { schedules: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "الگو یافت نشد." }, { status: 404 });
    }

    // Non-admin can only see their group's templates
    if (me.role !== "SUPER_ADMIN" && template.groupId !== me.groupId && !isManagerOfGroup(me, template.groupId)) {
      return NextResponse.json(
        { error: "شما به این الگو دسترسی ندارید." },
        { status: 403 }
      );
    }

    return NextResponse.json({ template: serializeTaskTemplate(template) });
  } catch (error) {
    console.error("Template GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/templates/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, priority } = body ?? {};

    const existing = await db.taskTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "الگو یافت نشد." }, { status: 404 });
    }

    // Only SUPER_ADMIN and MANAGER (own group) can update
    if (!memberHasPermission(me, "template:update")) {
      return NextResponse.json(
        { error: "شما مجاز به ویرایش الگو نیستید." },
        { status: 403 }
      );
    }

    if (me.role === "MANAGER" && !isManagerOfGroup(me, existing.groupId)) {
      return NextResponse.json(
        { error: "مدیر تنها می‌تواند الگوهای مجموعه خود را ویرایش کند." },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (description !== undefined) data.description = description ?? null;
    if (priority !== undefined && PRIORITIES.some((p) => p.key === priority)) {
      data.priority = priority;
    }

    const updated = await db.taskTemplate.update({
      where: { id },
      data,
      include: {
        group: true,
        _count: { select: { schedules: true } },
      },
    });

    return NextResponse.json({ template: serializeTaskTemplate(updated) });
  } catch (error) {
    console.error("Template PATCH error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// DELETE /api/templates/[id] — cascades to schedules
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.taskTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "الگو یافت نشد." }, { status: 404 });
    }

    // Only SUPER_ADMIN and MANAGER (own group) can delete
    if (!memberHasPermission(me, "template:delete")) {
      return NextResponse.json(
        { error: "شما مجاز به حذف الگو نیستید." },
        { status: 403 }
      );
    }

    if (me.role === "MANAGER" && !isManagerOfGroup(me, existing.groupId)) {
      return NextResponse.json(
        { error: "مدیر تنها می‌تواند الگوهای مجموعه خود را حذف کند." },
        { status: 403 }
      );
    }

    // Delete associated schedules first, then the template
    await db.taskSchedule.deleteMany({ where: { taskTemplateId: id } });
    await db.taskTemplate.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Template DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
