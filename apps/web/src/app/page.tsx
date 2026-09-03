"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitSignupRequest } from "@/lib/api";
import SquareCard, { type SquareCardHandle } from "@/components/SquareCard";

const profileSetupIncludes = [
  "Digital business profile setup",
  "Standard MDM template",
  "Logo or profile photo",
  "Name and business information",
  "Phone number",
  "Email address",
  "Business address",
  "Click-to-call",
  "Click-to-text",
  "Save Contact / vCard",
  "WhatsApp",
  "Social media links",
  "About section",
  "Standard QR code",
  "Customer dashboard setup",
  "NFC profile connection",
  "Initial testing and activation",
] as const;

const nfcProducts = [
  { name: "Adhesive NFC TapButton", price: "$9.99" },
  { name: "PVC NFC TapCard", price: "$14.99" },
  { name: "NFC Keychain", price: "$14.99" },
  { name: "Wood NFC TapCard", price: "$34.99" },
  { name: "NFC Ring", price: "$39.99" },
  { name: "Metal NFC TapCard", price: "$49.99" },
  { name: "Premium Custom Metal", price: "$69.99+" },
] as const;

const essentialIncludes = [
  "Hosted digital profile",
  "Customer dashboard",
  "Unlimited self-service updates",
  "NFC connectivity",
  "QR connectivity",
  "Save Contact / vCard",
  "Click-to-call",
  "Click-to-text",
  "Email",
  "Social media links",
  "WhatsApp",
  "Business information",
] as const;

// Checkout building blocks — must stay in sync with backend public.py pricing.
const PROFILE_SETUP_CENTS = 4900;
const ANNUAL_SERVICE_CENTS = 3900;

const serviceOptions = [
  { key: "digital_only", label: "Digital only — no card", requiresShipping: false, productCents: 0, quote: false },
  { key: "tap_button", label: "Adhesive NFC TapButton — $9.99", requiresShipping: true, productCents: 999, quote: false },
  { key: "pvc_tapcard", label: "PVC NFC TapCard — $14.99", requiresShipping: true, productCents: 1499, quote: false },
  { key: "keychain", label: "NFC Keychain — $14.99", requiresShipping: true, productCents: 1499, quote: false },
  { key: "wood_tapcard", label: "Wood NFC TapCard — $34.99", requiresShipping: true, productCents: 3499, quote: false },
  { key: "ring", label: "NFC Ring — $39.99", requiresShipping: true, productCents: 3999, quote: false },
  { key: "metal_tapcard", label: "Metal NFC TapCard — $49.99", requiresShipping: true, productCents: 4999, quote: false },
  { key: "premium_custom_metal", label: "Premium Custom Metal — $69.99+ (quote)", requiresShipping: true, productCents: null, quote: true },
  { key: "custom_design", label: "Custom Design (quote required)", requiresShipping: true, productCents: null, quote: true },
] as const;

const capabilities = [
  {
    title: "We program it for you",
    description: "MDM Creation sets up, programs, verifies, and supports every NFC product—no NFC setup required from your customer.",
  },
  {
    title: "One profile, every placement",
    description: "Connect a TapCard, phone button, truck button, counter button, and more to one permanent profile URL.",
  },
  {
    title: "Keep it current after delivery",
    description: "Update contact details, website, branding, and profile content any time without rewriting the physical NFC product.",
  },
  {
    title: "Measure meaningful engagement",
    description: "Pro analytics track profile views, NFC taps, QR scans, website clicks, contact saves, social clicks, and trends.",
  },
  {
    title: "Make every next step easy",
    description: "Give visitors direct call, text, email, website, social, and downloadable contact options from a single card.",
  },
  {
    title: "Built around your client’s brand",
    description: "Create custom branded templates and English or Spanish digital cards for the people they serve.",
  },
] as const;

const productFormats = [
  {
    label: "Digital Card",
    detail: "A shareable profile for your phone, QR code, and every link you need.",
    icon: "↗",
    accent: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  },
  {
    label: "NFC TapCard",
    detail: "A professionally programmed card that opens your always-current profile.",
    icon: "▣",
    accent: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  },
  {
    label: "NFC TapButton",
    detail: "An adhesive NFC button for phones, counters, vehicles, and more.",
    icon: "◉",
    accent: "bg-violet-50 text-violet-700 ring-violet-100",
  },
] as const;

