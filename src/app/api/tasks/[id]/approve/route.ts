import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask, serializeLog } from "@/lib/serialize";
import { requireAuth, isHttpError, isManagerOfGroup } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// POST /api/tasks/[id]/approve
// body: { action: "APPROVED" | "REJECTED" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { action } = body ?? {};

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return NextResponse.json(
        { error: "عملیات نامعتبر. فقط APPROVED یا REJECTED مجاز است." },
        { status: 400 }
      );
    }

    if (!memberHasPermission(me, "task:approve-referral")) {
      return NextResponse.json(
        { error: "تنها مدیر یا سرپرست می‌تواند تسک ارجاعی را تأیید/رد کند." },
        { status: 403 }
      );
    }

    const task = await db.task.findUnique({
      where: { id },
      include: { assignee: true, creator: true, group: true, referer: true, approver: true },
    });

    if (!task) {
      return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    }

    if (task.approvalStatus !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "این تسک در وضعیت انتظار تأیید نیست." },
        { status: 400 }
      );
    }

    // SUPERVISOR can only approve tasks of their subordinates
    if (me.role === "SUPERVISOR" && task.assignee.supervisorId !== me.id) {
      return NextResponse.json(
        { error: "سرپرست تنها می‌تواند تسک‌های زیردستان خود را تأیید کند." },
        { status: 403 }
      );
    }

    // MANAGER can only approve tasks in their managed groups
    if (me.role === "MANAGER" && !isManagerOfGroup(me, task.groupId)) {
      return NextResponse.json(
        { error: "مدیر تنها می‌تواند تسک‌های مجموعه خود را تأیید کند." },
        { status: 403 }
      );
    }

    const updated = await db.task.update({
      where: { id },
      data: {
        approvalStatus: action,
        approverId: me.id,
        approvedAt: new Date(),
      },
      include: { assignee: true, creator: true, group: true, referer: true, approver: true },
    });

    const actionLabel = action === "APPROVED" ? "تأیید" : "رد";

    await db.followUpLog.create({
      data: {
        taskId: id,
        type: "APPROVAL",
        message: `${me.name} تسک ارجاعی را ${actionLabel} کرد.`,
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
    console.error("Task approve error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
