import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { toGregorian, toEnglishDigits } from "@/lib/jalali";
import * as XLSX from "xlsx";
import { enqueueTaskAssigned } from "@/features/notifications/server/notification.events";

// Priority label to key mapping (Persian)
const PRIORITY_MAP: Record<string, string> = {
  "بالا": "HIGH",
  "متوسط": "MEDIUM",
  "پایین": "LOW",
  "HIGH": "HIGH",
  "MEDIUM": "MEDIUM",
  "LOW": "LOW",
};

// Source label to key mapping (Persian)
const SOURCE_MAP: Record<string, string> = {
  "دستی": "MANUAL",
  "ارجاع نامه‌ای": "REFERRED",
  "MANUAL": "MANUAL",
  "REFERRED": "REFERRED",
};

// Persian day name to number mapping
const DAY_MAP: Record<string, number> = {
  "شنبه": 0,
  "یکشنبه": 1,
  "دوشنبه": 2,
  "سه‌شنبه": 3,
  "سه شنبه": 3,
  "چهارشنبه": 4,
  "پنجشنبه": 5,
  "پنج شنبه": 5,
  "جمعه": 6,
};

// Convert date string (Gregorian or Jalali YYYY-MM-DD) to a Date object (Gregorian)
function parseDate(val: string): Date | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = toEnglishDigits(val.trim());
  if (!trimmed) return null;

  const parts = trimmed.split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Detect Jalali year (1200–1600) and convert to Gregorian
  if (year >= 1200 && year <= 1600) {
    const [gy, gm, gd] = toGregorian(year, month, day);
    return new Date(gy, gm - 1, gd);
  }

  // Gregorian date
  return new Date(year, month - 1, day);
}

// Parse HH:MM time and return ISO datetime for today
function parseTimeToDateTime(timeStr: string): Date | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const now = new Date();
  now.setHours(hours, minutes, 0, 0);
  return now;
}

