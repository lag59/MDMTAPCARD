"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type AnalyticsOverview = {
  total_taps: number;
  total_leads: number;
  conversion_rate: number;
  by_event_type: Record<string, number>;
  daily: Array<{ date: string; taps: number; leads: number }>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await apiGet<AnalyticsOverview>("/api/v1/admin/analytics/overview");
        if (mounted) {
          setData(response);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Could not load analytics overview.");
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const eventRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_event_type).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const formatDate = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Analytics</h1>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Taps", value: String(data?.total_taps ?? 0), color: "text-slate-800" },
          { label: "Leads", value: String(data?.total_leads ?? 0), color: "text-blue-700" },
          {
            label: "Lead Conversion",
            value: `${(data?.conversion_rate ?? 0).toFixed(2)}%`,
            color: "text-emerald-700",
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Event Type Breakdown</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Event</th>
                <th className="text-left px-4 py-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {eventRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                    No tap events recorded yet.
                  </td>
                </tr>
              ) : (
                eventRows.map(([eventType, count]) => (
                  <tr key={eventType} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{eventType}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Last 7 Days</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Taps</th>
                <th className="text-left px-4 py-3">Leads</th>
              </tr>
            </thead>
            <tbody>
              {(data?.daily ?? []).map((row) => (
                <tr key={row.date} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.taps}</td>
                  <td className="px-4 py-3 text-slate-700">{row.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
