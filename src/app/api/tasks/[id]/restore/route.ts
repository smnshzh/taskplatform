import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask, serializeLog } from "@/lib/serialize";
import { requireAuth, getVisibleMemberIds, isManagerOfGroup } from "@/lib/auth";
import { isHttpError } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// PATCH /api/tasks/[id]/restore — Restore soft-deleted task from trash
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    if (!memberHasPermission(me, "task:restore")) {
      return NextResponse.json(
        { error: "تنها مدیر یا مدیر کل می‌تواند تسک را بازیابی کند." },
        { status: 403 }
      );
    }

    const task = await db.task.findUnique({ where: { id } });
    if (!task || !task.deletedAt) {
      return NextResponse.json({ error: "تسک در سطل زباله یافت نشد." }, { status: 404 });
    }

    // MANAGER can only restore tasks from their group
    if (me.role === "MANAGER") {
      if (!isManagerOfGroup(me, task.groupId)) {
        return NextResponse.json(
          { error: "شما تنها می‌توانید تسک‌های مجموعه خود را بازیابی کنید." },
          { status: 403 }
        );
      }
    }

    const updated = await db.task.update({
      where: { id },
      data: { deletedAt: null },
      include: { assignee: true, creator: true, group: true, referer: true, approver: true },
    });

    await db.followUpLog.create({
      data: {
        taskId: id,
        type: "NOTE",
        message: `${me.name} تسک را از سطل زباله بازیابی کرد.`,
      },
    });

    const logs = await db.followUpLog.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({
      task: serializeTask(updated),
      logs: logs.map(serializeLog),
    });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Task restore error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
