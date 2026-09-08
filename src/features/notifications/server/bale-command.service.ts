import { db } from "@/lib/db";
import { toEnglishDigits, toGregorian, toJalali } from "@/lib/jalali";
import { tehranDayRange, tehranLocalDateTimeToUtc } from "@/shared/lib/date/tehran-time";
import { memberHasPermission } from "@/features/access-control/server/permissions";
import { consumeBaleLinkCode, normalizeLinkCode } from "./account-link.service";
import { enqueueReadyWorkflowSuccessors, enqueueTaskAssigned, enqueueTaskStatusChangedForManagers } from "./notification.events";
import { connectWorkflowTasks, ensureWorkflowTaskReady } from "@/features/tasks/server/task-workflow.service";
import { isWorkflowClosed } from "@/features/tasks/workflow-status";
import { z } from "zod";

type CommandInput = { text?: string; externalUserId: string; externalChatId: string };

const HELP = [
  "دستورهای ربات مدیریت تسک:",
  "/link CODE — اتصال حساب",
  "/newtask @handle | عنوان | تاریخ ساعت | اولویت — ساخت تسک",
  "نمونه: /newtask @ali | تهیه گزارش | 1405/05/20 14:30 | HIGH",
  "/mytasks — تسک‌های باز من",
  "/today — تسک‌های امروز",
  "/overdue — تسک‌های عقب‌افتاده",
  "/queue — تسک‌های در صف تا امروز",
  "/unlink — قطع اتصال حساب",
  "/help — راهنما",
  "/menu — نمایش منوی اصلی",
].join("\n");

function commandName(text: string): string {
  return text.trim().split(/\s+/)[0]?.replace(/@\w+$/u, "").toLowerCase() || "";
}

function linkCode(text: string): string | null {
  const parts = text.trim().split(/\s+/);
  if (!["/link", "/start"].includes(commandName(text)) || parts.length < 2) return null;
  const persian = "۰۱۲۳۴۵۶۷۸۹", arabic = "٠١٢٣٤٥٦٧٨٩";
  const normalized = parts[1].replace(/[۰-۹]/g, c => String(persian.indexOf(c))).replace(/[٠-٩]/g, c => String(arabic.indexOf(c)));
  const code = normalizeLinkCode(normalized);
  return code.length === 6 ? code : null;
}

async function linkedMember(externalUserId: string) {
  return db.notificationChannel.findUnique({
    where: { provider_externalUserId: { provider: "bale", externalUserId } },
    select: {
      id: true,
      memberId: true,
      isEnabled: true,
      isVerified: true,
      member: {
        select: {
          name: true,
          isActive: true,
          role: true,
          managedGroups: { select: { groupId: true } },
          accessGroups: { include: { accessGroup: { select: { permissions: true } } } },
        },
      },
    },
  });
}

type NewTaskCommand =
  | { ok: true; handle: string; title: string; deadline: Date; priority: "HIGH" | "MEDIUM" | "LOW" }
  | { ok: false; error: string };

const newTaskCommandSchema = z.object({
  handle: z.string().regex(/^@[^\s|]{2,80}$/u),
  title: z.string().trim().min(1).max(160),
  rawDateTime: z.string().min(1).max(32),
  rawPriority: z.string().min(1).max(16),
});

export function parseNewTaskCommand(text: string): NewTaskCommand {
  const payload = text.trim().replace(/^\/newtask(?:@\w+)?\s*/iu, "");
  const parts = payload.split("|").map(part => part.trim());
  if (parts.length < 3 || parts.length > 4) {
    return { ok: false, error: "فرمت صحیح:\n/newtask @handle | عنوان | 1405/05/20 14:30 | HIGH" };
  }
  const fields = newTaskCommandSchema.safeParse({
    handle: parts[0],
    title: parts[1],
    rawDateTime: parts[2],
    rawPriority: parts[3] || "MEDIUM",
  });
  if (!fields.success) return { ok: false, error: "هندل، عنوان، تاریخ یا اولویت نامعتبر است." };
  const { handle, title, rawDateTime, rawPriority } = fields.data;

  const normalizedDateTime = toEnglishDigits(rawDateTime);
  const match = normalizedDateTime.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return { ok: false, error: "تاریخ باید مانند 1405/05/20 14:30 باشد." };
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return { ok: false, error: "تاریخ یا ساعت نامعتبر است." };
  }

  let gregorian: [number, number, number];
  if (year >= 1300 && year <= 1600) {
    gregorian = toGregorian(year, month, day);
    const roundTrip = toJalali(...gregorian);
    if (roundTrip[0] !== year || roundTrip[1] !== month || roundTrip[2] !== day) {
      return { ok: false, error: "تاریخ شمسی نامعتبر است." };
    }
  } else if (year >= 1900 && year <= 2200) {
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
      return { ok: false, error: "تاریخ میلادی نامعتبر است." };
    }
    gregorian = [year, month, day];
  } else {
    return { ok: false, error: "سال واردشده نامعتبر است." };
  }

  const priorityAliases: Record<string, "HIGH" | "MEDIUM" | "LOW"> = {
    HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW",
    زیاد: "HIGH", متوسط: "MEDIUM", کم: "LOW",
  };
  const priority = priorityAliases[rawPriority.toUpperCase()] ?? priorityAliases[rawPriority];
  if (!priority) return { ok: false, error: "اولویت باید HIGH، MEDIUM یا LOW باشد." };
  return {
    ok: true,
    handle,
    title,
    deadline: tehranLocalDateTimeToUtc(gregorian[0], gregorian[1], gregorian[2], hour, minute),
    priority,
  };
}

function taskList(title: string, tasks: { id: string; code: string; title: string; deadline: Date }[]): string {
  if (!tasks.length) return `${title}\nموردی یافت نشد. ✅`;
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") || "";
  const formatter = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" });
  return [title, ...tasks.map((task, index) => {
    const line = `${index + 1}. ${task.title.replace(/\s+/g, " ").slice(0, 90)}\nکد: ${task.code} | مهلت: ${formatter.format(task.deadline)}`;
    return base ? `${line}\n${base}/?task=${encodeURIComponent(task.id)}` : line;
  })].join("\n\n");
}

type WizardData = {
  assigneeId?: string;
  assigneeName?: string;
  title?: string;
  deadline?: string;
  priority?: "HIGH" | "MEDIUM" | "LOW";
  groupId?: string;
  previousTaskId?: string;
  previousTaskLabel?: string;
};

