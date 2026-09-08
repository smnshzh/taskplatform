"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, Sparkles } from "lucide-react";
import { SOLUTIONS, type SolutionKey } from "@/lib/platform";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companyName, setCompanyName] = React.useState("");
  const [companySlug, setCompanySlug] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [solutionKey, setSolutionKey] = React.useState<SolutionKey>(
    (searchParams.get("solution") as SolutionKey | null) ?? "taskplatform"
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
          handle,
          password,
          solutionKey,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to create company account.");
        return;
      }
      router.push("/console");
      router.refresh();
    } catch {
      setError("Network error while creating the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-14 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-8 text-white shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Create a company account
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">Pick a solution and start inside your own tenant.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            This form creates the company, the first owner account, and binds the selected solution to that company.
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-200">
            <InfoRow title="Company identity" text="Your own slug, branding, and workspace boundary." />
            <InfoRow title="Solution selection" text="Choose TaskPlatform or another solution from the platform catalog." />
            <InfoRow title="Direct access" text="After signup you land in the console with the owner account already logged in." />
          </div>
          <Link href="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
            <ArrowLeft className="h-4 w-4" />
            Back to platform home
          </Link>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={submit} className="space-y-5">
            <Field label="Company name" value={companyName} onChange={setCompanyName} placeholder="Example Company" />
            <Field label="Company slug" value={companySlug} onChange={setCompanySlug} placeholder="example-company" />
            <Field label="Owner name" value={ownerName} onChange={setOwnerName} placeholder="Amin Rahimi" />
            <Field label="Owner handle" value={handle} onChange={setHandle} placeholder="@amin" dir="ltr" />
            <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••••" type="password" dir="ltr" />

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Select solution</label>
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
                    <div className="text-sm font-semibold">{solution.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{solution.slogan}</div>
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
              {busy ? "Creating company..." : "Create company"}
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
