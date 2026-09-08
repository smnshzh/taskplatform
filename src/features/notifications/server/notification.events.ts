import type { Prisma } from "@prisma/client";

export function formatTaskAssignedMessage(input: {
  taskCode: string;
  title: string;
  actorName: string;
  deadline: Date;
}) {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 160);
  const deadline = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short",
  }).format(input.deadline);
  return [
    "📌 یک تسک جدید به شما واگذار شد",
    `عنوان: ${title}`,
    `تعریف‌کننده: ${input.actorName}`,
    `ددلاین: ${deadline} (به وقت تهران)`,
    `کد: ${input.taskCode}`,
  ].join("\n");
}

export function taskAssignedReplyMarkup(taskId: string) {
  return {
    inline_keyboard: [[
      { text: "▶️ شروع تسک", callback_data: `start:${taskId}` },
    ]],
  };
}

export async function enqueueTaskAssigned(
  tx: Prisma.TransactionClient,
  input: { taskId: string; taskCode: string; title: string; memberId: string; actorName: string; deadline: Date; updatedAt: Date },
) {
  const channel = await tx.notificationChannel.findUnique({
    where: { memberId_provider: { memberId: input.memberId, provider: "bale" } },
    select: { externalChatId: true, externalUserId: true, isEnabled: true, isVerified: true },
  });
  if (!channel?.isEnabled || !channel.isVerified) return;
  const preference = await tx.notificationPreference.findUnique({
    where: { memberId_eventType: { memberId: input.memberId, eventType: "TASK_ASSIGNED" } },
    select: { baleEnabled: true },
  });
  if (preference?.baleEnabled === false) return;

  const text = formatTaskAssignedMessage({
    taskCode: input.taskCode,
    title: input.title,
    actorName: input.actorName,
    deadline: input.deadline,
  });

  await tx.notificationOutbox.create({
    data: {
      eventType: "TASK_ASSIGNED", aggregateType: "Task", aggregateId: input.taskId,
      memberId: input.memberId, provider: "bale", recipientId: channel.externalChatId || channel.externalUserId,
      payload: { text, replyMarkup: taskAssignedReplyMarkup(input.taskId) },
      idempotencyKey: `TASK_ASSIGNED:${input.taskId}:${input.memberId}:${input.updatedAt.toISOString()}`,
    },
  });
}

export function formatTaskStatusMessage(input: {
  taskCode: string;
  title: string;
  assigneeName: string;
  status: "STARTED" | "DONE";
}) {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 160);
  const headline = input.status === "STARTED"
    ? "▶️ تسک شروع شد"
    : "✅ تسک انجام شد";
  return [
    headline,
    `عنوان: ${title}`,
    `مسئول: ${input.assigneeName}`,
    `کد: ${input.taskCode}`,
  ].join("\n");
}

export async function enqueueTaskStatusChangedForManagers(
  tx: Prisma.TransactionClient,
  input: {
    taskId: string;
    taskCode: string;
    title: string;
    groupId: string;
    assigneeName: string;
    status: "STARTED" | "DONE";
    changedAt: Date;
  },
) {
  const eventType = input.status === "STARTED" ? "TASK_STARTED" : "TASK_COMPLETED";
  const managers = await tx.groupManager.findMany({
    where: { groupId: input.groupId },
    select: { memberId: true },
  });
  const memberIds = managers.map((manager) => manager.memberId);
  if (!memberIds.length) return;

  const [channels, disabledPreferences] = await Promise.all([
    tx.notificationChannel.findMany({
      where: {
        memberId: { in: memberIds },
        provider: "bale",
        isEnabled: true,
        isVerified: true,
      },
      select: { memberId: true, externalChatId: true, externalUserId: true },
    }),
    tx.notificationPreference.findMany({
      where: { memberId: { in: memberIds }, eventType, baleEnabled: false },
      select: { memberId: true },
    }),
  ]);
  const disabledMemberIds = new Set(disabledPreferences.map((preference) => preference.memberId));
  const text = formatTaskStatusMessage(input);

  await Promise.all(channels
    .filter((channel) => !disabledMemberIds.has(channel.memberId))
    .map((channel) => tx.notificationOutbox.create({
      data: {
        eventType,
        aggregateType: "Task",
        aggregateId: input.taskId,
        memberId: channel.memberId,
        provider: "bale",
        recipientId: channel.externalChatId || channel.externalUserId,
        payload: { text },
        idempotencyKey: `${eventType}:${input.taskId}:${channel.memberId}:${input.changedAt.toISOString()}`,
      },
    })));
}

export async function enqueueReadyWorkflowSuccessors(
  tx: Prisma.TransactionClient,
  input: { completedTaskId: string; changedAt: Date },
) {
  const relations = await tx.taskRelation.findMany({
    where: { previousTaskId: input.completedTaskId },
    include: {
      nextTask: {
        include: {
          assignee: true,
          workflowPrevious: { include: { previousTask: { select: { status: true } } } },
        },
      },
    },
  });
  for (const relation of relations) {
    const task = relation.nextTask;
    if (task.status === "DONE" || !task.workflowPrevious.every((item) => item.previousTask.status === "DONE")) continue;
    const channel = await tx.notificationChannel.findUnique({
      where: { memberId_provider: { memberId: task.assigneeId, provider: "bale" } },
      select: { externalChatId: true, externalUserId: true, isEnabled: true, isVerified: true },
    });
    if (!channel?.isEnabled || !channel.isVerified) continue;
    const preference = await tx.notificationPreference.findUnique({
      where: { memberId_eventType: { memberId: task.assigneeId, eventType: "TASK_WORKFLOW_READY" } },
      select: { baleEnabled: true },
    });
    if (preference?.baleEnabled === false) continue;
    await tx.notificationOutbox.upsert({
      where: { idempotencyKey: `TASK_WORKFLOW_READY:${task.id}:${task.assigneeId}` },
      create: {
        eventType: "TASK_WORKFLOW_READY",
        aggregateType: "Task",
        aggregateId: task.id,
        memberId: task.assigneeId,
        provider: "bale",
        recipientId: channel.externalChatId || channel.externalUserId,
        payload: {
          text: ["🔄 مرحله قبلی گردش‌کار انجام شد", `تسک بعدی به شما تحویل شد: ${task.title}`, `کد: ${task.code}`].join("\n"),
          replyMarkup: taskAssignedReplyMarkup(task.id),
        },
        idempotencyKey: `TASK_WORKFLOW_READY:${task.id}:${task.assigneeId}`,
      },
      update: {},
    });
  }
}
