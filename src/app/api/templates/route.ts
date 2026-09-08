import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTaskTemplate } from "@/lib/serialize";
import { PRIORITIES } from "@/lib/constants";
import { getCurrentMember, isManagerOfGroup, getManagedGroupIds } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// GET /api/templates — filtered by group if not SUPER_ADMIN
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    // Support ?groupId=... query param for explicit group filtering
    const { searchParams } = new URL(req.url);
    const queryGroupId = searchParams.get("groupId");

    const where: Record<string, unknown> = {};
    if (queryGroupId) {
      where.groupId = queryGroupId;
    } else if (me.role !== "SUPER_ADMIN") {
      if (me.role === "MANAGER") {
        const ids = getManagedGroupIds(me);
        if (ids.length > 0) where.groupId = { in: ids };
        else where.groupId = "__none__"; // return empty
      } else {
        where.groupId = me.groupId;
      }
    }

    const templates = await db.taskTemplate.findMany({
      where,
      include: {
        group: true,
        _count: { select: { schedules: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      templates: templates.map(serializeTaskTemplate),
    });
  } catch (error) {
    console.error("Templates GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/templates
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    // Only SUPER_ADMIN, MANAGER, SUPERVISOR can create templates
    if (!memberHasPermission(me, "template:create")) {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند الگو ایجاد کند." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description, groupId, priority } = body ?? {};

    if (!name || !groupId) {
      return NextResponse.json(
        { error: "نام و مجموعه الگو الزامی است." },
        { status: 400 }
      );
    }

    // Validate priority
    const templatePriority = priority || "MEDIUM";
    if (!PRIORITIES.some((p) => p.key === templatePriority)) {
      return NextResponse.json({ error: "اولویت نامعتبر است." }, { status: 400 });
    }

    // MANAGER can only create for their managed groups
    if (me.role === "MANAGER" && !isManagerOfGroup(me, groupId)) {
      return NextResponse.json(
        { error: "مدیر تنها می‌تواند برای مجموعه خود الگو ایجاد کند." },
        { status: 403 }
      );
    }

    // Validate group exists
    const group = await db.orgGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 400 });
    }

    const template = await db.taskTemplate.create({
      data: {
        name: String(name).trim(),
        description: description ?? null,
        groupId,
        priority: templatePriority,
      },
      include: {
        group: true,
        _count: { select: { schedules: true } },
      },
    });

    return NextResponse.json(
      { template: serializeTaskTemplate(template) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Templates POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
