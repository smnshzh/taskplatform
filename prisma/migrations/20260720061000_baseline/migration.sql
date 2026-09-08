-- Baseline migration for the PostgreSQL schema that predates Prisma Migrate.
-- Existing environments must mark this migration as applied; do not execute it
-- against a database that already contains these tables.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "OrgGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupManager" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupManager_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '1234',
    "role" TEXT NOT NULL DEFAULT 'SPECIALIST',
    "groupId" TEXT,
    "supervisorId" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskSchedule" (
    "id" TEXT NOT NULL,
    "taskTemplateId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "specificDate" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "overrideAssigneeId" TEXT,
    "overrideDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "assigneeId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "letterNumber" TEXT,
    "letterDate" TEXT,
    "refererId" TEXT,
    "approvalStatus" TEXT,
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "link" TEXT,
    "followUpReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "doneDescription" TEXT,
    "doneAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowUpLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUpLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgGroup_code_key" ON "OrgGroup"("code");
CREATE INDEX "GroupManager_groupId_idx" ON "GroupManager"("groupId");
CREATE INDEX "GroupManager_memberId_idx" ON "GroupManager"("memberId");
CREATE UNIQUE INDEX "GroupManager_groupId_memberId_key" ON "GroupManager"("groupId", "memberId");
CREATE UNIQUE INDEX "Member_handle_key" ON "Member"("handle");
CREATE INDEX "Member_groupId_idx" ON "Member"("groupId");
CREATE INDEX "Member_supervisorId_idx" ON "Member"("supervisorId");
CREATE INDEX "Member_role_idx" ON "Member"("role");
CREATE INDEX "TaskTemplate_groupId_idx" ON "TaskTemplate"("groupId");
CREATE INDEX "TaskSchedule_taskTemplateId_idx" ON "TaskSchedule"("taskTemplateId");
CREATE INDEX "TaskSchedule_assigneeId_idx" ON "TaskSchedule"("assigneeId");
CREATE INDEX "TaskSchedule_dayOfWeek_idx" ON "TaskSchedule"("dayOfWeek");
CREATE UNIQUE INDEX "Task_code_key" ON "Task"("code");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_groupId_idx" ON "Task"("groupId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_deadline_idx" ON "Task"("deadline");
CREATE INDEX "Task_approvalStatus_idx" ON "Task"("approvalStatus");
CREATE INDEX "Task_source_idx" ON "Task"("source");
CREATE INDEX "Task_deletedAt_idx" ON "Task"("deletedAt");
CREATE INDEX "FollowUpLog_taskId_idx" ON "FollowUpLog"("taskId");

ALTER TABLE "GroupManager" ADD CONSTRAINT "GroupManager_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "OrgGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupManager" ADD CONSTRAINT "GroupManager_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "OrgGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "OrgGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskSchedule" ADD CONSTRAINT "TaskSchedule_taskTemplateId_fkey"
  FOREIGN KEY ("taskTemplateId") REFERENCES "TaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskSchedule" ADD CONSTRAINT "TaskSchedule_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskSchedule" ADD CONSTRAINT "TaskSchedule_overrideAssigneeId_fkey"
  FOREIGN KEY ("overrideAssigneeId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "OrgGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_refererId_fkey"
  FOREIGN KEY ("refererId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
