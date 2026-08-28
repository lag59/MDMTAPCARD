"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type NfcTag = {
  id: string;
  tag_uid: string | null;
  tag_type: string | null;
  capacity_bytes: number | null;
  status: string;
  written_at: string | null;
  written_by: string | null;
  written_by_name: string | null;
  profile_id: string | null;
  profile_slug: string | null;
  profile_name: string | null;
  profile_url: string | null;
};

export default function NfcInventoryPage() {
  const [tags, setTags] = useState<NfcTag[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await apiGet<NfcTag[]>("/api/v1/nfc/inventory");
        if (mounted) {
          setTags(data);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Could not load NFC inventory.");
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    let activated = 0;
    let failed = 0;
    for (const tag of tags) {
      if (tag.status === "activated") activated += 1;
      if (tag.status === "failed") failed += 1;
    }
    return { total: tags.length, activated, failed };
  }, [tags]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">NFC Inventory</h1>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Tags", value: String(totals.total), color: "text-slate-800" },
          { label: "Activated", value: String(totals.activated), color: "text-green-600" },
          { label: "Failed Writes", value: String(totals.failed), color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              {["Tag UID", "Type", "Profile", "Status", "Written By", "Written At"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tags.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No tags programmed yet. Use the MDM TapCard mobile app to write your first tag.
                </td>
              </tr>
            ) : (
              {tags.map((tag) => (
                <tr key={tag.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{tag.tag_uid ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{tag.tag_type ?? "—"}</div>
                    <div className="text-xs text-slate-400">{tag.capacity_bytes ? `${tag.capacity_bytes} bytes` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {tag.profile_slug ? (
                      <div>
                        <div className="text-slate-700 font-medium">{tag.profile_name ?? tag.profile_slug}</div>
                        <a
                          href={tag.profile_url ?? `/c/${tag.profile_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          /c/{tag.profile_slug}
                        </a>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {tag.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{tag.written_by_name ?? tag.written_by ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(tag.written_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
