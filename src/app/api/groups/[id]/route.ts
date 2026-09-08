import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeGroup, serializeMember } from "@/lib/serialize";
import { isManagerOfGroup, requireAuth, requirePermission, isHttpError } from "@/lib/auth";

// GET /api/groups/[id] — with members
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAuth();
    const { id } = await params;

    if (!isManagerOfGroup(me, id)) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const group = await db.orgGroup.findUnique({
      where: { id },
      include: {
        managers: { include: { member: true }, orderBy: { createdAt: "asc" } },
        members: {
          include: { group: true, supervisor: true, _count: { select: { tasks: true } } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 404 });
    }

    const memberIds = group.members.map((m) => m.id);
    const activeCounts = await db.task.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { in: memberIds }, status: { notIn: ["DONE"] } },
      _count: { assigneeId: true },
    });
    const activeMap: Record<string, number> = {};
    for (const ac of activeCounts) {
      activeMap[ac.assigneeId] = ac._count.assigneeId;
    }

    return NextResponse.json({
      group: serializeGroup(group),
      members: group.members.map((m) => serializeMember(m, activeMap[m.id] ?? 0)),
    });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Group GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/groups/[id] — SUPER_ADMIN only
// Body: { name?, managerIds?: string[] | null }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("group:update");
    const { id } = await params;
    const body = await req.json();
    const { name, managerIds } = body ?? {};

    const existing = await db.orgGroup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();

    // Handle manager updates
    if (managerIds !== undefined) {
      if (managerIds === null || (Array.isArray(managerIds) && managerIds.length === 0)) {
        // Remove all managers
        await db.groupManager.deleteMany({ where: { groupId: id } });
      } else if (Array.isArray(managerIds)) {
        // Validate all manager IDs
        const mgrs = await db.member.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, role: true },
        });
        for (const mid of managerIds) {
          const mgr = mgrs.find((m) => m.id === mid);
          if (!mgr) {
            return NextResponse.json({ error: `عضو "${mid}" یافت نشد.` }, { status: 400 });
          }
          if (mgr.role !== "MANAGER") {
            return NextResponse.json({ error: "فقط کاربران با نقش «مدیر مجموعه» می‌توانند مدیر باشند." }, { status: 400 });
          }
        }

        // Replace all managers in a transaction
        await db.$transaction(async (tx) => {
          await tx.groupManager.deleteMany({ where: { groupId: id } });
          if (managerIds.length > 0) {
            await tx.groupManager.createMany({
              data: managerIds.map((mid: string) => ({ groupId: id, memberId: mid })),
            });
          }
        });
      }
    }

    const updated = await db.orgGroup.update({
      where: { id },
      data,
      include: {
        managers: { include: { member: true }, orderBy: { createdAt: "asc" } },
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
    });

    return NextResponse.json({ group: serializeGroup(updated) });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Group PATCH error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
