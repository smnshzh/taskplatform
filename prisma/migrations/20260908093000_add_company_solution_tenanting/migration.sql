CREATE TABLE "Solution" (
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Solution_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "selectedSolutionKey" TEXT NOT NULL,
  "ownerMemberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE UNIQUE INDEX "Company_ownerMemberId_key" ON "Company"("ownerMemberId");
CREATE INDEX "Company_selectedSolutionKey_idx" ON "Company"("selectedSolutionKey");

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_selectedSolutionKey_fkey"
  FOREIGN KEY ("selectedSolutionKey") REFERENCES "Solution"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_ownerMemberId_fkey"
  FOREIGN KEY ("ownerMemberId") REFERENCES "Member"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Member" ADD COLUMN "companyId" TEXT;
ALTER TABLE "OrgGroup" ADD COLUMN "companyId" TEXT;
ALTER TABLE "TaskTemplate" ADD COLUMN "companyId" TEXT;
ALTER TABLE "TaskSchedule" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Task" ADD COLUMN "companyId" TEXT;

CREATE INDEX "Member_companyId_idx" ON "Member"("companyId");
CREATE INDEX "OrgGroup_companyId_idx" ON "OrgGroup"("companyId");
CREATE INDEX "TaskTemplate_companyId_idx" ON "TaskTemplate"("companyId");
CREATE INDEX "TaskSchedule_companyId_idx" ON "TaskSchedule"("companyId");
CREATE INDEX "Task_companyId_idx" ON "Task"("companyId");

ALTER TABLE "Member"
  ADD CONSTRAINT "Member_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrgGroup"
  ADD CONSTRAINT "OrgGroup_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskTemplate"
  ADD CONSTRAINT "TaskTemplate_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskSchedule"
  ADD CONSTRAINT "TaskSchedule_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
