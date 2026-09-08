import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeMember } from "@/lib/serialize";
import { ROLES } from "@/lib/constants";
import { getCurrentMember, getVisibleMemberIds, canManage, getManagedGroupIds, isManagerOfGroup } from "@/lib/auth";
import { hashPassword } from "@/features/auth/server/password";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// GET /api/members — role-scoped listing
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const assignmentScope = req.nextUrl.searchParams.get("scope") === "task-assignees";
    let members;
    if (assignmentScope) {
      if (!memberHasPermission(me, "task:create")) {
        return NextResponse.json({ error: "دسترسی ایجاد تسک را ندارید." }, { status: 403 });
      }
      members = await db.member.findMany({
        where: { isActive: true },
        include: {
          group: true,
          supervisor: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { name: "asc" },
      });
    } else if (me.role === "SUPER_ADMIN") {
      members = await db.member.findMany({
        include: {
          group: true,
          supervisor: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    } else if (me.role === "MANAGER") {
      const ids = getManagedGroupIds(me);
      members = await db.member.findMany({
        where: ids.length > 0 ? { groupId: { in: ids } } : { id: "__none__" },
        include: {
          group: true,
          supervisor: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    } else {
      // SUPERVISOR sees self + subordinates
      const visibleIds = await getVisibleMemberIds(me);
      members = await db.member.findMany({
        where: { id: { in: visibleIds } },
        include: {
          group: true,
          supervisor: true,
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    // Count active (non-done) tasks per member
    const memberIds = members.map((m) => m.id);
    const activeCounts = await db.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: memberIds },
        status: { notIn: ["DONE"] },
      },
      _count: { assigneeId: true },
    });
    const activeMap: Record<string, number> = {};
    for (const ac of activeCounts) {
      activeMap[ac.assigneeId] = ac._count.assigneeId;
    }

    return NextResponse.json({
      members: members.map((m) =>
        serializeMember(m, activeMap[m.id] ?? 0)
      ),
    });
  } catch (error) {
    console.error("Members GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/members — SUPER_ADMIN or MANAGER (for their group)
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (!memberHasPermission(me, "member:create")) return NextResponse.json({ error: "دسترسی افزودن عضو را ندارید." }, { status: 403 });
    const body = await req.json();
    const { name, handle, password, role, groupId, supervisorId } = body ?? {};

    if (!name || !handle || !role || !password) {
      return NextResponse.json(
        { error: "نام، هندل، رمز عبور اولیه و نقش الزامی است." },
        { status: 400 }
      );
    }
    if (String(password).length < 8) {
      return NextResponse.json(
        { error: "رمز عبور اولیه باید حداقل ۸ کاراکتر باشد." },
        { status: 400 }
      );
    }

    // Handle must start with @
    if (!handle.startsWith("@")) {
      return NextResponse.json(
        { error: "هندل باید با @ شروع شود." },
        { status: 400 }
      );
    }

    // Validate role
    if (!ROLES.some((r) => r.key === role)) {
      return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
    }

    // Hierarchical creation rules
    if (me.role === "SUPER_ADMIN") {
      // Can create any role
    } else if (me.role === "MANAGER") {
      // Can create SUPERVISOR and SPECIALIST for their group
      if (!["SUPERVISOR", "SPECIALIST"].includes(role)) {
        return NextResponse.json(
          { error: "مدیر مجموعه تنها می‌تواند سرپرست یا کارشناس ایجاد کند." },
          { status: 403 }
        );
      }
      if (role === "MANAGER") {
        return NextResponse.json(
          { error: "مدیر مجموعه تنها می‌تواند سرپرست یا کارشناس ایجاد کند." },
          { status: 403 }
        );
      }
    } else if (me.role === "SUPERVISOR") {
      // Can create SPECIALIST only
      if (role !== "SPECIALIST") {
        return NextResponse.json(
          { error: "سرپرست تنها می‌تواند کارشناس ایجاد کند." },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند عضو جدید ایجاد کند." },
        { status: 403 }
      );
    }

    // Check handle uniqueness
    const existing = await db.member.findUnique({ where: { handle } });
    if (existing) {
      return NextResponse.json(
        { error: "این هندل قبلاً ثبت شده است." },
        { status: 400 }
      );
    }

    // Validate group
    if (me.role === "MANAGER" || me.role === "SUPERVISOR") {
      const targetGroupId = groupId || me.groupId;
      if (!targetGroupId) {
        return NextResponse.json(
          { error: "گروه مشخص نشده است." },
          { status: 400 }
        );
      }
      if (me.role === "MANAGER" && !isManagerOfGroup(me, targetGroupId)) {
        return NextResponse.json(
          { error: "مدیر تنها می‌تواند برای مجموعه خود عضو ایجاد کند." },
          { status: 403 }
        );
      }
    }

    // Validate supervisor
    if (supervisorId) {
      const sup = await db.member.findUnique({ where: { id: supervisorId } });
      if (!sup) {
        return NextResponse.json({ error: "سرپرست یافت نشد." }, { status: 400 });
      }
    }

    const member = await db.member.create({
      data: {
        name: String(name).trim(),
        handle: handle.trim(),
        password: await hashPassword(String(password)),
        mustChangePassword: true,
        role,
        groupId: groupId || me.groupId || null,
        supervisorId: supervisorId || null,
      },
      include: {
        group: true,
        supervisor: true,
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json(
      { member: serializeMember(member, 0) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Members POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
