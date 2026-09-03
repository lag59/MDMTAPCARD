"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, deleteCompany, grantComplimentaryNfc, listAdminCompanies, listReusableTemplates, type ImportedTemplate } from "@/lib/api";

type Company = {
  id: string;
  name: string;
  subscription_plan: string;
  status: string;
  renewal_date: string | null;
  default_template_id?: string | null;
  complimentary_nfc_cards?: number;
  complimentary_nfc_expires_at?: string | null;
  analytics_enabled?: boolean;
};

const PLAN_LABELS: Record<string, string> = {
  basic_monthly: "Basic ($3.99/month)",
  basic_yearly: "Basic ($39/year)",
  pro_monthly: "Pro ($6.99/month)",
  pro_yearly: "Pro ($69/year)",
  tap_starter: "Legacy Starter",
  tap_business: "Legacy Business",
  tap_team: "Legacy Team",
  tap_pro: "Legacy Pro",
};

export default function ClientsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [grantingCompanyId, setGrantingCompanyId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ImportedTemplate[]>([]);
  const [editing, setEditing] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    apiGet<{ role: string }>("/api/v1/admin/me")
      .then((user) => { if (mounted) setIsSuperAdmin(user.role === "super_admin"); })
      .catch(() => {});

    const load = async () => {
      try {
        const data = await listAdminCompanies<Company[]>();
        if (mounted) {
          setCompanies(data);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Could not load clients.");
        }
      }
    };

    load();
    listReusableTemplates().then(setTemplates).catch(() => setTemplates([]));
    return () => {
      mounted = false;
    };
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  const saveCompany = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/admin/companies/${editing.id}`, {
        name: editing.name, subscription_plan: editing.subscription_plan, status: editing.status,
        renewal_date: editing.renewal_date || null, default_template_id: editing.default_template_id || null,
        analytics_enabled: editing.analytics_enabled ?? false,
      });
      setCompanies((all) => all.map((company) => company.id === editing.id ? editing : company));
      setEditing(null);
      setSuccess(`Updated ${editing.name}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update client."); }
    finally { setSaving(false); }
  };

  const isBundlePlan = (plan: string) => {
    return ["basic_monthly", "basic_yearly", "pro_monthly", "pro_yearly", "tap_business", "tap_team", "tap_pro"].includes(plan);
  };

  const addComplimentaryCard = async (company: Company) => {
    setGrantingCompanyId(company.id);
    setError(null);
    setSuccess(null);

    try {
      await grantComplimentaryNfc(company.id, 1);
      const data = await listAdminCompanies<Company[]>();
      setCompanies(data);
      setSuccess(`Added a complimentary NFC card for ${company.name} (valid for 1 year).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add complimentary NFC card.");
    } finally {
      setGrantingCompanyId(null);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`Are you sure you want to delete ${company.name}? This will remove the client, soft-delete all their cards, and deactivate associated users.`)) {
      return;
    }
    setDeletingId(company.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteCompany(company.id);
      setCompanies((all) => all.filter((c) => c.id !== company.id));
      if (editing?.id === company.id) setEditing(null);
      setSuccess(`Deleted ${company.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete client.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
        <Link
          href="/admin/clients/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
        >
          + New Client
        </Link>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg bg-green-50 text-green-700 text-sm px-4 py-3">
          {success}
        </div>
      ) : null}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              {["Company", "Plan", "Cards", "Status", "Renewal", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No clients yet. Create your first client to get started.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800 font-medium">{company.name}</td>
                  <td className="px-4 py-3 text-slate-600">{PLAN_LABELS[company.subscription_plan] ?? company.subscription_plan}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{company.complimentary_nfc_cards ?? 0} complimentary</div>
                    <div className="text-xs text-slate-400">exp: {formatDate(company.complimentary_nfc_expires_at ?? null)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {company.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(company.renewal_date)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...company })}
                      className="mr-2 rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={!isBundlePlan(company.subscription_plan) || grantingCompanyId === company.id}
                      onClick={() => addComplimentaryCard(company)}
                      className="mr-2 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      title={isBundlePlan(company.subscription_plan) ? "Add 1 complimentary NFC card valid for 1 year" : "Available for bundle plans only"}
                    >
                      {grantingCompanyId === company.id ? "Adding..." : "+ 1 complimentary NFC"}
                    </button>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        disabled={deletingId === company.id}
                        onClick={() => handleDeleteCompany(company)}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === company.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing ? (
        <div className="mt-6 max-w-2xl rounded-xl bg-white p-5 shadow">
          <h2 className="text-lg font-semibold text-slate-800">Edit Client</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Client name" />
            <select value={editing.subscription_plan} onChange={(e) => setEditing({ ...editing, subscription_plan: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm">{Object.entries(PLAN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm"><option value="active">Active</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select>
            <input type="date" value={editing.renewal_date?.slice(0, 10) ?? ""} onChange={(e) => setEditing({ ...editing, renewal_date: e.target.value ? new Date(`${e.target.value}T00:00:00Z`).toISOString() : null })} className="rounded border border-slate-300 px-3 py-2 text-sm" />
            <select value={editing.default_template_id ?? ""} onChange={(e) => setEditing({ ...editing, default_template_id: e.target.value || null })} className="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"><option value="">No default template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
            <label className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={editing.analytics_enabled ?? false} onChange={(e) => setEditing({ ...editing, analytics_enabled: e.target.checked })} className="h-4 w-4" />
              <span>Paid analytics add-on <span className="text-slate-400">(lets this client view captured leads &amp; analytics)</span></span>
            </label>
          </div>
          <div className="mt-4 flex gap-2"><button disabled={saving} onClick={saveCompany} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button><button onClick={() => setEditing(null)} className="rounded border border-slate-300 px-3 py-2 text-sm">Cancel</button></div>
        </div>
      ) : null}
    </div>
  );
}
