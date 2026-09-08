import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeSchedule } from "@/lib/serialize";
import { getCurrentMember, isManagerOfGroup } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// DELETE /api/schedules/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (!memberHasPermission(me, "schedule:delete")) {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند زمان‌بندی را حذف کند." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const schedule = await db.taskSchedule.findUnique({
      where: { id },
      include: { taskTemplate: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "زمان‌بندی یافت نشد." }, { status: 404 });
    }

    // MANAGER can only delete schedules of their group
    if (me.role === "MANAGER" && !isManagerOfGroup(me, schedule.taskTemplate.groupId)) {
      return NextResponse.json(
        { error: "مدیر تنها می‌تواند زمان‌بندی‌های مجموعه خود را حذف کند." },
        { status: 403 }
      );
    }

    await db.taskSchedule.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Schedule DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/schedules/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (!memberHasPermission(me, "schedule:update")) {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند زمان‌بندی را ویرایش کند." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const {
      dayOfWeek,
      specificDate,
      startTime,
      endTime,
      assigneeId,
      overrideAssigneeId,
      overrideDate,
    } = body ?? {};

    const existing = await db.taskSchedule.findUnique({
      where: { id },
      include: { taskTemplate: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "زمان‌بندی یافت نشد." }, { status: 404 });
    }

    // MANAGER can only edit schedules of their group
    if (me.role === "MANAGER" && !isManagerOfGroup(me, existing.taskTemplate.groupId)) {
      return NextResponse.json(
        { error: "مدیر تنها می‌تواند زمان‌بندی‌های مجموعه خود را ویرایش کند." },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek !== null ? Number(dayOfWeek) : null;
    if (specificDate !== undefined) data.specificDate = specificDate ?? null;
    if (startTime !== undefined) data.startTime = String(startTime);
    if (endTime !== undefined) data.endTime = String(endTime);
    if (assigneeId !== undefined) data.assigneeId = assigneeId;
    if (overrideAssigneeId !== undefined) data.overrideAssigneeId = overrideAssigneeId ?? null;
    if (overrideDate !== undefined) data.overrideDate = overrideDate ?? null;

    const updated = await db.taskSchedule.update({
      where: { id },
      data,
      include: {
        taskTemplate: { include: { group: true } },
        assignee: true,
        overrideAssignee: true,
      },
    });

    return NextResponse.json({ schedule: serializeSchedule(updated) });
  } catch (error) {
    console.error("Schedule PATCH error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
