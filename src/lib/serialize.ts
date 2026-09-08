import type { Task, Member, FollowUpLog, OrgGroup, TaskTemplate, TaskSchedule } from "@prisma/client";
import { roleByKey, priorityByKey, statusByKey, sourceByKey, approvalStatusByKey } from "./constants";
import type { GroupWithManager, MemberWithCount, ScheduleWithRelations, TemplateWithRelations, TaskWithRelations } from "./prisma-types";

export type SerializedGroupManager = {
  memberId: string;
  memberName: string;
  memberHandle: string;
};

export type SerializedGroup = {
  id: string;
  name: string;
  code: string;
  managers: SerializedGroupManager[];
  memberCount: number;
  createdAt: string;
};

export function serializeGroup(
  g: GroupWithManager
): SerializedGroup {
  return {
    id: g.id,
    name: g.name,
    code: g.code,
    managers: (g.managers ?? []).map((gm) => ({
      memberId: gm.memberId,
      memberName: gm.member.name,
      memberHandle: gm.member.handle,
    })),
    memberCount: g._count?.members ?? 0,
    createdAt: g.createdAt.toISOString(),
  };
}

export type SerializedMember = {
  id: string;
  name: string;
  handle: string;
  role: string;
  roleLabel: string;
  groupId: string | null;
  groupName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  taskCount: number;
  activeCount: number;
  lastLoginAt: string | null;
};

export function serializeMember(
  member: MemberWithCount,
  activeCount: number
): SerializedMember {
  return {
    id: member.id,
    name: member.name,
    handle: member.handle,
    role: member.role,
    roleLabel: roleByKey(member.role)?.label ?? member.role,
    groupId: member.groupId,
    groupName: member.group?.name ?? null,
    supervisorId: member.supervisorId,
    supervisorName: member.supervisor?.name ?? null,
    taskCount: member._count?.tasks ?? 0,
    activeCount,
    lastLoginAt: member.lastLoginAt ? member.lastLoginAt.toISOString() : null,
  };
}

export type SerializedTaskTemplate = {
  id: string;
  name: string;
  description: string | null;
  groupId: string;
  groupName: string | null;
  priority: string;
  scheduleCount: number;
  createdAt: string;
};

export function serializeTaskTemplate(
  t: TemplateWithRelations
): SerializedTaskTemplate {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    groupId: t.groupId,
    groupName: t.group?.name ?? null,
    priority: t.priority,
    scheduleCount: t._count?.schedules ?? 0,
    createdAt: t.createdAt.toISOString(),
  };
}

export type SerializedSchedule = {
  id: string;
  taskTemplateId: string;
  taskTemplateName: string;
  dayOfWeek: number | null;
  dayOfWeekLabel: string | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  assigneeId: string;
  assigneeName: string;
  overrideAssigneeId: string | null;
  overrideAssigneeName: string | null;
  overrideDate: string | null;
};

export function serializeSchedule(
  s: ScheduleWithRelations
): SerializedSchedule {
  const dayLabels = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
  return {
    id: s.id,
    taskTemplateId: s.taskTemplateId,
    taskTemplateName: s.taskTemplate?.name ?? "",
    dayOfWeek: s.dayOfWeek,
    dayOfWeekLabel: s.dayOfWeek !== null ? dayLabels[s.dayOfWeek] ?? null : null,
    specificDate: s.specificDate,
    startTime: s.startTime,
    endTime: s.endTime,
    assigneeId: s.assigneeId,
    assigneeName: s.assignee?.name ?? "",
    overrideAssigneeId: s.overrideAssigneeId,
    overrideAssigneeName: s.overrideAssignee?.name ?? null,
    overrideDate: s.overrideDate,
  };
}

export type SerializedTask = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  groupId: string;
  groupName: string | null;
  source: string;
  sourceLabel: string;
  assigneeId: string;
  assigneeName: string;
  assigneeHandle: string;
  creatorId: string | null;
  creatorName: string | null;
  priority: string;
  status: string;
  letterNumber: string | null;
  letterDate: string | null;
  refererId: string | null;
  refererName: string | null;
  approvalStatus: string | null;
  approvalStatusLabel: string | null;
  approverId: string | null;
  approverName: string | null;
  approvedAt: string | null;
  startTime: string | null;
  deadline: string;
  link: string | null;
  followUpReason: string | null;
  startedAt: string | null;
  doneDescription: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeTask(
  task: TaskWithRelations
): SerializedTask {
  return {
    id: task.id,
    code: task.code,
    title: task.title,
    description: task.description,
    groupId: task.groupId,
    groupName: task.group?.name ?? null,
    source: task.source,
    sourceLabel: sourceByKey(task.source)?.label ?? task.source,
    assigneeId: task.assigneeId,
    assigneeName: task.assignee?.name ?? "",
    assigneeHandle: task.assignee?.handle ?? "",
    creatorId: task.creatorId,
    creatorName: task.creator?.name ?? null,
    priority: task.priority,
    status: task.status,
    letterNumber: task.letterNumber,
    letterDate: task.letterDate,
    refererId: task.refererId,
    refererName: task.referer?.name ?? null,
    approvalStatus: task.approvalStatus,
    approvalStatusLabel: task.approvalStatus
      ? approvalStatusByKey(task.approvalStatus)?.label ?? task.approvalStatus
      : null,
    approverId: task.approverId,
    approverName: task.approver?.name ?? null,
    approvedAt: task.approvedAt ? task.approvedAt.toISOString() : null,
    startTime: task.startTime ? task.startTime.toISOString() : null,
    deadline: task.deadline.toISOString(),
    link: task.link,
    followUpReason: task.followUpReason,
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    doneDescription: task.doneDescription,
    doneAt: task.doneAt ? task.doneAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export type SerializedLog = {
  id: string;
  type: string;
  message: string;
  reason: string | null;
  createdAt: string;
};

export function serializeLog(log: FollowUpLog): SerializedLog {
  return {
    id: log.id,
    type: log.type,
    message: log.message,
    reason: log.reason,
    createdAt: log.createdAt.toISOString(),
  };
}
