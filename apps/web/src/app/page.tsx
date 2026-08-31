"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitSignupRequest } from "@/lib/api";

const oneTimePackages = [
  {
    key: "digital_professional",
    name: "Digital Professional",
    price: "$59",
    cadence: "one-time",
    note: "+ digital service from $7/mo",
    description: "A complete digital business profile — no physical NFC card included.",
    features: [
      "Digital business profile & standard MDM template",
      "Logo, phone, email, business address",
      "Click-to-call, click-to-text, Save Contact / vCard",
      "WhatsApp, social links, About section",
      "Standard QR code",
      "Customer dashboard + unlimited self-service updates",
    ],
    featured: false,
  },
  {
    key: "nfc_professional_pvc",
    name: "NFC Professional PVC",
    price: "$89",
    cadence: "one-time",
    note: "+ digital service from $7/mo",
    description: "Everything in Digital Professional, plus a programmed PVC NFC card.",
    features: ["Everything in Digital Professional", "1 programmed PVC NFC TapCard", "Tap-to-share + QR backup"],
    featured: false,
  },
  {
    key: "nfc_professional_wood",
    name: "NFC Professional Wood",
    price: "$109",
    cadence: "one-time",
    note: "+ digital service from $7/mo",
    description: "A premium natural option for a distinctive first impression.",
    features: ["Everything in Digital Professional", "1 programmed Wood NFC TapCard", "Tap-to-share + QR backup"],
    featured: false,
  },
  {
    key: "tap_everywhere_pvc",
    name: "Tap Everywhere PVC",
    price: "$109",
    cadence: "one-time",
    note: "+ digital service from $7/mo",
    description: "A business card plus a second tap point for your phone, desk, or vehicle.",
    features: ["Digital Professional profile", "1 PVC NFC TapCard", "1 NFC TapButton", "NFC programming + QR access"],
    featured: false,
  },
  {
    key: "tap_everywhere_wood",
    name: "Tap Everywhere Wood",
    price: "$129",
    cadence: "one-time",
    note: "+ digital service from $7/mo",
    description: "Wood TapCard plus an additional NFC TapButton.",
    features: ["Digital Professional profile", "1 Wood NFC TapCard", "1 NFC TapButton", "NFC programming + QR access"],
    featured: false,
  },
  {
    key: "custom_wood_business",
    name: "Custom Wood Business",
    price: "$159",
    cadence: "one-time",
    note: "Pro service $12/mo recommended",
    description: "Our premium package: custom design, multiple tap points, and a Pro analytics trial.",
    features: [
      "Digital business profile",
      "1 Wood NFC TapCard + 1 NFC TapButton",
      "Custom Template Design",
      "Up to 4 customer-provided business links",
      "Standard QR code + customer dashboard",
      "Pro analytics trial",
    ],
    featured: true,
  },
  {
    key: "metal_nfc_professional",
    name: "Metal NFC Professional",
    price: "$119+",
    cadence: "one-time",
    note: "+ digital service from $7/mo",
    description: "A sleek metal TapCard for a bold, modern impression.",
    features: ["Everything in Digital Professional", "1 programmed Metal NFC TapCard", "Tap-to-share + QR backup"],
    featured: false,
  },
  {
    key: "premium_metal_nfc",
    name: "Premium Metal NFC",
    price: "$139+",
    cadence: "one-time",
    note: "+ digital service from $7/mo",
    description: "Our top-tier metal finish for a luxury, timeless presentation.",
    features: ["Everything in Digital Professional", "1 programmed Premium Metal NFC TapCard", "Tap-to-share + QR backup"],
    featured: false,
  },
] as const;

const cardMaterialStartingPrices = [
  { name: "PVC NFC", price: "$89 package" },
  { name: "Wood NFC", price: "$109 package" },
  { name: "Metal NFC", price: "$119+" },
  { name: "Premium Metal NFC", price: "$139+" },
] as const;

