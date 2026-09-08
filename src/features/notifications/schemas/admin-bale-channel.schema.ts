import { z } from "zod";

const baleIdentifier = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_:@.+-]+$/, "شناسه بله نامعتبر است.");

export const adminBaleChannelSchema = z.object({
  externalUserId: baleIdentifier,
  externalChatId: baleIdentifier.optional(),
});
