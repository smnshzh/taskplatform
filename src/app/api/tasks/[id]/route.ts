import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask, serializeLog } from "@/lib/serialize";
import { STATUSES, PRIORITIES, FOLLOW_UP_REASONS } from "@/lib/constants";
import { requireAuth, getVisibleMemberIds, isHttpError, isManagerOfGroup } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { enqueueReadyWorkflowSuccessors, enqueueTaskStatusChangedForManagers } from "@/features/notifications/server/notification.events";
import { connectWorkflowTasks, ensureWorkflowTaskReady } from "@/features/tasks/server/task-workflow.service";

// GET /api/tasks/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    const task = await db.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        creator: true,
        group: true,
        referer: true,
        approver: true,
        logs: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!task || task.deletedAt) {
      return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    }

    // Check visibility
    const visibleIds = await getVisibleMemberIds(me);
    if (!visibleIds.includes(task.assigneeId) && task.creatorId !== me.id) {
      return NextResponse.json(
        { error: "شما به این تسک دسترسی ندارید." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      task: serializeTask(task),
      logs: task.logs.map(serializeLog),
    });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    if (error instanceof Error && error.message.includes("مرحله قبلی گردش‌کار")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Task GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/tasks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    if (!memberHasPermission(me, "task:update")) return NextResponse.json({ error: "دسترسی ویرایش تسک را ندارید." }, { status: 403 });
    const { id } = await params;
    const body = await req.json();

    const {
      status,
      followUpReason,
      assigneeId,
      title,
      description,
      priority,
      deadline,
      link,
      doneDescription,
      nextTaskId,
    } = body ?? {};

    // Lean select — only fields needed for business logic (no relation joins)
    const existing = await db.task.findUnique({
      where: { id },
      select: {
        assigneeId: true,
        groupId: true,
        status: true,
        startedAt: true,
        doneAt: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    }

    // Check visibility
    const visibleIds = await getVisibleMemberIds(me);
    if (!visibleIds.includes(existing.assigneeId)) {
      return NextResponse.json(
        { error: "شما به این تسک دسترسی ندارید." },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};

    // Status change
    if (status && STATUSES.some((s) => s.key === status)) {
      data.status = status;
      if (status === "STARTED" && !existing.startedAt) {
        data.startedAt = new Date();
      }
      if (status === "DONE" && !existing.doneAt) {
        data.doneAt = new Date();
      }
      if (status !== "BLOCKED") {
        data.followUpReason = null;
      }
    }

    // Follow-up reason (only when BLOCKED)
    if (followUpReason && FOLLOW_UP_REASONS.some((r) => r.key === followUpReason)) {
      data.followUpReason = followUpReason;
      data.status = "BLOCKED";
    }

    // Assignee change (only MANAGER or SUPERVISOR)
    let newAssigneeName: string | null = null;
    let oldAssigneeName: string | null = null;
    if (assigneeId && assigneeId !== existing.assigneeId) {
      if (me.role !== "MANAGER" && me.role !== "SUPERVISOR" && me.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "تنها مدیر، سرپرست یا مدیر کل می‌تواند مسئول را تغییر دهد." },
          { status: 403 }
        );
      }
      // Fetch both old and new assignee names in a single batch query
      const [newAssignee, oldAssignee] = await db.member.findMany({
        where: { id: { in: [assigneeId, existing.assigneeId] } },
        select: { id: true, name: true },
      }).then((members) => {
        const byId = new Map(members.map((m) => [m.id, m.name]));
        return [byId.get(assigneeId), byId.get(existing.assigneeId)];
      });
      if (!newAssignee) {
        return NextResponse.json({ error: "مسئول جدید یافت نشد." }, { status: 400 });
      }
      newAssigneeName = newAssignee;
      oldAssigneeName = oldAssignee ?? "نامشخص";
      data.assigneeId = assigneeId;
    }

    // Other editable fields
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = description ?? null;
    if (priority !== undefined && PRIORITIES.some((p) => p.key === priority)) {
      data.priority = priority;
    }
    if (deadline !== undefined) data.deadline = new Date(deadline);
    if (link !== undefined) data.link = link ?? null;
    if (doneDescription !== undefined) data.doneDescription = doneDescription ? String(doneDescription).trim() : null;

    const updated = await db.$transaction(async (tx) => {
      if (status === "STARTED") await ensureWorkflowTaskReady(tx, id);
      if (nextTaskId) {
        await connectWorkflowTasks(tx, {
          previousTaskId: id,
          nextTaskId: String(nextTaskId),
          createdById: me.id,
        });
      }
      return tx.task.update({
        where: { id },
        data,
        include: { assignee: true, creator: true, group: true, referer: true, approver: true },
      });
    });

    // Log status changes
    if (status && status !== existing.status) {
      const statusLabel = STATUSES.find((s) => s.key === status)?.label ?? status;
      await db.followUpLog.create({
        data: {
          taskId: id,
          type: "STATUS_CHANGE",
          message: `${me.name} وضعیت را به «${statusLabel}» تغییر داد.`,
        },
      });
      if (status === "STARTED" || status === "DONE") {
        await db.$transaction((tx) => enqueueTaskStatusChangedForManagers(tx, {
          taskId: updated.id,
          taskCode: updated.code,
          title: updated.title,
          groupId: existing.groupId,
          assigneeName: updated.assignee.name,
          status,
          changedAt: updated.updatedAt,
        }));
        if (status === "DONE") {
          await db.$transaction((tx) => enqueueReadyWorkflowSuccessors(tx, { completedTaskId: id, changedAt: updated.updatedAt }));
        }
      }
    }

    // Log follow-up reason
    if (followUpReason) {
      const reasonLabel =
        FOLLOW_UP_REASONS.find((r) => r.key === followUpReason)?.label ?? followUpReason;
      await db.followUpLog.create({
        data: {
          taskId: id,
          type: "NOTE",
          message: `${me.name} علت مسدودی را ثبت کرد: ${reasonLabel}`,
          reason: followUpReason,
        },
      });
    }

    // Log assignee change
    if (assigneeId && assigneeId !== existing.assigneeId && newAssigneeName) {
      await db.followUpLog.create({
        data: {
          taskId: id,
          type: "NOTE",
          message: `${me.name} مسئول را از ${oldAssigneeName} به ${newAssigneeName} تغییر داد.`,
        },
      });
    }

    if (nextTaskId) {
      await db.followUpLog.create({
        data: { taskId: id, type: "NOTE", message: `${me.name} این تسک را به مرحله بعدی گردش‌کار متصل کرد.` },
      });
    }

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
    console.error("Task PATCH error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] — Soft delete (move to trash), MANAGER+ only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    if (!memberHasPermission(me, "task:delete")) {
      return NextResponse.json(
        { error: "تنها مدیر یا مدیر کل می‌تواند تسک را حذف کند." },
        { status: 403 }
      );
    }

    const task = await db.task.findUnique({ where: { id } });
    if (!task || task.deletedAt) {
      return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    }

    // MANAGER can only delete tasks from their group
    if (me.role === "MANAGER") {
      if (!isManagerOfGroup(me, task.groupId)) {
        return NextResponse.json(
          { error: "شما تنها می‌توانید تسک‌های مجموعه خود را حذف کنید." },
          { status: 403 }
        );
      }
    }

    await db.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Task DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
