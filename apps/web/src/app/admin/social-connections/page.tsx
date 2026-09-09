"use client";

import { useEffect, useState } from "react";
import {
  apiGet,
  disconnectSocial,
  getAdminBusinessId,
  getSocialAuthorizeUrl,
  listSocialAccounts,
  listSocialConnections,
  setAdminBusinessId,
  syncSocialNow,
  updateSocialPreferences,
  type SocialAccountOption,
  type SocialConnectionInfo,
} from "@/lib/api";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

type Company = { id: string; name: string };
type CurrentUser = { role: string; company_id: string | null };

export default function SocialConnectionsPage() {
  const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [facebookAccounts, setFacebookAccounts] = useState<SocialAccountOption[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [importMode, setImportMode] = useState("recent");
  const [requireApproval, setRequireApproval] = useState(true);
  const [autoPublish, setAutoPublish] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setConnections(await listSocialConnections());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load connections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const me = await apiGet<CurrentUser>("/api/v1/admin/me");
        const superAdmin = me.role === "super_admin";
        setIsSuperAdmin(superAdmin);

        if (superAdmin) {
          const available = await apiGet<Company[]>("/api/v1/admin/companies");
          const saved = getAdminBusinessId();
          const selected = available.some((company) => company.id === saved) ? saved : available[0]?.id ?? null;
          setCompanies(available);
          setSelectedBusinessId(selected);
          if (selected) setAdminBusinessId(selected);
        } else {
          setSelectedBusinessId(me.company_id);
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load social connections.");
        setLoading(false);
      }
    };
    initialize();
  }, []);

  const selectBusiness = (businessId: string) => {
    setAdminBusinessId(businessId);
    setSelectedBusinessId(businessId);
    void load();
  };

  const disconnect = async (platform: string) => {
    try {
      await disconnectSocial(platform);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect.");
    }
  };

  const connect = async (platform: string) => {
    setError(null);
    try {
      const { authorize_url } = await getSocialAuthorizeUrl(platform);
      window.open(authorize_url, "_self");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start connection.");
    }
  };

  const syncNow = async () => {
    setError(null);
    setInfo(null);
    try {
      const res = await syncSocialNow();
      setInfo(`Sync complete — ${res.imported} imported, ${res.skipped} already present.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    }
  };

  const loadFacebookPages = async () => {
    try {
      const pages = await listSocialAccounts("facebook");
      setFacebookAccounts(pages);
      setSelectedPageId(pages.find((page) => page.selected)?.id ?? pages[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Facebook Pages.");
    }
  };

  const saveFacebookSettings = async () => {
    try {
      await updateSocialPreferences("facebook", {
        selected_account_id: selectedPageId || null,
        import_mode: importMode,
        require_approval: requireApproval,
        auto_publish: autoPublish,
      });
      setInfo("Facebook import settings saved. Manual approval remains enabled by default.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save Facebook settings.");
    }
  };

  const isConnected = (c: SocialConnectionInfo) => c.status === "connected";

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">Social Connections</h1>
      <p className="text-sm text-slate-500">
        Connect your accounts so MDM TapCard can import your recent posts. We use each platform&apos;s official
        login — you never enter your social password here.
      </p>

      {isSuperAdmin ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <label htmlFor="social-business" className="block text-sm font-semibold text-indigo-950">
            Client business
          </label>
          <p className="mt-1 text-xs text-indigo-800">
            Select a client to review their connection status. The client&apos;s Business Owner signs into MDM TapCard
            and connects Facebook, Instagram, or TikTok from their own dashboard, approving access directly with the provider.
          </p>
          <select
            id="social-business"
            value={selectedBusinessId ?? ""}
            onChange={(event) => selectBusiness(event.target.value)}
            className="mt-3 w-full rounded-md border border-indigo-300 bg-white px-3 py-2 text-sm text-slate-800 sm:max-w-md"
          >
            <option value="" disabled>Select a client business</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Connect your own social account below. Click Connect, sign in directly with the social platform, and approve
          access there—never send your password to MDM TapCard or your administrator.
        </div>
      )}

      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {info ? <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{info}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Loading connections…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {connections.map((c) => (
            <div key={c.platform} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">{PLATFORM_LABELS[c.platform] ?? c.platform}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isConnected(c) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {isConnected(c) ? "Connected" : "Not Connected"}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p>Account: {c.username ?? "—"}</p>
                <p>Last sync: {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "never"}</p>
                {c.last_error ? <p className="text-red-500">Error: {c.last_error}</p> : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {isSuperAdmin ? (
                  <span className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800">
                    Client connects from their dashboard
                  </span>
                ) : (
                  <button
                    onClick={() => connect(c.platform)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {isConnected(c) ? "Reconnect" : "Connect"}
                  </button>
                )}
                {isConnected(c) ? (
                  <button onClick={() => disconnect(c.platform)} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    Disconnect
                  </button>
                ) : null}
                {connections.some((connection) => connection.platform === "facebook" && connection.status === "connected") ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800">Facebook Page Import</h2>
                    <p className="mt-1 text-sm text-slate-500">Choose the Page to import. New photos remain pending until approved.</p>
                    <button type="button" onClick={() => void loadFacebookPages()} className="mt-3 rounded border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700">Load available Pages</button>
                    {facebookAccounts.length > 0 ? <div className="mt-3 space-y-3">
                      <label className="block text-sm text-slate-700">Page<select value={selectedPageId} onChange={(e) => setSelectedPageId(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">{facebookAccounts.map((page) => <option key={page.id} value={page.id}>{page.name || page.id}</option>)}</select></label>
                      <label className="block text-sm text-slate-700">Import<select value={importMode} onChange={(e) => setImportMode(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"><option value="recent">Recent photos</option><option value="last_10">Last 10</option><option value="last_25">Last 25</option><option value="last_50">Last 50</option><option value="selected_album">Selected album (coming next)</option></select></label>
                      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={requireApproval} onChange={(e) => { setRequireApproval(e.target.checked); if (e.target.checked) setAutoPublish(false); }} /> Require manual approval</label>
                      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={autoPublish} onChange={(e) => { setAutoPublish(e.target.checked); if (e.target.checked) setRequireApproval(false); }} /> Auto-publish new photos</label>
                      <button type="button" onClick={() => void saveFacebookSettings()} className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Save Facebook import settings</button>
                    </div> : null}
                  </section>
                ) : null}
                <button
                  onClick={syncNow}
                  disabled={!isConnected(c)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Sync Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