const WIZARD_TTL_MS = 15 * 60_000;
const wizardExpiry = () => new Date(Date.now() + WIZARD_TTL_MS);

export function mainMenuMarkup(canCreate: boolean, canViewTeam = false): BaleTaskActionResult["replyMarkup"] {
  return {
    inline_keyboard: [
      ...(canCreate ? [[{ text: "➕ ثبت تسک جدید", callback_data: "menu:new" }]] : []),
      [
        { text: "📥 صف کارهای من", callback_data: "menu:queue" },
        { text: "📅 کارهای امروز", callback_data: "menu:today" },
      ],
      [
        { text: "⏰ عقب‌افتاده‌ها", callback_data: "menu:overdue" },
        { text: "📌 همه تسک‌های باز", callback_data: "menu:mytasks" },
      ],
      ...(canViewTeam ? [
        [{ text: "👥 تسک‌های باز تیم", callback_data: "team:open" }],
        [
          { text: "📅 تسک‌های امروز تیم", callback_data: "team:today" },
          { text: "⏰ عقب‌افتاده‌های تیم", callback_data: "team:overdue" },
        ],
        [{ text: "⛔ تسک‌های متوقف تیم", callback_data: "team:blocked" }],
        [
          { text: "🔀 گردش‌کارهای باز", callback_data: "team:workflows:open" },
          { text: "✅ گردش‌کارهای بسته‌شده", callback_data: "team:workflows:closed" },
        ],
      ] : []),
      [
        { text: "❓ راهنما", callback_data: "menu:help" },
        { text: "🔄 تازه‌سازی", callback_data: "menu:home" },
      ],
    ],
  };
}

export async function getBaleMainMenu(externalUserId: string): Promise<BaleTaskActionResult> {
  const channel = await requireLinkedOwner(externalUserId);
  if (!channel) return { text: "🔐 حساب بله شما هنوز به سامانه متصل نیست.\nاز پنل وب یک کد اتصال بگیرید و /link CODE را ارسال کنید." };
  const canCreate = memberHasPermission(channel.member, "task:create");
  const canViewTeam = ["MANAGER", "SUPER_ADMIN"].includes(channel.member.role);
  return {
    text: `سلام ${channel.member.name} عزیز 👋\n\nبه دستیار مدیریت تسک خوش آمدید. چه کاری انجام دهیم؟`,
    replyMarkup: mainMenuMarkup(canCreate, canViewTeam),
  };
}

async function assigneePicker(memberId: string, page = 0): Promise<BaleTaskActionResult> {
  const pageSize = 8;
  const [members, total] = await Promise.all([
    db.member.findMany({
      where: { isActive: true, groupId: { not: null } },
      select: { id: true, name: true, handle: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
      skip: page * pageSize,
      take: pageSize,
    }),
    db.member.count({ where: { isActive: true, groupId: { not: null } } }),
  ]);
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const navigation = [
    ...(page > 0 ? [{ text: "▶️ قبلی", callback_data: `new:people:${page - 1}` }] : []),
    ...(page < maxPage ? [{ text: "بعدی ◀️", callback_data: `new:people:${page + 1}` }] : []),
  ];
  const refreshed = await db.baleConversation.updateMany({
    where: { memberId, step: "ASSIGNEE", expiresAt: { gt: new Date() } },
    data: { step: "ASSIGNEE", expiresAt: wizardExpiry() },
  });
  if (!refreshed.count) return { text: "⌛ زمان انتخاب مسئول پایان یافته است. دوباره از منوی اصلی شروع کنید.", replyMarkup: mainMenuMarkup(true) };
  return {
    text: `➕ ثبت تسک جدید — مرحله ۱ از ۶\n\nمسئول انجام تسک را انتخاب کنید:\nصفحه ${page + 1} از ${maxPage + 1}`,
    replyMarkup: {
      inline_keyboard: [
        ...members.map(member => [{
          text: `👤 ${member.name} — ${member.group?.name ?? "بدون مجموعه"}`,
          callback_data: `new:person:${member.id}`,
        }]),
        ...(navigation.length ? [navigation] : []),
        [{ text: "❌ لغو", callback_data: "new:cancel" }],
      ],
    },
  };
}

export function wizardReview(data: WizardData): BaleTaskActionResult {
  const formatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const priorityLabel = data.priority === "HIGH" ? "زیاد 🔴" : data.priority === "LOW" ? "کم 🟢" : "متوسط 🟡";
  return {
    text: [
      "🧾 مرور نهایی تسک",
      "",
      `👤 مسئول: ${data.assigneeName}`,
      `📝 عنوان: ${data.title}`,
      `🗓 مهلت: ${formatter.format(new Date(data.deadline!))}`,
      `🚩 اولویت: ${priorityLabel}`,
      `🔗 مرحله قبلی: ${data.previousTaskLabel ?? "ندارد (شروع گردش‌کار)"}`,
      "",
      "در صورت صحت اطلاعات، ثبت نهایی را بزنید.",
    ].join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [{ text: "✅ ثبت نهایی", callback_data: "new:confirm" }],
        [
          { text: "🔁 شروع دوباره", callback_data: "menu:new" },
          { text: "❌ لغو", callback_data: "new:cancel" },
        ],
      ],
    },
  };
}

