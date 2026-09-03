"use client";

import { useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";

type AdminLead = {
  id: string;
  created_at: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  tag_token: string | null;
  card_number: string | null;
  profile_name: string | null;
  profile_slug: string | null;
  company_name: string | null;
  consent_to_contact: boolean;
  consent_text: string | null;
  consent_captured_at: string | null;
};

export default function LeadsPage() {
  const [rows, setRows] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await apiGet<AdminLead[]>("/api/v1/admin/leads");
        if (mounted) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          if (e instanceof ApiError && e.status === 402) {
            setLocked(true);
          } else {
            setError(e instanceof Error ? e.message : "Could not load leads.");
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
      </div>

      {locked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-900">Lead capture is a paid add-on</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-800">
            When someone taps your card, we can capture their name, phone, and email so you can follow up.
            This is a paid analytics feature. Contact MDM TapCard to enable it for your account.
          </p>
        </div>
      ) : (
      <>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      ) : null}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Lead</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Card</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Consent</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leads yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{fmt(row.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-slate-500">{row.profile_name ?? row.profile_slug ?? "—"}</div>
                    <div className="text-xs text-slate-400">{row.company_name ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{row.card_number ?? "—"}</div>
                    <div className="text-xs text-slate-400">{row.tag_token ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.source ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.consent_to_contact ? "Yes" : "No"}
                    <div className="text-xs text-slate-400">{fmt(row.consent_captured_at)}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
