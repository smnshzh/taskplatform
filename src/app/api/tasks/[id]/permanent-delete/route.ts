import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isManagerOfGroup } from "@/lib/auth";
import { isHttpError } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// DELETE /api/tasks/[id]/permanent-delete — Permanently delete a trashed task
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    if (!memberHasPermission(me, "task:delete-permanently")) {
      return NextResponse.json(
        { error: "تنها مدیر یا مدیر کل می‌تواند تسک را به‌صورت دائم حذف کند." },
        { status: 403 }
      );
    }

    const task = await db.task.findUnique({ where: { id } });
    if (!task || !task.deletedAt) {
      return NextResponse.json({ error: "تسک در سطل زباله یافت نشد یا حذف‌نشده است." }, { status: 404 });
    }

    // MANAGER can only permanently delete tasks from their group
    if (me.role === "MANAGER") {
      if (!isManagerOfGroup(me, task.groupId)) {
        return NextResponse.json(
          { error: "شما تنها می‌توانید تسک‌های مجموعه خود را حذف کنید." },
          { status: 403 }
        );
      }
    }

    // Delete logs first (cascade would handle this, but explicit for safety)
    await db.followUpLog.deleteMany({ where: { taskId: id } });
    // Hard delete the task
    await db.task.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Task permanent delete error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
