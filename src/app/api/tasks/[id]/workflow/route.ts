import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVisibleMemberIds, isHttpError, requireAuth } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { connectWorkflowTasks, getTaskWorkflow } from "@/features/tasks/server/task-workflow.service";

async function visibleTask(memberId: string, visibleIds: string[], taskId: string) {
  return db.task.findFirst({
    where: { id: taskId, deletedAt: null, OR: [{ assigneeId: { in: visibleIds } }, { creatorId: memberId }] },
    select: { id: true },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth();
    const { id } = await params;
    const visibleIds = await getVisibleMemberIds(me);
    if (!await visibleTask(me.id, visibleIds, id)) return NextResponse.json({ error: "تسک یافت نشد." }, { status: 404 });
    return NextResponse.json({ workflow: await db.$transaction((tx) => getTaskWorkflow(tx, id)) });
  } catch (error) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Task workflow GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth();
    if (!memberHasPermission(me, "task:update")) return NextResponse.json({ error: "دسترسی ویرایش تسک را ندارید." }, { status: 403 });
    const { id } = await params;
    const { nextTaskId } = await req.json();
    if (!nextTaskId) return NextResponse.json({ error: "تسک بعدی انتخاب نشده است." }, { status: 400 });
    const visibleIds = await getVisibleMemberIds(me);
    const [source, target] = await Promise.all([visibleTask(me.id, visibleIds, id), visibleTask(me.id, visibleIds, String(nextTaskId))]);
    if (!source || !target) return NextResponse.json({ error: "یکی از تسک‌ها در دسترس نیست." }, { status: 403 });
    await db.$transaction((tx) => connectWorkflowTasks(tx, { previousTaskId: id, nextTaskId: String(nextTaskId), createdById: me.id }));
    return NextResponse.json({ workflow: await db.$transaction((tx) => getTaskWorkflow(tx, id)) }, { status: 201 });
  } catch (error) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت ارتباط ناموفق بود." }, { status: 400 });
  }
}