const serviceSteps = ["You choose the format", "We design and program", "You share and grow"] as const;

const materialHighlights = [
  { label: "Tap to Connect", icon: "▣" },
  { label: "Share Links Instantly", icon: "↗" },
  { label: "Eco-Friendly Materials", icon: "♦" },
  { label: "Analytics & Insights", icon: "▤" },
  { label: "Secure & Reliable", icon: "◆" },
] as const;

const woodCollection = [
  {
    name: "Natural / Wheat",
    tagline: "Clean · Modern · Minimal",
    swatch: "from-amber-100 via-amber-200 to-yellow-100",
    textClass: "text-amber-900",
  },
  {
    name: "Classic / Light Brown",
    tagline: "Warm · Professional · Versatile",
    swatch: "from-amber-500 via-orange-600 to-amber-700",
    textClass: "text-amber-50",
  },
  {
    name: "Dark Walnut",
    tagline: "Premium · Bold · Sophisticated",
    swatch: "from-stone-800 via-amber-950 to-stone-900",
    textClass: "text-amber-100",
  },
] as const;

const metalCollection = [
  {
    name: "Black Metal",
    tagline: "Sleek · Bold · Modern",
    swatch: "from-neutral-900 via-black to-neutral-800",
    textClass: "text-amber-300",
  },
  {
    name: "Brushed Gold",
    tagline: "Luxury · Elegant · Timeless",
    swatch: "from-yellow-400 via-amber-500 to-yellow-600",
    textClass: "text-stone-900",
  },
  {
    name: "Brushed Silver",
    tagline: "Clean · Professional · Classic",
    swatch: "from-slate-300 via-gray-400 to-slate-300",
    textClass: "text-slate-900",
  },
] as const;

const perfectForAudiences = [
  "Entrepreneurs",
  "Business Professionals",
  "Real Estate Agents",
  "Stylists & Barbers",
  "Contractors & Builders",
] as const;

const materialGuarantees = [
  "Fully Customizable — Logos, QR, NFC & More",
  "Works with All Devices — iPhone & Android",
  "No App Needed — Just Tap",
  "1-Year Warranty",
  "Quality Guaranteed",
] as const;

