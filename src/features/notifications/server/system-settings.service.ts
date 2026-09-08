import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const BALE_TOKEN_KEY = "BALE_BOT_TOKEN";

function encryptionKey() {
  const secret = process.env.SYSTEM_SETTINGS_SECRET?.trim() || process.env.ACCOUNT_LINK_SECRET?.trim();
  if (!secret) throw new Error("کلید رمزگذاری تنظیمات سیستم تعریف نشده است.");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export async function getBaleBotToken() {
  const setting = await db.systemSetting.findUnique({ where: { key: BALE_TOKEN_KEY }, select: { valueEncrypted: true } });
  if (setting) return decrypt(setting.valueEncrypted).trim();
  return process.env.BALE_BOT_TOKEN?.trim();
}

export async function setBaleBotToken(token: string, updatedById: string) {
  await db.systemSetting.upsert({
    where: { key: BALE_TOKEN_KEY },
    create: { key: BALE_TOKEN_KEY, valueEncrypted: encrypt(token.trim()), updatedById },
    update: { valueEncrypted: encrypt(token.trim()), updatedById },
  });
}

export async function hasDatabaseBaleToken() {
  return Boolean(await db.systemSetting.findUnique({ where: { key: BALE_TOKEN_KEY }, select: { key: true } }));
}
