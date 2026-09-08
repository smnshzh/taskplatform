import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SOLUTIONS } from "@/lib/platform";

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            Solutions
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Choose the solution that fits your company.</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Start with TaskPlatform today and add other product lines later without changing your company account structure.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {SOLUTIONS.map((solution) => (
            <article key={solution.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className={`h-2 rounded-full bg-gradient-to-r ${solution.accent}`} />
              <h2 className="mt-5 text-2xl font-bold">{solution.name}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">{solution.slogan}</p>
              <p className="mt-4 text-sm leading-7 text-slate-600">{solution.description}</p>
              <Link href={solution.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                Open details
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
