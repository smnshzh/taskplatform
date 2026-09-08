import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SOLUTIONS } from "@/lib/platform";
import { getLocaleFromCookies } from "@/lib/site-locale";
import { getSiteCopy, localizedPath } from "@/lib/site-i18n";
import { SiteHeader } from "@/components/site-header";

export default async function SolutionsPage() {
  const locale = await getLocaleFromCookies();
  const copy = getSiteCopy(locale);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
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

        <div className="mt-12 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            {copy.solutions.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">{copy.solutions.title}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            {copy.solutions.description}
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {SOLUTIONS.map((solution) => (
            <article key={solution.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className={`h-2 rounded-full bg-gradient-to-r ${solution.accent}`} />
              <h2 className="mt-5 text-2xl font-bold">
                {solution.key === "taskplatform"
                  ? copy.options.taskplatformName
                  : solution.key === "insight"
                    ? copy.options.insightName
                    : copy.options.workflowsName}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {solution.key === "taskplatform"
                  ? copy.options.taskplatformSlogan
                  : solution.key === "insight"
                    ? copy.options.insightSlogan
                    : copy.options.workflowsSlogan}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {solution.key === "taskplatform"
                  ? copy.options.taskplatformDescription
                  : solution.key === "insight"
                    ? copy.options.insightDescription
                    : copy.options.workflowsDescription}
              </p>
              <Link
                href={localizedPath(locale, solution.href)}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-700"
              >
                {copy.solutions.openDetails}
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
