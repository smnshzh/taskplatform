import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { baleWebhookSchema } from "@/features/notifications/schemas/bale-webhook.schema";
import { consumeBaleLinkCode, normalizeLinkCode } from "@/features/notifications/server/account-link.service";
import { BaleProvider } from "@/features/notifications/server/providers/bale.provider";
import { getBaleMainMenu, getBaleTaskMenu, handleBaleCommand, handleBaleMenuAction, handleBaleTaskAction, handleBaleWizardText, type BaleTaskListMode } from "@/features/notifications/server/bale-command.service";

function hasValidSecret(request: NextRequest): boolean {
  const expected = process.env.BALE_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const supplied = request.headers.get("x-bale-webhook-secret") || request.headers.get("x-telegram-bot-api-secret-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return supplied === expected;
}

function extractLinkCode(text?: string): string | null {
  if (!text) return null;
  const match = text.trim().match(/^\/(?:start|link)(?:@\w+)?\s+([0-9۰-۹٠-٩ -]{6,})$/iu);
  if (!match) return null;
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const normalized = match[1].replace(/[۰-۹]/g, (c) => String(persian.indexOf(c))).replace(/[٠-٩]/g, (c) => String(arabic.indexOf(c)));
  const code = normalizeLinkCode(normalized);
  return code.length === 6 ? code : null;
}

export async function POST(request: NextRequest) {
  if (!hasValidSecret(request)) {
    await db.auditLog.create({ data: { action: "BALE_WEBHOOK_REJECTED", result: "FAILURE", requestId: request.headers.get("x-request-id") } }).catch(() => undefined);
    return NextResponse.json({ error: { code: "INVALID_WEBHOOK_SECRET", message: "Unauthorized" } }, { status: 401 });
  }

  const parsed = baleWebhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_UPDATE", message: "Invalid update" } }, { status: 400 });

  const updateId = String(parsed.data.update_id);
  try {
    await db.processedProviderUpdate.create({ data: { provider: "bale", providerUpdateId: updateId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ data: { accepted: true, duplicate: true } });
    }
    throw error;
  }

  const message = parsed.data.message;
  const callback = parsed.data.callback_query;
  if (!message && !callback) return NextResponse.json({ data: { accepted: true } });

  const rawChatId = callback?.message?.chat.id ?? message?.chat.id;
  const rawUserId = callback?.from.id ?? message?.from.id;
  if (rawChatId == null || rawUserId == null) return NextResponse.json({ data: { accepted: true } });
  const chatId = String(rawChatId);
  const externalUserId = String(rawUserId);
  const code = extractLinkCode(message?.text);
  let result: { text: string; replyMarkup?: { inline_keyboard: { text: string; callback_data: string }[][] } };
  let linked: boolean | undefined;
  if (callback?.data) {
    result = await handleBaleMenuAction(externalUserId, callback.data)
      ?? await handleBaleTaskAction(externalUserId, callback.data);
  } else if (code) {
    const channel = await consumeBaleLinkCode({ code, externalUserId, externalChatId: chatId });
    linked = Boolean(channel);
    result = {
      text: channel
        ? "✅ حساب بله شما با موفقیت متصل شد. اعلان‌های فعال از این پس در بله ارسال می‌شوند."
        : "❌ کد اتصال نامعتبر، منقضی یا استفاده‌شده است. از برنامه کد تازه دریافت کنید.",
    };
  } else {
    const command = message?.text?.trim().split(/\s+/)[0]?.replace(/@\w+$/u, "").toLowerCase() || "";
    if (["/start", "/menu"].includes(command)) {
      result = await getBaleMainMenu(externalUserId);
    } else if (["/queue", "/mytasks", "/today", "/overdue"].includes(command)) {
      result = await getBaleTaskMenu(externalUserId, command.slice(1) as BaleTaskListMode);
    } else {
      result = await handleBaleWizardText(externalUserId, message?.text || "")
        ?? { text: await handleBaleCommand({ text: message?.text, externalUserId, externalChatId: chatId }) };
    }
  }
  try {
    const provider = new BaleProvider();
    if (callback) await provider.answerCallbackQuery(String(callback.id)).catch(() => undefined);
    await provider.sendMessage({
      recipientId: chatId,
      text: result.text,
      replyMarkup: result.replyMarkup,
      idempotencyKey: `BALE_COMMAND:${updateId}`,
    });
  } catch (error) {
    await db.processedProviderUpdate.deleteMany({
      where: { provider: "bale", providerUpdateId: updateId },
    });
    throw error;
  }
  return NextResponse.json({ data: { accepted: true, ...(linked === undefined ? {} : { linked }) } });
}
