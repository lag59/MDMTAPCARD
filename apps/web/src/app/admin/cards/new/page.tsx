"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CardForm, { CardFormValues } from "@/components/CardForm";
import { apiGet, apiPost } from "@/lib/api";
import type { Profile } from "@/lib/types";

type Company = { id: string; name: string };
type Me = { role: string; company_id: string | null; company_name: string | null };

export default function NewCardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [importSlug, setImportSlug] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importJsonError, setImportJsonError] = useState<string | null>(null);
  const [importInitial, setImportInitial] = useState<Partial<CardFormValues>>({});

  useEffect(() => {
    apiGet<Me>("/api/v1/admin/me").then((data) => {
      setMe(data);
      if (data.role === "super_admin") {
        apiGet<Company[]>("/api/v1/admin/companies").then((list) => {
          setCompanies(list);
          if (list.length > 0) setSelectedCompanyId(list[0].id);
        });
      } else if (data.company_id) {
        setSelectedCompanyId(data.company_id);
      }
    });
  }, []);

  const handleSubmit = async (values: CardFormValues) => {
    const created = await apiPost<Profile>("/api/v1/profiles/", {
      ...values,
      title: values.title || null,
      photo_url: values.photo_url || null,
      phone: values.phone || null,
      email: values.email || null,
      website: values.website || null,
      address: values.address || null,
      biography: values.biography || null,
      whatsapp_number: values.whatsapp_number || null,
      company_id: selectedCompanyId || null,
    });
    router.push(`/admin/cards/${created.slug}`);
  };

  const handleImportDesign = async () => {
    const slug = importSlug.trim();
    if (!slug) return;
    setImportError(null);
    try {
      const source = await apiGet<Profile>(`/api/v1/profiles/${slug}/edit`);
      setImportInitial({
        display_name: source.display_name,
        title: source.title ?? "",
        photo_url: source.photo_url ?? "",
        phone: source.phone ?? "",
        email: source.email ?? "",
        website: source.website ?? "",
        address: source.address ?? "",
        biography: source.biography ?? "",
        whatsapp_number: source.whatsapp_number ?? "",
        language: source.language,
        theme_id: source.theme_id ?? "dark",
        is_active: source.is_active,
        social_links: source.social_links.map((l) => ({ platform: l.platform, url: l.url })),
      });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not import card design.");
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportJsonError(null);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<CardFormValues> & {
        profile?: Partial<CardFormValues>;
      };
      const source = parsed.profile ?? parsed;

      const normalized: Partial<CardFormValues> = {
        display_name: source.display_name ?? "",
        title: source.title ?? "",
        photo_url: source.photo_url ?? "",
        phone: source.phone ?? "",
        email: source.email ?? "",
        website: source.website ?? "",
        address: source.address ?? "",
        biography: source.biography ?? "",
        whatsapp_number: source.whatsapp_number ?? "",
        language: source.language === "es" ? "es" : "en",
        theme_id: source.theme_id ?? "dark",
        is_active: source.is_active ?? true,
        social_links: Array.isArray(source.social_links)
          ? source.social_links
              .filter((l): l is { platform: string; url: string } => Boolean(l && l.platform && l.url))
              .map((l) => ({ platform: l.platform, url: l.url }))
          : [],
      };

      if (!normalized.display_name) {
        throw new Error("JSON is missing display_name.");
      }

      setImportInitial(normalized);
      setImportError(null);
    } catch (err) {
      setImportJsonError(err instanceof Error ? err.message : "Invalid JSON file.");
    } finally {
      // Reset so importing the same file again still triggers onChange.
      e.currentTarget.value = "";
    }
  };

  const isSuperAdmin = me?.role === "super_admin";
  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/cards" className="text-sm text-slate-500 hover:text-slate-700">
          ← Cards
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">New Digital Card</h1>
      </div>
      <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700 mb-2">Import Already Designed Card</p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="Enter existing card slug (example: andrea-gaviria)"
                value={importSlug}
                onChange={(e) => setImportSlug(e.target.value)}
              />
              <button
                type="button"
                onClick={handleImportDesign}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Import from Slug
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600">Or import from JSON</label>
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportJsonFile}
                className="block text-xs text-slate-600"
              />
            </div>
          </div>
          {importError ? <p className="text-xs text-red-600 mt-2">{importError}</p> : null}
          {importJsonError ? <p className="text-xs text-red-600 mt-2">{importJsonError}</p> : null}
        </div>
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-1">Client / Company</label>
          {isSuperAdmin ? (
            <select
              className={input}
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-700 px-3 py-2 bg-slate-50 rounded-lg">
              {me?.company_name ?? "—"}
            </p>
          )}
        </div>
        <CardForm initial={importInitial} onSubmit={handleSubmit} submitLabel="Create Card" />
      </div>
    </div>
  );
}

