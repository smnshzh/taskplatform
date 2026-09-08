import { describe, expect, it } from "vitest";
import { shouldIgnoreBaleGroupMessage } from "@/features/notifications/server/bale-update-policy";

describe("Bale group update policy", () => {
  it("ignores ordinary group messages", () => {
    expect(shouldIgnoreBaleGroupMessage({ chatType: "group", text: "سلام دوستان", hasCallback: false })).toBe(true);
    expect(shouldIgnoreBaleGroupMessage({ chatType: "supergroup", text: "گزارش آماده شد", hasCallback: false })).toBe(true);
  });

  it("allows explicit commands in groups", () => {
    expect(shouldIgnoreBaleGroupMessage({ chatType: "group", text: "/chatid", hasCallback: false })).toBe(false);
  });

  it("allows bot buttons and private messages", () => {
    expect(shouldIgnoreBaleGroupMessage({ chatType: "group", text: undefined, hasCallback: true })).toBe(false);
    expect(shouldIgnoreBaleGroupMessage({ chatType: "private", text: "سلام", hasCallback: false })).toBe(false);
  });
});
