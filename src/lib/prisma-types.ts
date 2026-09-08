// Re-usable Prisma payload types with common includes
import { Prisma } from "@prisma/client";

export const authenticatedMemberSelect = {
  id: true,
  name: true,
  handle: true,
  role: true,
  companyId: true,
  groupId: true,
  supervisorId: true,
  avatar: true,
  createdAt: true,
  lastLoginAt: true,
  mustChangePassword: true,
  isActive: true,
  company: { select: { id: true, name: true, slug: true, selectedSolutionKey: true } },
  group: true,
  supervisor: {
    select: {
      id: true,
      name: true,
      handle: true,
      role: true,
      groupId: true,
      supervisorId: true,
    },
  },
  managedGroups: { include: { group: true } },
  accessGroups: { include: { accessGroup: { select: { id: true, name: true, permissions: true } } } },
} satisfies Prisma.MemberSelect;

// Authenticated member with safe scalar selection and required relations.
export type MemberWithRelations = Prisma.MemberGetPayload<{
  select: typeof authenticatedMemberSelect;
}>;

export type CompanyWithSolution = Prisma.CompanyGetPayload<{
  include: { selectedSolution: true; ownerMember: { select: { id: true; name: true; handle: true } } };
}>;

// Helper: get group IDs that a member manages (empty array if not a manager)
export function getManagedGroupIds(member: MemberWithRelations): string[] {
  return member.managedGroups.map((gm) => gm.groupId);
}

// Member with group, supervisor, and task count
export type MemberWithCount = Prisma.MemberGetPayload<{
  include: {
    group: true;
    supervisor: true;
    _count: { select: { tasks: true } };
  };
}>;

// Task with full relations
export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    assignee: true;
    creator: true;
    group: true;
    referer: true;
    approver: true;
  };
}>;

// Task with logs
export type TaskWithLogs = Prisma.TaskGetPayload<{
  include: {
    assignee: true;
    creator: true;
    group: true;
    referer: true;
    approver: true;
    logs: { orderBy: { createdAt: "desc" }; take: 30 };
  };
}>;

// OrgGroup with managers and counts
export type GroupWithManager = Prisma.OrgGroupGetPayload<{
  include: {
    managers: { include: { member: true } };
    _count: { select: { members: true; taskTemplates: true; tasks: true } };
  };
}>;

// TaskSchedule with template, assignee, and override
export type ScheduleWithRelations = Prisma.TaskScheduleGetPayload<{
  include: {
    taskTemplate: { include: { group: true } };
    assignee: true;
    overrideAssignee: true;
  };
}>;

// TaskTemplate with group and schedule count
export type TemplateWithRelations = Prisma.TaskTemplateGetPayload<{
  include: {
    group: true;
    _count: { select: { schedules: true } };
  };
}>;