const digitalServicePlans = [
  {
    key: "essential",
    name: "Essential",
    monthly: "$7/month",
    annual: "$69/year",
    features: ["Hosted digital profile", "Customer dashboard", "Unlimited self-service updates", "NFC + QR connectivity"],
    featured: false,
  },
  {
    key: "pro",
    name: "Pro",
    monthly: "$12/month",
    annual: "$119/year",
    features: ["Everything in Essential", "Profile view analytics", "NFC tap tracking", "QR scan + link-click analytics"],
    featured: true,
  },
  {
    key: "business",
    name: "Business",
    monthly: "$20/month",
    annual: "$199/year",
    features: ["Everything in Pro", "Advanced analytics", "Lead/conversion reporting", "Priority support"],
    featured: false,
  },
] as const;

const customizationPricing = [
  { name: "Standard MDM Template", price: "Included" },
  { name: "Brand Color Customization", price: "+$10" },
  { name: "Custom Template Design", price: "+$35" },
  { name: "Advanced Custom Template", price: "+$65+" },
  { name: "Bilingual English/Spanish Profile", price: "+$20" },
  { name: "Professional Bio Writing", price: "+$25" },
  { name: "Custom Branded QR Code", price: "+$15" },
  { name: "Additional Design Revision", price: "+$15" },
] as const;

const linkSetupPricing = [
  { name: "Website Link", price: "+$10" },
  { name: "Booking / Calendar Link", price: "+$10" },
  { name: "Payment Portal Link", price: "+$10" },
  { name: "Review Link", price: "+$10" },
  { name: "Quote / Estimate Link", price: "+$10" },
  { name: "Menu / Store / Portfolio Link", price: "+$10" },
  { name: "Additional Custom Link", price: "+$5" },
] as const;

const selfServiceUpdates = [
  "Logo",
  "Phone number",
  "Email address",
  "Business address",
  "Social media links",
  "Business name",
  "Job title",
  "Bio or business information",
] as const;

const addOnPricing = [
  { name: "Additional NFC TapButton", price: "$15", detail: "Connect another tap point to an existing profile — phones, desks, vehicles, registers, displays." },
  { name: "Additional NFC Cards", price: "Starting at $30+", detail: "Additional or replacement cards, priced by material, finish, printing, and quantity." },
] as const;

const faqItems = [
  { q: "Do I need an app?", a: "No. The person receiving your information does not need to download an app. Compatible devices can access your profile through NFC tap or QR scan." },
  { q: "Can I update my information later?", a: "Yes. Customers with an active digital service plan can log into their dashboard and update editable information themselves." },
  { q: "What happens if my phone number changes?", a: "Log into your dashboard and update it. You only need a new NFC card if the old number was permanently printed or engraved on the physical card." },
  { q: "Can you connect my appointment calendar?", a: "Yes. You provide the working link from your existing booking or scheduling service, and we add it to your profile." },
  { q: "Can you accept payments through my digital card?", a: "We can connect your existing payment portal or payment link to your profile. You must already have an active payment-processing account." },
  { q: "Do you provide the booking or payment service?", a: "No. MDM Creation connects customer-provided URLs to the digital profile. Third-party accounts and services remain between you and the applicable provider." },
] as const;

