"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitEnterpriseSignupRequest } from "@/lib/api";
import SquareCard, { type SquareCardHandle } from "@/components/SquareCard";

// Pricing constants — must stay in sync with backend public.py enterprise pricing.
const ENTERPRISE_SETUP_CENTS = 29900;

const MONTHLY_RATE_CENTS: Record<number, number> = { 10: 299, 25: 279, 50: 249 };
const ANNUAL_RATE_CENTS: Record<number, number> = { 10: 2900, 25: 2700, 50: 2400 };

function perUserCents(users: number, annual: boolean): number | null {
  if (users >= 100) return null;
  const table = annual ? ANNUAL_RATE_CENTS : MONTHLY_RATE_CENTS;
  let rate: number | null = null;
  for (const lowerBound of [10, 25, 50]) {
    if (users >= lowerBound) rate = table[lowerBound];
  }
  return rate;
}

const hardwareOptions = [
  { key: "none", label: "No hardware (digital only)", cents: 0, quote: false, physical: false },
  { key: "tap_button", label: "Adhesive NFC TapButton — $7.99 each", cents: 799, quote: false, physical: true },
  { key: "pvc_tapcard", label: "PVC NFC TapCard — $12.99 each", cents: 1299, quote: false, physical: true },
  { key: "keychain", label: "NFC Keychain — $12.99 each", cents: 1299, quote: false, physical: true },
  { key: "wood_tapcard", label: "Wood NFC TapCard — $29.99 each", cents: 2999, quote: false, physical: true },
  { key: "ring", label: "NFC Ring — $34.99 each", cents: 3499, quote: false, physical: true },
  { key: "metal_tapcard", label: "Metal NFC TapCard — $44.99 each", cents: 4499, quote: false, physical: true },
  { key: "premium_custom_metal", label: "Premium / Custom Metal — custom quote", cents: null, quote: true, physical: true },
] as const;

const setupIncludes = [
  "Company account setup",
  "Branded company template",
  "Admin dashboard configuration",
  "Employee/user profile setup",
  "Company-wide links and branding",
  "NFC product programming",
  "QR configuration",
  "Initial testing and deployment support",
  "Bulk onboarding assistance",
] as const;

const enterpriseFeatures = [
  "Centralized company dashboard",
  "Multiple employee profiles",
  "Company-wide branding",
  "Individual employee contact information",
  "Unlimited self-service profile updates",
  "NFC + QR connectivity",
  "Profile analytics",
  "NFC tap tracking",
  "QR scan tracking",
  "Link-click analytics",
  "Lead and conversion reporting",
  "Employee onboarding and offboarding",
  "Standardized company templates",
  "Company website, review, booking and quote links",
  "Priority support",
  "Bulk NFC programming",
] as const;

const monthlyTiers = [
  { range: "10–24 users", price: "$2.99/user/mo" },
  { range: "25–49 users", price: "$2.79/user/mo" },
  { range: "50–99 users", price: "$2.49/user/mo" },
  { range: "100+ users", price: "Custom pricing" },
] as const;

const annualTiers = [
  { range: "10–24 users", price: "$29/user/yr" },
  { range: "25–49 users", price: "$27/user/yr" },
  { range: "50–99 users", price: "$24/user/yr" },
  { range: "100+ users", price: "Custom annual pricing" },
] as const;

