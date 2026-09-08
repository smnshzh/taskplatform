import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export function normalizeLinkCode(value: string): string {
  return value.replace(/\D/g, "");
}

export function hashLinkCode(code: string, secret = process.env.ACCOUNT_LINK_SECRET): string {
  if (!secret?.trim()) throw new Error("ACCOUNT_LINK_SECRET_NOT_CONFIGURED");
  return createHash("sha256").update(`${secret}:${normalizeLinkCode(code)}`).digest("hex");
}

export function linkCodeMatches(code: string, expectedHash: string, secret?: string): boolean {
  const actual = Buffer.from(hashLinkCode(code, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createBaleLinkCode(memberId: string, createdByIp: string | null) {
  const code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  await db.$transaction([
    db.accountLinkCode.updateMany({
      where: { memberId, provider: "bale", usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.accountLinkCode.create({
      data: { memberId, provider: "bale", codeHash: hashLinkCode(code), expiresAt, createdByIp },
    }),
  ]);
  return { code, expiresAt };
}

export async function consumeBaleLinkCode(input: {
  code: string;
  externalUserId: string;
  externalChatId: string;
}) {
  const codeHash = hashLinkCode(input.code);
  return db.$transaction(async (tx) => {
    const link = await tx.accountLinkCode.findUnique({ where: { codeHash } });
    if (!link || link.provider !== "bale" || link.usedAt || link.revokedAt || link.expiresAt <= new Date()) {
      if (link && link.attemptCount < 10) {
        await tx.accountLinkCode.update({ where: { id: link.id }, data: { attemptCount: { increment: 1 } } });
      }
      return null;
    }
    const conflicting = await tx.notificationChannel.findUnique({
      where: { provider_externalUserId: { provider: "bale", externalUserId: input.externalUserId } },
      select: { memberId: true },
    });
    if (conflicting && conflicting.memberId !== link.memberId) return null;

    const channel = await tx.notificationChannel.upsert({
      where: { memberId_provider: { memberId: link.memberId, provider: "bale" } },
      create: { memberId: link.memberId, provider: "bale", externalUserId: input.externalUserId, externalChatId: input.externalChatId, isVerified: true },
      update: { externalUserId: input.externalUserId, externalChatId: input.externalChatId, isVerified: true, isEnabled: true },
    });
    await tx.accountLinkCode.update({ where: { id: link.id }, data: { usedAt: new Date(), attemptCount: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorId: link.memberId, action: "NOTIFICATION_CHANNEL_LINKED", entityType: "NotificationChannel", entityId: channel.id, result: "SUCCESS", metadata: { provider: "bale" } } });
    return channel;
  });
}
