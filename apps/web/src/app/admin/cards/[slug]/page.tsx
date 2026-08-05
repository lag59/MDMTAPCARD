"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CardForm, { CardFormValues } from "@/components/CardForm";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function EditCardPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    if (!slug) return;
    apiGet<Profile>(`/api/v1/profiles/${slug}/edit`)
      .then(setProfile)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load card."));
  }, [slug]);

  const handleSubmit = async (values: CardFormValues) => {
    const updated = await apiPatch<Profile>(`/api/v1/profiles/${slug}`, {
      ...values,
      title: values.title || null,
      photo_url: values.photo_url || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      address: values.address || null,
      biography: values.biography || null,
      whatsapp_number: values.whatsapp_number || null,
    });
    setProfile(updated);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete card "${profile?.display_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/v1/profiles/${slug}`);
      router.push("/admin/cards");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed.");
      setDeleting(false);
    }
  };

  const handleCopyPublicLink = async () => {
    if (!profile) return;
    await navigator.clipboard.writeText(profile.profile_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleExportJson = () => {
    if (!profile) return;

    const payload = {
      exported_at: new Date().toISOString(),
      source_slug: profile.slug,
      profile: {
        display_name: profile.display_name,
        title: profile.title ?? "",
        photo_url: profile.photo_url ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        website: profile.website ?? "",
        address: profile.address ?? "",
        biography: profile.biography ?? "",
        whatsapp_number: profile.whatsapp_number ?? "",
        language: profile.language,
        theme_id: profile.theme_id ?? "dark",
        is_active: profile.is_active,
        social_links: profile.social_links.map((l) => ({ platform: l.platform, url: l.url })),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${profile.slug}-design.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);

    setExported(true);
    window.setTimeout(() => setExported(false), 1500);
  };

  if (loadError) {
    return (
      <div>
        <Link href="/admin/cards" className="text-sm text-slate-500 hover:text-slate-700">
          ← Cards
        </Link>
        <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{loadError}</div>
      </div>
    );
  }

  if (!profile) {
    return <div className="text-slate-400 text-sm p-8">Loading…</div>;
  }

  const initial: CardFormValues = {
    display_name: profile.display_name,
    title: profile.title ?? "",
    photo_url: profile.photo_url ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    website: profile.website ?? "",
    address: profile.address ?? "",
    biography: profile.biography ?? "",
    whatsapp_number: profile.whatsapp_number ?? "",
    language: profile.language,
    theme_id: profile.theme_id ?? "dark",
    is_active: profile.is_active,
    social_links: profile.social_links.map((l) => ({ platform: l.platform, url: l.url })),
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/cards" className="text-sm text-slate-500 hover:text-slate-700">
          ← Cards
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">{profile.display_name}</h1>
        <span className="text-xs text-slate-400">/{profile.slug}</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            {exported ? "Exported" : "Export JSON"}
          </button>
          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            {copied ? "Copied" : "Copy Public Link"}
          </button>
          <a
            href={profile.profile_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View card ↗
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
        <CardForm key={profile.slug} initial={initial} onSubmit={handleSubmit} submitLabel="Save Changes" />
      </div>
    </div>
  );
}