const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function EnterprisePage() {
  const router = useRouter();
  const formFieldClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    user_count: "10",
    billing: "annual",
    hardware: "pvc_tapcard",
    hardware_quantity: "",
    shipping_name: "",
    shipping_company: "",
    shipping_address1: "",
    shipping_address2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_postal_code: "",
    shipping_country: "US",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<SquareCardHandle>(null);
  const [cardAvailable, setCardAvailable] = useState(false);

  const users = Math.max(0, Number.parseInt(form.user_count, 10) || 0);
  const selectedHardware = hardwareOptions.find((option) => option.key === form.hardware) ?? hardwareOptions[0];
  const isAnnual = form.billing === "annual";
  const requiresShipping = selectedHardware.physical;
  const hardwareQuantity =
    selectedHardware.key === "none" ? 0 : Math.max(1, Number.parseInt(form.hardware_quantity, 10) || users || 1);
  const perUser = perUserCents(users, isAnnual);
  const isQuote = users >= 100 || perUser === null || selectedHardware.cents === null;
  const hardwareCents = selectedHardware.cents ?? 0;
  const serviceCents = isAnnual && perUser !== null ? perUser * users : 0;
  const dueTodayCents = isQuote ? null : ENTERPRISE_SETUP_CENTS + hardwareCents * hardwareQuantity + serviceCents;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (users < 10) {
      setError("Enterprise plans require at least 10 users.");
      return;
    }

    setSubmitting(true);
    try {
      let cardSourceId: string | undefined;
      if (!isQuote && cardAvailable && cardRef.current) {
        const token = await cardRef.current.tokenize();
        if (!token) {
          setSubmitting(false);
          return;
        }
        cardSourceId = token;
      }
      const result = await submitEnterpriseSignupRequest({
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || undefined,
        user_count: users,
        billing: isAnnual ? "annual" : "monthly",
        hardware: selectedHardware.key,
        hardware_quantity: selectedHardware.key === "none" ? undefined : hardwareQuantity,
        shipping_name: requiresShipping ? form.shipping_name || undefined : undefined,
        shipping_company: requiresShipping ? form.shipping_company || undefined : undefined,
        shipping_address1: requiresShipping ? form.shipping_address1 || undefined : undefined,
        shipping_address2: requiresShipping ? form.shipping_address2 || undefined : undefined,
        shipping_city: requiresShipping ? form.shipping_city || undefined : undefined,
        shipping_state: requiresShipping ? form.shipping_state || undefined : undefined,
        shipping_postal_code: requiresShipping ? form.shipping_postal_code || undefined : undefined,
        shipping_country: requiresShipping ? form.shipping_country || undefined : undefined,
        notes: form.notes || undefined,
        card_source_id: cardSourceId,
      });
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      const requestId = encodeURIComponent(result.request_id);
      const companyName = encodeURIComponent(form.company_name);
      const designParam = result.is_design_request ? "&design=1" : "";
      router.push(`/signup/thanks?request_id=${requestId}&company=${companyName}${designParam}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit enterprise request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-700">MDM Creation</p>
            <h1 className="text-xl font-semibold text-slate-900">TapCard Enterprise</h1>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
              Individual
            </Link>
            <a href="#enterprise-signup" className="text-sm text-slate-600 hover:text-slate-900">
              Sign up
            </a>
            <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Sign in
            </Link>
          </nav>
        </header>

        <section className="mt-12 md:mt-16">
          <p className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
            MDM Tap Enterprise
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-5xl">
            One company. One brand. Every team member connected.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            Built for teams, companies, sales organizations, contractors, healthcare groups, real estate teams, and growing
            businesses that need multiple digital profiles managed under one brand.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#enterprise-signup"
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-500"
            >
              Start enterprise sign-up
            </a>
            <a
              href="#enterprise-pricing"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              View pricing
            </a>
          </div>
        </section>

        <section id="enterprise-pricing" className="mt-16 md:mt-20">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <article className="rounded-2xl border border-indigo-300 bg-indigo-50 p-6 shadow-md">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-800">Enterprise Setup</p>
              <p className="mt-2 text-4xl font-bold text-slate-900">
                $299<span className="ml-1 text-sm font-medium text-slate-500">one-time</span>
              </p>
              <ul className="mt-4 grid gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
                {setupIncludes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-indigo-600">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <div className="grid gap-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-700">Enterprise Digital Service — Monthly</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {monthlyTiers.map((tier) => (
                    <li key={tier.range} className="flex justify-between">
                      <span>{tier.range}</span>
                      <span className="font-semibold text-slate-900">{tier.price}</span>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Pay Annually &amp; Save</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {annualTiers.map((tier) => (
                    <li key={tier.range} className="flex justify-between">
                      <span>{tier.range}</span>
                      <span className="font-semibold text-slate-900">{tier.price}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-600">Annual service is paid in advance for the full 12-month service term.</p>
              </article>
            </div>
          </div>

          <div className="mt-10">
            <h3 className="text-xl font-bold text-slate-900">Enterprise NFC hardware</h3>
            <p className="mt-1 text-sm text-slate-600">Volume and custom-branding pricing may be available for larger orders.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hardwareOptions
                .filter((option) => option.key !== "none")
                .map((option) => (
                  <div key={option.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                    <span className="font-medium text-slate-700">{option.label.split(" — ")[0]}</span>
                    <span className="font-bold text-indigo-600">{option.cents === null ? "Custom quote" : `${formatUsd(option.cents)} ea`}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-10">
            <h3 className="text-xl font-bold text-slate-900">Enterprise features</h3>
            <div className="mt-4 grid gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
              {enterpriseFeatures.map((feature) => (
                <p key={feature} className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  {feature}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">Example — 10 employee team</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li className="flex justify-between"><span>Enterprise setup</span><span className="font-semibold">$299</span></li>
              <li className="flex justify-between"><span>10 PVC TapCards</span><span className="font-semibold">$129.90</span></li>
              <li className="flex justify-between"><span>12-month service</span><span className="font-semibold">$290</span></li>
            </ul>
            <p className="mt-3 text-lg font-bold text-slate-900">First-year total: $718.90</p>
            <p className="mt-1 text-sm text-slate-600">
              Equivalent digital service cost: <span className="font-semibold">$2.42/user/month when prepaid annually.</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              After the first year, the company only renews its digital service and purchases replacement or additional NFC products
              as needed.
            </p>
          </div>
        </section>

        <section id="enterprise-signup" className="mt-16 md:mt-20">
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl ring-1 ring-indigo-100/70 md:p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Sign up for MDM Tap Enterprise</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Configure your team below. Teams of 100+ users and custom hardware are quoted by our team; everything else can check
                out instantly.
              </p>
            </div>

            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Company name *
                <input
                  required
                  value={form.company_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                  className={formFieldClass}
                  placeholder="Acme Corp"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Contact name *
                <input
                  required
                  value={form.contact_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                  className={formFieldClass}
                  placeholder="Jane Doe"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Email *
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className={formFieldClass}
                  placeholder="you@company.com"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className={formFieldClass}
                  placeholder="+1 555 123 4567"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Number of users *
                <input
                  required
                  type="number"
                  min={10}
                  value={form.user_count}
                  onChange={(e) => setForm((prev) => ({ ...prev, user_count: e.target.value }))}
                  className={formFieldClass}
                  placeholder="10"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Billing
                <select
                  value={form.billing}
                  onChange={(e) => setForm((prev) => ({ ...prev, billing: e.target.value }))}
                  className={formFieldClass}
                >
                  <option value="annual">Annual (prepaid, best value)</option>
                  <option value="monthly">Monthly (per user)</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                NFC hardware
                <select
                  value={form.hardware}
                  onChange={(e) => setForm((prev) => ({ ...prev, hardware: e.target.value }))}
                  className={formFieldClass}
                >
                  {hardwareOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Hardware quantity
                <input
                  type="number"
                  min={1}
                  value={form.hardware_quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, hardware_quantity: e.target.value }))}
                  className={formFieldClass}
                  placeholder={`Defaults to ${users || 10} (one per user)`}
                  disabled={selectedHardware.key === "none"}
                />
              </label>

              {requiresShipping ? (
                <>
                  <label className="text-sm font-medium text-slate-700">
                    Shipping full name *
                    <input
                      required={requiresShipping}
                      value={form.shipping_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_name: e.target.value }))}
                      className={formFieldClass}
                      placeholder="Jane Doe"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Shipping company
                    <input
                      value={form.shipping_company}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_company: e.target.value }))}
                      className={formFieldClass}
                      placeholder="Acme Corp"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">
                    Shipping address line 1 *
                    <input
                      required={requiresShipping}
                      value={form.shipping_address1}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_address1: e.target.value }))}
                      className={formFieldClass}
                      placeholder="123 Main St"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">
                    Shipping address line 2
                    <input
                      value={form.shipping_address2}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_address2: e.target.value }))}
                      className={formFieldClass}
                      placeholder="Suite, apt, etc."
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    City *
                    <input
                      required={requiresShipping}
                      value={form.shipping_city}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_city: e.target.value }))}
                      className={formFieldClass}
                      placeholder="Dallas"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    State/Region *
                    <input
                      required={requiresShipping}
                      value={form.shipping_state}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_state: e.target.value }))}
                      className={formFieldClass}
                      placeholder="TX"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Postal code *
                    <input
                      required={requiresShipping}
                      value={form.shipping_postal_code}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_postal_code: e.target.value }))}
                      className={formFieldClass}
                      placeholder="75001"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Country code *
                    <input
                      required={requiresShipping}
                      value={form.shipping_country}
                      maxLength={2}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_country: e.target.value.toUpperCase() }))}
                      className={formFieldClass}
                      placeholder="US"
                    />
                  </label>
                </>
              ) : null}

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={`${formFieldClass} h-24`}
                  placeholder="Tell us about your rollout timeline, branding, or onboarding needs."
                />
              </label>

              {!isQuote ? (
                <div className="md:col-span-2">
                  {cardAvailable ? (
                    <>
                      <p className="text-sm font-medium text-slate-700">Card for automatic renewal</p>
                      <p className="mb-2 text-xs text-slate-500">Saved securely with Square to auto-charge your enterprise service each cycle.</p>
                    </>
                  ) : null}
                  <SquareCard ref={cardRef} onAvailability={setCardAvailable} />
                </div>
              ) : null}

              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Order summary</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  <li className="flex justify-between">
                    <span>Enterprise setup</span>
                    <span className="font-semibold">{formatUsd(ENTERPRISE_SETUP_CENTS)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>
                      {selectedHardware.label.split(" — ")[0]}
                      {selectedHardware.key !== "none" ? ` × ${hardwareQuantity}` : ""}
                    </span>
                    <span className="font-semibold">
                      {selectedHardware.cents === null
                        ? "Quote"
                        : selectedHardware.key === "none"
                          ? "—"
                          : formatUsd(hardwareCents * hardwareQuantity)}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Digital service {isAnnual ? "(annual prepay)" : "(monthly, per user)"}</span>
                    <span className="font-semibold">
                      {perUser === null
                        ? "Custom"
                        : isAnnual
                          ? formatUsd(perUser * users)
                          : `${formatUsd(perUser)}/user/mo`}
                    </span>
                  </li>
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold text-slate-900">Due today</span>
                  <span className="text-lg font-bold text-slate-900">
                    {dueTodayCents === null ? "We'll send a custom quote" : formatUsd(dueTodayCents)}
                  </span>
                </div>
                {!isAnnual && !isQuote && perUser !== null ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Then {formatUsd(perUser)}/user/month ({formatUsd(perUser * users)}/month for {users} users) — auto-renews monthly, billed separately.
                  </p>
                ) : null}
                {isAnnual && !isQuote && perUser !== null ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Auto-renews annually at {formatUsd(perUser * users)}/year after the first year.
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : isQuote ? "Request a custom quote" : "Continue to secure checkout"}
                </button>
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              </div>
            </form>
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-center md:mt-20">
          <p className="text-lg font-bold tracking-tight text-slate-900">MDM TAP ENTERPRISE</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            One Company. One Brand. Every Team Member Connected.
          </p>
        </section>
      </div>
    </main>
  );
}
