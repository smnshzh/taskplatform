ALTER TABLE "Task" ADD COLUMN "creatorId" TEXT;

CREATE INDEX "Task_creatorId_idx" ON "Task"("creatorId");

ALTER TABLE "Task"
ADD CONSTRAINT "Task_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "Member"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