const pricingTerms = [
  { title: "Third-Party Services", body: "MDM Creation does not provide or operate third-party websites, booking systems, scheduling services, payment processors, review platforms, online stores, calendars, or other external services. Customers must establish and maintain their own accounts and provide valid working URLs. Third-party fees, transaction fees, and outages are the customer's responsibility." },
  { title: "NFC Compatibility", body: "NFC functionality depends on the receiving device being NFC-capable, enabled, and compatible. NFC antenna locations vary between phones, so users may need to tap different areas of their phone. Where available, a QR code provides an alternative access method." },
  { title: "Wood NFC Cards", body: "Wood is a natural material. Color, grain, texture, tone, and finish may vary between individual cards. These natural variations are not considered manufacturing defects." },
  { title: "Metal NFC Cards", body: "Because metal affects radio-frequency transmission, metal NFC cards may require tapping at the designated NFC area of the card and a compatible area of the receiving phone. Performance may vary by device." },
  { title: "Customer-Provided Information", body: "Customers are responsible for ensuring that all submitted information is accurate, including names, phone numbers, emails, addresses, URLs, social accounts, logos, and photographs, and for having permission to use any submitted content." },
  { title: "Digital Updates vs. Physical Printing", body: "Changes made to your online profile update the digital information associated with your NFC card. They do not change information permanently printed, engraved, or otherwise applied to the physical card. A replacement card may need to be purchased if printed artwork must change." },
  { title: "Design Revisions", body: "Custom Template Design includes 1 revision. Advanced Custom Template Design includes up to 2 revisions. Additional revisions may be billed at $15 per revision. Major changes outside the approved design scope may require a new quote." },
  { title: "Reprints & Customer Errors", body: "If an error results from information provided incorrectly by the customer and the physical product has already entered production, reprinting or replacement costs are the customer's responsibility." },
  { title: "Custom Product Refund Policy", body: "NFC cards, customized designs, branded products, and custom templates are created specifically for each customer. Custom products and completed design services are non-refundable once design or production has begun, except for verified production defects." },
  { title: "Monthly & Annual Digital Service", body: "The one-time product/setup price and ongoing digital service are separate charges. Your digital service plan provides access to your hosted profile and the features of your selected service level. If service is canceled, the digital profile and related NFC/QR destination may become unavailable once the paid service period expires." },
] as const;

