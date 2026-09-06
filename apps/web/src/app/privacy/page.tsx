import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | MDM TapCard",
  description: "Privacy information for MDM TapCard and MDM Creation services.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 px-6 py-12 text-slate-100">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-slate-800 shadow-2xl sm:p-12">
        <Link href="/" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← MDM TapCard</Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">MDM Creation</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Effective date: September 6, 2026</p>

        <div className="prose prose-slate mt-10 max-w-none">
          <p>MDM Creation (“MDM,” “we,” “us,” or “our”) provides MDM TapCard digital profiles, NFC products, client dashboards, and related services. This policy explains how we collect, use, and protect information.</p>
          <h2>Information we collect</h2>
          <p>We may collect account and contact details, business profile information, order and shipping details, support messages, usage analytics, and information submitted through an MDM TapCard profile.</p>
          <h2>Social account connections</h2>
          <p>When a client connects Facebook, Instagram, TikTok, or another supported service, the client is redirected to that provider’s official authorization screen. We do not ask for or store the client’s social-media password. If access is approved, we receive only the permissions and account information authorized by the provider, store access tokens encrypted, and use them to provide the requested gallery and synchronization features.</p>
          <h2>How we use information</h2>
          <p>We use information to create and operate profiles, process orders, provide NFC and digital-card services, synchronize approved social content, provide support, secure the service, and understand service usage. We do not sell personal information.</p>
          <h2>Sharing and retention</h2>
          <p>We share information only with service providers needed to operate the service, payment and shipping partners, or when required by law. We retain information only as long as reasonably necessary for the service, legal obligations, dispute resolution, and security.</p>
          <h2>Your choices</h2>
          <p>You may request access, correction, deletion, or disconnection of an integrated social account. Disconnecting a social account removes its stored access tokens and stops future synchronization.</p>
          <h2>Contact</h2>
          <p>For privacy questions or requests, use the contact options on the <Link href="/" className="text-indigo-700 underline">MDM TapCard website</Link> and identify the account or business involved.</p>
        </div>
      </article>
    </main>
  );
}
