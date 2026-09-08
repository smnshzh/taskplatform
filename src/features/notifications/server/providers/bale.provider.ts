import type { NotificationProvider, SendMessageInput, SendMessageResult } from "./notification-provider";
import { NotificationProviderError } from "./provider-error";
import { getBaleBotToken } from "../system-settings.service";

type BaleResponse = {
  ok?: boolean;
  description?: string;
  result?: { message_id?: string | number };
};

export class BaleProvider implements NotificationProvider {
  readonly name = "bale" as const;

  constructor(
    private readonly token?: string,
    private readonly apiBaseUrl = process.env.BALE_API_BASE_URL?.trim() || "https://tapi.bale.ai",
    private readonly timeoutMs = 10_000,
  ) {}

  async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    const token = this.token?.trim() || await getBaleBotToken();
    if (!token) throw new NotificationProviderError("توکن ربات بله تنظیم نشده است.", "BALE_NOT_CONFIGURED", true);
    const response = await fetch(`${this.apiBaseUrl.replace(/\/$/, "")}/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new NotificationProviderError("پاسخ callback بله ناموفق بود.", `BALE_HTTP_${response.status}`, false);
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const token = this.token?.trim() || await getBaleBotToken();
    if (!token) {
      throw new NotificationProviderError("توکن ربات بله تنظیم نشده است.", "BALE_NOT_CONFIGURED", true);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.apiBaseUrl.replace(/\/$/, "")}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: input.recipientId,
          text: input.text,
          ...(input.parseMode === "markdown" ? { parse_mode: "Markdown" } : {}),
          ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
        }),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as BaleResponse;
      if (!response.ok || body.ok === false) {
        const permanent = [400, 401, 403, 404].includes(response.status);
        throw new NotificationProviderError(
          body.description || `Bale HTTP ${response.status}`,
          `BALE_HTTP_${response.status}`,
          permanent,
        );
      }
      return {
        delivered: true,
        providerMessageId: body.result?.message_id?.toString(),
        rawStatus: "ok",
      };
    } catch (error) {
      if (error instanceof NotificationProviderError) throw error;
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new NotificationProviderError(
        timedOut ? "مهلت ارتباط با بله پایان یافت." : "ارتباط با بله ناموفق بود.",
        timedOut ? "BALE_TIMEOUT" : "BALE_NETWORK_ERROR",
        false,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