const serviceOptions = [
  { key: "digital_card", label: "Digital Card", requiresShipping: false },
  { key: "physical_tap_card", label: "Physical Tap Card", requiresShipping: true },
  { key: "physical_tap_card_with_design", label: "Physical Tap Card + Custom Design (quote required)", requiresShipping: true },
  { key: "tap_button_for_phone", label: "Adhesive NFC TapButton", requiresShipping: true },
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
    service_interest: "digital_card",
    plan_interest: "pro_monthly",
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const requiresShipping = form.service_interest !== "digital_card";

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
    const role = window.localStorage.getItem("user_role");
    if (mounted) {
      setIsSuperAdmin(role === "super_admin");
    }
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
        service_interest: form.service_interest as "digital_card" | "physical_tap_card" | "physical_tap_card_with_design" | "tap_button_for_phone",
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
              <p className="text-sm font-semibold text-slate-900">Card material starting prices</p>
              <div className="mt-3 space-y-2">
                {cardMaterialStartingPrices.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="font-semibold text-slate-900">{item.price}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Special finishes, premium materials, bulk orders, and specialty customization may require a custom quote.</p>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-amber-300 bg-amber-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">See full packages</p>
              <p className="mt-2 text-sm text-slate-700">Compare complete packages, digital service plans, and add-ons.</p>
              <a href="#pricing" className="mt-4 inline-flex w-fit rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                View pricing & packages ↓
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
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">One tap. One profile. Endless connections.</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">Choose your package</h3>
            <p className="mt-2 text-sm text-slate-600">
              Every package is a one-time product price. Digital service is billed separately and keeps your hosted profile active.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {oneTimePackages.map((pkg) => (
              <article
                key={pkg.key}
                className={`flex flex-col rounded-2xl border p-5 ${
                  pkg.featured ? "border-indigo-300 bg-indigo-50 shadow-md" : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                {pkg.featured ? (
                  <span className="mb-2 inline-flex w-fit rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Most popular
                  </span>
                ) : null}
                <p className="text-sm font-semibold text-slate-700">{pkg.name}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {pkg.price}
                  <span className="ml-1 text-sm font-medium text-slate-500">{pkg.cadence}</span>
                </p>
                <p className="mt-1 text-xs font-medium text-indigo-700">{pkg.note}</p>
                <p className="mt-3 text-sm text-slate-600">{pkg.description}</p>
                <ul className="mt-4 space-y-1 text-sm text-slate-600">
                  {pkg.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <a
                  href="#signup"
                  className="mt-5 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Get started
                </a>
              </article>
            ))}
          </div>

          <div className="mt-10">
            <h4 className="text-xl font-bold text-slate-900">Customize your digital card</h4>
            <p className="mt-1 text-sm text-slate-600">The standard MDM template is included. Upgrade your design any time.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {customizationPricing.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
                  <span className="text-slate-700">{item.name}</span>
                  <span className="font-semibold text-slate-900">{item.price}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <h4 className="text-xl font-bold text-slate-900">Add your business links</h4>
            <p className="mt-1 text-sm text-slate-600">
              Already use a website, booking service, payment portal, or review page? We can connect those existing links directly to your card.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-wide text-cyan-800">Business Link Bundle</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">$25</p>
                <p className="mt-2 text-sm text-slate-700">Add up to 4 customer-provided links: Visit Website, Book Now, Pay Now, Leave a Review, Request a Quote, Shop Online, View Menu, or View Portfolio.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {linkSetupPricing.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="font-semibold text-slate-900">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              MDM Creation programs customer-provided URLs into the digital card. Customers must already have an active account and valid URL for any connected service; MDM Creation does not provide or operate third-party services.
            </p>
          </div>

          <div className="mt-10">
            <h4 className="text-xl font-bold text-slate-900">Monthly digital service</h4>
            <p className="mt-1 text-sm text-slate-600">Your NFC card is a one-time purchase. Digital service keeps your hosted profile active.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {digitalServicePlans.map((plan) => (
                <article
                  key={plan.key}
                  className={`rounded-2xl border p-5 ${plan.featured ? "border-indigo-300 bg-indigo-50 shadow-md" : "border-slate-200 bg-white shadow-sm"}`}
                >
                  {plan.featured ? (
                    <span className="mb-2 inline-flex w-fit rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Recommended
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold text-slate-700">{plan.name}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{plan.monthly}</p>
                  <p className="mt-1 text-xs text-slate-500">or {plan.annual}</p>
                  <ul className="mt-4 space-y-1 text-sm text-slate-600">
                    {plan.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Your profile. Your control.</p>
            <p className="mt-1 text-sm text-slate-700">
              With an active digital service plan, customers log into their dashboard and update editable profile information themselves — no charge for normal self-service updates.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selfServiceUpdates.map((item) => (
                <span key={item} className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {addOnPricing.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xl font-bold text-slate-900">{item.price}</p>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <h4 className="text-xl font-bold text-slate-900">Frequently asked questions</h4>
            <div className="mt-4 space-y-2">
              {faqItems.map((item) => (
                <details key={item.q} className="group rounded-xl border border-slate-200 bg-white p-4 open:shadow-sm">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900 marker:content-none">{item.q}</summary>
                  <p className="mt-2 text-sm text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-lg font-bold text-slate-900">Pricing & service terms</h4>
            <div className="mt-3 space-y-2">
              {pricingTerms.map((term) => (
                <details key={term.title} className="group rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-800 marker:content-none">{term.title}</summary>
                  <p className="mt-2 text-sm text-slate-600">{term.body}</p>
                </details>
              ))}
            </div>
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
                Plan interest
                <select
                  value={form.plan_interest}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan_interest: e.target.value }))}
                  className={formFieldClass}
                >
                  <option value="basic_monthly">Basic Monthly ($3.99)</option>
                  <option value="basic_yearly">Basic Yearly ($39)</option>
                  <option value="pro_monthly">Pro Monthly ($6.99)</option>
                  <option value="pro_yearly">Pro Yearly ($69)</option>
                  {isSuperAdmin ? (
                    <>
                      <option value="tap_starter">Tap Starter (Legacy)</option>
                      <option value="tap_business">Tap Business (Legacy)</option>
                      <option value="tap_team">Tap Team (Legacy)</option>
                      <option value="tap_pro">Tap Pro (Legacy)</option>
                    </>
                  ) : null}
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
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Continue to signup"}
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
