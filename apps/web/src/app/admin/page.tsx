"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type DashboardStats = {
  companies: number;
  profiles: number;
  nfc_tags: number;
  total_taps: number;
  total_leads: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await apiGet<DashboardStats>("/api/v1/admin/dashboard");
        if (mounted) {
          setStats(data);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Could not load dashboard data.");
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(() => [
    { label: "Companies", value: stats?.companies ?? "—" },
    { label: "Digital Cards", value: stats?.profiles ?? "—" },
    { label: "NFC Tags", value: stats?.nfc_tags ?? "—" },
    { label: "Total Taps", value: stats?.total_taps ?? "—" },
    { label: "Leads", value: stats?.total_leads ?? "—" },
  ], [stats]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Dashboard</h1>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 px-4 py-3">
          {error}
        </div>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm ring-1 ring-indigo-100/60 flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="text-3xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
