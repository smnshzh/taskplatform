import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeGroup } from "@/lib/serialize";
import { getCurrentMember, getManagedGroupIds, requireRole, requirePermission, isHttpError } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// GET /api/groups — SUPER_ADMIN and MANAGER can access
export async function GET(req: NextRequest) {
  try {
    const assignmentScope = req.nextUrl.searchParams.get("scope") === "task-assignees";
    if (assignmentScope) {
      const me = await getCurrentMember();
      if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
      if (!memberHasPermission(me, "task:create")) {
        return NextResponse.json({ error: "دسترسی ایجاد تسک را ندارید." }, { status: 403 });
      }
    } else {
      await requireRole("SUPER_ADMIN", "MANAGER");
    }

    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    const visibleGroupIds = me.role === "MANAGER"
      ? getManagedGroupIds(me)
      : assignmentScope && me.groupId
        ? [me.groupId]
        : [];
    const where = me.role === "SUPER_ADMIN"
      ? undefined
      : { id: { in: visibleGroupIds } };

    const groups = await db.orgGroup.findMany({
      where,
      include: {
        managers: { include: { member: true }, orderBy: { createdAt: "asc" } },
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ groups: groups.map(serializeGroup) });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Groups GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/groups — SUPER_ADMIN only
// Body: { name, code, managerIds?: string[] }
export async function POST(req: NextRequest) {
  try {
    await requirePermission("group:create");
    const body = await req.json();
    const { name, code, managerIds } = body ?? {};

    if (!name || !code) {
      return NextResponse.json({ error: "نام و کد مجموعه الزامی است." }, { status: 400 });
    }

    const existing = await db.orgGroup.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "این کد مجموعه قبلاً ثبت شده است." }, { status: 400 });
    }

    // Validate manager IDs if provided
    const validManagerIds: string[] = [];
    if (Array.isArray(managerIds) && managerIds.length > 0) {
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
        validManagerIds.push(mid);
      }
    }

    const group = await db.orgGroup.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim(),
        managers: validManagerIds.length > 0 ? {
          create: validManagerIds.map((mid) => ({ memberId: mid })),
        } : undefined,
      },
      include: {
        managers: { include: { member: true }, orderBy: { createdAt: "asc" } },
        _count: { select: { members: true, taskTemplates: true, tasks: true } },
      },
    });

    return NextResponse.json({ group: serializeGroup(group) }, { status: 201 });
  } catch (error: unknown) {
    if (isHttpError(error, 401)) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (isHttpError(error, 403)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    console.error("Groups POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
