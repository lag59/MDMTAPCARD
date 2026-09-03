"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, cancelSignupSubscription } from "@/lib/api";
import { planInterestLabel, serviceInterestLabel } from "@/lib/labels";

type SignupRequestRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  plan_interest: string | null;
  service_interest: string | null;
  team_size: string | null;
  quantity: number | null;
  shipping_name: string | null;
  shipping_company: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  amount_cents: number | null;
  currency: string | null;
  payment_required: boolean;
  square_checkout_url: string | null;
  square_payment_link_id: string | null;
  square_customer_id: string | null;
  square_subscription_id: string | null;
  subscription_status: string | null;
  notes: string | null;
  status: string;
  queue: "intake" | "fulfillment";
  created_at: string | null;
};

const STATUS_OPTIONS = ["design_request", "new", "in_review", "approved", "fulfilled", "closed"] as const;

export default function SignupRequestsPage() {
  const [rows, setRows] = useState<SignupRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const data = await apiGet<SignupRequestRow[]>("/api/v1/admin/signup-requests");
    setRows(data.filter((row) => row.queue === "intake"));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const role = window.localStorage.getItem("user_role");
        if (role !== "super_admin") {
          throw new Error("Only super admins can view signup requests.");
        }
        await load();
        if (mounted) setError(null);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Could not load signup requests.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.status, (map.get(row.status) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  const fmtMoney = (amountCents: number | null, currency: string | null) => {
    if (amountCents == null) return "—";
    const safeCurrency = currency || "USD";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: safeCurrency }).format(amountCents / 100);
  };

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id);
    setError(null);
    try {
      await apiPatch(`/api/v1/admin/signup-requests/${id}`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status.");
    } finally {
      setSavingId(null);
    }
  };

  const cancelSubscription = async (id: string) => {
    if (!window.confirm("Cancel this Square subscription? This stops future renewals.")) return;
    setSavingId(id);
    setError(null);
    try {
      await cancelSignupSubscription(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel subscription.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Signup Requests</h1>
      <p className="-mt-4 mb-6 text-sm text-slate-500">
        General intake and custom design requests. Paid physical orders ready for programming and shipping appear in the{" "}
        <a href="/admin/fulfillment" className="text-indigo-600 underline">Fulfillment Queue</a>.
      </p>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {STATUS_OPTIONS.map((status) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{status}</p>
            <p className="text-2xl font-bold text-slate-900">{counts.get(status) ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Service</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Qty</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Shipping</th>
              <th className="px-4 py-3 text-left">Square</th>
              <th className="px-4 py-3 text-left">Subscription</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">No signup requests yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-600">{fmtDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium">{row.contact_name}</div>
                    <div>{row.company_name}</div>
                    <div className="text-xs text-slate-500">{row.email}</div>
                    <div className="text-xs text-slate-500">{row.phone || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{serviceInterestLabel(row.service_interest)}</td>
                  <td className="px-4 py-3 text-slate-700">{planInterestLabel(row.plan_interest)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.quantity ?? 1}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {fmtMoney(row.amount_cents, row.currency)}
                    <div className="text-xs text-slate-500">{row.payment_required ? "Payment required" : "No payment"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.shipping_address1 ? (
                      <>
                        <div>{row.shipping_name || "—"}</div>
                        <div className="text-xs text-slate-500">{row.shipping_company || ""}</div>
                        <div className="text-xs text-slate-500">{row.shipping_address1}</div>
                        {row.shipping_address2 ? <div className="text-xs text-slate-500">{row.shipping_address2}</div> : null}
                        <div className="text-xs text-slate-500">
                          {[row.shipping_city, row.shipping_state, row.shipping_postal_code].filter(Boolean).join(", ")} {row.shipping_country || ""}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.square_checkout_url ? (
                      <a
                        href={row.square_checkout_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 underline"
                      >
                        Open checkout
                      </a>
                    ) : (
                      "—"
                    )}
                    <div className="text-xs text-slate-500">{row.square_payment_link_id || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.square_subscription_id ? (
                      <>
                        <div className="text-xs font-medium">{row.subscription_status || "—"}</div>
                        {row.subscription_status && !["CANCELED", "canceled", "error"].includes(row.subscription_status) ? (
                          <button
                            type="button"
                            disabled={savingId === row.id}
                            onClick={() => cancelSubscription(row.id)}
                            className="mt-1 rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      value={row.status}
                      disabled={savingId === row.id}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
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