async function createWizardTask(
  actor: { memberId: string; name: string; canViewTeam: boolean },
  data: Required<Pick<WizardData, "assigneeId" | "title" | "deadline" | "priority">> & Pick<WizardData, "previousTaskId">,
): Promise<BaleTaskActionResult> {
  const recentCreates = await db.auditLog.count({
    where: {
      actorId: actor.memberId,
      action: "TASK_CREATED_FROM_BALE",
      result: "SUCCESS",
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
  });
  if (recentCreates >= 5) return { text: "⏳ تعداد درخواست‌ها زیاد است؛ یک دقیقه دیگر دوباره تلاش کنید." };

  const assignee = await db.member.findUnique({
    where: { id: data.assigneeId },
    select: { id: true, name: true, groupId: true, isActive: true },
  });
  if (!assignee?.isActive || !assignee.groupId) return { text: "❌ مسئول انتخاب‌شده دیگر فعال نیست یا مجموعه ندارد." };
  const deadline = new Date(data.deadline);
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) {
    return { text: "❌ مهلت تسک معتبر نیست یا گذشته است. لطفاً دوباره شروع کنید." };
  }
  const assigneeGroupId = assignee.groupId;
  let created: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await db.$transaction(async tx => {
        const lastTask = await tx.task.findFirst({ select: { code: true }, orderBy: { createdAt: "desc" } });
        const match = lastTask?.code.match(/TSK-(\d+)/);
        const nextNumber = match ? Number(match[1]) + 1 : 1;
        const task = await tx.task.create({
          data: {
            code: `TSK-${String(nextNumber).padStart(4, "0")}`,
            title: data.title,
            groupId: assigneeGroupId,
            assigneeId: assignee.id,
            creatorId: actor.memberId,
            priority: data.priority,
            deadline,
            source: "MANUAL",
            status: "PENDING",
          },
        });
        await tx.followUpLog.create({
          data: { taskId: task.id, type: "STATUS_CHANGE", message: `تسک توسط ${actor.name} از طریق فرم مرحله‌ای ربات بله ثبت شد.` },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.memberId,
            action: "TASK_CREATED_FROM_BALE",
            entityType: "Task",
            entityId: task.id,
            result: "SUCCESS",
            metadata: { assigneeId: assignee.id, provider: "bale", flow: "wizard" },
          },
        });
        if (data.previousTaskId) {
          await connectWorkflowTasks(tx, { previousTaskId: data.previousTaskId, nextTaskId: task.id, createdById: actor.memberId });
        }
        const previousIsDone = data.previousTaskId
          ? (await tx.task.findUnique({ where: { id: data.previousTaskId }, select: { status: true } }))?.status === "DONE"
          : true;
        if (previousIsDone) {
          await enqueueTaskAssigned(tx, {
            taskId: task.id,
            taskCode: task.code,
            title: task.title,
            memberId: task.assigneeId,
            actorName: actor.name,
            deadline: task.deadline,
            updatedAt: task.updatedAt,
          });
        }
        return { id: task.id, code: task.code };
      });
    } catch (error) {
      if (attempt === 4 || !(error instanceof Error) || !error.message.includes("Unique")) throw error;
    }
  }
  if (!created) return { text: "❌ ساخت تسک انجام نشد؛ دوباره تلاش کنید." };
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
  return {
    text: [
      "✅ تسک با موفقیت ثبت شد",
      "",
      `🔖 کد: ${created.code}`,
      `👤 مسئول: ${assignee.name}`,
      `✍️ تعریف‌کننده: ${actor.name}`,
      ...(baseUrl ? [`🔗 مشاهده: ${baseUrl}/?task=${encodeURIComponent(created.id)}`] : []),
    ].join("\n"),
    replyMarkup: mainMenuMarkup(true, actor.canViewTeam),
  };
}

export async function handleBaleMenuAction(externalUserId: string, data: string): Promise<BaleTaskActionResult | null> {
  if (!data.startsWith("menu:") && !data.startsWith("new:") && !data.startsWith("team:")) return null;
  const channel = await requireLinkedOwner(externalUserId);
  if (!channel) return { text: "🔐 حساب شما متصل نیست." };

  if (data === "menu:home") return getBaleMainMenu(externalUserId);
  if (data === "menu:help") return { text: HELP, replyMarkup: mainMenuMarkup(memberHasPermission(channel.member, "task:create")) };
  if (["menu:queue", "menu:today", "menu:overdue", "menu:mytasks"].includes(data)) {
    return getBaleTaskMenu(externalUserId, data.slice(5) as BaleTaskListMode);
  }
  if (["team:open", "team:today", "team:overdue", "team:blocked"].includes(data)) {
    return getBaleTeamTaskMenu(externalUserId, data.slice(5) as BaleTeamTaskListMode);
  }
  const workflowPage = data.match(/^team:workflows(?::(open|closed))?(?::(\d+))?$/);
  if (workflowPage) return getBaleTeamWorkflows(externalUserId, workflowPage[1] === "closed" ? "closed" : "open", Number(workflowPage[2] || 0));
  if (data === "new:cancel") {
    await db.baleConversation.deleteMany({ where: { memberId: channel.memberId } });
    return { text: "فرایند ثبت تسک لغو شد.", replyMarkup: mainMenuMarkup(memberHasPermission(channel.member, "task:create")) };
  }
  if (!memberHasPermission(channel.member, "task:create")) return { text: "شما مجوز ایجاد تسک را ندارید." };

  if (data === "menu:new") {
    await db.baleConversation.upsert({
      where: { memberId: channel.memberId },
      create: { memberId: channel.memberId, step: "ASSIGNEE", data: {}, expiresAt: wizardExpiry() },
      update: { step: "ASSIGNEE", data: {}, expiresAt: wizardExpiry() },
    });
    return assigneePicker(channel.memberId, 0);
  }
  const pageMatch = data.match(/^new:people:(\d{1,3})$/);
  if (pageMatch) return assigneePicker(channel.memberId, Number(pageMatch[1]));

  const conversation = await db.baleConversation.findUnique({ where: { memberId: channel.memberId } });
  if (!conversation || conversation.expiresAt <= new Date()) {
    await db.baleConversation.deleteMany({ where: { memberId: channel.memberId } });
    return { text: "⌛ زمان فرم به پایان رسیده است. دوباره «ثبت تسک جدید» را انتخاب کنید.", replyMarkup: mainMenuMarkup(true) };
  }
  const current = conversation.data as WizardData;
  const personMatch = data.match(/^new:person:([a-zA-Z0-9_-]+)$/);
  if (personMatch && conversation.step === "ASSIGNEE") {
    const assignee = await db.member.findFirst({
      where: { id: personMatch[1], isActive: true, groupId: { not: null } },
      select: { id: true, name: true, groupId: true },
    });
    if (!assignee) return { text: "این مسئول دیگر قابل انتخاب نیست؛ فرد دیگری را انتخاب کنید." };
    await db.baleConversation.update({
      where: { memberId: channel.memberId },
      data: { step: "TITLE", data: { ...current, assigneeId: assignee.id, assigneeName: assignee.name, groupId: assignee.groupId! }, expiresAt: wizardExpiry() },
    });
    return {
      text: `➕ ثبت تسک جدید — مرحله ۲ از ۶\n\nمسئول: ${assignee.name}\n\n📝 عنوان تسک را در یک پیام ارسال کنید.`,
      replyMarkup: { inline_keyboard: [[{ text: "❌ لغو", callback_data: "new:cancel" }]] },
    };
  }
  const priorityMatch = data.match(/^new:priority:(HIGH|MEDIUM|LOW)$/);
  if (priorityMatch && conversation.step === "PRIORITY") {
    const next = { ...current, priority: priorityMatch[1] as "HIGH" | "MEDIUM" | "LOW" };
    const candidates = await db.task.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    await db.baleConversation.update({
      where: { memberId: channel.memberId },
      data: { step: "RELATED", data: next, expiresAt: wizardExpiry() },
    });
    return {
      text: "➕ ثبت تسک جدید — مرحله ۵ از ۶\n\n🔗 این تسک مرحله بعدی کدام کار است؟\nاگر در فهرست نیست، کد یا بخشی از عنوان تسک را پیام کنید.",
      replyMarkup: { inline_keyboard: [
        [{ text: "بدون مرحله قبلی", callback_data: "new:previous:none" }],
        ...candidates.map((task) => [{ text: `${task.code} — ${task.title.slice(0, 35)}`, callback_data: `new:previous:${task.id}` }]),
        [{ text: "❌ لغو", callback_data: "new:cancel" }],
      ] },
    };
  }
  const previousMatch = data.match(/^new:previous:(none|[a-zA-Z0-9_-]+)$/);
  if (previousMatch && conversation.step === "RELATED") {
    const previous = previousMatch[1] === "none" ? null : await db.task.findFirst({
      where: { id: previousMatch[1], deletedAt: null },
      select: { id: true, code: true, title: true },
    });
    if (previousMatch[1] !== "none" && !previous) return { text: "تسک انتخاب‌شده دیگر در دسترس نیست." };
    const next = { ...current, previousTaskId: previous?.id, previousTaskLabel: previous ? `${previous.code} — ${previous.title}` : undefined };
    await db.baleConversation.update({ where: { memberId: channel.memberId }, data: { step: "CONFIRM", data: next, expiresAt: wizardExpiry() } });
    return wizardReview(next);
  }
  if (data === "new:confirm" && conversation.step === "CONFIRM") {
    if (!current.assigneeId || !current.title || !current.deadline || !current.priority) {
      await db.baleConversation.deleteMany({ where: { memberId: channel.memberId } });
      return { text: "اطلاعات فرم ناقص بود؛ لطفاً دوباره شروع کنید.", replyMarkup: mainMenuMarkup(true) };
    }
    const result = await createWizardTask(
      {
        memberId: channel.memberId,
        name: channel.member.name,
        canViewTeam: ["MANAGER", "SUPER_ADMIN"].includes(channel.member.role),
      },
      { assigneeId: current.assigneeId, title: current.title, deadline: current.deadline, priority: current.priority, previousTaskId: current.previousTaskId },
    );
    if (result.text.startsWith("✅")) await db.baleConversation.deleteMany({ where: { memberId: channel.memberId } });
    return result;
  }
  return { text: "این گزینه دیگر معتبر نیست؛ از منوی اصلی دوباره شروع کنید.", replyMarkup: mainMenuMarkup(true) };
}

