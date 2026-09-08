CREATE TABLE "SystemSetting" (
  "key" TEXT NOT NULL,
  "valueEncrypted" TEXT NOT NULL,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "NotificationRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "leadMinutes" INTEGER,
  "sendTime" TEXT,
  "recipientMode" TEXT NOT NULL DEFAULT 'ASSIGNEE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationRule_isEnabled_eventType_idx" ON "NotificationRule"("isEnabled", "eventType");
