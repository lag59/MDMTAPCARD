"use client";

import { useEffect, useState } from "react";

const PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube"] as const;

const THEME_OPTIONS = [
  { id: "dark",     label: "Dark",     color: "bg-slate-700" },
  { id: "ocean",    label: "Ocean",    color: "bg-blue-500" },
  { id: "sunset",   label: "Sunset",   color: "bg-orange-500" },
  { id: "forest",   label: "Forest",   color: "bg-emerald-600" },
  { id: "midnight", label: "Midnight", color: "bg-violet-700" },
  { id: "light",    label: "Light",    color: "bg-slate-200 border border-slate-300" },
];

export interface CardFormValues {
  display_name: string;
  title: string;
  photo_url: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  biography: string;
  whatsapp_number: string;
  language: "en" | "es";
  theme_id: string;
  is_active: boolean;
  social_links: { platform: string; url: string }[];
}

interface Props {
  initial?: Partial<CardFormValues>;
  onSubmit: (values: CardFormValues) => Promise<void>;
  submitLabel: string;
}

export default function CardForm({ initial, onSubmit, submitLabel }: Props) {
  const [values, setValues] = useState<CardFormValues>({
    display_name: initial?.display_name ?? "",
    title: initial?.title ?? "",
    photo_url: initial?.photo_url ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    website: initial?.website ?? "",
    address: initial?.address ?? "",
    biography: initial?.biography ?? "",
    whatsapp_number: initial?.whatsapp_number ?? "",
    language: initial?.language ?? "en",
    theme_id: initial?.theme_id ?? "dark",
    is_active: initial?.is_active ?? true,
    social_links: initial?.social_links ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setValues({
      display_name: initial?.display_name ?? "",
      title: initial?.title ?? "",
      photo_url: initial?.photo_url ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      website: initial?.website ?? "",
      address: initial?.address ?? "",
      biography: initial?.biography ?? "",
      whatsapp_number: initial?.whatsapp_number ?? "",
      language: initial?.language ?? "en",
      theme_id: initial?.theme_id ?? "dark",
      is_active: initial?.is_active ?? true,
      social_links: initial?.social_links ?? [],
    });
  }, [initial]);

  const set =
    (key: keyof CardFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSocialChange = (i: number, field: "platform" | "url", val: string) =>
    setValues((v) => ({
      ...v,
      social_links: v.social_links.map((l, j) => (j === i ? { ...l, [field]: val } : l)),
    }));

  const addLink = () =>
    setValues((v) => ({ ...v, social_links: [...v.social_links, { platform: "instagram", url: "" }] }));

  const removeLink = (i: number) =>
    setValues((v) => ({ ...v, social_links: v.social_links.filter((_, j) => j !== i) }));

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the logo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setValues((v) => ({ ...v, photo_url: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // Convert empty strings to null for optional fields
      await onSubmit({
        ...values,
        title: values.title || "",
        photo_url: values.photo_url || "",
        phone: values.phone || "",
        email: values.email || "",
        website: values.website || "",
        address: values.address || "",
        biography: values.biography || "",
        whatsapp_number: values.whatsapp_number || "",
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const label = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 text-green-700 text-sm px-4 py-3">Saved successfully.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={label}>Display Name *</label>
          <input required className={input} value={values.display_name} onChange={set("display_name")} />
        </div>
        <div>
          <label className={label}>Title / Position</label>
          <input className={input} value={values.title} onChange={set("title")} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Logo / Profile Image (optional)</label>
          <div className="flex flex-col md:flex-row gap-3">
            <input className={input} placeholder="Paste image URL" value={values.photo_url} onChange={set("photo_url")} />
            <input type="file" accept="image/*" onChange={handleLogoFile} className="block text-sm text-slate-600" />
          </div>
          <p className="mt-2 text-xs text-slate-500">If you do not upload a logo/image, the card will show initials automatically.</p>
          {values.photo_url ? (
            <div className="mt-3 flex items-center gap-3">
              <img src={values.photo_url} alt="Logo preview" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
              <button
                type="button"
                onClick={() => setValues((v) => ({ ...v, photo_url: "" }))}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Remove image
              </button>
            </div>
          ) : null}
        </div>
        <div>
          <label className={label}>Phone</label>
          <input className={input} type="tel" value={values.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className={label}>Email</label>
          <input className={input} type="email" value={values.email} onChange={set("email")} />
        </div>
        <div>
          <label className={label}>Website</label>
          <input className={input} value={values.website} onChange={set("website")} />
        </div>
        <div>
          <label className={label}>WhatsApp Number</label>
          <input className={input} type="tel" value={values.whatsapp_number} onChange={set("whatsapp_number")} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Address</label>
          <input className={input} value={values.address} onChange={set("address")} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Biography</label>
          <textarea className={input} rows={3} value={values.biography} onChange={set("biography")} />
        </div>
        <div>
          <label className={label}>Language</label>
          <select className={input} value={values.language} onChange={set("language")}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            id="is_active"
            type="checkbox"
            checked={values.is_active}
            onChange={(e) => setValues((v) => ({ ...v, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="is_active" className="text-sm text-slate-700">
            Active (publicly visible)
          </label>
        </div>

        <div className="md:col-span-2">
          <label className={label}>Card Theme</label>
          <div className="flex gap-4 flex-wrap mt-1">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setValues((v) => ({ ...v, theme_id: t.id }))}
                className="flex flex-col items-center gap-1.5"
              >
                <div className={`w-10 h-10 rounded-full ${t.color} transition ${values.theme_id === t.id ? "ring-2 ring-offset-2 ring-blue-500 scale-110" : "opacity-70 hover:opacity-100"}`} />
                <span className={`text-xs ${values.theme_id === t.id ? "font-semibold text-slate-800" : "text-slate-500"}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Social Links</span>
          <button type="button" onClick={addLink} className="text-xs text-blue-600 hover:underline">
            + Add link
          </button>
        </div>
        <div className="space-y-2">
          {values.social_links.map((link, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={link.platform}
                onChange={(e) => handleSocialChange(i, "platform", e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                className={`${input} flex-1`}
                placeholder="https://…"
                value={link.url}
                onChange={(e) => handleSocialChange(i, "url", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="text-slate-400 hover:text-red-500 text-xl leading-none px-1"
              >
                ×
              </button>
            </div>
          ))}
          {values.social_links.length === 0 && (
            <p className="text-xs text-slate-400">No social links added yet.</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
