import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember, isHttpError } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { connectWorkflowTasks } from "@/features/tasks/server/task-workflow.service";

const taskSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  startedAt: true,
  groupId: true,
  group: { select: { name: true } },
  assignee: { select: { name: true } },
} as const;

export async function GET() {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    const relations = await db.taskRelation.findMany({
      where: {
        previousTask: { deletedAt: null },
        nextTask: { deletedAt: null },
      },
      include: { previousTask: { select: taskSelect }, nextTask: { select: taskSelect } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      relations: relations.map((relation) => ({
        id: relation.id,
        workflowName: relation.workflowName,
        previous: { ...relation.previousTask, groupName: relation.previousTask.group.name, assigneeName: relation.previousTask.assignee.name },
        next: { ...relation.nextTask, groupName: relation.nextTask.group.name, assigneeName: relation.nextTask.assignee.name },
      })),
    });
  } catch (error) {
    console.error("Workflows GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (!memberHasPermission(me, "task:update")) return NextResponse.json({ error: "دسترسی ویرایش تسک را ندارید." }, { status: 403 });
    const { previousTaskId, nextTaskId, workflowName } = await req.json();
    if (!previousTaskId || !nextTaskId) return NextResponse.json({ error: "هر دو مرحله را انتخاب کنید." }, { status: 400 });
    const allowed = await db.task.count({
      where: { id: { in: [String(previousTaskId), String(nextTaskId)] }, deletedAt: null },
    });
    if (allowed !== 2) return NextResponse.json({ error: "یکی از تسک‌ها در دسترس شما نیست." }, { status: 403 });
    const normalizedName = workflowName ? String(workflowName).replace(/\s+/g, " ").trim().slice(0, 100) : null;
    await db.$transaction((tx) => connectWorkflowTasks(tx, { previousTaskId: String(previousTaskId), nextTaskId: String(nextTaskId), createdById: me.id, workflowName: normalizedName }));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت ارتباط ناموفق بود." }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (!memberHasPermission(me, "task:update")) return NextResponse.json({ error: "دسترسی ویرایش گردش‌کار را ندارید." }, { status: 403 });
    const { relationIds, workflowName } = await req.json();
    if (!Array.isArray(relationIds) || !relationIds.length) return NextResponse.json({ error: "گردش‌کار معتبر نیست." }, { status: 400 });
    const normalizedName = String(workflowName ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
    if (!normalizedName) return NextResponse.json({ error: "نام گردش‌کار را وارد کنید." }, { status: 400 });
    await db.taskRelation.updateMany({ where: { id: { in: relationIds.map(String) } }, data: { workflowName: normalizedName } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ثبت نام گردش‌کار ناموفق بود." }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (!memberHasPermission(me, "task:update")) return NextResponse.json({ error: "دسترسی ویرایش مراحل گردش‌کار را ندارید." }, { status: 403 });
    const { relationId, previousTaskId, nextTaskId } = await req.json();
    if (!relationId || !previousTaskId || !nextTaskId) return NextResponse.json({ error: "مرحله قبلی و بعدی را انتخاب کنید." }, { status: 400 });
    await db.$transaction(async (tx) => {
      const current = await tx.taskRelation.findUnique({ where: { id: String(relationId) } });
      if (!current) throw new Error("ارتباط مرحله‌ای پیدا نشد.");
      await tx.taskRelation.delete({ where: { id: current.id } });
      await connectWorkflowTasks(tx, {
        previousTaskId: String(previousTaskId),
        nextTaskId: String(nextTaskId),
        createdById: me.id,
        workflowName: current.workflowName,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ویرایش مرحله ناموفق بود." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (!memberHasPermission(me, "task:update")) return NextResponse.json({ error: "دسترسی حذف گردش‌کار را ندارید." }, { status: 403 });
    const { relationIds } = await req.json();
    if (!Array.isArray(relationIds) || !relationIds.length) return NextResponse.json({ error: "گردش‌کار معتبر نیست." }, { status: 400 });
    const ids = [...new Set(relationIds.map(String))];
    const result = await db.taskRelation.deleteMany({ where: { id: { in: ids } } });
    if (!result.count) return NextResponse.json({ error: "گردش‌کار پیدا نشد." }, { status: 404 });
    return NextResponse.json({ ok: true, deletedRelations: result.count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "حذف گردش‌کار ناموفق بود." }, { status: 400 });
  }
}
