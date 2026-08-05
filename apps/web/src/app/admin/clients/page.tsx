"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type Company = {
  id: string;
  name: string;
  subscription_plan: string;
  status: string;
  renewal_date: string | null;
};

export default function ClientsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await apiGet<Company[]>("/api/v1/admin/companies");
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
                  <td className="px-4 py-3 text-slate-600">{company.subscription_plan}</td>
                  <td className="px-4 py-3 text-slate-600">—</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {company.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(company.renewal_date)}</td>
                  <td className="px-4 py-3 text-slate-400">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
