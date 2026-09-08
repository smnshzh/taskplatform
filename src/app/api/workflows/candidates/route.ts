import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    if (!memberHasPermission(me, "task:update") && !memberHasPermission(me, "task:create")) {
      return NextResponse.json({ error: "دسترسی به اتصال گردش‌کار را ندارید." }, { status: 403 });
    }
    const rawQuery = new URL(req.url).searchParams.get("q")?.replace(/\s+/g, " ").trim().slice(0, 100);
    const query = rawQuery?.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    const tasks = await db.task.findMany({
      where: {
        deletedAt: null,
        ...(query ? { OR: [
          { code: { contains: query, mode: "insensitive" } },
          { title: { contains: query, mode: "insensitive" } },
          { assignee: { name: { contains: query, mode: "insensitive" } } },
          { group: { name: { contains: query, mode: "insensitive" } } },
        ] } : {}),
      },
      select: { id: true, code: true, title: true, status: true, groupId: true, group: { select: { name: true } }, assignee: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { code: "desc" }],
    });
    return NextResponse.json({ tasks: tasks.map((task) => ({
      id: task.id,
      code: task.code,
      title: task.title,
      status: task.status,
      groupId: task.groupId,
      groupName: task.group.name,
      assigneeName: task.assignee.name,
    })) });
  } catch (error) {
    console.error("Workflow candidates GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
