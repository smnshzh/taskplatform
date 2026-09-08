CREATE TABLE "BaleGroupDestination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orgGroupId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BaleGroupDestination_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationRule" ADD COLUMN "baleGroupDestinationId" TEXT;
ALTER TABLE "NotificationOutbox" ALTER COLUMN "memberId" DROP NOT NULL;

CREATE UNIQUE INDEX "BaleGroupDestination_chatId_key" ON "BaleGroupDestination"("chatId");
CREATE INDEX "BaleGroupDestination_isEnabled_idx" ON "BaleGroupDestination"("isEnabled");
CREATE INDEX "BaleGroupDestination_orgGroupId_idx" ON "BaleGroupDestination"("orgGroupId");
CREATE INDEX "NotificationRule_baleGroupDestinationId_idx" ON "NotificationRule"("baleGroupDestinationId");

ALTER TABLE "BaleGroupDestination" ADD CONSTRAINT "BaleGroupDestination_orgGroupId_fkey" FOREIGN KEY ("orgGroupId") REFERENCES "OrgGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_baleGroupDestinationId_fkey" FOREIGN KEY ("baleGroupDestinationId") REFERENCES "BaleGroupDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
