"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, Sparkles } from "lucide-react";
import { SOLUTIONS, slugifyCompanyName, type SolutionKey } from "@/lib/platform";
import { SiteHeader } from "@/components/site-header";
import type { Locale, SITE_COPY } from "@/lib/site-i18n";
import { localizedPath } from "@/lib/site-i18n";
import { buildCompanyOwnerHandle } from "@/lib/company-handle";

type SiteCopy = typeof SITE_COPY.en;

export function SignupForm({
  locale,
  copy,
  initialSolutionKey,
}: {
  locale: Locale;
  copy: SiteCopy;
  initialSolutionKey: SolutionKey;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = React.useState("");
  const [companySlug, setCompanySlug] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [solutionKey, setSolutionKey] = React.useState<SolutionKey>(initialSolutionKey);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const effectiveCompanySlug = companySlug.trim() || slugifyCompanyName(companyName.trim());
  const ownerHandlePreview = buildCompanyOwnerHandle(effectiveCompanySlug);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companySlug,
          ownerName,
          password,
          solutionKey,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setError(locale === "en" ? "Sign in with Clerk first." : "ابتدا با Clerk وارد شوید.");
        } else {
          setError(payload.error ?? copy.signup.errorFallback);
        }
        return;
      }
      router.push("/console");
      router.refresh();
    } catch {
      setError(copy.signup.networkError);
    } finally {
      setBusy(false);
    }
  }

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
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-8 text-white shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cyan-100">
            <Sparkles className="h-4 w-4" />
            {copy.signup.eyebrow}
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">{copy.signup.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            {copy.signup.description}
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-200">
            <InfoRow title={copy.signup.infoCompany} text={locale === "en" ? "Your own slug, branding, and workspace boundary." : "شناسه، برند و مرز workspace مخصوص شرکت شما."} />
            <InfoRow title={copy.signup.infoSolution} text={locale === "en" ? "Choose TaskPlatform or another solution from the platform catalog." : "TaskPlatform یا یکی از راهکارهای دیگر را انتخاب کنید."} />
            <InfoRow title={copy.signup.infoAccess} text={locale === "en" ? "After signup you land in the console with the owner account already logged in." : "بعد از ثبت‌نام مستقیم وارد کنسول می‌شوید."} />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="font-semibold text-white">{copy.signup.ownerHandle}</div>
              <div className="mt-1 font-mono text-sm leading-6 text-cyan-200" dir="ltr">
                {ownerHandlePreview}
              </div>
            </div>
          </div>
          <Link href={localizedPath(locale, "/")} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
            <ArrowLeft className="h-4 w-4" />
            {copy.signup.backHome}
          </Link>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={submit} className="space-y-5">
            <Field label={copy.signup.companyName} value={companyName} onChange={setCompanyName} placeholder={locale === "en" ? "Example Company" : "مثال شرکت"} />
            <Field label={copy.signup.companySlug} value={companySlug} onChange={setCompanySlug} placeholder={locale === "en" ? "example-company" : "namayandegi"} />
            <Field label={copy.signup.ownerName} value={ownerName} onChange={setOwnerName} placeholder={locale === "en" ? "Amin Rahimi" : "امین رحیمی"} />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{copy.signup.ownerHandle}</label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900" dir="ltr">
                {ownerHandlePreview}
              </div>
            </div>
            <Field label={copy.signup.password} value={password} onChange={setPassword} placeholder="••••••••••" type="password" dir="ltr" />

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{copy.signup.selectSolution}</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {SOLUTIONS.map((solution) => (
                  <button
                    key={solution.key}
                    type="button"
                    onClick={() => setSolutionKey(solution.key)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      solutionKey === solution.key
                        ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-200"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">
                      {solution.key === "taskplatform"
                        ? copy.options.taskplatformName
                        : solution.key === "insight"
                          ? copy.options.insightName
                          : copy.options.workflowsName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {solution.key === "taskplatform"
                        ? copy.options.taskplatformSlogan
                        : solution.key === "insight"
                          ? copy.options.insightSlogan
                          : copy.options.workflowsSlogan}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              {busy ? copy.signup.creatingCompany : copy.signup.createCompany}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        dir={dir}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
      />
    </label>
  );
}

function InfoRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-300">{text}</div>
    </div>
  );
}
