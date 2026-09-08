import { db } from "@/lib/db";
import { tehranDayRange } from "@/shared/lib/date/tehran-time";
import { elapsedDaysSinceStart } from "@/features/tasks/elapsed-days";

function tehranClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}

function taskText(eventType: string, task: { code: string; title: string; deadline: Date; group: { name: string }; assignee: { name: string } }, leadMinutes?: number | null) {
  const heading = eventType === "OVERDUE" ? "⏰ یادآوری تسک عقب‌افتاده" : eventType === "TODAY" ? "📅 یادآوری تسک امروز" : `🔔 یادآوری موعد تسک (${leadMinutes} دقیقه مانده)`;
  return `${heading}\n\n${task.code} — ${task.title}\nمسئول: ${task.assignee.name}\nواحد: ${task.group.name}\nموعد: ${task.deadline.toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}`;
}

type WorkflowRelation = {
  id: string;
  workflowName: string | null;
  previousTask: { id: string; code: string; title: string; status: string; group: { name: string } };
  nextTask: { id: string; code: string; title: string; status: string; group: { name: string } };
};

type StartedReportMember = {
  id: string;
  name: string;
  group: { name: string } | null;
  tasks: { code: string; title: string; startedAt: Date | null }[];
};

type OverdueReportTask = {
  id: string;
  code: string;
  title: string;
  deadline: Date;
  status: string;
  group: { name: string };
  assignee: { name: string };
};

export function overdueTasksDigest(tasks: OverdueReportTask[], now = new Date()) {
  if (!tasks.length) return null;
  const groups = new Map<string, Map<string, OverdueReportTask[]>>();
  for (const task of tasks) {
    const members = groups.get(task.group.name) || new Map<string, OverdueReportTask[]>();
    members.set(task.assignee.name, [...(members.get(task.assignee.name) || []), task]);
    groups.set(task.group.name, members);
  }
  const sections = [...groups.entries()].map(([groupName, members]) => {
    const memberRows = [...members.entries()].map(([memberName, memberTasks]) => {
      const details = memberTasks.map((task) => {
        const days = Math.max(0, Math.floor((now.getTime() - task.deadline.getTime()) / 86_400_000));
        const elapsed = days === 0 ? "از امروز عقب‌افتاده" : `${days.toLocaleString("fa-IR")} روز عقب‌افتاده`;
        return `    • ${task.code} — ${task.title} (${elapsed})`;
      }).join("\n");
      return `  👤 ${memberName}: ${memberTasks.length.toLocaleString("fa-IR")} تسک\n${details}`;
    });
    return `🏢 ${groupName}\n${memberRows.join("\n")}`;
  });
  const text = `🚨 گزارش یکپارچه تسک‌های عقب‌افتاده\nمجموع: ${tasks.length.toLocaleString("fa-IR")} تسک\n\n${sections.join("\n\n")}`;
  return text.length <= 3800 ? text : `${text.slice(0, 3740)}\n\n… ادامه گزارش در پنل مدیریت قابل مشاهده است.`;
}

export function startedTasksByMemberDigest(members: StartedReportMember[], now = new Date()) {
  if (!members.length) return null;
  const grouped = new Map<string, StartedReportMember[]>();
  for (const member of members) {
    const groupName = member.group?.name || "بدون مجموعه";
    grouped.set(groupName, [...(grouped.get(groupName) || []), member]);
  }
  const sections = [...grouped.entries()].map(([groupName, groupMembers]) => {
    const rows = groupMembers.slice(0, 40).map((member) => {
      const details = member.tasks.slice(0, 5).map((task) => {
        const days = elapsedDaysSinceStart(task.startedAt, now);
        const elapsed = days === null ? "زمان شروع ثبت نشده" : days === 0 ? "امروز شروع شده" : `${days.toLocaleString("fa-IR")} روز گذشته`;
        return `    • ${task.code} — ${task.title} (${elapsed})`;
      }).join("\n");
      const more = member.tasks.length > 5 ? `\n    … و ${(member.tasks.length - 5).toLocaleString("fa-IR")} تسک دیگر` : "";
      return `  👤 ${member.name}: ${member.tasks.length.toLocaleString("fa-IR")} تسک${details ? `\n${details}${more}` : ""}`;
    });
    const moreMembers = groupMembers.length > 40 ? `\n  … و ${(groupMembers.length - 40).toLocaleString("fa-IR")} عضو دیگر` : "";
    return `🏢 ${groupName}\n${rows.join("\n")}${moreMembers}`;
  });
  const total = members.reduce((sum, member) => sum + member.tasks.length, 0);
  const text = `📊 گزارش تسک‌های در حال انجام اعضا\nمجموع: ${total.toLocaleString("fa-IR")} تسک\n\n${sections.join("\n\n")}`;
  return text.length <= 3800 ? text : `${text.slice(0, 3740)}\n\n… ادامه گزارش در پنل مدیریت قابل مشاهده است.`;
}

