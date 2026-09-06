import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion | MDM TapCard",
  description: "Request deletion of your MDM TapCard account and connected data.",
};

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 px-6 py-12 text-slate-100">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-slate-800 shadow-2xl sm:p-12">
        <Link href="/" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">← MDM TapCard</Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">MDM Creation</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Data Deletion</h1>
        <p className="mt-3 text-sm text-slate-500">How to request deletion of your information</p>

        <div className="prose prose-slate mt-10 max-w-none">
          <p>You can request deletion of your MDM TapCard account and associated personal information at any time.</p>
          <h2>To disconnect a social account</h2>
          <p>Sign in to your MDM TapCard dashboard, open <strong>Social Connections</strong>, and choose <strong>Disconnect</strong>. This removes the stored access and refresh tokens and stops future imports from that provider.</p>
          <h2>To delete your MDM data</h2>
          <ol>
            <li>Contact MDM Creation through the <Link href="/" className="text-indigo-700 underline">MDM TapCard website</Link>.</li>
            <li>State that you want your MDM TapCard data deleted.</li>
            <li>Include the account email or business name so we can verify and locate the correct account.</li>
          </ol>
          <p>We will verify the request, remove or anonymize information that we are not required to retain, and confirm completion. Some limited records may be retained when required for accounting, fraud prevention, security, legal compliance, or dispute resolution.</p>
          <h2>Third-party social data</h2>
          <p>Deleting your MDM data does not delete content held by Facebook, Instagram, TikTok, or another social provider. To remove data held by those providers, use their account and privacy controls directly.</p>
        </div>
      </article>
    </main>
  );
}