export async function handleBaleWizardText(externalUserId: string, text: string): Promise<BaleTaskActionResult | null> {
  if (!text || text.startsWith("/")) return null;
  const channel = await requireLinkedOwner(externalUserId);
  if (!channel) return null;
  const conversation = await db.baleConversation.findUnique({ where: { memberId: channel.memberId } });
  if (!conversation) return null;
  if (conversation.expiresAt <= new Date()) {
    await db.baleConversation.delete({ where: { memberId: channel.memberId } });
    return { text: "⌛ زمان فرم به پایان رسیده است.", replyMarkup: mainMenuMarkup(true) };
  }
  const current = conversation.data as WizardData;
  if (conversation.step === "TITLE") {
    const title = text.replace(/\s+/g, " ").trim();
    if (!title || title.length > 160) return { text: "عنوان باید بین ۱ تا ۱۶۰ کاراکتر باشد. دوباره ارسال کنید." };
    await db.baleConversation.update({
      where: { memberId: channel.memberId },
      data: { step: "DEADLINE", data: { ...current, title }, expiresAt: wizardExpiry() },
    });
    return {
      text: "➕ ثبت تسک جدید — مرحله ۳ از ۶\n\n🗓 تاریخ و ساعت مهلت را به این شکل ارسال کنید:\n1405/05/20 14:30",
      replyMarkup: { inline_keyboard: [[{ text: "❌ لغو", callback_data: "new:cancel" }]] },
    };
  }
  if (conversation.step === "DEADLINE") {
    const parsed = parseNewTaskCommand(`/newtask @temp | موقت | ${text} | MEDIUM`);
    if (!parsed.ok) return { text: `❌ ${parsed.error}\nدوباره تاریخ و ساعت را ارسال کنید.` };
    if (parsed.deadline <= new Date()) return { text: "مهلت باید در آینده باشد. دوباره ارسال کنید." };
    await db.baleConversation.update({
      where: { memberId: channel.memberId },
      data: { step: "PRIORITY", data: { ...current, deadline: parsed.deadline.toISOString() }, expiresAt: wizardExpiry() },
    });
    return {
      text: "➕ ثبت تسک جدید — مرحله ۴ از ۶\n\n🚩 اولویت را انتخاب کنید:",
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🔴 زیاد", callback_data: "new:priority:HIGH" }],
          [{ text: "🟡 متوسط", callback_data: "new:priority:MEDIUM" }],
          [{ text: "🟢 کم", callback_data: "new:priority:LOW" }],
          [{ text: "❌ لغو", callback_data: "new:cancel" }],
        ],
      },
    };
  }
  if (conversation.step === "RELATED") {
    const query = toEnglishDigits(text.replace(/\s+/g, " ").trim().slice(0, 100));
    const candidates = await db.task.findMany({
      where: { deletedAt: null, OR: [
        { code: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { assignee: { name: { contains: query, mode: "insensitive" } } },
        { group: { name: { contains: query, mode: "insensitive" } } },
      ] },
      select: { id: true, code: true, title: true, assignee: { select: { name: true } }, group: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (!candidates.length) return { text: "تسکی پیدا نشد؛ کد یا عبارت دیگری ارسال کنید." };
    return { text: "نتیجه جست‌وجوی تسک قبلی:", replyMarkup: { inline_keyboard: [
      ...candidates.map((task) => [{ text: `${task.code} — ${task.title.slice(0, 28)} | ${task.assignee.name}`, callback_data: `new:previous:${task.id}` }]),
      [{ text: "❌ لغو", callback_data: "new:cancel" }],
    ] } };
  }
  return { text: "لطفاً از دکمه‌های همین مرحله استفاده کنید." };
}

export async function handleBaleCommand(input: CommandInput): Promise<string> {
  const text = input.text?.trim() || "";
  const code = linkCode(text);
  if (code) {
    const channel = await consumeBaleLinkCode({ code, externalUserId: input.externalUserId, externalChatId: input.externalChatId });
    return channel ? "✅ حساب شما با موفقیت به سامانه مدیریت تسک متصل شد." : "❌ کد اتصال نامعتبر، منقضی یا استفاده‌شده است.";
  }
  const command = commandName(text);
  if (command === "/start") {
    const channel = await linkedMember(input.externalUserId);
    return channel?.isVerified && channel.isEnabled
      ? `سلام ${channel.member.name} عزیز، خوش آمدید. 👋\n\n${HELP}`
      : `سلام، به ربات مدیریت تسک خوش آمدید. 👋\nبرای استفاده، حساب بله را از پنل متصل کنید.\n\n${HELP}`;
  }
  if (command === "/help" || !command) return HELP;

  const channel = await linkedMember(input.externalUserId);
  if (!channel?.isVerified || !channel.isEnabled || !channel.member.isActive) return "حساب بله شما متصل نیست. از پنل کد اتصال بگیرید و دستور /link CODE را ارسال کنید.";

  if (command === "/unlink") {
    await db.$transaction([
      db.notificationChannel.update({ where: { id: channel.id }, data: { isEnabled: false, isVerified: false } }),
      db.auditLog.create({ data: { actorId: channel.memberId, action: "NOTIFICATION_CHANNEL_UNLINKED", entityType: "NotificationChannel", entityId: channel.id, result: "SUCCESS", metadata: { provider: "bale", source: "bot" } } }),
    ]);
    return "اتصال حساب بله شما غیرفعال شد.";
  }

  if (command === "/newtask") {
    if (!memberHasPermission(channel.member, "task:create")) {
      return "شما مجوز ایجاد تسک را ندارید.";
    }
    const parsed = parseNewTaskCommand(text);
    if (!parsed.ok) return `❌ ${parsed.error}`;
    if (parsed.deadline.getTime() <= Date.now()) return "❌ مهلت تسک باید در آینده باشد.";
    const recentCreates = await db.auditLog.count({
      where: {
        actorId: channel.memberId,
        action: "TASK_CREATED_FROM_BALE",
        result: "SUCCESS",
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentCreates >= 5) return "❌ تعداد درخواست‌ها زیاد است؛ یک دقیقه دیگر دوباره تلاش کنید.";

    const assignee = await db.member.findUnique({
      where: { handle: parsed.handle },
      select: { id: true, name: true, groupId: true, isActive: true },
    });
    if (!assignee?.isActive || !assignee.groupId) {
      return "❌ مسئول فعال با این هندل یافت نشد یا مجموعه ندارد.";
    }
    const assigneeGroupId = assignee.groupId;

    let created: { id: string; code: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        created = await db.$transaction(async tx => {
          const lastTask = await tx.task.findFirst({
            select: { code: true },
            orderBy: { createdAt: "desc" },
          });
          const match = lastTask?.code.match(/TSK-(\d+)/);
          const nextNumber = match ? Number(match[1]) + 1 : 1;
          const task = await tx.task.create({
            data: {
              code: `TSK-${String(nextNumber).padStart(4, "0")}`,
              title: parsed.title,
              groupId: assigneeGroupId,
              assigneeId: assignee.id,
              creatorId: channel.memberId,
              priority: parsed.priority,
              deadline: parsed.deadline,
              source: "MANUAL",
              status: "PENDING",
            },
          });
          await tx.followUpLog.create({
            data: {
              taskId: task.id,
              type: "STATUS_CHANGE",
              message: `تسک توسط ${channel.member.name} از طریق ربات بله ثبت شد.`,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: channel.memberId,
              action: "TASK_CREATED_FROM_BALE",
              entityType: "Task",
              entityId: task.id,
              result: "SUCCESS",
              metadata: { assigneeId: assignee.id, provider: "bale" },
            },
          });
          await enqueueTaskAssigned(tx, {
            taskId: task.id,
            taskCode: task.code,
            title: task.title,
            memberId: task.assigneeId,
            actorName: channel.member.name,
            deadline: task.deadline,
            updatedAt: task.updatedAt,
          });
          return { id: task.id, code: task.code };
        });
      } catch (error) {
        if (attempt === 4 || !(error instanceof Error) || !error.message.includes("Unique")) throw error;
      }
    }
    if (!created) return "❌ ساخت تسک انجام نشد؛ دوباره تلاش کنید.";
    const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
    return [
      "✅ تسک با موفقیت ساخته شد.",
      `کد: ${created.code}`,
      `مسئول: ${assignee.name}`,
      `تعریف‌کننده: ${channel.member.name}`,
      ...(baseUrl ? [`مشاهده: ${baseUrl}/?task=${encodeURIComponent(created.id)}`] : []),
    ].join("\n");
  }

  if (command === "/done") return "تغییر وضعیت تسک از طریق ربات هنوز فعال نیست. لطفاً تسک را در پنل به انجام‌شده تغییر دهید.";
  if (!["/mytasks", "/today", "/overdue"].includes(command)) return `دستور ناشناخته است.\n\n${HELP}`;

  const now = new Date();
  const range = tehranDayRange(now);
  const deadline = command === "/today" ? { gte: range.start, lt: range.end } : command === "/overdue" ? { lt: now } : undefined;
  const tasks = await db.task.findMany({
    where: { assigneeId: channel.memberId, deletedAt: null, status: { not: "DONE" }, ...(deadline ? { deadline } : {}) },
    select: { id: true, code: true, title: true, deadline: true }, orderBy: { deadline: "asc" }, take: 10,
  });
  const title = command === "/today" ? "📅 تسک‌های امروز" : command === "/overdue" ? "⚠️ تسک‌های عقب‌افتاده" : "📌 تسک‌های باز من";
  return taskList(title, tasks);
}

export type BaleTaskActionResult = {
  text: string;
  replyMarkup?: { inline_keyboard: { text: string; callback_data: string }[][] };
};

async function requireLinkedOwner(externalUserId: string) {
  const channel = await linkedMember(externalUserId);
  return channel?.isVerified && channel.isEnabled && channel.member.isActive ? channel : null;
}

export type BaleTaskListMode = "queue" | "mytasks" | "today" | "overdue";
export type BaleTeamTaskListMode = "open" | "today" | "overdue" | "blocked";

export function baleTaskStatusLabel(status: string): string {
  return status === "STARTED" ? "▶️ در حال انجام"
    : status === "BLOCKED" ? "⛔ متوقف"
      : "⏳ در انتظار";
}

async function managedTeamMemberIds(channel: NonNullable<Awaited<ReturnType<typeof requireLinkedOwner>>>): Promise<string[]> {
  if (channel.member.role === "SUPER_ADMIN") {
    const members = await db.member.findMany({
      where: { id: { not: channel.memberId }, isActive: true },
      select: { id: true },
    });
    return members.map(member => member.id);
  }
  if (channel.member.role !== "MANAGER") return [];
  const groupIds = channel.member.managedGroups.map(group => group.groupId);
  if (!groupIds.length) return [];
  const members = await db.member.findMany({
    where: { groupId: { in: groupIds }, id: { not: channel.memberId }, isActive: true },
    select: { id: true },
  });
  return members.map(member => member.id);
}

export async function getBaleTaskMenu(externalUserId: string, mode: BaleTaskListMode): Promise<BaleTaskActionResult> {
  const channel = await requireLinkedOwner(externalUserId);
  if (!channel) return { text: "حساب بله شما متصل نیست. ابتدا از پنل حساب را متصل کنید." };
  const now = new Date();
  const { start, end } = tehranDayRange(now);
  const status = mode === "queue" ? "PENDING" : { in: ["PENDING", "STARTED"] };
  const deadline = mode === "queue" ? { lt: end }
    : mode === "today" ? { gte: start, lt: end }
      : mode === "overdue" ? { lt: now }
        : undefined;
  const tasks = await db.task.findMany({
    where: { assigneeId: channel.memberId, deletedAt: null, status, ...(deadline ? { deadline } : {}) },
    select: { id: true, code: true, title: true, status: true }, orderBy: { deadline: "asc" }, take: 20,
  });
  const title = mode === "queue" ? "تسک‌های در صف تا امروز"
    : mode === "today" ? "تسک‌های امروز"
      : mode === "overdue" ? "تسک‌های عقب‌افتاده"
        : "تسک‌های باز من";
  if (!tasks.length) return { text: `${title} خالی است. ✅` };
  return {
    text: `${title}\nیکی از تسک‌ها را انتخاب کنید:`,
    replyMarkup: { inline_keyboard: tasks.map(task => [{
      text: `${baleTaskStatusLabel(task.status)} | ${task.code} — ${task.title.slice(0, 32)}`,
      callback_data: `task:${task.id}`,
    }]) },
  };
}

export async function getBaleTeamTaskMenu(
  externalUserId: string,
  mode: BaleTeamTaskListMode,
): Promise<BaleTaskActionResult> {
  const channel = await requireLinkedOwner(externalUserId);
  if (!channel) return { text: "حساب بله شما متصل نیست." };
  if (!["MANAGER", "SUPER_ADMIN"].includes(channel.member.role)) {
    return { text: "شما مجوز مشاهده تسک‌های تیم را ندارید." };
  }
  const memberIds = await managedTeamMemberIds(channel);
  if (!memberIds.length) return { text: "عضوی در محدوده مدیریت شما یافت نشد. ✅", replyMarkup: mainMenuMarkup(true, true) };
  const now = new Date();
  const { start, end } = tehranDayRange(now);
  const deadline = mode === "today"
    ? { gte: start, lt: end }
    : mode === "overdue"
      ? { lt: now }
      : undefined;
  const status = mode === "blocked"
    ? "BLOCKED"
    : { in: ["PENDING", "STARTED"] };
  const tasks = await db.task.findMany({
    where: {
      assigneeId: { in: memberIds },
      deletedAt: null,
      status,
      ...(deadline ? { deadline } : {}),
    },
    select: { id: true, code: true, title: true, status: true, assignee: { select: { name: true } } },
    orderBy: { deadline: "asc" },
    take: 30,
  });
  const title = mode === "today"
    ? "📅 تسک‌های امروز تیم"
    : mode === "overdue"
      ? "⏰ تسک‌های عقب‌افتاده تیم"
      : mode === "blocked"
        ? "⛔ تسک‌های متوقف تیم"
        : "👥 تسک‌های باز تیم";
  if (!tasks.length) return { text: `${title}\nموردی یافت نشد. ✅`, replyMarkup: mainMenuMarkup(true, true) };
  return {
    text: `${title}\nیکی از تسک‌ها را برای مشاهده جزئیات انتخاب کنید:`,
    replyMarkup: {
      inline_keyboard: [
        ...tasks.map(task => [{
          text: `${baleTaskStatusLabel(task.status)} | ${task.assignee.name} | ${task.code} — ${task.title.slice(0, 24)}`,
          callback_data: `teamtask:${mode}:${task.id}`,
        }]),
        [{ text: "↩️ بازگشت به منوی اصلی", callback_data: "menu:home" }],
      ],
    },
  };
}

export type BaleWorkflowListMode = "open" | "closed";

export async function getBaleTeamWorkflows(externalUserId: string, mode: BaleWorkflowListMode = "open", requestedPage = 0): Promise<BaleTaskActionResult> {
  const channel = await requireLinkedOwner(externalUserId);
  if (!channel || !["MANAGER", "SUPER_ADMIN"].includes(channel.member.role)) return { text: "مجوز مشاهده گردش‌کارهای زیرمجموعه را ندارید." };
  const groupIds = channel.member.managedGroups.map((group) => group.groupId);
  const groupFilter = channel.member.role === "SUPER_ADMIN" ? {} : { groupId: { in: groupIds } };
  const relations = await db.taskRelation.findMany({
    where: { OR: [{ previousTask: { deletedAt: null, ...groupFilter } }, { nextTask: { deletedAt: null, ...groupFilter } }] },
    include: {
      previousTask: { select: { id: true, code: true, title: true, status: true, group: { select: { name: true } }, assignee: { select: { name: true } } } },
      nextTask: { select: { id: true, code: true, title: true, status: true, group: { select: { name: true } }, assignee: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!relations.length) return { text: "🔀 گردش‌کاری برای زیرمجموعه شما یافت نشد.", replyMarkup: mainMenuMarkup(true, true) };
  type Node = typeof relations[number]["previousTask"];
  const nodes = new Map<string, Node>();
  const adjacency = new Map<string, Set<string>>();
  const predecessors = new Map<string, Set<string>>();
  for (const relation of relations) {
    nodes.set(relation.previousTask.id, relation.previousTask); nodes.set(relation.nextTask.id, relation.nextTask);
    (adjacency.get(relation.previousTask.id) || adjacency.set(relation.previousTask.id, new Set()).get(relation.previousTask.id)!).add(relation.nextTask.id);
    (adjacency.get(relation.nextTask.id) || adjacency.set(relation.nextTask.id, new Set()).get(relation.nextTask.id)!).add(relation.previousTask.id);
    (predecessors.get(relation.nextTask.id) || predecessors.set(relation.nextTask.id, new Set()).get(relation.nextTask.id)!).add(relation.previousTask.id);
  }
  const seen = new Set<string>();
  const summaries: string[] = [];
  for (const start of nodes.keys()) {
    if (seen.has(start)) continue;
    const component: string[] = [], pending = [start]; seen.add(start);
    while (pending.length) { const id = pending.pop()!; component.push(id); for (const next of adjacency.get(id) || []) if (!seen.has(next)) { seen.add(next); pending.push(next); } }
    const componentRelations = relations.filter((relation) => component.includes(relation.previousTask.id) && component.includes(relation.nextTask.id));
    const name = componentRelations.find((relation) => relation.workflowName)?.workflowName || `گردش‌کار ${summaries.length + 1}`;
    const tasks = component.map((id) => nodes.get(id)!);
    if (isWorkflowClosed(tasks) !== (mode === "closed")) continue;
    const active = tasks.filter((task) => task.status !== "DONE");
    const stuck = active.filter((task) => task.status === "BLOCKED" || [...(predecessors.get(task.id) || [])].every((id) => nodes.get(id)?.status === "DONE"));
    const focus = stuck.length ? stuck : active.slice(0, 1);
    summaries.push(`🔹 ${name}\n${focus.length ? focus.map((task) => `${task.status === "BLOCKED" ? "⛔" : "⏳"} پردازش در واحد «${task.group.name}» — ${task.assignee.name}\n${task.code}: ${task.title}`).join("\n") : "✅ همه مراحل انجام شده"}`);
  }
  const listTitle = mode === "closed" ? "✅ گردش‌کارهای بسته‌شده زیرمجموعه" : "🔀 گردش‌کارهای باز زیرمجموعه";
  if (!summaries.length) return { text: `${listTitle}\nموردی یافت نشد. ✅`, replyMarkup: mainMenuMarkup(true, true) };
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(summaries.length / pageSize));
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
  const navigation = [
    ...(page > 0 ? [{ text: "قبلی", callback_data: `team:workflows:${mode}:${page - 1}` }] : []),
    ...(page + 1 < pageCount ? [{ text: "بعدی", callback_data: `team:workflows:${mode}:${page + 1}` }] : []),
  ];
  return { text: `${listTitle} — صفحه ${page + 1} از ${pageCount}\n\n${summaries.slice(page * pageSize, (page + 1) * pageSize).join("\n\n")}`, replyMarkup: { inline_keyboard: [...(navigation.length ? [navigation] : []), [{ text: "🔄 تازه‌سازی", callback_data: `team:workflows:${mode}:${page}` }], [{ text: "↩️ منوی اصلی", callback_data: "menu:home" }]] } };
}

export function getBaleQueue(externalUserId: string) {
  return getBaleTaskMenu(externalUserId, "queue");
}

export async function handleBaleTaskAction(externalUserId: string, data: string): Promise<BaleTaskActionResult> {
  const channel = await requireLinkedOwner(externalUserId);
  if (!channel) return { text: "حساب بله شما متصل نیست." };
  const workflowNewMatch = data.match(/^workflownew:([a-zA-Z0-9_-]+)$/);
  const workflowEndMatch = data.match(/^workflowend:([a-zA-Z0-9_-]+)$/);
  if (workflowEndMatch) return { text: "✅ گردش‌کار در همین مرحله پایان یافت.", replyMarkup: mainMenuMarkup(memberHasPermission(channel.member, "task:create"), ["MANAGER", "SUPER_ADMIN"].includes(channel.member.role)) };
  if (workflowNewMatch) {
    if (!memberHasPermission(channel.member, "task:create")) return { text: "شما مجوز تعریف مرحله بعد را ندارید." };
    const previous = await db.task.findFirst({ where: { id: workflowNewMatch[1], assigneeId: channel.memberId, status: "DONE", deletedAt: null }, select: { id: true, code: true, title: true } });
    if (!previous) return { text: "تسک انجام‌شده برای ساخت مرحله بعد یافت نشد." };
    await db.baleConversation.upsert({
      where: { memberId: channel.memberId },
      create: { memberId: channel.memberId, step: "ASSIGNEE", data: { previousTaskId: previous.id, previousTaskLabel: `${previous.code} — ${previous.title}` }, expiresAt: wizardExpiry() },
      update: { step: "ASSIGNEE", data: { previousTaskId: previous.id, previousTaskLabel: `${previous.code} — ${previous.title}` }, expiresAt: wizardExpiry() },
    });
    return assigneePicker(channel.memberId, 0);
  }
  const workflowMatch = data.match(/^workflow:([a-zA-Z0-9_-]+)$/);
  const workflowPickMatch = data.match(/^workflowpick:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)$/);
  if (workflowMatch || workflowPickMatch) {
    const sourceId = workflowMatch?.[1] ?? workflowPickMatch![1];
    const source = await db.task.findFirst({ where: { id: sourceId, assigneeId: channel.memberId, deletedAt: null }, select: { id: true, groupId: true, code: true } });
    if (!source) return { text: "تسک مبدا در دسترس نیست." };
    if (workflowPickMatch) {
      try {
        await db.$transaction((tx) => connectWorkflowTasks(tx, { previousTaskId: source.id, nextTaskId: workflowPickMatch[2], createdById: channel.memberId }));
        return { text: "✅ ارتباط گردش‌کار ثبت شد.", replyMarkup: mainMenuMarkup(memberHasPermission(channel.member, "task:create")) };
      } catch (error) {
        return { text: `❌ ${error instanceof Error ? error.message : "ثبت ارتباط ناموفق بود."}` };
      }
    }
    const candidates = await db.task.findMany({ where: { id: { not: source.id }, deletedAt: null }, select: { id: true, code: true, title: true }, orderBy: { createdAt: "desc" }, take: 10 });
    return { text: "تسک مرحله بعد را انتخاب کنید:", replyMarkup: { inline_keyboard: candidates.map((task) => [{ text: `${task.code} — ${task.title.slice(0, 35)}`, callback_data: `workflowpick:${source.id}:${task.id}` }]) } };
  }
  const teamMatch = data.match(/^teamtask:(open|today|overdue|blocked):([a-zA-Z0-9_-]+)$/);
  const legacyTeamMatch = data.match(/^teamtask:([a-zA-Z0-9_-]+)$/);
  const taskMatch = data.match(/^(task|start|finish|confirm):([a-zA-Z0-9_-]+)$/);
  if (!teamMatch && !legacyTeamMatch && !taskMatch) return { text: "درخواست نامعتبر است." };
  const action = teamMatch || legacyTeamMatch ? "teamtask" : taskMatch![1];
  const taskId = teamMatch?.[2] ?? legacyTeamMatch?.[1] ?? taskMatch![2];
  const teamReturnMode = teamMatch?.[1] ?? "open";
  const task = await db.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      deadline: true,
      priority: true,
      groupId: true,
      assigneeId: true,
      assignee: { select: { name: true } },
    },
  });
  if (!task) return { text: "تسک یافت نشد." };
  if (action === "teamtask") {
    const managedIds = await managedTeamMemberIds(channel);
    if (!managedIds.includes(task.assigneeId)) return { text: "این تسک در محدوده مدیریت شما نیست." };
    const status = task.status === "DONE" ? "انجام‌شده"
      : task.status === "STARTED" ? "در حال انجام"
        : task.status === "BLOCKED" ? "متوقف"
          : "در انتظار";
    const priority = task.priority === "HIGH" ? "زیاد" : task.priority === "LOW" ? "کم" : "متوسط";
    const deadline = new Intl.DateTimeFormat("fa-IR", {
      timeZone: "Asia/Tehran",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(task.deadline);
    return {
      text: [
        `📌 ${task.title}`,
        `کد: ${task.code}`,
        `مسئول: ${task.assignee.name}`,
        `وضعیت: ${status}`,
        `اولویت: ${priority}`,
        `مهلت: ${deadline}`,
      ].join("\n"),
      replyMarkup: { inline_keyboard: [[{
        text: "↩️ بازگشت به فهرست تیم",
        callback_data: `team:${teamReturnMode}`,
      }]] },
    };
  }
  if (task.assigneeId !== channel.memberId) return { text: "این تسک متعلق به شما نیست." };
  if (task.status === "DONE") return { text: "این تسک قبلاً پایان یافته است. ✅" };
  if (task.status === "BLOCKED") return { text: "این تسک در فهرست فعال ربات قرار ندارد." };

  if (action === "task") {
    const status = task.status === "STARTED" ? "در حال انجام" : "در انتظار";
    return {
      text: `📌 ${task.title}\nکد: ${task.code}\nوضعیت: ${status}`,
      replyMarkup: { inline_keyboard: [[task.status === "STARTED"
        ? { text: "✅ پایان تسک", callback_data: `finish:${task.id}` }
        : { text: "▶️ شروع تسک", callback_data: `start:${task.id}` }]] },
    };
  }

  if (action === "finish") return {
    text: `آیا از پایان «${task.title.slice(0, 100)}» مطمئن هستید؟`,
    replyMarkup: { inline_keyboard: [[{ text: "✅ بله، پایان", callback_data: `confirm:${task.id}` }, { text: "انصراف", callback_data: `task:${task.id}` }]] },
  };

  if (action === "start") {
    try {
      await db.$transaction((tx) => ensureWorkflowTaskReady(tx, task.id));
    } catch (error) {
      return { text: `⏳ ${error instanceof Error ? error.message : "مرحله قبلی هنوز انجام نشده است."}` };
    }
  }

  const now = new Date();
  const expectedStatuses = action === "start" ? ["PENDING"] : ["STARTED"];
  const nextStatus = action === "start" ? "STARTED" : "DONE";
  const updated = await db.$transaction(async tx => {
    const result = await tx.task.updateMany({
      where: { id: task.id, assigneeId: channel.memberId, status: { in: expectedStatuses }, deletedAt: null },
      data: action === "start"
        ? { status: nextStatus, startedAt: now, followUpReason: null }
        : { status: nextStatus, doneAt: now },
    });
    if (!result.count) return false;
    await tx.followUpLog.create({ data: { taskId: task.id, type: "STATUS_CHANGE", message: `${channel.member.name} وضعیت را از طریق ربات بله به «${action === "start" ? "در حال انجام" : "انجام‌شده"}» تغییر داد.` } });
    await tx.auditLog.create({ data: { actorId: channel.memberId, action: action === "start" ? "TASK_STARTED_FROM_BALE" : "TASK_COMPLETED_FROM_BALE", entityType: "Task", entityId: task.id, result: "SUCCESS", metadata: { provider: "bale" } } });
    await enqueueTaskStatusChangedForManagers(tx, {
      taskId: task.id,
      taskCode: task.code,
      title: task.title,
      groupId: task.groupId,
      assigneeName: task.assignee.name,
      status: nextStatus,
      changedAt: now,
    });
    if (nextStatus === "DONE") await enqueueReadyWorkflowSuccessors(tx, { completedTaskId: task.id, changedAt: now });
    return true;
  });
  if (!updated) return { text: "وضعیت تسک هم‌زمان تغییر کرده است؛ دوباره آن را انتخاب کنید." };
  return action === "start"
    ? { text: `▶️ تسک «${task.title}» شروع شد.` }
    : { text: `✅ تسک «${task.title}» پایان یافت.\n\nآیا این تسک دارای گردش‌کار است؟`, replyMarkup: { inline_keyboard: [[{ text: "✅ بله، تعریف تسک بعدی", callback_data: `workflownew:${task.id}` }], [{ text: "❌ خیر، پایان گردش‌کار", callback_data: `workflowend:${task.id}` }]] } };
}
