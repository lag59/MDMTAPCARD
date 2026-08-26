"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PrintableCard from "@/components/PrintableCard";
import { apiGet } from "@/lib/api";
import type { Profile } from "@/lib/types";

export default function PrintCardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    apiGet<Profile>(`/api/v1/profiles/${slug}/edit`)
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load card."));
  }, [slug]);

  if (error) {
    return (
      <div>
        <Link href={`/admin/cards/${slug}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back
        </Link>
        <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      </div>
    );
  }

  if (!profile) return <div className="text-slate-400 text-sm p-8">Loading…</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link href={`/admin/cards/${slug}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to card
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">Print business card</h1>
        <button
          onClick={() => window.print()}
          className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Print / Save as PDF
        </button>
      </div>

      <p className="text-sm text-slate-500 mb-6 print:hidden">
        Standard 3.5&quot; × 2&quot; card. Front and back shown below — print double-sided.
      </p>

      <div className="bg-slate-100 rounded-xl p-8 print:bg-white print:p-0">
        <PrintableCard profile={profile} />
      </div>
    </div>
  );
}