export default function Home() {
  const router = useRouter();
  const formFieldClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200";
  const logoSrc = "/brand/mdm-tapcard-logo.png";

  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    service_interest: "pvc_tapcard",
    plan_interest: "essential_monthly",
    quantity: "1",
    team_size: "",
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
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"checking" | "connected" | "unreachable">("checking");
  const cardRef = useRef<SquareCardHandle>(null);
  const [cardAvailable, setCardAvailable] = useState(false);
  const selectedService = serviceOptions.find((option) => option.key === form.service_interest) ?? serviceOptions[0];
  const requiresShipping = selectedService.requiresShipping;
  const isQuote = selectedService.quote;
  const isAnnual = form.plan_interest === "essential_annual";
  const quantity = Math.max(1, Number.parseInt(form.quantity, 10) || 1);
  const productCents = selectedService.productCents;
  const productQuantity = selectedService.key === "digital_only" ? 1 : quantity;
  const dueTodayCents =
    isQuote || productCents === null
      ? null
      : PROFILE_SETUP_CENTS + productCents * productQuantity + (isAnnual ? ANNUAL_SERVICE_CENTS : 0);
  const formatUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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
      let cardSourceId: string | undefined;
      if (!isQuote && cardAvailable && cardRef.current) {
        const token = await cardRef.current.tokenize();
        if (!token) {
          setSubmitting(false);
          return;
        }
        cardSourceId = token;
      }
      const result = await submitSignupRequest({
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || undefined,
        service_interest: form.service_interest,
        plan_interest: form.plan_interest || undefined,
        quantity: Number.parseInt(form.quantity, 10) || 1,
        team_size: form.team_size || undefined,
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
      setError(e instanceof Error ? e.message : "Could not submit signup request.");
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
            <h1 className="text-xl font-semibold text-slate-900">TapCard</h1>
          </div>
          <nav className="flex items-center gap-3">
            <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">
              Pricing
            </a>
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900">
              Features
            </a>
            <a href="#materials" className="text-sm text-slate-600 hover:text-slate-900">
              Wood & Metal Cards
            </a>
            <a href="#signup" className="text-sm text-slate-600 hover:text-slate-900">
              Sign up
            </a>
            <Link href="/enterprise" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              Enterprise
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <section className="mt-12 md:mt-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <p className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
                Managed NFC + digital connections
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                    healthStatus === "connected"
                      ? "bg-emerald-100 text-emerald-700"
                      : healthStatus === "unreachable"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {healthStatus === "connected"
                    ? "Backend Connected"
                    : healthStatus === "unreachable"
                      ? "Backend Unreachable"
                      : "Checking Backend..."}
                </span>
                <span className="text-slate-500">Landing v2026.08.29</span>
              </div>
              <h2 className="mt-5 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-5xl">
                Your client&apos;s connection, professionally programmed.
              </h2>
              <p className="mt-4 text-base text-slate-600 md:text-lg">
                Give customers a digital card, NFC TapCard, or adhesive TapButton—then let MDM Creation handle the design, setup,
                programming, and support.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#signup"
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-500"
                >
                  Start sign-up
                </a>
                <a
                  href="#pricing"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  View options & prices
                </a>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-700 p-[1px] shadow-2xl shadow-indigo-200">
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="relative rounded-3xl bg-slate-950/20 p-5 md:p-7">
                  {!logoFailed ? (
                    <img
                      src={logoSrc}
                      alt="MDM TapCard logo"
                      className="h-auto w-full rounded-2xl bg-white/95 object-contain p-4"
                      onError={() => setLogoFailed(true)}
                    />
                  ) : (
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-8 text-center">
                      <p className="text-xl font-semibold text-white">MDM TapCard</p>
                      <p className="mt-2 text-sm text-indigo-100">
                        Your connection, always ready to share.
                      </p>
                    </div>
                  )}
                  <div className="mt-5 flex justify-center">
                    <div className="w-52 overflow-hidden rounded-[1.8rem] border-[5px] border-slate-900 bg-slate-900 shadow-2xl shadow-black/30 ring-1 ring-white/20">
                      <img
                        src="/brand/tapcard-profile-preview.png"
                        alt="Live MDM TapCard profile with contact actions, social links, and QR sharing"
                        className="block h-[23rem] w-full object-cover object-top"
                      />
                    </div>
                  </div>
                  <p className="mt-4 text-center text-xs font-medium text-indigo-100">Actual MDM TapCard profile experience</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">Choose your connection</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">Three formats. One polished profile.</h3>
            </div>
            <p className="max-w-sm text-sm text-slate-600">Mix physical and digital formats while keeping every update in one place.</p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {productFormats.map((format) => (
              <article key={format.label} className="group rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-xl ring-1 ${format.accent}`}>{format.icon}</span>
                <h4 className="mt-4 font-semibold text-slate-900">{format.label}</h4>
                <p className="mt-1 text-sm leading-6 text-slate-600">{format.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="materials" className="mt-16 rounded-3xl border border-amber-200/70 bg-gradient-to-b from-amber-50/60 via-white to-white p-5 shadow-sm md:mt-20 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">NFC Wood & Metal Cards</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">Tap. Connect. Impress.</h3>
              <p className="mt-1 text-sm italic text-slate-500">Built by a Latina. Created for Dreamers.</p>
            </div>
            <p className="max-w-sm text-sm text-slate-600">
              Premium wood and metal NFC cards for professionals who want their first impression to stand out.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {materialHighlights.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                <span className="text-amber-600">{item.icon}</span>
                {item.label}
              </span>
            ))}
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Wood Collection</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {woodCollection.map((material) => (
                <div key={material.name}>
                  <div className={`flex aspect-[16/9] flex-col justify-center rounded-2xl bg-gradient-to-br px-5 shadow-md ${material.swatch}`}>
                    <p className={`text-lg font-bold tracking-tight ${material.textClass}`}>MDM CREATION</p>
                    <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide ${material.textClass} opacity-80`}>
                      <span>▣</span> Tap to Connect
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{material.name}</p>
                  <p className="text-xs text-slate-500">{material.tagline}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Metal Collection</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {metalCollection.map((material) => (
                <div key={material.name}>
                  <div className={`flex aspect-[16/9] flex-col justify-center rounded-2xl bg-gradient-to-br px-5 shadow-md ${material.swatch}`}>
                    <p className={`text-lg font-bold tracking-tight ${material.textClass}`}>MDM CREATION</p>
                    <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide ${material.textClass} opacity-80`}>
                      <span>▣</span> Tap to Connect
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{material.name}</p>
                  <p className="text-xs text-slate-500">{material.tagline}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Perfect for</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {perfectForAudiences.map((audience) => (
                <span key={audience} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                  {audience}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">NFC products</p>
              <div className="mt-3 space-y-2">
                {nfcProducts.map((product) => (
                  <div key={product.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{product.name}</span>
                    <span className="font-semibold text-slate-900">{product.price}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">One-time purchase. Choose the material and finish that fits your brand.</p>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-amber-300 bg-amber-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">See full pricing</p>
              <p className="mt-2 text-sm text-slate-700">Compare profile setup, NFC products, and digital service options.</p>
              <a href="#pricing" className="mt-4 inline-flex w-fit rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                View pricing ↓
              </a>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
            {materialGuarantees.map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span>
                {item}
              </span>
            ))}
          </div>
        </section>

        <section id="features" className="mt-16 md:mt-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">More than a digital business card</p>
            <h3 className="mt-2 text-3xl font-bold text-slate-900">A managed TapCard experience, from first tap to follow-up.</h3>
            <p className="mt-3 text-base text-slate-600">
              Customers get a polished, editable connection point. Your team gets practical tools for fulfillment, engagement, and growth.
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability) => (
              <article key={capability.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-base font-semibold text-slate-900">{capability.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
            <p className="text-sm font-semibold text-slate-900">A white-glove process from order to first tap.</p>
            <ol className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
              {serviceSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-3 rounded-xl bg-white/70 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-slate-700">Customers provide a shipping address and complete payment; MDM Creation programs and ships the finished product. Managed website and branding clients can also receive complimentary or discounted membership periods.</p>
          </div>
        </section>

        <section id="pricing" className="mt-16 md:mt-20">
          <div className="mb-6 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">Simple, transparent pricing</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">One setup. One card. One low membership.</h3>
            <p className="mt-2 text-sm text-slate-600">
              A one-time profile setup, your choice of NFC product, and an affordable digital service plan.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <article className="rounded-2xl border border-indigo-300 bg-indigo-50 p-6 shadow-md">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-800">One-Time Profile Setup</p>
              <p className="mt-2 text-4xl font-bold text-slate-900">$49</p>
              <p className="mt-1 text-sm text-slate-600">Everything you need to launch your digital business profile.</p>
              <ul className="mt-4 grid gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
                {profileSetupIncludes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-indigo-600">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <div className="grid gap-4">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="inline-flex w-fit rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Most popular
                </span>
                <p className="mt-2 text-sm font-semibold text-slate-700">Essential — Digital Service</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  $3.99<span className="ml-1 text-sm font-medium text-slate-500">/month</span>
                </p>
                <ul className="mt-4 grid gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
                  {essentialIncludes.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </article>
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Pay Annually & Save</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  $39<span className="ml-1 text-sm font-medium text-slate-500">/year</span>
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Prepay 12 months of Essential — about <span className="font-semibold">$3.25/month</span> vs. $3.99 billed monthly.
                </p>
              </article>
            </div>
          </div>

          <div className="mt-10">
            <h4 className="text-xl font-bold text-slate-900">Choose your NFC product</h4>
            <p className="mt-1 text-sm text-slate-600">A one-time purchase that links to your always-current profile.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nfcProducts.map((product) => (
                <div key={product.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                  <span className="font-medium text-slate-700">{product.name}</span>
                  <span className="font-bold text-indigo-600">{product.price}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-xl font-bold text-slate-900">Individual example — PVC TapCard</h4>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Monthly option</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  <li className="flex justify-between"><span>Profile setup</span><span className="font-semibold">$49</span></li>
                  <li className="flex justify-between"><span>PVC TapCard</span><span className="font-semibold">$14.99</span></li>
                  <li className="flex justify-between"><span>Digital service</span><span className="font-semibold">$3.99/month</span></li>
                </ul>
                <p className="mt-3 text-lg font-bold text-slate-900">
                  $63.99 due today <span className="text-sm font-medium text-slate-500">+ $3.99/month</span>
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Annual prepaid option</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  <li className="flex justify-between"><span>Profile setup</span><span className="font-semibold">$49</span></li>
                  <li className="flex justify-between"><span>PVC TapCard</span><span className="font-semibold">$14.99</span></li>
                  <li className="flex justify-between"><span>12-month digital service</span><span className="font-semibold">$39</span></li>
                </ul>
                <p className="mt-3 text-lg font-bold text-slate-900">First-year total: $102.99</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              No new card is required when your information changes — simply update your MDM Tap profile through your customer dashboard.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-300">Managing a team?</p>
              <p className="mt-1 text-lg font-bold">MDM Tap Enterprise — one brand, every team member connected.</p>
              <p className="mt-1 text-sm text-slate-300">Company setup, branded templates, per-user pricing from $2.49/user/mo, and bulk NFC programming.</p>
            </div>
            <Link
              href="/enterprise"
              className="inline-flex shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-100"
            >
              Explore Enterprise →
            </Link>
          </div>

          <div className="mt-10 rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-center">
            <p className="text-lg font-bold tracking-tight text-slate-900">MDM TAP</p>
            <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">Tap. Connect. Update.</p>
          </div>
        </section>

        <section id="signup" className="mt-16 md:mt-20">
          <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl ring-1 ring-indigo-100/70 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Sign up for TapCard</h3>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
              New customers can start by requesting onboarding. If you already have credentials, sign in directly to your admin dashboard.
                </p>
              </div>
              <span className="hidden md:inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Response in 1 business day
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                I already have an account
              </Link>
            </div>

            <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
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
                Service type *
                <select
                  value={form.service_interest}
                  onChange={(e) => setForm((prev) => ({ ...prev, service_interest: e.target.value }))}
                  className={formFieldClass}
                >
                  {serviceOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Digital service plan
                <select
                  value={form.plan_interest}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan_interest: e.target.value }))}
                  className={formFieldClass}
                >
                  <option value="essential_monthly">Essential — $3.99/month</option>
                  <option value="essential_annual">Essential Annual — $39/year (save ~19%)</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Quantity
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  className={formFieldClass}
                  placeholder="1"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Team size
                <input
                  value={form.team_size}
                  onChange={(e) => setForm((prev) => ({ ...prev, team_size: e.target.value }))}
                  className={formFieldClass}
                  placeholder="e.g. 5"
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
                  placeholder="Tell us about your rollout timeline or NFC volume goals."
                />
              </label>
              {!isQuote ? (
                <div className="md:col-span-2">
                  {cardAvailable ? (
                    <>
                      <p className="text-sm font-medium text-slate-700">Card for automatic renewal</p>
                      <p className="mb-2 text-xs text-slate-500">Saved securely with Square to auto-charge your digital service each cycle.</p>
                    </>
                  ) : null}
                  <SquareCard ref={cardRef} onAvailability={setCardAvailable} />
                </div>
              ) : null}

              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Order summary</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  <li className="flex justify-between">
                    <span>One-time profile setup</span>
                    <span className="font-semibold">{formatUsd(PROFILE_SETUP_CENTS)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>
                      {selectedService.label.split(" — ")[0]}
                      {selectedService.key !== "digital_only" && !isQuote && productQuantity > 1 ? ` × ${productQuantity}` : ""}
                    </span>
                    <span className="font-semibold">
                      {isQuote || productCents === null
                        ? "Quote"
                        : productCents === 0
                          ? "Included"
                          : formatUsd(productCents * productQuantity)}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Digital service {isAnnual ? "(annual prepay)" : "(monthly)"}</span>
                    <span className="font-semibold">{isAnnual ? formatUsd(ANNUAL_SERVICE_CENTS) : "$3.99/mo"}</span>
                  </li>
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-sm font-semibold text-slate-900">Due today</span>
                  <span className="text-lg font-bold text-slate-900">
                    {dueTodayCents === null ? "We'll send a quote" : formatUsd(dueTodayCents)}
                  </span>
                </div>
                {!isAnnual && !isQuote ? (
                  <p className="mt-1 text-xs text-slate-500">Then $3.99/month for Essential digital service — auto-renews monthly, cancel anytime.</p>
                ) : null}
                {isAnnual && !isQuote ? (
                  <p className="mt-1 text-xs text-slate-500">Auto-renews annually at $39/year after the first year. Cancel anytime.</p>
                ) : null}
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : isQuote ? "Request a quote" : "Continue to secure checkout"}
                </button>
                {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
