import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeMember } from "@/lib/serialize";
import { ROLES } from "@/lib/constants";
import { getCurrentMember, requireRole, getVisibleMemberIds, canManage, isManagerOfGroup } from "@/lib/auth";
import { hashPassword } from "@/features/auth/server/password";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// GET /api/members/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { id } = await params;

    // Visibility check
    if (me.role !== "SUPER_ADMIN") {
      const visibleIds = await getVisibleMemberIds(me);
      if (!visibleIds.includes(id) && id !== me.id) {
        return NextResponse.json(
          { error: "شما به این عضو دسترسی ندارید." },
          { status: 403 }
        );
      }
    }

    const member = await db.member.findUnique({
      where: { id },
      include: {
        group: true,
        supervisor: true,
        _count: { select: { tasks: true } },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "عضو یافت نشد." }, { status: 404 });
    }

    const activeCount = await db.task.count({
      where: {
        assigneeId: id,
        status: { notIn: ["DONE"] },
        deletedAt: null,
      },
    });

    return NextResponse.json({
      member: serializeMember(member, activeCount),
    });
  } catch (error) {
    console.error("Member GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/members/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, password, role, groupId, supervisorId } = body ?? {};

    const existing = await db.member.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "عضو یافت نشد." }, { status: 404 });
    }
    if (id !== me.id && !memberHasPermission(me, "member:update")) return NextResponse.json({ error: "دسترسی ویرایش عضو را ندارید." }, { status: 403 });

    const data: Record<string, unknown> = {};

    // Name: self or admin can change
    if (name !== undefined) {
      if (id !== me.id && me.role !== "SUPER_ADMIN" && me.role !== "MANAGER") {
        return NextResponse.json(
          { error: "شما نمی‌توانید نام این عضو را تغییر دهید." },
          { status: 403 }
        );
      }
      data.name = String(name).trim();
    }

    // Password: self can change
    if (password !== undefined) {
      if (id !== me.id && me.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "شما نمی‌توانید رمز عبور این عضو را تغییر دهید." },
          { status: 403 }
        );
      }
      if (String(password).length < 8) {
        return NextResponse.json(
          { error: "رمز عبور باید حداقل ۸ کاراکتر باشد." },
          { status: 400 }
        );
      }
      data.password = await hashPassword(String(password));
      data.mustChangePassword = id !== me.id;
    }

    // Role change: only SUPER_ADMIN
    if (role !== undefined) {
      if (!memberHasPermission(me, "member:change-role")) {
        return NextResponse.json(
          { error: "تنها مدیر کل می‌تواند نقش را تغییر دهد." },
          { status: 403 }
        );
      }
      if (!ROLES.some((r) => r.key === role)) {
        return NextResponse.json({ error: "نقش نامعتبر است." }, { status: 400 });
      }
      data.role = role;
    }

    // Group change: only SUPER_ADMIN
    if (groupId !== undefined) {
      if (!memberHasPermission(me, "member:update")) {
        return NextResponse.json(
          { error: "تنها مدیر کل می‌تواند گروه را تغییر دهد." },
          { status: 403 }
        );
      }
      if (groupId) {
        const group = await db.orgGroup.findUnique({ where: { id: groupId } });
        if (!group) {
          return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 400 });
        }
      }
      data.groupId = groupId ?? null;
    }

    // Supervisor change
    if (supervisorId !== undefined) {
      if (me.role !== "SUPER_ADMIN" && me.role !== "MANAGER") {
        return NextResponse.json(
          { error: "شما نمی‌توانید سرپرست را تغییر دهید." },
          { status: 403 }
        );
      }
      if (supervisorId) {
        const sup = await db.member.findUnique({ where: { id: supervisorId } });
        if (!sup) {
          return NextResponse.json({ error: "سرپرست یافت نشد." }, { status: 400 });
        }
      }
      data.supervisorId = supervisorId ?? null;
    }

    const updated = await db.member.update({
      where: { id },
      data,
      include: {
        group: true,
        supervisor: true,
        _count: { select: { tasks: true } },
      },
    });

    if (password !== undefined) {
      await db.session.updateMany({
        where: { memberId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await db.auditLog.create({
        data: {
          actorId: me.id,
          action: "PASSWORD_CHANGE",
          entityType: "Member",
          entityId: id,
          result: "SUCCESS",
        },
      });
    }

    const activeCount = await db.task.count({
      where: {
        assigneeId: id,
        status: { notIn: ["DONE"] },
        deletedAt: null,
      },
    });

    return NextResponse.json({
      member: serializeMember(updated, activeCount),
    });
  } catch (error) {
    console.error("Member PATCH error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// DELETE /api/members/[id] — SUPER_ADMIN always, MANAGER for their group
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { id } = await params;

    if (!memberHasPermission(me, "member:delete")) {
      return NextResponse.json(
        { error: "شما دسترسی حذف عضو را ندارید." },
        { status: 403 }
      );
    }

    const member = await db.member.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!member) {
      return NextResponse.json({ error: "عضو یافت نشد." }, { status: 404 });
    }

    // Cannot delete self
    if (member.id === me.id) {
      return NextResponse.json(
        { error: "شما نمی‌توانید خودتان را حذف کنید." },
        { status: 400 }
      );
    }

    // MANAGER can only delete members of their own managed groups
    if (me.role === "MANAGER") {
      if (!member.groupId || !isManagerOfGroup(me, member.groupId)) {
        return NextResponse.json(
          { error: "مدیر تنها می‌تواند اعضای مجموعه خود را حذف کند." },
          { status: 403 }
        );
      }
      // Cannot delete another MANAGER
      if (member.role === "MANAGER") {
        return NextResponse.json(
          { error: "مدیر مجموعه نمی‌تواند مدیر دیگری را حذف کند." },
          { status: 403 }
        );
      }
    }

    await db.member.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Member DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
