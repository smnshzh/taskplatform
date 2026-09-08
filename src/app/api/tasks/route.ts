import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTask } from "@/lib/serialize";
import { getCurrentMember, getVisibleMemberIds } from "@/lib/auth";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { STATUSES, PRIORITIES } from "@/lib/constants";
import { toGregorian, toEnglishDigits } from "@/lib/jalali";
import { getMultiValueFilter, getTaskSearchQuery } from "@/features/tasks/server/task-filter";
import { enqueueTaskAssigned } from "@/features/notifications/server/notification.events";
import { connectWorkflowTasks } from "@/features/tasks/server/task-workflow.service";

// Convert "1404/03/15" or "1404-03-15" Jalali string to Date
function jalaliToDate(str: string): Date | null {
  const cleaned = toEnglishDigits(str.trim()).replace(/[\/\\]/g, "-");
  const parts = cleaned.split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) return null;
  const [jy, jm, jd] = parts;
  if (jy < 1300 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const [gy, gm, gd] = toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

// Validate that a Date has a reasonable year for Prisma (PostgreSQL supports 1-9999)
function isValidPrismaDate(d: Date): boolean {
  const y = d.getFullYear();
  return y >= 1900 && y <= 2200;
}

// GET /api/tasks?q=&status=&groupId=&priority=&source=&overdue=1&dateFrom=&dateTo=&dateField=deadline|doneAt&assigneeId=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statuses = getMultiValueFilter(searchParams, "status");
    const groupIds = getMultiValueFilter(searchParams, "groupId");
    const priorities = getMultiValueFilter(searchParams, "priority");
    const sources = getMultiValueFilter(searchParams, "source");
    const overdue = searchParams.get("overdue") === "1";
    const trash = searchParams.get("trash") === "1";
    const dateFromStr = searchParams.get("dateFrom");
    const dateToStr = searchParams.get("dateTo");
    const dateField = searchParams.get("dateField") === "doneAt" ? "doneAt" : "deadline";
    const assigneeIds = getMultiValueFilter(searchParams, "assigneeId");
    const search = getTaskSearchQuery(searchParams);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));

    // Role-based visibility
    const visibleIds = await getVisibleMemberIds(me);

    const where: Record<string, unknown> = {
      OR: [
        { assigneeId: { in: visibleIds } },
        { creatorId: me.id },
      ],
      deletedAt: trash ? { not: null } : null,
    };

    if (statuses.length > 0) where.status = { in: statuses };
    if (groupIds.length > 0) where.groupId = { in: groupIds };
    if (priorities.length > 0) where.priority = { in: priorities };
    if (sources.length > 0) where.source = { in: sources };
    if (assigneeIds.length > 0) where.assigneeId = { in: assigneeIds };
    if (search) {
      where.AND = [{
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { assignee: { name: { contains: search, mode: "insensitive" } } },
        ],
      }];
    }

    // Date range filter on deadline — accept both Gregorian (YYYY-MM-DD) and Jalali
    if (dateFromStr || dateToStr) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFromStr) {
        const d = jalaliToDate(dateFromStr) || new Date(dateFromStr);
        if (!isNaN(d.getTime()) && isValidPrismaDate(d)) {
          // doneAt is grouped for users by Tehran calendar day.
          dateFilter.gte = dateField === "doneAt"
            ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - 3.5 * 60 * 60 * 1000)
            : d;
        }
      }
      if (dateToStr) {
        const d = jalaliToDate(dateToStr) || new Date(dateToStr);
        if (!isNaN(d.getTime()) && isValidPrismaDate(d)) {
          if (dateField === "doneAt") {
            dateFilter.lt = new Date(
              Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1) - 3.5 * 60 * 60 * 1000
            );
          } else {
            d.setHours(23, 59, 59, 999);
            dateFilter.lte = d;
          }
        }
      }
      if (Object.keys(dateFilter).length > 0) where[dateField] = dateFilter;
    }

    const [tasks, total] = await Promise.all([
      db.task.findMany({
        where,
        include: { assignee: true, creator: true, group: true, referer: true, approver: true },
        orderBy: { deadline: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.task.count({ where }),
    ]);

    let result = tasks.map(serializeTask);
    if (overdue) {
      const now = Date.now();
      result = result.filter(
        (t) => t.status !== "DONE" && new Date(t.deadline).getTime() < now
      );
    }

    return NextResponse.json({
      tasks: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Tasks GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

// POST /api/tasks — MANAGER, SUPERVISOR, or SPECIALIST can create for subordinates/self
export async function POST(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) {
      return NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 });
    }
    if (!memberHasPermission(me, "task:create")) return NextResponse.json({ error: "دسترسی ایجاد تسک را ندارید." }, { status: 403 });

    const body = await req.json();
    const {
      title,
      description,
      assigneeId,
      priority,
      deadline,
      startTime,
      link,
      groupId,
      source,
      letterNumber,
      letterDate,
      refererId,
      previousTaskId,
    } = body ?? {};

    if (!title || !assigneeId || !deadline || !groupId) {
      return NextResponse.json(
        { error: "فیلدهای ضروری ناقص است. عنوان، مسئول، ددلاین و مجموعه الزامی است." },
        { status: 400 }
      );
    }

    // Validate priority
    if (priority && !PRIORITIES.some((p) => p.key === priority)) {
      return NextResponse.json({ error: "اولویت نامعتبر است." }, { status: 400 });
    }

    // Validate source
    const taskSource = source || "MANUAL";
    if (!["MANUAL", "REFERRED"].includes(taskSource)) {
      return NextResponse.json({ error: "منبع تسک نامعتبر است." }, { status: 400 });
    }

    // Referred task validation
    if (taskSource === "REFERRED") {
      if (!letterNumber || !letterDate || !refererId) {
        return NextResponse.json(
          { error: "برای تسک ارجاعی، شماره نامه، تاریخ نامه و مرجع الزامی است." },
          { status: 400 }
        );
      }
    }

    // Check assignee exists and is in the correct group
    const assignee = await db.member.findUnique({
      where: { id: assigneeId },
      include: { group: true },
    });
    if (!assignee || !assignee.isActive) {
      return NextResponse.json({ error: "مسئول یافت نشد." }, { status: 400 });
    }

    // Check group exists
    const group = await db.orgGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: "مجموعه یافت نشد." }, { status: 400 });
    }

    if (assignee.groupId !== groupId) {
      return NextResponse.json(
        { error: "مسئول انتخاب‌شده عضو این مجموعه نیست." },
        { status: 400 }
      );
    }

    // Generate next code with retry on unique constraint (race-condition safe)
    const deadlineDate = new Date(deadline);
    const startDate = startTime ? new Date(startTime) : null;

    const MAX_RETRIES = 5;
    let task: Awaited<ReturnType<typeof db.task.create>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use interactive transaction to read-then-write atomically
        task = await db.$transaction(async (tx) => {
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
              title: String(title).trim(),
              description: description ?? null,
              groupId,
              assigneeId,
              creatorId: me.id,
              priority: priority || "MEDIUM",
              deadline: deadlineDate,
              startTime: startDate,
              link: link ?? null,
              status: "PENDING",
              source: taskSource,
              letterNumber: taskSource === "REFERRED" ? letterNumber : null,
              letterDate: taskSource === "REFERRED" ? letterDate : null,
              refererId: taskSource === "REFERRED" ? refererId : null,
              approvalStatus: taskSource === "REFERRED" ? "PENDING_APPROVAL" : null,
            },
            include: { assignee: true, creator: true, group: true, referer: true, approver: true },
          });
          if (previousTaskId) {
            await connectWorkflowTasks(tx, {
              previousTaskId: String(previousTaskId),
              nextTaskId: createdTask.id,
              createdById: me.id,
            });
          }
          const previousIsDone = previousTaskId
            ? (await tx.task.findUnique({ where: { id: String(previousTaskId) }, select: { status: true } }))?.status === "DONE"
            : true;
          if (previousIsDone) {
            await enqueueTaskAssigned(tx, {
              taskId: createdTask.id, taskCode: createdTask.code, title: createdTask.title,
              memberId: createdTask.assigneeId, actorName: me.name,
              deadline: createdTask.deadline, updatedAt: createdTask.updatedAt,
            });
          }
          return createdTask;
        });
        break; // success
      } catch (err: unknown) {
        // If unique constraint on code fails, retry
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("Unique") && attempt < MAX_RETRIES - 1) {
          continue;
        }
        lastError = err;
      }
    }

    if (!task) {
      console.error("Task create retry failed:", lastError);
      return NextResponse.json({ error: "خطا در تولید کد تسک. دوباره تلاش کنید." }, { status: 500 });
    }

    await db.followUpLog.create({
      data: {
        taskId: task.id,
        type: "STATUS_CHANGE",
        message: `تسک توسط ${me.name} ثبت شد.`,
      },
    });

    return NextResponse.json({ task: serializeTask(task as Parameters<typeof serializeTask>[0]) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    console.error("Tasks POST error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
