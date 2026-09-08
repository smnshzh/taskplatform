-- Add Clerk linkage to app members
ALTER TABLE "Member" ADD COLUMN "clerkUserId" TEXT;

CREATE UNIQUE INDEX "Member_clerkUserId_key" ON "Member"("clerkUserId");
