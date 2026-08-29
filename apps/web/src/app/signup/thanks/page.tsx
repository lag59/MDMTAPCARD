import Link from "next/link";

type Props = {
  searchParams?: Promise<{
    request_id?: string;
    company?: string;
  }>;
};

export default async function SignupThanksPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const requestId = params.request_id ?? "";
  const company = params.company ?? "your company";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-cyan-400/30 bg-slate-900 p-8 shadow-2xl">
        <p className="inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
          Signup request received
        </p>
        <h1 className="mt-4 text-3xl font-bold">Thanks, {company}!</h1>
        <p className="mt-3 text-slate-300">
          Your onboarding request was submitted successfully. Our team will review it and contact you with setup steps.
        </p>

        {requestId ? (
          <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Request ID</p>
            <p className="mt-1 break-all font-mono text-sm text-cyan-200">{requestId}</p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="rounded-lg border border-slate-600 px-4 py-2.5 text-center text-sm font-semibold hover:bg-slate-800"
          >
            Back to landing page
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-cyan-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-cyan-500"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
