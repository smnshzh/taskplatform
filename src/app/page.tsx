import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { SOLUTIONS } from "@/lib/platform";
import { getLocaleFromCookies } from "@/lib/site-locale";
import { getSiteCopy, localizedPath } from "@/lib/site-i18n";
import { SiteHeader } from "@/components/site-header";

export default async function Home() {
  const locale = await getLocaleFromCookies();
  const copy = getSiteCopy(locale);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#ffffff_45%,#f8fafc_100%)] text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
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
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            {copy.home.badge}
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">
            {copy.home.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {copy.home.description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={localizedPath(locale, "/signup")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {copy.home.primaryCta}
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link
              href={localizedPath(locale, "/solutions")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copy.home.secondaryCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Metric label={copy.home.metricCompanyBoundaryLabel} value={copy.home.metricCompanyBoundaryValue} />
            <Metric label={copy.home.metricSolutionsLabel} value={copy.home.metricSolutionsValue} />
            <Metric label={copy.home.metricAccessLabel} value={copy.home.metricAccessValue} />
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                  {copy.home.howTitle}
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {locale === "en" ? "Built for company onboarding" : "ساخته شده برای ورود شرکت‌ها"}
                </h2>
              </div>
              <div className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                {locale === "en" ? "Fast setup" : "راه‌اندازی سریع"}
              </div>
            </div>
            <ol className="mt-6 space-y-4">
              <HowItem index="01" title={copy.home.howStep1Title} text={copy.home.howStep1Text} />
              <HowItem index="02" title={copy.home.howStep2Title} text={copy.home.howStep2Text} />
              <HowItem index="03" title={copy.home.howStep3Title} text={copy.home.howStep3Text} />
            </ol>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
              {locale === "en" ? "Start here" : "از اینجا شروع کنید"}
            </p>
            <p className="mt-3 text-xl font-bold leading-8">
              {copy.home.startTitle}
            </p>
            <Link
              href={localizedPath(locale, "/signup")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              {copy.home.startCta}
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-6 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {SOLUTIONS.map((solution) => {
            const labels =
              solution.key === "taskplatform"
                ? {
                    name: copy.options.taskplatformName,
                    slogan: copy.options.taskplatformSlogan,
                    description: copy.options.taskplatformDescription,
                    icon: LayoutGrid,
                  }
                : solution.key === "insight"
                  ? {
                      name: copy.options.insightName,
                      slogan: copy.options.insightSlogan,
                      description: copy.options.insightDescription,
                      icon: ShieldCheck,
                    }
                  : {
                      name: copy.options.workflowsName,
                      slogan: copy.options.workflowsSlogan,
                      description: copy.options.workflowsDescription,
                      icon: Workflow,
                    };

            const Icon = labels.icon;

            return (
              <article
                key={solution.key}
                className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur"
              >
                <div className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br ${solution.accent} p-3 text-white`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold">{labels.name}</h2>
                <p className="mt-1 text-sm font-medium uppercase tracking-wide text-slate-500">{labels.slogan}</p>
                <p className="mt-4 text-sm leading-7 text-slate-600">{labels.description}</p>
                <Link
                  href={localizedPath(locale, solution.href)}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-700"
                >
                  {locale === "en" ? "Explore" : "مشاهده"}
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm lg:grid-cols-3">
          <Feature icon={Building2} title={copy.home.featureIsolation} text={locale === "en" ? "Each company gets its own tenant boundary and account." : "هر شرکت مرز دسترسی و داده خودش را دارد."} />
          <Feature icon={CheckCircle2} title={copy.home.featureSelection} text={locale === "en" ? "TaskPlatform is one solution in a broader multi-solution website." : "TaskPlatform یکی از راهکارهای این وب‌سایت چندمحصولی است."} />
          <Feature icon={ShieldCheck} title={copy.home.featureSecure} text={locale === "en" ? "The platform is designed around signed-in company owners and controlled access." : "دسترسی بر پایه مالک شرکت و کنترل سرور انجام می‌شود."} />
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-black text-slate-950">{value}</div>
    </div>
  );
}

function HowItem({
  index,
  title,
  text,
}: {
  index: string;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-950 shadow-sm">
        {index}
      </div>
      <div>
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </li>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}
