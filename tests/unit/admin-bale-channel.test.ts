import { describe, expect, it } from "vitest";
import { adminBaleChannelSchema } from "@/features/notifications/schemas/admin-bale-channel.schema";

describe("admin Bale channel validation", () => {
  it("accepts numeric ids and UUID-like values", () => {
    expect(adminBaleChannelSchema.safeParse({ externalUserId: "183266491" }).success).toBe(true);
    expect(adminBaleChannelSchema.safeParse({ externalUserId: "550e8400-e29b-41d4-a716-446655440000", externalChatId: "183266491" }).success).toBe(true);
  });

  it("rejects blank and control-character identifiers", () => {
    expect(adminBaleChannelSchema.safeParse({ externalUserId: "" }).success).toBe(false);
    expect(adminBaleChannelSchema.safeParse({ externalUserId: "123\n456" }).success).toBe(false);
  });
});