export function workflowDigest(eventType: "WORKFLOW_OPEN" | "WORKFLOW_CLOSED", relations: WorkflowRelation[]) {
  const workflows = new Map<string, { name: string; tasks: Map<string, WorkflowRelation["previousTask"]> }>();
  for (const relation of relations) {
    const key = relation.workflowName?.trim() || `relation:${relation.id}`;
    const workflow = workflows.get(key) || { name: relation.workflowName?.trim() || `گردش‌کار ${relation.previousTask.code}`, tasks: new Map() };
    workflow.tasks.set(relation.previousTask.id, relation.previousTask);
    workflow.tasks.set(relation.nextTask.id, relation.nextTask);
    workflows.set(key, workflow);
  }
  const closed = eventType === "WORKFLOW_CLOSED";
  const selected = [...workflows.values()].filter((workflow) => [...workflow.tasks.values()].every((task) => task.status === "DONE") === closed);
  const heading = closed ? "✅ گردش‌کارهای بسته‌شده" : "🔄 گردش‌کارهای باز";
  const rows = selected.slice(0, 20).map((workflow) => {
    const tasks = [...workflow.tasks.values()];
    const done = tasks.filter((task) => task.status === "DONE").length;
    const active = tasks.find((task) => task.status !== "DONE");
    return `• ${workflow.name} — ${done.toLocaleString("fa-IR")}/${tasks.length.toLocaleString("fa-IR")} مرحله${active ? `\n  مرحله جاری: ${active.code} · ${active.group.name}` : ""}`;
  });
  return selected.length ? `${heading}\n\n${rows.join("\n")}${selected.length > 20 ? `\n\n… و ${(selected.length - 20).toLocaleString("fa-IR")} مورد دیگر` : ""}` : null;
}

