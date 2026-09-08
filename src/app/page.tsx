import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowLeft, Building2, CheckCircle2, LayoutGrid, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { SOLUTIONS } from "@/lib/platform";
import { AuthControls } from "@/components/auth-controls";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#ffffff_45%,#f8fafc_100%)] text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-16 lg:px-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-lg shadow-sky-200/60">
              س
            </div>
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.25em] text-slate-500">
                SolutionCompany
              </div>
              <div className="text-base font-semibold text-slate-950">
                Platform for company-specific solutions
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/solutions"
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
            >
              Solutions
            </Link>
            <AuthControls />
          </div>
        </header>

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            One website. Multiple solutions. Tenant-separated by company.
          </div>
          <h1 className="mt-8 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Build a company account and choose the solution it needs.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            SolutionCompany is the front door. Each company creates an account, picks a solution, and works inside its own
            isolated workspace. TaskPlatform is one of the available solutions.
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
              View solutions
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
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

        <div className="mt-10 grid gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm lg:grid-cols-3">
          <Feature icon={Building2} title="Company isolation" text="Each company gets its own tenant boundary and account." />
          <Feature icon={CheckCircle2} title="Solution selection" text="TaskPlatform is one solution in a broader multi-solution website." />
          <Feature icon={ShieldCheck} title="Secure access" text="The platform is designed around signed-in company owners and controlled access." />
        </div>
      </section>
    </main>
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
