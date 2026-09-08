CREATE TABLE "AccessGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT[] NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessGroupMember" (
  "accessGroupId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessGroupMember_pkey" PRIMARY KEY ("accessGroupId", "memberId")
);

CREATE UNIQUE INDEX "AccessGroup_name_key" ON "AccessGroup"("name");
CREATE INDEX "AccessGroupMember_memberId_idx" ON "AccessGroupMember"("memberId");
ALTER TABLE "AccessGroupMember" ADD CONSTRAINT "AccessGroupMember_accessGroupId_fkey" FOREIGN KEY ("accessGroupId") REFERENCES "AccessGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessGroupMember" ADD CONSTRAINT "AccessGroupMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
