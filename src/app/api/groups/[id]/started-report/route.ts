import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isHttpError, isManagerOfGroup, requireAuth } from "@/lib/auth";
import { elapsedDaysSinceStart } from "@/features/tasks/elapsed-days";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id: groupId } = await params;

    if (!isManagerOfGroup(actor, groupId)) {
      return NextResponse.json({ error: "دسترسی به گزارش این مجموعه را ندارید." }, { status: 403 });
    }

    const group = await db.orgGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        members: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            handle: true,
            tasks: {
              where: { status: "STARTED", deletedAt: null },
              orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                code: true,
                title: true,
                priority: true,
                deadline: true,
                startedAt: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 404 });
    }

    const now = new Date();
    return NextResponse.json({
      data: {
        group: { id: group.id, name: group.name },
        members: group.members.map((member) => ({
          id: member.id,
          name: member.name,
          handle: member.handle,
          startedCount: member.tasks.length,
          tasks: member.tasks.map((task) => ({
            ...task,
            deadline: task.deadline.toISOString(),
            startedAt: task.startedAt?.toISOString() ?? null,
            elapsedDays: elapsedDaysSinceStart(task.startedAt, now),
          })),
        })),
      },
    });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    console.error("Group started report GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
