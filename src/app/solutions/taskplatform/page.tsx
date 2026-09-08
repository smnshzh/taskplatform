import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole, Workflow } from "lucide-react";
import { getLocaleFromCookies } from "@/lib/site-locale";
import { getSiteCopy, localizedPath } from "@/lib/site-i18n";
import { SiteHeader } from "@/components/site-header";

const HIGHLIGHTS = {
  en: [
    "Task assignment and tracking",
    "Role-based access control",
    "Bale and notification integration",
    "Tehran-time aware schedules and due dates",
  ],
  fa: [
    "تخصیص و پیگیری تسک",
    "کنترل دسترسی مبتنی بر نقش",
    "یکپارچگی با بله و اعلان‌ها",
    "زمان‌بندی و سررسید بر پایه زمان تهران",
  ],
} as const;

export default async function TaskPlatformSolutionPage() {
  const locale = await getLocaleFromCookies();
  const copy = getSiteCopy(locale);
  const highlights = HIGHLIGHTS[locale];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#08111f_0%,#0f172a_60%,#111827_100%)] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <SiteHeader
          locale={locale}
          brandLine={copy.header.brandLine}
          brandSubtitle={copy.header.brandSubtitle}
          solutionsLabel={copy.header.solutions}
          localeToggleLabel={copy.header.localeToggleLabel}
          localeEnglish={copy.header.localeEnglish}
          localePersian={copy.header.localePersian}
          signInLabel={copy.header.signIn}
          signUpLabel={copy.header.signUp}
          accountLabel={copy.header.account}
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
              {copy.taskplatform.eyebrow}
            </p>
            <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
              {copy.taskplatform.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {copy.taskplatform.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={localizedPath(locale, "/signup?solution=taskplatform")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {copy.taskplatform.createCompany}
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                href={localizedPath(locale, "/console")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {copy.taskplatform.openApp}
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-cyan-300" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
            <div className="inline-flex rounded-2xl bg-cyan-400/15 p-3 text-cyan-300">
              <Workflow className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">{copy.taskplatform.cardTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {copy.taskplatform.cardText}
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-200">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-cyan-300" />
                {copy.taskplatform.cardAccess}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-cyan-300" />
                {copy.taskplatform.cardSolution}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-cyan-300" />
                {copy.taskplatform.cardDeploy}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
