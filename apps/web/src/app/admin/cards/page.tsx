"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";

type AdminProfile = {
  id: string;
  display_name: string;
  title: string | null;
  slug: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  company_name: string;
  tap_count: number;
  lead_count: number;
  created_at: string | null;
};

type Me = {
  role: string;
};

export default function CardsPage() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [data, me] = await Promise.all([
          apiGet<AdminProfile[]>("/api/v1/admin/profiles"),
          apiGet<Me>("/api/v1/admin/me"),
        ]);
        if (mounted) {
          setProfiles(data);
          setRole(me.role);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Could not load digital cards.");
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const profile of profiles) {
      if (profile.is_active) {
        active += 1;
      } else {
        inactive += 1;
      }
    }
    return { total: profiles.length, active, inactive };
  }, [profiles]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  const copyPublicLink = async (slug: string, id: string) => {
    const url = `${window.location.origin}/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1500);
  };

  const isSuperAdmin = role === "super_admin";

  const toggleActive = async (profile: AdminProfile) => {
    setUpdatingId(profile.id);
    setError(null);
    try {
      const updated = await apiPatch<AdminProfile>(`/api/v1/profiles/${profile.slug}`, {
        is_active: !profile.is_active,
      });
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, is_active: updated.is_active } : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update card status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteCard = async (profile: AdminProfile) => {
    if (!confirm(`Delete card "${profile.display_name}"? This cannot be undone.`)) return;
    setDeletingId(profile.id);
    setError(null);
    try {
      await apiDelete(`/api/v1/profiles/${profile.slug}`);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete card.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Digital Cards</h1>
        <Link
          href="/admin/cards/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          + New Card
        </Link>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Cards", value: String(metrics.total) },
          { label: "Active", value: String(metrics.active) },
          { label: "Inactive", value: String(metrics.inactive) },
        ].map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl shadow p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-slate-800">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">Card URL</th>
              <th className="text-left px-4 py-3">Taps</th>
              <th className="text-left px-4 py-3">Leads</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No digital cards found.
                </td>
              </tr>
            ) : (
              profiles.map((profile) => (
                <tr key={profile.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800 font-medium">{profile.display_name}</td>
                  <td className="px-4 py-3 text-slate-600">{profile.company_name}</td>
                  <td className="px-4 py-3 text-slate-600">/{profile.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{profile.tap_count}</td>
                  <td className="px-4 py-3 text-slate-600">{profile.lead_count}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {profile.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(profile.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/cards/${profile.slug}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => copyPublicLink(profile.slug, profile.id)}
                        className="text-xs text-slate-600 hover:text-slate-800"
                      >
                        {copiedId === profile.id ? "Copied" : "Copy Link"}
                      </button>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => toggleActive(profile)}
                          disabled={updatingId === profile.id || deletingId === profile.id}
                          className="text-xs text-amber-700 hover:text-amber-900 disabled:opacity-50"
                          title={profile.is_active ? "Deactivate card" : "Activate card"}
                        >
                          {updatingId === profile.id
                            ? "Updating…"
                            : profile.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => deleteCard(profile)}
                          disabled={deletingId === profile.id || updatingId === profile.id}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingId === profile.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
