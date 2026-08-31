"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { useRouter } from "next/navigation";
import TemplatePreview from "@/components/TemplatePreview";
import { TEMPLATES, PALETTES, isValidCustomTheme, type CardTemplate } from "@/lib/templates";
import {
  apiGet,
  listTemplateBackgrounds,
  updateTemplateBackgroundSettings,
  uploadTemplateBackgroundImage,
  deleteTemplateBackgroundImage,
  importTemplateZip,
  type TemplateBackgroundInfo,
} from "@/lib/api";

const CATEGORIES = ["Classic", "Minimal", "Corporate", "Spotlight"] as const;

const POSITION_OPTIONS = [
  "center center",
  "top center",
  "bottom center",
  "left center",
  "right center",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
] as const;

const SAMPLE_CUSTOM = {
  name: "My Brand Card",
  layout: "spotlight",
  palette: {
    bg: "bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-700",
    text: "text-white",
    sub: "text-cyan-50",
    glass: "bg-white/15 border border-white/25",
    save: "bg-white text-indigo-900 hover:bg-indigo-50",
    inquiry: "border border-white/40 text-white hover:bg-white/15",
    accent: "bg-indigo-700",
  },
};

export default function TemplatesGalleryPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const zipFileRef = useRef<HTMLInputElement>(null);
  const individualFilesRef = useRef<HTMLInputElement>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [backgrounds, setBackgrounds] = useState<Record<string, TemplateBackgroundInfo>>({});
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipPreview, setZipPreview] = useState<Partial<import("@/lib/types").Profile> | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [importingZip, setImportingZip] = useState(false);
  const [savedTemplateName, setSavedTemplateName] = useState<string | null>(null);
  const [individual, setIndividual] = useState({ id: "", name: "", layout: "spotlight" as "classic" | "minimal" | "corporate" | "spotlight" });
  const [individualAssets, setIndividualAssets] = useState<{ background?: File; logo?: File; tapcardLogo?: File; preview?: File }>({});

  const loadBackgrounds = async () => {
    try {
      const rows = await listTemplateBackgrounds();
      setBackgrounds(Object.fromEntries(rows.map((row) => [row.theme_id, row])));
    } catch {
      // Non-blocking: gallery still works without background management data.
    }
  };

  useEffect(() => {
    apiGet<{ role: string }>("/api/v1/admin/me")
      .then((me) => setIsSuperAdmin(me.role === "super_admin"))
      .catch(() => setIsSuperAdmin(false));
    loadBackgrounds();
  }, []);

  const selectTemplate = (id: string) => {
    router.push(`/admin/cards/new?template=${encodeURIComponent(id)}`);
  };

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_CUSTOM, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom-template.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomError(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidCustomTheme(parsed)) {
        throw new Error("File is not a valid template (needs a layout and a full palette).");
      }
      window.sessionStorage.setItem("pending_custom_theme", JSON.stringify(parsed));
      router.push("/admin/cards/new?template=custom");
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Invalid template file.");
    } finally {
      e.currentTarget.value = "";
    }
  };

  const handleZipPreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setZipError(null);
    setZipPreview(null);
    try {
      if (!selected.name.toLowerCase().endsWith(".zip") || selected.size > 25 * 1024 * 1024) {
        throw new Error("Choose a ZIP template no larger than 25 MB.");
      }
      const zip = await JSZip.loadAsync(selected);
      const templateFiles = zip.file(/(^|\/)template\.json$/);
      if (templateFiles.length !== 1) throw new Error("The ZIP must contain exactly one template.json file.");
      const json = templateFiles[0];
      const definition: unknown = JSON.parse(await json.async("string"));
      const raw = definition as { id?: unknown; slug?: unknown; name?: unknown; assets?: unknown };
      if (!isValidCustomTheme(definition) || typeof (raw.id ?? raw.slug) !== "string" || typeof raw.name !== "string") {
        throw new Error("template.json needs id or slug, name, a supported layout, and a full palette.");
      }
      const imported = definition as typeof definition & {
        id: string;
        slug?: string;
        name: string;
        background?: { image?: string; position?: string; size_mode?: "cover" | "contain"; opacity?: number; overlay_color?: string | null; overlay_opacity?: number; text_color?: string | null };
        branding?: Record<string, string>;
        assets?: { background?: string; logo?: string; tapcardLogo?: string; preview?: string };
        features?: Record<string, boolean>;
        locked?: boolean;
      };
      const templateId = imported.id ?? imported.slug!;
      const backgroundName = imported.background?.image ?? imported.assets?.background;
      const templateDirectory = json.name.includes("/") ? json.name.slice(0, json.name.lastIndexOf("/") + 1) : "";
      const backgroundPath = typeof backgroundName === "string" ? `${templateDirectory}${backgroundName.split("/").pop()}` : "";
      const backgroundFile = backgroundPath ? zip.file(backgroundPath) : null;
      const backgroundImage = backgroundFile ? `data:image/webp;base64,${await backgroundFile.async("base64")}` : undefined;
      setZipFile(selected);
      setZipPreview({
        theme_id: templateId,
        template_definition: { id: templateId, name: imported.name, layout: imported.layout, palette: imported.palette, branding: { ...(imported.branding ?? {}), features: JSON.stringify(imported.features ?? {}) }, locked: imported.locked ?? true },
        template_background: backgroundImage ? { image_url: backgroundImage, position: imported.background?.position ?? "center center", size_mode: imported.background?.size_mode ?? "cover", opacity: imported.background?.opacity ?? 1, overlay_color: imported.background?.overlay_color ?? null, overlay_opacity: imported.background?.overlay_opacity ?? 0, text_color: imported.background?.text_color ?? null, lock_background: imported.locked ?? true } : null,
      });
    } catch (err) {
      setZipFile(null);
      setZipError(err instanceof Error ? err.message : "Could not preview this ZIP template.");
    } finally {
      e.currentTarget.value = "";
    }
  };

  const saveZipTemplate = async () => {
    if (!zipFile) return;
    setImportingZip(true);
    setZipError(null);
    try {
      const saved = await importTemplateZip(zipFile);
      setSavedTemplateName(saved.name);
      setZipFile(null);
      setZipPreview(null);
      await loadBackgrounds();
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Could not import template ZIP.");
    } finally {
      setImportingZip(false);
    }
  };

  const previewIndividualTemplate = async () => {
    setZipError(null);
    const name = individual.name.trim() || "Untitled Template";
    const generatedId = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const cleanedCustomId = individual.id.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const id = (cleanedCustomId || generatedId || `template-${Date.now()}`).slice(0, 80);
    const assets = Object.fromEntries(
      Object.entries(individualAssets)
        .filter(([, file]) => Boolean(file))
        .map(([kind, file]) => [kind, file!.name])
    );
    const definition = {
      id,
      name,
      layout: individual.layout,
      palette: SAMPLE_CUSTOM.palette,
      assets,
      locked: true,
    };
    const archive = new JSZip();
    archive.file("template.json", JSON.stringify(definition, null, 2));
    for (const file of Object.values(individualAssets)) if (file) archive.file(file.name, file);
    const packageFile = new File([await archive.generateAsync({ type: "blob" })], `${id}.zip`, { type: "application/zip" });
    setZipFile(packageFile);
    setZipPreview({
      theme_id: id,
      template_definition: { id, name, layout: individual.layout, palette: SAMPLE_CUSTOM.palette, branding: {}, locked: true },
      template_background: individualAssets.background ? { image_url: URL.createObjectURL(individualAssets.background), position: "center center", size_mode: "cover", opacity: 1, overlay_color: null, overlay_opacity: 0, text_color: null, lock_background: true } : null,
    });
  };

  const handleIndividualFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const matched: typeof individualAssets = {};
    const unmatched: File[] = [];
    for (const file of selected) {
      const name = file.name.toLowerCase();
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) continue;
      if (name.startsWith("background.")) matched.background = file;
      else if (name.startsWith("tapcard-logo.") || name.startsWith("tapcardlogo.")) matched.tapcardLogo = file;
      else if (name.startsWith("preview.")) matched.preview = file;
      else if (name.startsWith("logo.")) matched.logo = file;
      else unmatched.push(file);
    }
    setIndividualAssets((assets) => {
      const next = { ...assets, ...matched };
      for (const file of unmatched) {
        const slot = (["background", "logo", "tapcardLogo", "preview"] as const).find((key) => !next[key]);
        if (!slot) break;
        next[slot] = file;
      }
      return next;
    });
    setZipError(selected.length ? null : "Choose one or more JPG, PNG, or WebP files.");
    e.target.value = "";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Card Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse {TEMPLATES.length} ready-made designs{isSuperAdmin ? ", or upload a custom template." : "."}
          </p>
        </div>
        <Link
          href="/admin/cards/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          + New Card
        </Link>
      </div>

      {/* Custom template code is intentionally restricted to super admins. */}
      {isSuperAdmin ? <div className="mb-8 rounded-xl border border-dashed border-slate-300 bg-white p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Upload a custom template</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Design your own look with a JSON file (layout + Tailwind color palette, optional background image).
              Download the sample to see the exact format.
            </p>
            {customError ? <p className="text-xs text-red-600 mt-2">{customError}</p> : null}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={downloadSample}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Download sample
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Upload JSON
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleUpload} className="hidden" />
          </div>
        </div>
      </div> : null}

      {isSuperAdmin ? <div className="mb-8 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-5">
        <h2 className="text-sm font-semibold text-slate-800">Import reusable ZIP template</h2>
        <p className="mt-1 text-xs text-slate-500">Include one <code>template.json</code> and optional JPG, PNG, or WebP background, logo, icon, and preview assets. Files may be in one template folder; assets are optimized and stored once for every assigned profile.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => zipFileRef.current?.click()} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800">Choose ZIP to preview</button>
          <input ref={zipFileRef} type="file" accept=".zip,application/zip" onChange={handleZipPreview} className="hidden" />
          {zipPreview && zipFile ? <button type="button" disabled={importingZip} onClick={saveZipTemplate} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{importingZip ? "Saving…" : "Save template"}</button> : null}
        </div>
        {zipError ? <p className="mt-2 text-xs text-red-600">{zipError}</p> : null}
        {zipPreview ? <div className="mt-4 flex flex-wrap items-start gap-4"><TemplatePreview overrides={zipPreview} width={220} height={360} /><div className="max-w-sm text-xs text-slate-600"><p className="font-semibold text-slate-800">Live preview: {zipPreview.template_definition?.name}</p><p className="mt-1">Review the layout, palette, background, overlay, and text color above. Saving uploads optimized shared assets and assigns profiles by template ID—no per-customer background copies.</p></div></div> : null}
      </div> : null}

      {isSuperAdmin ? <div className="mb-8 rounded-xl border border-dashed border-cyan-300 bg-cyan-50/40 p-5">
        <h2 className="text-sm font-semibold text-slate-800">Create template from individual files</h2>
        <p className="mt-1 text-xs text-slate-500">No ZIP required. Choose JPG, PNG, or WebP assets, review the live preview, then save the reusable template.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input value={individual.id} onChange={(e) => setIndividual((value) => ({ ...value, id: e.target.value }))} placeholder="Template ID (optional; generated from name)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={individual.name} onChange={(e) => setIndividual((value) => ({ ...value, name: e.target.value }))} placeholder="Template name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={individual.layout} onChange={(e) => setIndividual((value) => ({ ...value, layout: e.target.value as typeof value.layout }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="spotlight">Spotlight</option><option value="classic">Classic</option><option value="minimal">Minimal</option><option value="corporate">Corporate</option></select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["background", "logo", "tapcardLogo", "preview"] as const).map((kind) => <label key={kind} className="text-xs font-medium capitalize text-slate-600">{kind.replace("Logo", " logo")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setIndividualAssets((assets) => ({ ...assets, [kind]: e.target.files?.[0] }))} className="mt-1 block w-full text-xs" /></label>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => individualFilesRef.current?.click()} className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100">Select multiple assets</button>
          <input ref={individualFilesRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleIndividualFiles} className="hidden" />
          <span className="text-xs text-slate-500">Any filenames are accepted. Recognized names map automatically; other files fill the open slots in selection order.</span>
        </div>
        <button type="button" onClick={previewIndividualTemplate} className="mt-4 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800">Preview individual files</button>
        {zipError ? <p className="mt-2 text-xs text-red-600">{zipError}</p> : null}
        {zipPreview && zipFile ? <div className="mt-4 rounded-lg border border-cyan-200 bg-white p-4"><div className="flex flex-wrap items-start gap-4"><TemplatePreview overrides={zipPreview} width={220} height={360} /><div className="max-w-sm text-xs text-slate-600"><p className="font-semibold text-slate-800">Live preview: {zipPreview.template_definition?.name}</p><p className="mt-1">This is the shared visual used by every profile assigned to this template.</p><button type="button" disabled={importingZip} onClick={saveZipTemplate} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{importingZip ? "Saving…" : "Save template"}</button></div></div></div> : null}
        {savedTemplateName ? <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">Saved “{savedTemplateName}”. It is ready to select on a customer card.</p> : null}
      </div> : null}

      {CATEGORIES.map((category) => {
        const items = TEMPLATES.filter((t) => t.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onUse={() => selectTemplate(t.id)}
                  isSuperAdmin={isSuperAdmin}
                  background={backgrounds[t.id] ?? null}
                  onBackgroundChange={loadBackgrounds}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-slate-400 mt-4">
        {Object.keys(PALETTES).length} color palettes · 4 layouts · custom upload supported.
      </p>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  isSuperAdmin,
  background,
  onBackgroundChange,
}: {
  template: CardTemplate;
  onUse: () => void;
  isSuperAdmin: boolean;
  background: TemplateBackgroundInfo | null;
  onBackgroundChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
      <TemplatePreview overrides={{ theme_id: template.id }} width={220} height={360} />
      <div className="mt-3 w-full text-center">
        <div className="flex items-center justify-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ${template.swatch}`} />
          <h3 className="text-sm font-semibold text-slate-800">{template.name}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1 min-h-[2rem]">{template.description}</p>
        <button
          onClick={onUse}
          className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition"
        >
          Use this template
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {expanded ? "Hide background settings" : background?.image_url ? "Edit background" : "Add background image"}
        </button>
      </div>
      {expanded ? (
        <TemplateBackgroundManager
          themeId={template.id}
          isSuperAdmin={isSuperAdmin}
          background={background}
          onChange={onBackgroundChange}
        />
      ) : null}
    </div>
  );
}

function TemplateBackgroundManager({
  themeId,
  isSuperAdmin,
  background,
  onChange,
}: {
  themeId: string;
  isSuperAdmin: boolean;
  background: TemplateBackgroundInfo | null;
  onChange: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = Boolean(background?.lock_background) && !isSuperAdmin;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadTemplateBackgroundImage(themeId, file);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload background image.");
    } finally {
      setBusy(false);
      e.currentTarget.value = "";
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteTemplateBackgroundImage(themeId);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove background image.");
    } finally {
      setBusy(false);
    }
  };

  const handleSetting = async (updates: Partial<TemplateBackgroundInfo>) => {
    setBusy(true);
    setError(null);
    try {
      await updateTemplateBackgroundSettings(themeId, updates);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update background settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Template background (shared by every profile using this template)</p>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {locked ? <p className="mt-2 text-xs text-amber-700">Locked by a super admin. Only a super admin can change this background.</p> : null}

      {background?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={background.image_url} alt="Template background" className="mt-2 h-24 w-full rounded-md object-cover" />
      ) : (
        <p className="mt-2 text-xs text-slate-400">No background image set.</p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy || locked}
          onClick={() => fileRef.current?.click()}
          className="flex-1 rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {background?.image_url ? "Replace" : "Upload"}
        </button>
        {background?.image_url ? (
          <button
            type="button"
            disabled={busy || locked}
            onClick={handleRemove}
            className="flex-1 rounded-lg border border-red-300 px-2 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-600">
          Position
          <select
            disabled={busy || locked}
            value={background?.position ?? "center center"}
            onChange={(e) => handleSetting({ position: e.target.value })}
            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] disabled:opacity-50"
          >
            {POSITION_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-600">
          Fit
          <select
            disabled={busy || locked}
            value={background?.size_mode ?? "cover"}
            onChange={(e) => handleSetting({ size_mode: e.target.value as "cover" | "contain" })}
            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] disabled:opacity-50"
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-600">
          Opacity ({Math.round((background?.opacity ?? 1) * 100)}%)
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            disabled={busy || locked}
            value={background?.opacity ?? 1}
            onChange={(e) => handleSetting({ opacity: Number.parseFloat(e.target.value) })}
            className="mt-1 w-full disabled:opacity-50"
          />
        </label>
        <label className="text-[11px] text-slate-600">
          Overlay opacity ({Math.round((background?.overlay_opacity ?? 0) * 100)}%)
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            disabled={busy || locked}
            value={background?.overlay_opacity ?? 0}
            onChange={(e) => handleSetting({ overlay_opacity: Number.parseFloat(e.target.value) })}
            className="mt-1 w-full disabled:opacity-50"
          />
        </label>
        <label className="col-span-2 text-[11px] text-slate-600">
          Overlay color
          <input
            type="color"
            disabled={busy || locked}
            value={background?.overlay_color ?? "#000000"}
            onChange={(e) => handleSetting({ overlay_color: e.target.value })}
            className="mt-0.5 h-7 w-full rounded border border-slate-300 disabled:opacity-50"
          />
        </label>
        <label className="col-span-2 text-[11px] text-slate-600">
          Text color (matches the entered profile text to your design)
          <div className="mt-0.5 flex items-center gap-2">
            <input
              type="color"
              disabled={busy || locked}
              value={background?.text_color ?? "#ffffff"}
              onChange={(e) => handleSetting({ text_color: e.target.value })}
              className="h-7 w-12 shrink-0 rounded border border-slate-300 disabled:opacity-50"
            />
            {background?.text_color ? (
              <button
                type="button"
                disabled={busy || locked}
                onClick={() => handleSetting({ text_color: null })}
                className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 disabled:opacity-50"
              >
                Use automatic color
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Automatic (based on background lightness)</span>
            )}
          </div>
        </label>
      </div>

      {isSuperAdmin ? (
        <label className="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(background?.lock_background)}
            disabled={busy}
            onChange={(e) => handleSetting({ lock_background: e.target.checked })}
          />
          Lock template background (business owners cannot replace or remove it)
        </label>
      ) : null}
    </div>
  );
}
