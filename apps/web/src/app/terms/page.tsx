import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | MDM TapCard",
  description: "Terms of service for MDM TapCard and MDM Creation services.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 px-6 py-12 text-slate-100">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-slate-800 shadow-2xl sm:p-12">
        <Link href="/" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← MDM TapCard</Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">MDM Creation</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-500">Effective date: September 6, 2026</p>

        <div className="prose prose-slate mt-10 max-w-none">
          <p>These Terms govern your use of MDM TapCard and related MDM Creation services. By using the service, you agree to these Terms.</p>
          <h2>Using the service</h2>
          <p>You must provide accurate information, keep your account credentials secure, and use the service lawfully. You are responsible for content you publish and for having the rights and permissions needed to use that content.</p>
          <h2>Social integrations</h2>
          <p>You may connect supported social accounts through the provider’s official authorization flow. You authorize only the access you approve at that provider. MDM does not request your social password. You may disconnect an integration at any time through your account or by contacting us.</p>
          <h2>Content and moderation</h2>
          <p>You retain responsibility for your profile, gallery, and social content. We may remove content or suspend access when reasonably necessary for security, legal compliance, abuse prevention, or violation of these Terms.</p>
          <h2>Orders and subscriptions</h2>
          <p>Product, setup, subscription, and renewal charges are presented during checkout. Payment processing may be handled by third-party payment providers under their own terms. Digital service access may be suspended for unpaid or disputed charges.</p>
          <h2>Availability</h2>
          <p>We work to keep MDM TapCard available and reliable, but the service may occasionally be unavailable for maintenance, provider outages, or circumstances outside our control. Social features also depend on the availability and permissions of each social platform.</p>
          <h2>Contact</h2>
          <p>Questions about these Terms can be submitted through the <Link href="/" className="text-indigo-700 underline">MDM TapCard website</Link>.</p>
        </div>
      </article>
    </main>
  );
}
