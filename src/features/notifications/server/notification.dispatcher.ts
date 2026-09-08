import { db } from "@/lib/db";
import { BaleProvider } from "./providers/bale.provider";
import { NotificationProviderError } from "./providers/provider-error";

const RETRY_DELAYS_MS = [0, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;

function safeErrorMessage(error: unknown): string {
  if (error instanceof NotificationProviderError) return error.message.slice(0, 500);
  return "خطای ناشناخته در ارسال اعلان";
}

export async function processNotificationBatch(limit = 20): Promise<number> {
  const now = new Date();
  await db.notificationOutbox.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
    data: { status: "RETRY", nextAttemptAt: now },
  });
  const candidates = await db.notificationOutbox.findMany({
    where: { status: { in: ["PENDING", "RETRY"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: "asc" }, take: limit, select: { id: true },
  });
  let processed = 0;
  for (const candidate of candidates) {
    const claimed = await db.notificationOutbox.updateMany({
      where: { id: candidate.id, status: { in: ["PENDING", "RETRY"] } },
      data: { status: "PROCESSING" },
    });
    if (!claimed.count) continue;
    const item = await db.notificationOutbox.findUnique({ where: { id: candidate.id } });
    if (!item) continue;
    processed++;
    const payload = item.payload as {
      text?: unknown;
      replyMarkup?: { inline_keyboard: { text: string; callback_data: string }[][] };
    };
    try {
      if (item.provider !== "bale" || typeof payload.text !== "string") throw new NotificationProviderError("اعلان یا provider پشتیبانی نمی‌شود.", "UNSUPPORTED_NOTIFICATION", true);
      const result = await new BaleProvider().sendMessage({
        recipientId: item.recipientId,
        text: payload.text,
        replyMarkup: payload.replyMarkup,
        idempotencyKey: item.idempotencyKey,
      });
      await db.$transaction([
        db.notificationOutbox.update({ where: { id: item.id }, data: { status: "SENT", sentAt: new Date(), attemptCount: { increment: 1 }, nextAttemptAt: null, lastError: null } }),
        db.notificationLog.create({ data: { outboxId: item.id, provider: item.provider, recipientId: item.recipientId, eventType: item.eventType, status: "SENT", providerMessageId: result.providerMessageId } }),
      ]);
    } catch (error) {
      const attempt = item.attemptCount + 1;
      const permanent = error instanceof NotificationProviderError && error.permanent;
      const exhausted = attempt >= RETRY_DELAYS_MS.length;
      const failed = permanent || exhausted;
      const errorCode = error instanceof NotificationProviderError ? error.code : "UNKNOWN_ERROR";
      const errorMessage = safeErrorMessage(error);
      await db.$transaction([
        db.notificationOutbox.update({ where: { id: item.id }, data: { status: failed ? "FAILED" : "RETRY", failedAt: failed ? new Date() : null, attemptCount: attempt, nextAttemptAt: failed ? null : new Date(Date.now() + RETRY_DELAYS_MS[attempt]), lastError: errorMessage } }),
        db.notificationLog.create({ data: { outboxId: item.id, provider: item.provider, recipientId: item.recipientId, eventType: item.eventType, status: failed ? "FAILED" : "RETRY", errorCode, errorMessage } }),
      ]);
    }
  }
  return processed;
}
