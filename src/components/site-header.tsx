import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";
import type { Locale } from "@/lib/site-i18n";
import { localizedPath } from "@/lib/site-i18n";

export function SiteHeader({
  locale,
  brandLine,
  brandSubtitle,
  solutionsLabel,
  localeToggleLabel,
  localeEnglish,
  localePersian,
  signInLabel,
  signUpLabel,
  accountLabel,
}: {
  locale: Locale;
  brandLine: string;
  brandSubtitle: string;
  solutionsLabel: string;
  localeToggleLabel: string;
  localeEnglish: string;
  localePersian: string;
  signInLabel: string;
  signUpLabel: string;
  accountLabel: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href={localizedPath(locale, "/")} className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-lg shadow-sky-200/60">
          س
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.25em] text-slate-500">
            {brandLine}
          </div>
          <div className="text-base font-semibold text-slate-950">
            {brandSubtitle}
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={localizedPath(locale, "/solutions")}
          className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
        >
          {solutionsLabel}
        </Link>
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-600 sm:flex">
          <span className="px-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            {localeToggleLabel}
          </span>
          <Link
            href={localizedPath("en", "/")}
            className={`rounded-lg px-3 py-1 transition ${
              locale === "en" ? "bg-slate-950 text-white" : "hover:bg-slate-100"
            }`}
          >
            {localeEnglish}
          </Link>
          <Link
            href={localizedPath("fa", "/")}
            className={`rounded-lg px-3 py-1 transition ${
              locale === "fa" ? "bg-slate-950 text-white" : "hover:bg-slate-100"
            }`}
          >
            {localePersian}
          </Link>
        </div>
        <AuthControls
          signInLabel={signInLabel}
          signUpLabel={signUpLabel}
          accountLabel={accountLabel}
        />
      </div>
    </header>
  );
}
