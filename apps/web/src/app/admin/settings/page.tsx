"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type MeResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string | null;
  company_name: string | null;
};

type DashboardStats = {
  companies: number;
  profiles: number;
  nfc_tags: number;
  total_taps: number;
  total_leads: number;
};

type MyCompanyStats = {
  company_id: string;
  profiles: number;
  nfc_tags: number;
  total_taps: number;
  total_leads: number;
};

export default function SettingsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [globalStats, setGlobalStats] = useState<DashboardStats | null>(null);
  const [companyStats, setCompanyStats] = useState<MyCompanyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const meData = await apiGet<MeResponse>("/api/v1/admin/me");
        if (!mounted) return;
        setMe(meData);

        if (meData.role === "super_admin") {
          const stats = await apiGet<DashboardStats>("/api/v1/admin/dashboard");
          if (mounted) setGlobalStats(stats);
        } else {
          const stats = await apiGet<MyCompanyStats>("/api/v1/admin/my-company");
          if (mounted) setCompanyStats(stats);
        }

        if (mounted) {
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Could not load settings data.");
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const roleLabel = me?.role ? me.role.replaceAll("_", " ") : "-";

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-4">Account</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Name</dt>
              <dd className="text-slate-800 font-medium">{me?.name ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-slate-800 font-medium">{me?.email ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Role</dt>
              <dd className="text-slate-800 font-medium capitalize">{roleLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Company</dt>
              <dd className="text-slate-800 font-medium">{me?.company_name ?? "Global"}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-4">Scope Summary</h2>
          {me?.role === "super_admin" ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Companies</dt>
                <dd className="text-slate-800 font-medium">{globalStats?.companies ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Digital Cards</dt>
                <dd className="text-slate-800 font-medium">{globalStats?.profiles ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">NFC Tags</dt>
                <dd className="text-slate-800 font-medium">{globalStats?.nfc_tags ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Total Taps</dt>
                <dd className="text-slate-800 font-medium">{globalStats?.total_taps ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Total Leads</dt>
                <dd className="text-slate-800 font-medium">{globalStats?.total_leads ?? 0}</dd>
              </div>
            </dl>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Profiles</dt>
                <dd className="text-slate-800 font-medium">{companyStats?.profiles ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">NFC Tags</dt>
                <dd className="text-slate-800 font-medium">{companyStats?.nfc_tags ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Total Taps</dt>
                <dd className="text-slate-800 font-medium">{companyStats?.total_taps ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Total Leads</dt>
                <dd className="text-slate-800 font-medium">{companyStats?.total_leads ?? 0}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
