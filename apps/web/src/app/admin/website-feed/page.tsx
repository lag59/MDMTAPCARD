"use client";

import { useEffect, useMemo, useState } from "react";
import {
  apiBaseUrl,
  getWebsiteFeed,
  updateWebsiteFeed,
  listWebsiteApiKeys,
  createWebsiteApiKey,
  revokeWebsiteApiKey,
  regenerateWebsiteApiKey,
  type WebsiteFeedSettings,
  type WebsiteApiKeyInfo,
} from "@/lib/api";

const PLATFORMS = ["instagram", "facebook", "tiktok"] as const;
const LAYOUTS = ["grid", "masonry", "carousel", "featured-first"] as const;

export default function WebsiteFeedPage() {
  const [feed, setFeed] = useState<WebsiteFeedSettings | null>(null);
  const [keys, setKeys] = useState<WebsiteApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Website key");

  useEffect(() => {
    (async () => {
      try {
        const [f, k] = await Promise.all([getWebsiteFeed(), listWebsiteApiKeys()]);
        setFeed(f);
        setKeys(k);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load website feed.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const endpoint = useMemo(
    () => (feed ? `${apiBaseUrl}/api/v1/businesses/${feed.slug}/gallery` : ""),
    [feed]
  );

  const patch = (updates: Partial<WebsiteFeedSettings>) =>
    setFeed((f) => (f ? { ...f, ...updates } : f));

  const save = async () => {
    if (!feed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateWebsiteFeed({
        name: feed.name,
        slug: feed.slug,
        status: feed.status,
        require_approval: feed.require_approval,
        auto_publish: feed.auto_publish,
        auto_sync: feed.auto_sync,
        max_items: feed.max_items,
        platforms: feed.platforms,
        layout: feed.layout,
        trigger_build_on_approval: feed.trigger_build_on_approval,
      });
      setFeed(updated);
      setSuccess("Website feed saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save feed.");
    } finally {
      setSaving(false);
    }
  };

  const generateKey = async () => {
    setError(null);
    setNewRawKey(null);
    try {
      const created = await createWebsiteApiKey(keyName.trim() || "Website key");
      setNewRawKey(created.raw_key ?? null);
      setKeys((all) => [created, ...all]);
      setSuccess("API key generated — copy it now, it won't be shown again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate key.");
    }
  };

  const revoke = async (id: string) => {
    try {
      const updated = await revokeWebsiteApiKey(id);
      setKeys((all) => all.map((k) => (k.id === id ? updated : k)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke key.");
    }
  };

  const regenerate = async (id: string) => {
    try {
      const created = await regenerateWebsiteApiKey(id);
      setNewRawKey(created.raw_key ?? null);
      const refreshed = await listWebsiteApiKeys();
      setKeys(refreshed);
      setSuccess("API key regenerated — copy the new key now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not regenerate key.");
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  if (loading) return <div className="text-sm text-slate-500">Loading website feed…</div>;
  if (!feed) return <div className="text-sm text-red-600">{error ?? "No feed available."}</div>;

  const label = "text-sm font-medium text-slate-700";
  const box = "rounded-xl bg-white p-6 shadow";

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Website Feed</h1>

      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className={box}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={label}>Status</span>
            <select value={feed.status} onChange={(e) => patch({ status: e.target.value as WebsiteFeedSettings["status"] })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Business Slug</span>
            <input value={feed.slug} onChange={(e) => patch({ slug: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 font-mono text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Max Website Items</span>
            <input type="number" min={1} max={60} value={feed.max_items} onChange={(e) => patch({ max_items: Number(e.target.value) })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Layout</span>
            <select value={feed.layout} onChange={(e) => patch({ layout: e.target.value as WebsiteFeedSettings["layout"] })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              {LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <span className={label}>Platforms</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm capitalize text-slate-700">
                <input
                  type="checkbox"
                  checked={feed.platforms.includes(p)}
                  onChange={(e) =>
                    patch({ platforms: e.target.checked ? [...feed.platforms, p] : feed.platforms.filter((x) => x !== p) })
                  }
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={feed.require_approval} onChange={(e) => patch({ require_approval: e.target.checked })} />
            Require approval before media appears on the website
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={feed.auto_publish} onChange={(e) => patch({ auto_publish: e.target.checked })} />
            Auto Publish new imported posts (off by default)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={feed.auto_sync} onChange={(e) => patch({ auto_sync: e.target.checked })} />
            Auto Sync every 6 hours
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={feed.trigger_build_on_approval} onChange={(e) => patch({ trigger_build_on_approval: e.target.checked })} />
            Trigger a Netlify rebuild on approval (Phase 3)
          </label>
        </div>

        <button onClick={save} disabled={saving} className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save feed settings"}
        </button>
      </section>

      <section className={box}>
        <h2 className="text-lg font-semibold text-slate-800">Public API Endpoint</h2>
        <p className="mt-1 text-xs text-slate-500">Your Netlify Function calls this server-side with a Bearer API key. Never put the key in browser code.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-800">{endpoint}</code>
          <button onClick={() => copy(endpoint)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Copy</button>
        </div>
      </section>

      <section className={box}>
        <h2 className="text-lg font-semibold text-slate-800">API Keys</h2>
        {newRawKey ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">Copy this key now — it will not be shown again:</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs text-slate-900">{newRawKey}</code>
              <button onClick={() => copy(newRawKey)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Copy</button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={generateKey} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Generate API key</button>
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {keys.length === 0 ? <p className="py-3 text-sm text-slate-400">No API keys yet.</p> : null}
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{k.name} <span className="font-mono text-xs text-slate-400">{k.key_prefix}…</span></p>
                <p className="text-xs text-slate-500">
                  {k.status} · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                </p>
              </div>
              {k.status === "active" ? (
                <>
                  <button onClick={() => regenerate(k.id)} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700">Regenerate</button>
                  <button onClick={() => revoke(k.id)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Revoke</button>
                </>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">revoked</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
