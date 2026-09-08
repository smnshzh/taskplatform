import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember, isManagerOfGroup, getManagedGroupIds } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";

// POST /api/schedules/bulk
// Body: { schedules: Array<{taskName, dayOfWeek, startTime, endTime, assigneeHandle, groupId}> }
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (!memberHasPermission(me, "schedule:import")) {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند زمان‌بندی ایجاد کند." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { schedules } = body ?? {};

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return NextResponse.json(
        { error: "لیست زمان‌بندی‌ها الزامی است." },
        { status: 400 }
      );
    }

    // ---- Batch preload: groups, members, templates ----
    // Collect all unique references
    const groupIds = new Set<string>();
    const handles = new Set<string>();
    for (const row of schedules) {
      if (row.groupId) groupIds.add(row.groupId);
      if (row.assigneeHandle) handles.add(String(row.assigneeHandle));
    }

    // Single query for all needed groups
    const allGroups = await db.orgGroup.findMany({
      where: { id: { in: Array.from(groupIds) } },
      select: { id: true },
    });
    const groupMap = new Map(allGroups.map((g) => [g.id, true]));

    // Single query for all needed members by handle
    const allMembers = await db.member.findMany({
      where: { handle: { in: Array.from(handles) } },
      select: { id: true, handle: true },
    });
    const memberByHandle = new Map(allMembers.map((m) => [m.handle, m.id]));

    // MANAGER access check
    const myManagedIds = getManagedGroupIds(me);

    // Process rows with preloaded data
    let created = 0;
    const errors: string[] = [];
    const templateCache = new Map<string, string>(); // "name|groupId" -> templateId
    const scheduleKeyCache = new Set<string>(); // avoid duplicate checks

    // Batch: collect all template lookups needed
    const templateLookups: Array<{ name: string; groupId: string }> = [];
    for (let i = 0; i < schedules.length; i++) {
      const row = schedules[i];
      const { taskName, groupId } = row;
      const key = `${String(taskName).trim()}|${groupId}`;
      if (!templateCache.has(key)) {
        templateLookups.push({ name: String(taskName).trim(), groupId });
      }
    }

    // Batch fetch all needed templates
    if (templateLookups.length > 0) {
      const uniqueLookups = [...new Map(templateLookups.map((t) => [`${t.name}|${t.groupId}`, t])).values()];
      for (let i = 0; i < uniqueLookups.length; i += 100) {
        const batch = uniqueLookups.slice(i, i + 100);
        const OR = batch.map((t) => ({ name: t.name, groupId: t.groupId }));
        const templates = await db.taskTemplate.findMany({
          where: { OR },
          select: { id: true, name: true, groupId: true },
        });
        for (const t of templates) {
          templateCache.set(`${t.name}|${t.groupId}`, t.id);
        }
      }
    }

    for (let i = 0; i < schedules.length; i++) {
      const row = schedules[i];
      const { taskName, dayOfWeek, startTime, endTime, assigneeHandle, groupId } = row;

      if (!taskName || !startTime || !endTime || !assigneeHandle || !groupId) {
        errors.push(`ردیف ${i + 1}: فیلدهای ضروری ناقص است.`);
        continue;
      }

      try {
        // Validate group from preloaded data
        if (!groupMap.has(groupId)) {
          errors.push(`ردیف ${i + 1}: مجموعه یافت نشد.`);
          continue;
        }

        // MANAGER: only their group
        if (me.role === "MANAGER" && !myManagedIds.includes(groupId)) {
          errors.push(`ردیف ${i + 1}: دسترسی به مجموعه غیرمجاز.`);
          continue;
        }

        // Find assignee from preloaded data
        const assigneeId = memberByHandle.get(String(assigneeHandle));
        if (!assigneeId) {
          errors.push(`ردیف ${i + 1}: عضو با هندل ${assigneeHandle} یافت نشد.`);
          continue;
        }

        const trimmedName = String(taskName).trim();
        const templateKey = `${trimmedName}|${groupId}`;

        // Find or create template
        let templateId = templateCache.get(templateKey);
        if (!templateId) {
          const template = await db.taskTemplate.create({
            data: { name: trimmedName, groupId, priority: "MEDIUM" },
          });
          templateId = template.id;
          templateCache.set(templateKey, templateId);
        }

        // Check for duplicate using cache key
        const scheduleKey = `${templateId}|${dayOfWeek ?? "null"}|${String(startTime)}|${String(endTime)}|${assigneeId}`;
        if (scheduleKeyCache.has(scheduleKey)) {
          continue; // skip duplicate
        }

        // Verify no existing schedule in DB
        const existing = await db.taskSchedule.findFirst({
          where: {
            taskTemplateId: templateId,
            dayOfWeek: dayOfWeek !== null ? Number(dayOfWeek) : null,
            specificDate: null,
            assigneeId,
            startTime: String(startTime),
            endTime: String(endTime),
          },
        });

        if (!existing) {
          await db.taskSchedule.create({
            data: {
              taskTemplateId: templateId,
              dayOfWeek: dayOfWeek !== null && dayOfWeek !== undefined ? Number(dayOfWeek) : null,
              specificDate: null,
              startTime: String(startTime),
              endTime: String(endTime),
              assigneeId,
            },
          });
          created++;
        }
        scheduleKeyCache.add(scheduleKey);
      } catch (err) {
        errors.push(`ردیف ${i + 1}: خطای داخلی.`);
      }
    }

    return NextResponse.json({ created, errors }, { status: 201 });
  } catch (error) {
    console.error("Schedules bulk error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
