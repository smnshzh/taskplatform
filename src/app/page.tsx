import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, LayoutGrid, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { SOLUTIONS } from "@/lib/platform";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#ffffff_45%,#f8fafc_100%)] text-slate-900">
      <section className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
        <SiteHeader />
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            One website. Multiple solutions. Each company gets its own workspace.
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">
            A company solution website that feels clear from the first click.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            SolutionCompany is the front door for teams that want to create an account, select a solution, and work in an isolated tenant. TaskPlatform is the first live solution, with more product lines ready to be added.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create a company account
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/solutions"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Browse solutions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Metric label="Company boundary" value="1 tenant / company" />
            <Metric label="Solutions" value="TaskPlatform + more" />
            <Metric label="Access" value="Clerk auth" />
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                  How it works
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Built for company onboarding
                </h2>
              </div>
              <div className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                Fast setup
              </div>
            </div>
            <ol className="mt-6 space-y-4">
              <HowItem index="01" title="Create a company" text="Signup creates the company record, owner account, and selected solution." />
              <HowItem index="02" title="Select a solution" text="TaskPlatform starts as the live solution; more product lines can be added later." />
              <HowItem index="03" title="Open the console" text="The owner lands in the app console with company-scoped access." />
            </ol>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Start here
            </p>
            <p className="mt-3 text-xl font-bold leading-8">
              Every company gets a clean public website, a signup flow, and a private console.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Create company
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-6 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {SOLUTIONS.map((solution) => (
            <article
              key={solution.key}
              className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br ${solution.accent} p-3 text-white`}>
                {solution.key === "taskplatform" ? <LayoutGrid className="h-6 w-6" /> : solution.key === "insight" ? <ShieldCheck className="h-6 w-6" /> : <Workflow className="h-6 w-6" />}
              </div>
              <h2 className="text-xl font-bold">{solution.name}</h2>
              <p className="mt-1 text-sm font-medium uppercase tracking-wide text-slate-500">{solution.slogan}</p>
              <p className="mt-4 text-sm leading-7 text-slate-600">{solution.description}</p>
              <Link href={solution.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                Explore
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm lg:grid-cols-3">
          <Feature icon={Building2} title="Company isolation" text="Each company gets its own tenant boundary and account." />
          <Feature icon={CheckCircle2} title="Solution selection" text="TaskPlatform is one solution in a broader multi-solution website." />
          <Feature icon={ShieldCheck} title="Secure access" text="The platform is designed around signed-in company owners and controlled access." />
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
