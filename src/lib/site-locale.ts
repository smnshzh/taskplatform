import { cookies } from "next/headers";
import type { Locale } from "./site-i18n";
import { LOCALE_COOKIE, normalizeLocale } from "./site-i18n";

export async function getLocaleFromCookies(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value ?? null);
}
