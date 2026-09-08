import { afterEach, describe, expect, it, vi } from "vitest";
import { hashLinkCode, linkCodeMatches, normalizeLinkCode } from "@/features/notifications/server/account-link.service";
import { BaleProvider } from "@/features/notifications/server/providers/bale.provider";
import { NotificationProviderError } from "@/features/notifications/server/providers/provider-error";
import { formatTaskAssignedMessage, formatTaskStatusMessage, taskAssignedReplyMarkup } from "@/features/notifications/server/notification.events";
import { baleTaskStatusLabel, mainMenuMarkup, parseNewTaskCommand, wizardReview } from "@/features/notifications/server/bale-command.service";
import { baleWebhookSchema } from "@/features/notifications/schemas/bale-webhook.schema";

describe("Bale account linking", () => {
  it("normalizes Persian and separator-free link codes", () => {
    expect(normalizeLinkCode("12-34 56")).toBe("123456");
  });

  it("hashes codes with an application secret and compares safely", () => {
    const hash = hashLinkCode("123456", "test-secret");
    expect(hash).not.toContain("123456");
    expect(linkCodeMatches("123456", hash, "test-secret")).toBe(true);
    expect(linkCodeMatches("654321", hash, "test-secret")).toBe(false);
  });
});

describe("BaleProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends a Telegram-compatible Bale sendMessage request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new BaleProvider("token", "https://bale.test").sendMessage({ recipientId: "10", text: "سلام", idempotencyKey: "key" });
    expect(result).toMatchObject({ delivered: true, providerMessageId: "42" });
    expect(fetchMock).toHaveBeenCalledWith("https://bale.test/bottoken/sendMessage", expect.objectContaining({ method: "POST" }));
  });

  it("marks invalid recipients as permanent failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 404 })));
    await expect(new BaleProvider("token", "https://bale.test").sendMessage({ recipientId: "x", text: "test", idempotencyKey: "key" }))
      .rejects.toMatchObject({ code: "BALE_HTTP_404", permanent: true } satisfies Partial<NotificationProviderError>);
  });
});

describe("Bale task assignment message", () => {
  it("identifies the task creator", () => {
    const message = formatTaskAssignedMessage({
      taskCode: "TSK-0001",
      title: "تهیه گزارش",
      actorName: "علی رضایی",
      deadline: new Date("2026-08-03T08:00:00.000Z"),
    });

    expect(message).toContain("تعریف‌کننده: علی رضایی");
    expect(message).toContain("ددلاین:");
    expect(message).toContain("به وقت تهران");
    expect(message).toContain("کد: TSK-0001");
    expect(message).not.toContain("مشاهده:");
    expect(taskAssignedReplyMarkup("task-1")).toEqual({
      inline_keyboard: [[{ text: "▶️ شروع تسک", callback_data: "start:task-1" }]],
    });
  });
});

describe("Bale manager task-status messages", () => {
  it("reports a started task with its assignee and code", () => {
    const message = formatTaskStatusMessage({
      taskCode: "TSK-0002",
      title: "  تهیه   گزارش فروش  ",
      assigneeName: "علی رضایی",
      status: "STARTED",
    });
    expect(message).toContain("تسک شروع شد");
    expect(message).toContain("عنوان: تهیه گزارش فروش");
    expect(message).toContain("مسئول: علی رضایی");
    expect(message).toContain("کد: TSK-0002");
  });

  it("reports a completed task", () => {
    expect(formatTaskStatusMessage({
      taskCode: "TSK-0002",
      title: "تهیه گزارش فروش",
      assigneeName: "علی رضایی",
      status: "DONE",
    })).toContain("تسک انجام شد");
  });
});

describe("Bale new-task command", () => {
  it("parses Persian digits and stores the deadline using Tehran time", () => {
    const result = parseNewTaskCommand("/newtask @ali | تهیه گزارش | ۱۴۰۵/۰۵/۲۰ ۱۴:۳۰ | HIGH");
    expect(result).toMatchObject({ ok: true, handle: "@ali", title: "تهیه گزارش", priority: "HIGH" });
    if (result.ok) expect(result.deadline.toISOString()).toBe("2026-08-11T11:00:00.000Z");
  });

  it("rejects malformed commands", () => {
    expect(parseNewTaskCommand("/newtask @ali | عنوان")).toMatchObject({ ok: false });
  });
});

describe("Bale professional menus", () => {
  it("labels in-progress tasks in list buttons", () => {
    expect(baleTaskStatusLabel("STARTED")).toContain("در حال انجام");
  });
  it("shows task creation only when permitted", () => {
    expect(JSON.stringify(mainMenuMarkup(true))).toContain("menu:new");
    expect(JSON.stringify(mainMenuMarkup(false))).not.toContain("menu:new");
  });

  it("shows team task menus only for managers", () => {
    expect(JSON.stringify(mainMenuMarkup(true, true))).toContain("team:open");
    expect(JSON.stringify(mainMenuMarkup(true, true))).toContain("team:blocked");
    expect(JSON.stringify(mainMenuMarkup(true, true))).toContain("team:workflows:open");
    expect(JSON.stringify(mainMenuMarkup(true, true))).toContain("team:workflows:closed");
    expect(JSON.stringify(mainMenuMarkup(true, false))).not.toContain("team:open");
  });

  it("renders a final review with confirmation and cancellation", () => {
    const review = wizardReview({
      assigneeName: "علی رضایی",
      title: "تهیه گزارش",
      deadline: "2026-08-11T11:00:00.000Z",
      priority: "HIGH",
    });
    expect(review.text).toContain("مرور نهایی");
    expect(JSON.stringify(review.replyMarkup)).toContain("new:confirm");
    expect(JSON.stringify(review.replyMarkup)).toContain("new:cancel");
  });

  it("accepts callback updates from Bale webhook", () => {
    expect(baleWebhookSchema.safeParse({
      update_id: 10,
      callback_query: {
        id: "callback-1",
        data: "menu:new",
        from: { id: 20 },
        message: { chat: { id: 30 } },
      },
    }).success).toBe(true);
  });
});
