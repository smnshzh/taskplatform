import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import { getBaleMainMenu, getBaleTaskMenu, handleBaleCommand, handleBaleMenuAction, handleBaleTaskAction, handleBaleWizardText, type BaleTaskListMode } from "../src/features/notifications/server/bale-command.service";
import { BaleProvider } from "../src/features/notifications/server/providers/bale.provider";
import { getBaleBotToken } from "../src/features/notifications/server/system-settings.service";
import { shouldIgnoreBaleGroupMessage } from "../src/features/notifications/server/bale-update-policy";

type Update = {
  update_id: string | number;
  message?: { text?: string; from?: { id?: string | number }; chat?: { id?: string | number; type?: string; title?: string } };
  callback_query?: { id: string | number; data?: string; from?: { id?: string | number }; message?: { chat?: { id?: string | number; type?: string; title?: string } } };
};
const apiBase = (process.env.BALE_API_BASE_URL?.trim() || "https://tapi.bale.ai").replace(/\/$/, "");
let stopping = false;
let offset = 0;
let activeToken = "";
let processedProvider = "bale";
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function getUpdates(): Promise<Update[]> {
  const token = await getBaleBotToken();
  if (!token) throw new Error("BALE_BOT_TOKEN is required");
  if (token !== activeToken) {
    activeToken = token;
    offset = 0;
    processedProvider = `bale-${createHash("sha256").update(token).digest("hex").slice(0, 12)}`;
  }
  const response = await fetch(`${apiBase}/bot${token}/getUpdates?offset=${offset}&timeout=25&limit=50`, { signal: AbortSignal.timeout(30_000) });
  const body = await response.json() as { ok?: boolean; result?: Update[]; description?: string };
  if (!response.ok || !body.ok) throw new Error(body.description || `Bale HTTP ${response.status}`);
  return body.result || [];
}

async function processUpdate(update: Update) {
  const updateId = String(update.update_id);
  try { await db.processedProviderUpdate.create({ data: { provider: processedProvider, providerUpdateId: updateId } }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
  try {
    const callback = update.callback_query;
    const userId = callback?.from?.id ?? update.message?.from?.id;
    const chatId = callback?.message?.chat?.id ?? update.message?.chat?.id;
    if (userId == null || chatId == null) return;
    const chat = callback?.message?.chat ?? update.message?.chat;
    if (shouldIgnoreBaleGroupMessage({
      chatType: chat?.type,
      text: update.message?.text,
      hasCallback: Boolean(callback?.data),
    })) return;
    let result;
    const command = update.message?.text?.trim().split(/\s+/)[0]?.replace(/@\w+$/u, "").toLowerCase();
    if (command === "/chatid") {
      const isPrivate = !chat?.type || chat.type === "private";
      result = {
        text: isPrivate
          ? `این شناسه چت خصوصی است: ${chatId}\nبرای ثبت مقصد گروهی، دستور /chatid را داخل خود گروه بله ارسال کنید.`
          : `✅ شناسه این گروه بله:\n${chatId}\n\nاین مقدار را در بخش «گروه‌های مقصد بله» ثبت کنید.`,
      };
    } else if (callback?.data) {
      result = await handleBaleMenuAction(String(userId), callback.data)
        ?? await handleBaleTaskAction(String(userId), callback.data);
      const token = await getBaleBotToken();
      if (!token) throw new Error("BALE_BOT_TOKEN is required");
      await fetch(`${apiBase}/bot${token}/answerCallbackQuery`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ callback_query_id: callback.id }),
      }).catch(() => undefined);
    } else if (
      ["/start", "/menu"].includes(update.message?.text?.trim().split(/\s+/)[0]?.replace(/@\w+$/u, "").toLowerCase() || "")
      && update.message?.text?.trim().split(/\s+/).length === 1
    ) {
      result = await getBaleMainMenu(String(userId));
    } else if (["/queue", "/mytasks", "/today", "/overdue"].includes(update.message?.text?.trim().split(/\s+/)[0]?.replace(/@\w+$/u, "").toLowerCase() || "")) {
      const taskCommand = update.message!.text!.trim().split(/\s+/)[0].replace(/@\w+$/u, "").slice(1).toLowerCase();
      result = await getBaleTaskMenu(String(userId), taskCommand as BaleTaskListMode);
    } else {
      result = await handleBaleWizardText(String(userId), update.message?.text || "")
        ?? { text: await handleBaleCommand({ text: update.message?.text, externalUserId: String(userId), externalChatId: String(chatId) }) };
    }
    await new BaleProvider().sendMessage({ recipientId: String(chatId), text: result.text, replyMarkup: result.replyMarkup, idempotencyKey: `BALE_COMMAND:${updateId}` });
  } catch (error) {
    await db.processedProviderUpdate.deleteMany({ where: { provider: processedProvider, providerUpdateId: updateId } });
    throw error;
  }
}

async function main() {
  while (!stopping) {
    try {
      const updates = await getUpdates();
      for (const update of updates) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        await processUpdate(update);
      }
    } catch (error) {
      console.error(JSON.stringify({ level: "error", feature: "bale-command", action: "poll", errorCode: error instanceof Error ? error.name : "UNKNOWN" }));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  await db.$disconnect();
}

main().catch(async () => { await db.$disconnect(); process.exit(1); });
