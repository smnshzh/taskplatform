export {};
const token = process.env.BALE_BOT_TOKEN?.trim();
const webhookUrl = process.env.BALE_WEBHOOK_URL?.trim();
const secret = process.env.BALE_WEBHOOK_SECRET?.trim();
const apiBase = process.env.BALE_API_BASE_URL?.trim() || "https://tapi.bale.ai";

if (!token || !webhookUrl || !secret) {
  throw new Error("BALE_BOT_TOKEN, BALE_WEBHOOK_URL and BALE_WEBHOOK_SECRET are required");
}
if (!webhookUrl.startsWith("https://")) throw new Error("BALE_WEBHOOK_URL must use HTTPS");

const response = await fetch(`${apiBase.replace(/\/$/, "")}/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
});
const result = await response.json().catch(() => null);
if (!response.ok || !result || (typeof result === "object" && "ok" in result && !result.ok)) {
  throw new Error(`Bale setWebhook failed with HTTP ${response.status}`);
}
console.log("Bale webhook configured successfully.");
