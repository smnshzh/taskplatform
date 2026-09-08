import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-lg shadow-sky-200/60">
          س
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.25em] text-slate-500">
            SolutionCompany
          </div>
          <div className="text-base font-semibold text-slate-950">
            Company solutions platform
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
  );
}
