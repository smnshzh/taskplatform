import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeSchedule } from "@/lib/serialize";
import { getCurrentMember, isManagerOfGroup, getManagedGroupIds } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// GET /api/schedules — filtered by group
export async function GET() {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const where: Record<string, unknown> = {};
    if (me.role !== "SUPER_ADMIN") {
      const targetGroupIds = me.role === "MANAGER" ? getManagedGroupIds(me) : (me.groupId ? [me.groupId] : []);
      where.taskTemplate = { groupId: { in: targetGroupIds } };
    }

    const schedules = await db.taskSchedule.findMany({
      where,
      include: {
        taskTemplate: { include: { group: true } },
        assignee: true,
        overrideAssignee: true,
      },
      orderBy: [
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
    });

    return NextResponse.json({
      schedules: schedules.map(serializeSchedule),
    });
  } catch (error) {
    console.error("Schedules GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/schedules — create a new schedule
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (!memberHasPermission(me, "schedule:create")) {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند زمان‌بندی ایجاد کند." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      taskTemplateId,
      newTemplateName,
      priority: bodyPriority,
      dayOfWeeks,
      specificDate,
      startTime,
      endTime,
      assigneeId,
      allDaysSamePerson,
    } = body ?? {};

    if (!startTime || !endTime || !assigneeId) {
      return NextResponse.json(
        { error: "ساعت شروع، ساعت پایان و مسئول الزامی است." },
        { status: 400 }
      );
    }

    if (!taskTemplateId && !newTemplateName) {
      return NextResponse.json(
        { error: "لطفاً یک الگو انتخاب کنید یا نام الگوی جدید را وارد کنید." },
        { status: 400 }
      );
    }

    const days: number[] = Array.isArray(dayOfWeeks) ? dayOfWeeks : [];
    const hasDays = days.length > 0;
    const hasDate = !!specificDate;

    if (!hasDays && !hasDate) {
      return NextResponse.json(
        { error: "روز هفته یا تاریخ خاص الزامی است." },
        { status: 400 }
      );
    }

    // Validate or create template
    let finalTemplateId = taskTemplateId;
    let groupId: string | undefined;

    if (newTemplateName) {
      // Create a new template inline
      if (!body.groupId) {
        return NextResponse.json(
          { error: "مجموعه برای ایجاد الگوی جدید الزامی است." },
          { status: 400 }
        );
      }

      // Check MANAGER access to group
      if (me.role === "MANAGER") {
        const group = await db.orgGroup.findUnique({ where: { id: body.groupId } });
        if (group && !isManagerOfGroup(me, group.id)) {
          return NextResponse.json(
            { error: "مدیر تنها می‌تواند برای مجموعه خود الگو بسازد." },
            { status: 403 }
          );
        }
      }

      const createdTemplate = await db.taskTemplate.create({
        data: {
          name: newTemplateName,
          groupId: body.groupId,
          priority: (bodyPriority as "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
        },
        include: { group: true },
      });
      finalTemplateId = createdTemplate.id;
      groupId = createdTemplate.groupId;
    } else {
      // Validate existing template
      const template = await db.taskTemplate.findUnique({
        where: { id: taskTemplateId },
        include: { group: true },
      });

      if (!template) {
        return NextResponse.json({ error: "الگو یافت نشد." }, { status: 400 });
      }

      if (me.role === "MANAGER" && !isManagerOfGroup(me, template.groupId)) {
        return NextResponse.json(
          { error: "مدیر تنها می‌تواند برای الگوهای مجموعه خود زمان‌بندی ایجاد کند." },
          { status: 403 }
        );
      }
      groupId = template.groupId;
    }

    // Validate assignee
    const assignee = await db.member.findUnique({ where: { id: assigneeId } });
    if (!assignee) {
      return NextResponse.json({ error: "مسئول یافت نشد." }, { status: 400 });
    }

    // Build list of (dayOfWeek, specificDate) pairs to create
    const createEntries: { dayOfWeek: number | null; specificDate: string | null }[] = [];

    if (hasDays) {
      days.forEach((d) => {
        createEntries.push({ dayOfWeek: Number(d), specificDate: null });
      });
    }
    if (hasDate) {
      createEntries.push({ dayOfWeek: null, specificDate: String(specificDate) });
    }

    // Create all schedule entries
    const created = await db.taskSchedule.createMany({
      data: createEntries.map((entry) => ({
        taskTemplateId: finalTemplateId!,
        dayOfWeek: entry.dayOfWeek,
        specificDate: entry.specificDate,
        startTime: String(startTime),
        endTime: String(endTime),
        assigneeId,
      })),
    });

    // Fetch all created schedules to return them
    const newSchedules = await db.taskSchedule.findMany({
      where: {
        taskTemplateId: finalTemplateId!,
        startTime: String(startTime),
        endTime: String(endTime),
        assigneeId,
      },
      include: {
        taskTemplate: { include: { group: true } },
        assignee: true,
        overrideAssignee: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(
      {
        schedules: newSchedules.map(serializeSchedule),
        count: created.count,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Schedules POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// PATCH /api/schedules/[id] — handled in [id]/route.ts
