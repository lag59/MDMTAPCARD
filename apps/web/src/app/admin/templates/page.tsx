"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TemplatePreview from "@/components/TemplatePreview";
import { TEMPLATES, PALETTES, isValidCustomTheme, type CardTemplate } from "@/lib/templates";

const CATEGORIES = ["Classic", "Minimal", "Corporate", "Spotlight"] as const;

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
  const [customError, setCustomError] = useState<string | null>(null);

  const useTemplate = (id: string) => {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Card Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse {TEMPLATES.length} ready-made designs, or upload your own custom template.
          </p>
        </div>
        <Link
          href="/admin/cards/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          + New Card
        </Link>
      </div>

      {/* Custom upload */}
      <div className="mb-8 rounded-xl border border-dashed border-slate-300 bg-white p-5">
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
      </div>

      {CATEGORIES.map((category) => {
        const items = TEMPLATES.filter((t) => t.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={() => useTemplate(t.id)} />
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

function TemplateCard({ template, onUse }: { template: CardTemplate; onUse: () => void }) {
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
      </div>
    </div>
  );
}
