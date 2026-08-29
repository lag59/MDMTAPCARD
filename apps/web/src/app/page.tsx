"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { submitSignupRequest } from "@/lib/api";

const primaryPlans = [
  {
    key: "basic_monthly",
    name: "Basic Monthly",
    price: "$3.99",
    cadence: "/month",
    description: "A lightweight starting plan for solo professionals and pilots.",
    features: ["Digital card management", "Lead capture", "NFC-ready profiles"],
    featured: false,
  },
  {
    key: "basic_yearly",
    name: "Basic Yearly",
    price: "$39",
    cadence: "/year",
    description: "Save over monthly billing while keeping the same Basic feature set.",
    features: ["Digital card management", "Lead capture", "Annual discount"],
    featured: false,
  },
  {
    key: "pro_monthly",
    name: "Pro Monthly",
    price: "$6.99",
    cadence: "/month",
    description: "Best for active teams that need advanced admin operations.",
    features: ["Everything in Basic", "NFC lifecycle workflows", "Admin analytics"],
    featured: true,
  },
  {
    key: "pro_yearly",
    name: "Pro Yearly",
    price: "$69",
    cadence: "/year",
    description: "Annual Pro plan for lower total cost and predictable billing.",
    features: ["Everything in Pro Monthly", "Annual discount", "Priority onboarding"],
    featured: false,
  },
] as const;

const legacyPlans = [
  { key: "tap_starter", name: "Tap Starter", price: "$99" },
  { key: "tap_business", name: "Tap Business", price: "$99" },
  { key: "tap_team", name: "Tap Team", price: "$99" },
  { key: "tap_pro", name: "Tap Pro", price: "$99" },
] as const;

export default function Home() {
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    plan_interest: "pro_monthly",
    team_size: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<"checking" | "connected" | "unreachable">("checking");

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      try {
        const proxyRes = await fetch("/api/proxy/health", { cache: "no-store" });
        if (proxyRes.ok) {
          if (mounted) setHealthStatus("connected");
          return;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "https://mdm-tapcard-api.fly.dev";
        const directRes = await fetch(`${apiBase}/health`, { cache: "no-store" });
        if (mounted) setHealthStatus(directRes.ok ? "connected" : "unreachable");
      } catch {
        if (mounted) setHealthStatus("unreachable");
      }
    };

    checkHealth();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await submitSignupRequest({
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || undefined,
        plan_interest: form.plan_interest || undefined,
        team_size: form.team_size || undefined,
        notes: form.notes || undefined,
      });
      setSuccess(result.message);
      setForm((prev) => ({ ...prev, notes: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit signup request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">MDM Creation</p>
            <h1 className="text-xl font-semibold">TapCard</h1>
          </div>
          <nav className="flex items-center gap-3">
            <a href="#pricing" className="text-sm text-slate-300 hover:text-white">
              Pricing
            </a>
            <a href="#signup" className="text-sm text-slate-300 hover:text-white">
              Sign up
            </a>
            <Link
              href="/login"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <section className="mt-12 md:mt-16">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              NFC business cards + lead capture
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  healthStatus === "connected"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : healthStatus === "unreachable"
                      ? "bg-rose-500/20 text-rose-200"
                      : "bg-slate-500/20 text-slate-200"
                }`}
              >
                {healthStatus === "connected"
                  ? "Backend Connected"
                  : healthStatus === "unreachable"
                    ? "Backend Unreachable"
                    : "Checking Backend..."}
              </span>
              <span className="text-slate-400">Landing v2026.08.29</span>
            </div>
            <h2 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">
              Turn every tap into a tracked lead.
            </h2>
            <p className="mt-4 text-base text-slate-300 md:text-lg">
              TapCard helps teams deploy digital cards with NFC workflows, profile management, and lead capture in one platform.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#signup"
                className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Start sign-up
              </a>
              <a
                href="#pricing"
                className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold hover:bg-slate-800"
              >
                View options & prices
              </a>
            </div>
          </div>
        </section>

        <section id="pricing" className="mt-16 md:mt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold">Options & pricing</h3>
              <p className="mt-1 text-sm text-slate-400">Choose monthly or yearly billing for Basic and Pro tiers.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {primaryPlans.map((plan) => (
              <article
                key={plan.key}
                className={`rounded-2xl border p-5 ${
                  plan.featured
                    ? "border-cyan-400/60 bg-cyan-400/10"
                    : "border-slate-800 bg-slate-900/70"
                }`}
              >
                <p className="text-sm text-slate-300">{plan.name}</p>
                <p className="mt-2 text-3xl font-bold">
                  {plan.price}
                  <span className="ml-1 text-sm font-medium text-slate-400">{plan.cadence}</span>
                </p>
                <p className="mt-3 text-sm text-slate-300">{plan.description}</p>
                <ul className="mt-4 space-y-1 text-sm text-slate-300">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm font-semibold text-slate-200">Legacy plans (available for existing packages)</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-300 md:grid-cols-2">
              {legacyPlans.map((plan) => (
                <div key={plan.key} className="rounded-lg border border-slate-800 px-3 py-2">
                  {plan.name}: <span className="font-semibold">{plan.price}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="mt-16 md:mt-20">
          <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-6">
            <h3 className="text-2xl font-bold text-cyan-100">Sign up for TapCard</h3>
            <p className="mt-2 max-w-2xl text-sm text-cyan-50/90">
              New customers can start by requesting onboarding. If you already have credentials, sign in directly to your admin dashboard.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-lg border border-cyan-300/40 px-5 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
              >
                I already have an account
              </Link>
            </div>

            <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-cyan-50/90">
                Company name *
                <input
                  required
                  value={form.company_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-cyan-200/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/50"
                  placeholder="Acme Corp"
                />
              </label>
              <label className="text-sm text-cyan-50/90">
                Contact name *
                <input
                  required
                  value={form.contact_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-cyan-200/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/50"
                  placeholder="Jane Doe"
                />
              </label>
              <label className="text-sm text-cyan-50/90">
                Email *
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-cyan-200/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/50"
                  placeholder="you@company.com"
                />
              </label>
              <label className="text-sm text-cyan-50/90">
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-cyan-200/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/50"
                  placeholder="+1 555 123 4567"
                />
              </label>
              <label className="text-sm text-cyan-50/90">
                Plan interest
                <select
                  value={form.plan_interest}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan_interest: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-cyan-200/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  <option value="basic_monthly">Basic Monthly ($3.99)</option>
                  <option value="basic_yearly">Basic Yearly ($39)</option>
                  <option value="pro_monthly">Pro Monthly ($6.99)</option>
                  <option value="pro_yearly">Pro Yearly ($69)</option>
                  <option value="tap_starter">Tap Starter (Legacy)</option>
                  <option value="tap_business">Tap Business (Legacy)</option>
                  <option value="tap_team">Tap Team (Legacy)</option>
                  <option value="tap_pro">Tap Pro (Legacy)</option>
                </select>
              </label>
              <label className="text-sm text-cyan-50/90">
                Team size
                <input
                  value={form.team_size}
                  onChange={(e) => setForm((prev) => ({ ...prev, team_size: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-cyan-200/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/50"
                  placeholder="e.g. 5"
                />
              </label>
              <label className="text-sm text-cyan-50/90 md:col-span-2">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 h-24 w-full rounded-lg border border-cyan-200/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400/50"
                  placeholder="Tell us about your rollout timeline or NFC volume goals."
                />
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit signup request"}
                </button>
                {success ? <p className="text-sm text-emerald-200">{success}</p> : null}
                {error ? <p className="text-sm text-rose-200">{error}</p> : null}
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
