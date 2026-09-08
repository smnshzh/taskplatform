import type { Prisma } from "@prisma/client";

type Transaction = Prisma.TransactionClient;

export async function ensureWorkflowTaskReady(tx: Transaction, taskId: string) {
  const prerequisites = await tx.taskRelation.findMany({
    where: { nextTaskId: taskId },
    include: { previousTask: { select: { status: true } } },
  });
  if (prerequisites.some((relation) => relation.previousTask.status !== "DONE")) {
    throw new Error("این تسک هنوز منتظر انجام مرحله قبلی گردش‌کار است.");
  }
}

export async function connectWorkflowTasks(
  tx: Transaction,
  input: { previousTaskId: string; nextTaskId: string; createdById: string; workflowName?: string | null },
) {
  if (input.previousTaskId === input.nextTaskId) {
    throw new Error("یک تسک نمی‌تواند به خودش متصل شود.");
  }
  const tasks = await tx.task.findMany({
    where: { id: { in: [input.previousTaskId, input.nextTaskId] }, deletedAt: null },
    select: { id: true, groupId: true },
  });
  if (tasks.length !== 2) throw new Error("یکی از تسک‌های گردش‌کار یافت نشد.");
  const edges = await tx.taskRelation.findMany({
    select: { previousTaskId: true, nextTaskId: true },
  });
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    const next = graph.get(edge.previousTaskId) ?? [];
    next.push(edge.nextTaskId);
    graph.set(edge.previousTaskId, next);
  }
  const pending = [input.nextTaskId];
  const visited = new Set<string>();
  while (pending.length) {
    const taskId = pending.pop()!;
    if (taskId === input.previousTaskId) {
      throw new Error("این ارتباط در گردش‌کار چرخه ایجاد می‌کند.");
    }
    if (visited.has(taskId)) continue;
    visited.add(taskId);
    pending.push(...(graph.get(taskId) ?? []));
  }

  return tx.taskRelation.upsert({
    where: {
      previousTaskId_nextTaskId: {
        previousTaskId: input.previousTaskId,
        nextTaskId: input.nextTaskId,
      },
    },
    create: input,
    update: input.workflowName ? { workflowName: input.workflowName } : {},
  });
}

export async function getTaskWorkflow(tx: Transaction, taskId: string) {
  const [previous, next] = await Promise.all([
    tx.taskRelation.findMany({
      where: { nextTaskId: taskId },
      include: { previousTask: { include: { assignee: true } } },
      orderBy: { createdAt: "asc" },
    }),
    tx.taskRelation.findMany({
      where: { previousTaskId: taskId },
      include: { nextTask: { include: { assignee: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const serialize = (task: { id: string; code: string; title: string; status: string; assignee: { name: string } }) => ({
    id: task.id,
    code: task.code,
    title: task.title,
    status: task.status,
    assigneeName: task.assignee.name,
  });
  return {
    previous: previous.map((relation) => serialize(relation.previousTask)),
    next: next.map((relation) => serialize(relation.nextTask)),
  };
}
