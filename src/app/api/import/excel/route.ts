import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember, getManagedGroupIds } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import * as XLSX from "xlsx";

// Persian day name to number mapping
const DAY_MAP: Record<string, number> = {
  "\u0634\u0646\u0628\u0647": 0,
  "\u06CC\u06A9\u0634\u0646\u0628\u0647": 1,
  "\u062F\u0648\u0634\u0646\u0628\u0647": 2,
  "\u0633\u0647\u200C\u0634\u0646\u0628\u0647": 3,
  "\u0633\u0647 \u0634\u0646\u0628\u0647": 3,
  "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647": 4,
  "\u067E\u0646\u062C\u0634\u0646\u0628\u0647": 5,
  "\u067E\u0646\u062C \u0634\u0646\u0628\u0647": 5,
  "\u062C\u0645\u0639\u0647": 6,
};

// POST /api/import/excel
// FormData with file field "file" containing .xlsx
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (!memberHasPermission(me, "schedule:import")) {
      return NextResponse.json(
        { error: "کارشناس نمی‌تواند فایل وارد کند." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "فایل اکسل الزامی است." },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "فقط فایل‌های .xlsx پشتیبانی می‌شود." },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: "فایل اکسل خالی است." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "فایل اکسل خالی است." },
        { status: 400 }
      );
    }

    // ---- Batch preload all unique group names and handles ----
    const uniqueGroupNames = new Set<string>();
    const uniqueHandles = new Set<string>();
    const parsedRows: Array<{
      index: number;
      taskName: string;
      dayOfWeek: number | undefined;
      startTime: string;
      endTime: string;
      assigneeHandle: string;
      groupName: string;
      error?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const taskName = String(row["\u0646\u0627\u0645 \u062A\u0633\u06A9"] || row["taskName"] || "").trim();
      const dayName = String(row["\u0631\u0648\u0632"] || row["dayOfWeek"] || "").trim();
      const startTime = String(row["\u0633\u0627\u0639\u062A \u0634\u0631\u0648\u0639"] || row["startTime"] || "").trim();
      const endTime = String(row["\u0633\u0627\u0639\u062A \u067E\u0627\u06CC\u0627\u0646"] || row["endTime"] || "").trim();
      const assigneeHandle = String(row["\u0647\u0646\u062F\u0644 \u0645\u0633\u0626\u0648\u0644"] || row["assigneeHandle"] || "").trim();
      const groupName = String(row["\u0646\u0627\u0645 \u0645\u062C\u0645\u0648\u0639\u0647"] || row["groupName"] || "").trim();

      if (!taskName || !dayName || !startTime || !endTime || !assigneeHandle || !groupName) {
        parsedRows.push({ index: i, taskName, dayOfWeek: undefined, startTime, endTime, assigneeHandle, groupName, error: `\u0631\u062F\u06CC\u0641 ${i + 2}: \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u0636\u0631\u0648\u0631\u06CC \u0646\u0627\u0642\u0635 \u0627\u0633\u062A.` });
        continue;
      }

      const dayOfWeek = DAY_MAP[dayName];
      if (dayOfWeek === undefined) {
        parsedRows.push({ index: i, taskName, dayOfWeek: undefined, startTime, endTime, assigneeHandle, groupName, error: `\u0631\u062F\u06CC\u0641 ${i + 2}: \u0631\u0648\u0632 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 "${dayName}".` });
        continue;
      }

      uniqueGroupNames.add(groupName);
      uniqueHandles.add(assigneeHandle);
      parsedRows.push({ index: i, taskName, dayOfWeek, startTime, endTime, assigneeHandle, groupName });
    }

    // Single batch: fetch all groups by name
    const allGroups = await db.orgGroup.findMany({
      where: { name: { in: Array.from(uniqueGroupNames) } },
    });
    const groupByName = new Map(allGroups.map((g) => [g.name, g]));

    // Single batch: fetch all members by handle
    const allMembers = await db.member.findMany({
      where: { handle: { in: Array.from(uniqueHandles) } },
    });
    const memberByHandle = new Map(allMembers.map((m) => [m.handle, m]));

    const myManagedGroupIds = me.role === "MANAGER" ? getManagedGroupIds(me) : [];
    let created = 0;
    const errors: string[] = [];
    const templateCache = new Map<string, string>(); // "name|groupId" -> templateId

    for (const parsed of parsedRows) {
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }

      const { taskName, dayOfWeek, startTime, endTime, assigneeHandle, groupName, index } = parsed;
      const rowNum = index + 2;

      try {
        const group = groupByName.get(groupName);
        if (!group) {
          errors.push(`\u0631\u062F\u06CC\u0641 ${rowNum}: \u0645\u062C\u0645\u0648\u0639\u0647 "${groupName}" \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`);
          continue;
        }

        // MANAGER: only their managed groups
        if (me.role === "MANAGER" && !myManagedGroupIds.includes(group.id)) {
          errors.push(`\u0631\u062F\u06CC\u0641 ${rowNum}: \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0645\u062C\u0645\u0648\u0639\u0647 "${groupName}" \u063A\u06CC\u0631\u0645\u062C\u0627\u0632.`);
          continue;
        }

        const assignee = memberByHandle.get(assigneeHandle);
        if (!assignee) {
          errors.push(`\u0631\u062F\u06CC\u0641 ${rowNum}: \u0639\u0636\u0648 "${assigneeHandle}" \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`);
          continue;
        }

        const templateKey = `${taskName}|${group.id}`;
        let templateId = templateCache.get(templateKey);

        if (!templateId) {
          // Check if template exists
          const existing = await db.taskTemplate.findFirst({
            where: { name: taskName, groupId: group.id },
            select: { id: true },
          });
          if (existing) {
            templateId = existing.id;
          } else {
            const newTemplate = await db.taskTemplate.create({
              data: { name: taskName, groupId: group.id, priority: "MEDIUM" },
            });
            templateId = newTemplate.id;
          }
          templateCache.set(templateKey, templateId);
        }

        // Check for duplicate schedule
        const existingSchedule = await db.taskSchedule.findFirst({
          where: {
            taskTemplateId: templateId,
            dayOfWeek,
            specificDate: null,
            assigneeId: assignee.id,
            startTime,
            endTime,
          },
        });

        if (!existingSchedule) {
          await db.taskSchedule.create({
            data: {
              taskTemplateId: templateId,
              dayOfWeek,
              specificDate: null,
              startTime,
              endTime,
              assigneeId: assignee.id,
            },
          });
          created++;
        }
      } catch (err) {
        errors.push(`\u0631\u062F\u06CC\u0641 ${rowNum}: \u062E\u0637\u0627\u06CC \u062F\u0627\u062E\u0644\u06CC.`);
      }
    }

    return NextResponse.json({ created, errors }, { status: 201 });
  } catch (error) {
    console.error("Excel import error:", error);
    return NextResponse.json({ error: "\u062E\u0637\u0627\u06CC \u0633\u0631\u0648\u0631" }, { status: 500 });
  }
}
