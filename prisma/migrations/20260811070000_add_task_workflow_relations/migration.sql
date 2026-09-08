CREATE TABLE "TaskRelation" (
  "id" TEXT NOT NULL,
  "previousTaskId" TEXT NOT NULL,
  "nextTaskId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskRelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskRelation_previousTaskId_nextTaskId_key" ON "TaskRelation"("previousTaskId", "nextTaskId");
CREATE INDEX "TaskRelation_previousTaskId_idx" ON "TaskRelation"("previousTaskId");
CREATE INDEX "TaskRelation_nextTaskId_idx" ON "TaskRelation"("nextTaskId");
CREATE INDEX "TaskRelation_createdById_idx" ON "TaskRelation"("createdById");

ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_previousTaskId_fkey"
  FOREIGN KEY ("previousTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_nextTaskId_fkey"
  FOREIGN KEY ("nextTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskRelation" ADD CONSTRAINT "TaskRelation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