// POST /api/tasks/import
// Expects FormData with "file" field containing .xlsx
// Reads Persian column headers from the template
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    if (!memberHasPermission(me, "task:import")) {
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

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

    // ---- Preload reference data ----
    const uniqueGroupNames = new Set<string>();
    const uniqueHandles = new Set<string>();

    const parsedRows: Array<{
      index: number;
      title: string;
      description: string;
      groupName: string;
      assigneeHandle: string;
      priority: string;
      deadline: string;
      startTime: string | null;
      source: string;
      link: string | null;
      letterNumber: string | null;
      letterDate: string | null;
      refererHandle: string | null;
      error?: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Skip instruction rows (contain "|" which is our delimiter in template)
      const firstVal = String(row["\u0639\u0646\u0648\u0627\u0646 \u062A\u0633\u06A9"] || row["title"] || "").trim();
      if (firstVal.includes("|") && firstVal.includes("مثال")) continue;

      const title = String(row["\u0639\u0646\u0648\u0627\u0646 \u062A\u0633\u06A9"] || row["title"] || "").trim();
      const description = String(row["\u062A\u0648\u0636\u06CC\u062D\u0627\u062A"] || row["description"] || "").trim();
      const groupName = String(row["\u0646\u0627\u0645 \u0645\u062C\u0645\u0648\u0639\u0647"] || row["groupName"] || "").trim();
      const assigneeHandle = String(row["\u0647\u0646\u062F\u0644 \u0645\u0633\u0626\u0648\u0644"] || row["assigneeHandle"] || "").trim();
      const priorityStr = String(row["\u0627\u0648\u0644\u0648\u06CC\u062A"] || row["priority"] || "متوسط").trim();
      const deadline = String(row["\u0645\u0647\u0644\u062A (YYYY-MM-DD)"] || row["deadline"] || "").trim();
      const startTimeStr = String(row["\u0633\u0627\u0639\u062A \u0634\u0631\u0648\u0639 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)"] || row["startTime"] || "").trim();
      const sourceStr = String(row["\u0645\u0646\u0628\u0639"] || row["source"] || "دستی").trim();
      const link = String(row["\u0644\u06CC\u0646\u06A9 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)"] || row["link"] || "").trim() || null;
      const letterNumber = String(row["\u0634\u0645\u0627\u0631\u0647 \u0646\u0627\u0645\u0647 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)"] || row["letterNumber"] || "").trim() || null;
      const letterDate = String(row["\u062A\u0627\u0631\u06CC\u062E \u0646\u0627\u0645\u0647 (YYYY-MM-DD) (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)"] || row["letterDate"] || "").trim() || null;
      const refererHandle = String(row["\u0647\u0646\u062F\u0644 \u0645\u0631\u062C\u0639 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)"] || row["refererHandle"] || "").trim() || null;

      // Validate required fields
      if (!title) {
        parsedRows.push({ index: i, title, description, groupName, assigneeHandle, priority: priorityStr, deadline, startTime: startTimeStr, source: sourceStr, link, letterNumber, letterDate, refererHandle, error: `ردیف ${i + 2}: عنوان تسک الزامی است.` });
        continue;
      }

      if (!groupName) {
        parsedRows.push({ index: i, title, description, groupName, assigneeHandle, priority: priorityStr, deadline, startTime: startTimeStr, source: sourceStr, link, letterNumber, letterDate, refererHandle, error: `ردیف ${i + 2}: نام مجموعه الزامی است.` });
        continue;
      }

      if (!assigneeHandle) {
        parsedRows.push({ index: i, title, description, groupName, assigneeHandle, priority: priorityStr, deadline, startTime: startTimeStr, source: sourceStr, link, letterNumber, letterDate, refererHandle, error: `ردیف ${i + 2}: هندل مسئول الزامی است.` });
        continue;
      }

      if (!deadline) {
        parsedRows.push({ index: i, title, description, groupName, assigneeHandle, priority: priorityStr, deadline, startTime: startTimeStr, source: sourceStr, link, letterNumber, letterDate, refererHandle, error: `ردیف ${i + 2}: مهلت الزامی است.` });
        continue;
      }

      // Map priority
      const priority = PRIORITY_MAP[priorityStr] || "MEDIUM";
      if (!PRIORITY_MAP[priorityStr] && !["HIGH", "MEDIUM", "LOW"].includes(priorityStr)) {
        parsedRows.push({ index: i, title, description, groupName, assigneeHandle, priority: priorityStr, deadline, startTime: startTimeStr, source: sourceStr, link, letterNumber, letterDate, refererHandle, error: `ردیف ${i + 2}: اولویت نامعتبر "${priorityStr}".` });
        continue;
      }

      // Map source
      const source = SOURCE_MAP[sourceStr] || "MANUAL";

      // Validate referred task fields
      if (source === "REFERRED" && (!letterNumber || !letterDate || !refererHandle)) {
        parsedRows.push({ index: i, title, description, groupName, assigneeHandle, priority, deadline, startTime: startTimeStr, source: sourceStr, link, letterNumber, letterDate, refererHandle, error: `ردیف ${i + 2}: برای تسک ارجاعی، شماره نامه، تاریخ نامه و هندل مرجع الزامی است.` });
        continue;
      }

      uniqueGroupNames.add(groupName);
      uniqueHandles.add(assigneeHandle);
      if (refererHandle) uniqueHandles.add(refererHandle);

      parsedRows.push({
        index: i, title, description, groupName, assigneeHandle,
        priority, deadline, startTime: startTimeStr || null,
        source, link, letterNumber, letterDate, refererHandle,
      });
    }

    // Batch load groups and members
    const allGroups = await db.orgGroup.findMany({
      where: { name: { in: Array.from(uniqueGroupNames) } },
    });
    const groupByName = new Map(allGroups.map((g) => [g.name, g]));

    const allMembers = await db.member.findMany({
      where: { handle: { in: Array.from(uniqueHandles) } },
    });
    const memberByHandle = new Map(allMembers.map((m) => [m.handle, m]));

    const myGroupId = me.managedGroups?.[0]?.groupId;
    let created = 0;
    const errors: string[] = [];

    for (const parsed of parsedRows) {
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }

      const { title, description, groupName, assigneeHandle, priority, deadline, startTime, source, link, letterNumber, letterDate, refererHandle, index } = parsed;
      const rowNum = index + 2;

      try {
        const group = groupByName.get(groupName);
        if (!group) {
          errors.push(`ردیف ${rowNum}: مجموعه "${groupName}" یافت نشد.`);
          continue;
        }

        // MANAGER: only their group
        if (me.role === "MANAGER" && group.id !== myGroupId) {
          errors.push(`ردیف ${rowNum}: دسترسی به مجموعه "${groupName}" غیرمجاز.`);
          continue;
        }

        const assignee = memberByHandle.get(assigneeHandle);
        if (!assignee) {
          errors.push(`ردیف ${rowNum}: عضو "${assigneeHandle}" یافت نشد.`);
          continue;
        }

        // Validate assignee is in the target group
        if (assignee.groupId !== group.id) {
          errors.push(`ردیف ${rowNum}: عضو "${assigneeHandle}" در مجموعه "${groupName}" نیست.`);
          continue;
        }

        // Role-based checks
        if (me.role === "MANAGER") {
          if (assignee.groupId !== myGroupId) {
            errors.push(`ردیف ${rowNum}: مسئول باید عضو مجموعه شما باشد.`);
            continue;
          }
        } else if (me.role === "SUPERVISOR") {
          if (assignee.supervisorId !== me.id && assignee.id !== me.id) {
            errors.push(`ردیف ${rowNum}: شما نمی‌توانید برای "${assigneeHandle}" تسک ثبت کنید.`);
            continue;
          }
          if (me.groupId !== group.id) {
            errors.push(`ردیف ${rowNum}: شما نمی‌توانید برای مجموعه دیگر تسک ثبت کنید.`);
            continue;
          }
        }

        let refererId: string | null = null;
        if (source === "REFERRED" && refererHandle) {
          const referer = memberByHandle.get(refererHandle);
          if (!referer) {
            errors.push(`ردیف ${rowNum}: مرجع "${refererHandle}" یافت نشد.`);
            continue;
          }
          refererId = referer.id;
        }

        // Parse dates
        const deadlineDate = parseDate(deadline);
        if (!deadlineDate) {
          errors.push(`ردیف ${rowNum}: فرمت مهلت نامعتبر "${deadline}".`);
          continue;
        }

        const startDate = startTime ? parseTimeToDateTime(startTime) : null;

        // Generate task code (atomic)
        const task = await db.$transaction(async (tx) => {
          const lastTask = await tx.task.findFirst({
            select: { code: true },
            orderBy: { createdAt: "desc" },
          });
          let nextNum = 1;
          if (lastTask?.code) {
            const match = lastTask.code.match(/TSK-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
          }
          const code = `TSK-${String(nextNum).padStart(4, "0")}`;

          const createdTask = await tx.task.create({
            data: {
              code,
              title,
              description: description || null,
              groupId: group.id,
              assigneeId: assignee.id,
              creatorId: me.id,
              priority,
              deadline: deadlineDate,
              startTime: startDate,
              link: link || null,
              status: "PENDING",
              source,
              letterNumber: source === "REFERRED" ? letterNumber : null,
              letterDate: source === "REFERRED" ? letterDate : null,
              refererId: source === "REFERRED" ? refererId : null,
              approvalStatus: source === "REFERRED" ? "PENDING_APPROVAL" : null,
            },
            include: { assignee: true, creator: true, group: true, referer: true, approver: true },
          });
          await enqueueTaskAssigned(tx, {
            taskId: createdTask.id,
            taskCode: createdTask.code,
            title: createdTask.title,
            memberId: createdTask.assigneeId,
            actorName: me.name,
            deadline: createdTask.deadline,
            updatedAt: createdTask.updatedAt,
          });
          return createdTask;
        });

        // Log
        await db.followUpLog.create({
          data: {
            taskId: task.id,
            type: "STATUS_CHANGE",
            message: `تسک از طریق اکسل توسط ${me.name} ثبت شد.`,
          },
        });

        created++;
      } catch (err) {
        errors.push(`ردیف ${rowNum}: خطای داخلی در ثبت تسک.`);
        console.error(`Task import row ${rowNum} error:`, err);
      }
    }

    return NextResponse.json({ created, errors, total: parsedRows.length }, { status: 201 });
  } catch (error) {
    console.error("Task Excel import error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