export async function enqueueScheduledNotifications(now = new Date()) {
  const rules = await db.notificationRule.findMany({ where: { isEnabled: true }, include: { baleGroupDestination: true } });
  const clock = tehranClock(now);
  let queued = 0;
  for (const rule of rules) {
    if (rule.eventType !== "DUE_SOON" && rule.sendTime !== clock.time) continue;
    if (rule.eventType === "GROUP_OVERDUE_REPORT") {
      const destination = rule.baleGroupDestination;
      if (rule.recipientMode !== "BALE_GROUP" || !destination?.isEnabled) continue;
      const tasks = await db.task.findMany({
        where: {
          deletedAt: null,
          status: { in: ["PENDING", "STARTED"] },
          deadline: { lt: now },
          ...(destination.orgGroupId ? { groupId: destination.orgGroupId } : {}),
        },
        orderBy: [{ group: { name: "asc" } }, { assignee: { name: "asc" } }, { deadline: "asc" }],
        select: { id: true, code: true, title: true, deadline: true, status: true, group: { select: { name: true } }, assignee: { select: { name: true } } },
      });
      const text = overdueTasksDigest(tasks, now);
      if (!text) continue;
      const result = await db.notificationOutbox.createMany({
        data: [{ eventType: rule.eventType, aggregateType: "GroupOverdueReport", aggregateId: destination.orgGroupId || rule.id, memberId: null, provider: "bale", recipientId: destination.chatId, payload: { text }, idempotencyKey: `RULE:${rule.id}:GROUP_OVERDUE_REPORT:${destination.id}:${clock.date}` }],
        skipDuplicates: true,
      });
      queued += result.count;
      continue;
    }
    if (rule.eventType === "GROUP_STARTED_REPORT") {
      const destination = rule.baleGroupDestination;
      if (rule.recipientMode !== "BALE_GROUP" || !destination?.isEnabled) continue;
      const members = await db.member.findMany({
        where: {
          isActive: true,
          groupId: destination.orgGroupId || { not: null },
        },
        orderBy: [{ group: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          group: { select: { name: true } },
          tasks: {
            where: { status: "STARTED", deletedAt: null },
            orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
            select: { code: true, title: true, startedAt: true },
          },
        },
      });
      const text = startedTasksByMemberDigest(members);
      if (!text) continue;
      const result = await db.notificationOutbox.createMany({
        data: [{
          eventType: rule.eventType,
          aggregateType: "GroupStartedReport",
          aggregateId: destination.orgGroupId || rule.id,
          memberId: null,
          provider: "bale",
          recipientId: destination.chatId,
          payload: { text },
          idempotencyKey: `RULE:${rule.id}:GROUP_STARTED_REPORT:${destination.id}:${clock.date}`,
        }],
        skipDuplicates: true,
      });
      queued += result.count;
      continue;
    }
    if (["WORKFLOW_OPEN", "WORKFLOW_CLOSED"].includes(rule.eventType)) {
      const destination = rule.baleGroupDestination;
      if (rule.recipientMode !== "BALE_GROUP" || !destination?.isEnabled) continue;
      const relations = await db.taskRelation.findMany({
        where: destination.orgGroupId ? { OR: [{ previousTask: { groupId: destination.orgGroupId } }, { nextTask: { groupId: destination.orgGroupId } }] } : undefined,
        select: {
          id: true,
          workflowName: true,
          previousTask: { select: { id: true, code: true, title: true, status: true, group: { select: { name: true } } } },
          nextTask: { select: { id: true, code: true, title: true, status: true, group: { select: { name: true } } } },
        },
      });
      const text = workflowDigest(rule.eventType as "WORKFLOW_OPEN" | "WORKFLOW_CLOSED", relations);
      if (!text) continue;
      const result = await db.notificationOutbox.createMany({ data: [{ eventType: rule.eventType, aggregateType: "WorkflowDigest", aggregateId: rule.id, memberId: null, provider: "bale", recipientId: destination.chatId, payload: { text }, idempotencyKey: `RULE:${rule.id}:BALE_GROUP:${destination.id}:${clock.date}` }], skipDuplicates: true });
      queued += result.count;
      continue;
    }
    const day = tehranDayRange(now);
    const deadline = rule.eventType === "OVERDUE" ? { lt: now }
      : rule.eventType === "TODAY" ? { gte: day.start, lt: day.end }
        : { gt: now, lte: new Date(now.getTime() + (rule.leadMinutes || 0) * 60_000) };
    const tasks = await db.task.findMany({
      // Blocked tasks are intentionally reported through the separate Bale
      // "stopped tasks" view; they must not receive overdue/due reminders.
      where: { deletedAt: null, status: { in: ["PENDING", "STARTED"] }, deadline, ...(rule.recipientMode === "BALE_GROUP" && rule.baleGroupDestination?.orgGroupId ? { groupId: rule.baleGroupDestination.orgGroupId } : {}) },
      select: { id: true, code: true, title: true, deadline: true, groupId: true, group: { select: { name: true } }, assignee: { select: { id: true, name: true, notificationChannels: { where: { provider: "bale", isVerified: true, isEnabled: true }, select: { externalChatId: true, externalUserId: true } } } } },
    });
    for (const task of tasks) {
      const recipients = new Map<string, { memberId: string; recipientId: string }>();
      if (rule.recipientMode === "BALE_GROUP" && rule.baleGroupDestination?.isEnabled) {
        const destination = rule.baleGroupDestination;
        const occurrence = rule.eventType === "DUE_SOON" ? task.deadline.toISOString() : clock.date;
        const result = await db.notificationOutbox.createMany({ data: [{ eventType: `TASK_${rule.eventType}`, aggregateType: "Task", aggregateId: task.id, memberId: null, provider: "bale", recipientId: destination.chatId, payload: { text: taskText(rule.eventType, task, rule.leadMinutes) }, idempotencyKey: `RULE:${rule.id}:${task.id}:BALE_GROUP:${destination.id}:${occurrence}` }], skipDuplicates: true });
        queued += result.count;
        continue;
      }
      if (["ASSIGNEE", "BOTH"].includes(rule.recipientMode)) {
        for (const channel of task.assignee.notificationChannels) recipients.set(task.assignee.id, { memberId: task.assignee.id, recipientId: channel.externalChatId || channel.externalUserId });
      }
      if (["MANAGERS", "BOTH"].includes(rule.recipientMode)) {
        const managers = await db.member.findMany({ where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { managedGroups: { some: { groupId: task.groupId } } }] }, select: { id: true, notificationChannels: { where: { provider: "bale", isVerified: true, isEnabled: true }, select: { externalChatId: true, externalUserId: true } } } });
        for (const manager of managers) for (const channel of manager.notificationChannels) recipients.set(manager.id, { memberId: manager.id, recipientId: channel.externalChatId || channel.externalUserId });
      }
      const occurrence = rule.eventType === "DUE_SOON" ? task.deadline.toISOString() : clock.date;
      for (const recipient of recipients.values()) {
        const result = await db.notificationOutbox.createMany({ data: [{ eventType: `TASK_${rule.eventType}`, aggregateType: "Task", aggregateId: task.id, memberId: recipient.memberId, provider: "bale", recipientId: recipient.recipientId, payload: { text: taskText(rule.eventType, task, rule.leadMinutes) }, idempotencyKey: `RULE:${rule.id}:${task.id}:${recipient.memberId}:${occurrence}` }], skipDuplicates: true });
        queued += result.count;
      }
    }
  }
  return queued;
}
