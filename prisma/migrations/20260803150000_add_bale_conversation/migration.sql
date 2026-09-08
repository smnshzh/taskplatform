CREATE TABLE "BaleConversation" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BaleConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BaleConversation_memberId_key" ON "BaleConversation"("memberId");
CREATE INDEX "BaleConversation_expiresAt_idx" ON "BaleConversation"("expiresAt");

ALTER TABLE "BaleConversation"
ADD CONSTRAINT "BaleConversation_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
