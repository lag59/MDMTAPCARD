"use client";

import { useEffect, useState } from "react";
import {
  listSocialMedia,
  updateSocialMedia,
  bulkSocialMedia,
  aiSuggestMedia,
  applyMediaSuggestions,
  uploadManualSocialMedia,
  type SocialMediaItem,
} from "@/lib/api";

type Filter = "all" | "pending" | "approved" | "hidden" | "instagram" | "facebook" | "tiktok" | "manual" | "featured";

const FILTERS: Filter[] = ["all", "pending", "approved", "hidden", "instagram", "facebook", "tiktok", "manual", "featured"];

function filterParams(filter: Filter): Record<string, string> {
  if (filter === "all") return {};
  if (filter === "featured") return { featured: "true" };
  if (["pending", "approved", "hidden"].includes(filter)) return { approval_status: filter };
  return { platform: filter };
}

export default function AutoGalleryPage() {
  const [items, setItems] = useState<SocialMediaItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [isSuperAdmin] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("user_role") === "super_admin");

  const load = async (f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listSocialMedia(filterParams(f)));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load media.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(filter); }, 0);
    return () => window.clearTimeout(timer);
  }, [filter]);

  const patchItem = async (id: string, updates: Partial<SocialMediaItem>) => {
    try {
      const updated = await updateSocialMedia(id, updates);
      setItems((all) => all.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update item.");
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = async (action: "approve" | "hide" | "reject") => {
    if (selected.size === 0) return;
    try {
      await bulkSocialMedia([...selected], action);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk action failed.");
    }
  };

  const aiSuggest = async (id: string) => {
    try {
      const updated = await aiSuggestMedia(id);
      setItems((all) => all.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI suggestion failed.");
    }
  };

  const applySuggestions = async (id: string) => {
    try {
      const updated = await applyMediaSuggestions(id);
      setItems((all) => all.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply suggestions.");
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadManualSocialMedia(file);
      }
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload media.");
    } finally {
      setUploading(false);
    }
  };

  const statusBadge = (s: SocialMediaItem["approval_status"]) => {
    const map: Record<string, string> = {
      approved: "bg-emerald-100 text-emerald-700",
      pending: "bg-amber-100 text-amber-700",
      hidden: "bg-slate-100 text-slate-600",
      rejected: "bg-red-100 text-red-700",
    };
    return map[s] ?? "bg-slate-100 text-slate-600";
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">AutoGallery</h1>
      <p className="text-sm text-slate-500">
        Imported social media. New posts start as <strong>pending</strong> and must be approved before they appear on the public website.
      </p>

      {isSuperAdmin ? <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm font-semibold text-indigo-950">Upload website photos</p>
        <p className="mt-1 text-xs text-indigo-800">Super admins can add photos directly for the selected client business. Uploads remain pending until approved.</p>
        <label className="mt-3 inline-flex cursor-pointer rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
          {uploading ? "Uploading…" : "Choose photos"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = ""; }} className="hidden" />
        </label>
      </div> : null}

      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === f ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">{selected.size} selected</span>
          <button onClick={() => runBulk("approve")} className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700">Approve selected</button>
          <button onClick={() => runBulk("hide")} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Hide selected</button>
          <button onClick={() => runBulk("reject")} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Reject selected</button>
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">Loading media…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No media yet. Connect a social account and run a sync to import posts.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-square bg-slate-100">
                {item.thumbnail_url || item.media_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail_url ?? item.media_url ?? ""} alt={item.alt_text ?? ""} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">No preview</div>
                )}
                <label className="absolute left-2 top-2 rounded bg-white/80 p-1">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                </label>
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] capitalize text-white">{item.platform}</span>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusBadge(item.approval_status)}`}>{item.approval_status}</span>
                  <span className="text-[10px] text-slate-400">{item.published_at ? new Date(item.published_at).toLocaleDateString() : ""}</span>
                </div>
                <p className="line-clamp-2 text-xs text-slate-600">{item.caption || <em className="text-slate-400">No caption</em>}</p>

                <div className="flex flex-wrap gap-1">
                  <button onClick={() => patchItem(item.id, { approval_status: "approved" })} className="rounded border border-emerald-300 px-2 py-0.5 text-[10px] text-emerald-700">Approve</button>
                  <button onClick={() => patchItem(item.id, { approval_status: "hidden" })} className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-700">Hide</button>
                  <button onClick={() => patchItem(item.id, { approval_status: "rejected" })} className="rounded border border-red-300 px-2 py-0.5 text-[10px] text-red-600">Reject</button>
                  <button onClick={() => patchItem(item.id, { featured: !item.featured })} className={`rounded border px-2 py-0.5 text-[10px] ${item.featured ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-700"}`}>
                    {item.featured ? "★ Featured" : "Feature"}
                  </button>
                </div>

                <details className="text-[11px] text-slate-500">
                  <summary className="cursor-pointer">Edit details</summary>
                  <div className="mt-2 space-y-2">
                    <input defaultValue={item.caption ?? ""} onBlur={(e) => e.target.value !== (item.caption ?? "") && patchItem(item.id, { caption: e.target.value })} placeholder="Caption" className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                    <input defaultValue={item.alt_text ?? ""} onBlur={(e) => e.target.value !== (item.alt_text ?? "") && patchItem(item.id, { alt_text: e.target.value })} placeholder="Alt text" className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                    <input defaultValue={item.category ?? ""} onBlur={(e) => e.target.value !== (item.category ?? "") && patchItem(item.id, { category: e.target.value })} placeholder="Category" className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                    <div className="flex flex-wrap gap-1 pt-1">
                      <button onClick={() => aiSuggest(item.id)} className="rounded border border-violet-300 px-2 py-0.5 text-[10px] text-violet-700">AI suggest</button>
                      {item.ai_status === "suggested" ? (
                        <button onClick={() => applySuggestions(item.id)} className="rounded border border-emerald-300 px-2 py-0.5 text-[10px] text-emerald-700">Apply suggestions</button>
                      ) : null}
                    </div>
                    {item.ai_status === "suggested" ? (
                      <div className="rounded bg-violet-50 p-2 text-[10px] text-violet-900">
                        <p><strong>Title:</strong> {item.ai_suggested_title || "—"}</p>
                        <p><strong>Category:</strong> {item.ai_suggested_category || "—"}</p>
                        <p><strong>Alt:</strong> {item.ai_suggested_alt_text || "—"}</p>
                        <p><strong>Caption:</strong> {item.ai_suggested_caption || "—"}</p>
                        <p className="mt-1 text-violet-500">Review, then Apply to publish these.</p>
                      </div>
                    ) : null}
                    {item.ai_status === "applied" ? <p className="text-[10px] text-emerald-600">AI suggestions applied.</p> : null}
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
