"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import TemplatePreview from "./TemplatePreview";
import { TEMPLATES, isValidCustomTheme } from "@/lib/templates";
import { apiGet, listReusableTemplates, uploadLogo, type ImportedTemplate } from "@/lib/api";

const PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube"] as const;

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
  custom_theme: string;
  booking_url: string;
  payment_url: string;
  payment_label: string;
  is_active: boolean;
  social_links: { platform: string; url: string }[];
}

interface Props {
  initial?: Partial<CardFormValues>;
  onSubmit: (values: CardFormValues) => Promise<void>;
  submitLabel: string;
}

export default function CardForm({ initial, onSubmit, submitLabel }: Props) {
  const normalizedInitial: CardFormValues = {
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
    custom_theme: initial?.custom_theme ?? "",
    booking_url: initial?.booking_url ?? "",
    payment_url: initial?.payment_url ?? "",
    payment_label: initial?.payment_label ?? "",
    is_active: initial?.is_active ?? true,
    social_links: initial?.social_links ?? [],
  };

  const [values, setValues] = useState<CardFormValues>({
    ...normalizedInitial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [reusableTemplates, setReusableTemplates] = useState<ImportedTemplate[]>([]);
  const customFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGet<{ role: string }>("/api/v1/admin/me")
      .then((user) => setIsSuperAdmin(user.role === "super_admin"))
      .catch(() => setIsSuperAdmin(false));
    listReusableTemplates().then(setReusableTemplates).catch(() => setReusableTemplates([]));
  }, []);

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
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP profile photo.");
      return;
    }
    setUploadingLogo(true);
    setError(null);
    uploadLogo(file)
      .then((url) => setValues((v) => ({ ...v, photo_url: url })))
      .catch((err) => setError(err instanceof Error ? err.message : "Logo upload failed."))
      .finally(() => {
        setUploadingLogo(false);
        e.target.value = "";
      });
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidCustomTheme(parsed)) {
        throw new Error("Invalid template file (needs a layout and a full color palette).");
      }
      setValues((v) => ({ ...v, theme_id: "custom", custom_theme: JSON.stringify(parsed) }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid template file.");
    } finally {
      e.currentTarget.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const normalizedSocialLinks = values.social_links
        .map((link) => ({
          platform: (link.platform ?? "").trim().toLowerCase(),
          url: (link.url ?? "").trim(),
        }))
        .filter((link) => link.platform.length > 0 && link.url.length > 0);

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
        social_links: normalizedSocialLinks,
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
          <label className={label}>Profile Photo (optional)</label>
          <div className="flex flex-col md:flex-row gap-3">
            <input className={input} placeholder="Paste image URL" value={values.photo_url} onChange={set("photo_url")} />
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoFile} disabled={uploadingLogo} className="block text-sm text-slate-600" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {uploadingLogo ? "Uploading…" : "Upload a JPG, PNG, or WebP photo, or paste an image URL. If none is set, the card shows initials automatically."}
          </p>
          {values.photo_url ? (
            <div className="mt-3 flex items-center gap-3">
              <Image
                src={values.photo_url}
                alt="Logo preview"
                width={80}
                height={80}
                unoptimized
                className="w-20 h-20 rounded-lg object-cover border border-slate-200"
              />
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
          <div className="flex items-center justify-between mb-2">
            <label className={label}>Card Template</label>
            <div className="flex items-center gap-3">
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={() => customFileRef.current?.click()}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Upload custom…
                </button>
              ) : null}
              <a href="/admin/templates" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:underline">
                Browse gallery ↗
              </a>
            </div>
          </div>
          <input
            ref={customFileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleCustomUpload}
            className="hidden"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {reusableTemplates.map((template) => (
              <div
                key={template.id}
                role="button"
                tabIndex={0}
                onClick={() => setValues((v) => ({ ...v, theme_id: template.id, custom_theme: "" }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setValues((v) => ({ ...v, theme_id: template.id, custom_theme: "" }));
                  }
                }}
                className={`cursor-pointer rounded-lg border p-1.5 text-left transition ${
                  values.theme_id === template.id ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <TemplatePreview
                  overrides={{
                    theme_id: template.id,
                    template_definition: { id: template.id, name: template.name, layout: template.layout, palette: template.palette, branding: template.branding, locked: template.locked },
                    template_background: template.background,
                    display_name: values.display_name || "Alex Rivera",
                    title: values.title,
                    photo_url: values.photo_url,
                  }}
                  width={120}
                  height={180}
                />
                <div className="mt-1 text-[11px] font-medium text-slate-700 truncate">{template.name}</div>
              </div>
            ))}
            {values.theme_id === "custom" && values.custom_theme && (
              <div className="rounded-lg border border-blue-500 ring-2 ring-blue-200 p-1.5 text-left">
                <TemplatePreview
                  overrides={{
                    theme_id: "custom",
                    custom_theme: values.custom_theme,
                    display_name: values.display_name || "Alex Rivera",
                    title: values.title,
                    photo_url: values.photo_url,
                  }}
                  width={120}
                  height={180}
                />
                <div className="mt-1 text-[11px] font-semibold text-blue-700">Custom (uploaded)</div>
              </div>
            )}
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setValues((v) => ({ ...v, theme_id: t.id }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setValues((v) => ({ ...v, theme_id: t.id }));
                  }
                }}
                className={`cursor-pointer rounded-lg border p-1.5 text-left transition ${
                  values.theme_id === t.id
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <TemplatePreview
                  overrides={{
                    theme_id: t.id,
                    display_name: values.display_name || "Alex Rivera",
                    title: values.title,
                    photo_url: values.photo_url,
                  }}
                  width={120}
                  height={180}
                />
                <div className="mt-1 flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${t.swatch}`} />
                  <span className="text-[11px] font-medium text-slate-700 truncate">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-700 mb-1">Scheduling &amp; Payments</p>
        <p className="text-xs text-slate-500 mb-3">
          Add a booking link (Calendly, Cal.com) and/or a payment link (Stripe Payment Link, PayPal.me).
          Buttons appear on the card only when a link is set.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={label}>Booking / Scheduling link</label>
            <input
              className={input}
              placeholder="https://calendly.com/your-name"
              value={values.booking_url}
              onChange={set("booking_url")}
            />
          </div>
          <div>
            <label className={label}>Payment link</label>
            <input
              className={input}
              placeholder="https://buy.stripe.com/… or paypal.me/…"
              value={values.payment_url}
              onChange={set("payment_url")}
            />
          </div>
          <div>
            <label className={label}>Payment button label (optional)</label>
            <input
              className={input}
              placeholder="Pay Now / Book Deposit"
              value={values.payment_label}
              onChange={set("payment_label")}
            />
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
