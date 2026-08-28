"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost, createSquareCheckout } from "@/lib/api";

type OrderItem = {
  id: string;
  reference_code: string;
  company_name: string;
  plan: string;
  seats: number;
  amount_cents: number;
  currency: string;
  status: string;
  payment_status: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
};

type OrdersResponse = {
  items: OrderItem[];
  summary: {
    total_orders: number;
    pending: number;
    paid: number;
    cancelled: number;
    refunded: number;
    revenue_cents: number;
  };
};

type Company = {
  id: string;
  name: string;
};

type SquareCheckoutResponse = {
  order_id: string;
  checkout_url: string;
  payment_link_id: string;
};

type OrderEditState = Record<
  string,
  {
    plan: string;
    seats: string;
    amount: string;
    currency: string;
    status: string;
    payment_status: string;
  }
>;

const PLAN_OPTIONS = [
  "basic_monthly",
  "basic_yearly",
  "pro_monthly",
  "pro_yearly",
  "tap_starter",
  "tap_business",
  "tap_team",
  "tap_pro",
] as const;
const PLAN_META: Record<string, { label: string; amount: string }> = {
  basic_monthly: { label: "Basic — $3.99/month", amount: "3.99" },
  basic_yearly: { label: "Basic — $39/year", amount: "39.00" },
  pro_monthly: { label: "Pro — $6.99/month", amount: "6.99" },
  pro_yearly: { label: "Pro — $69/year", amount: "69.00" },
  tap_starter: { label: "Legacy Starter", amount: "99.00" },
  tap_business: { label: "Legacy Business", amount: "99.00" },
  tap_team: { label: "Legacy Team", amount: "99.00" },
  tap_pro: { label: "Legacy Pro", amount: "99.00" },
};
const STATUS_OPTIONS = ["pending", "paid", "cancelled", "refunded"] as const;
const PAYMENT_OPTIONS = ["unpaid", "paid", "failed", "refunded"] as const;

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [serverSummary, setServerSummary] = useState<OrdersResponse["summary"] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [orderEdits, setOrderEdits] = useState<OrderEditState>({});
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    company_id: "",
    plan: "basic_monthly",
    seats: "1",
    amount: "3.99",
    currency: "USD",
    status: "pending",
    payment_status: "unpaid",
    period_start: "",
    period_end: "",
    notes: "",
  });

  const loadOrders = useCallback(async () => {
    const data = await apiGet<OrdersResponse>("/api/v1/admin/orders");
    setOrders(data.items);
    setServerSummary(data.summary);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const role = window.localStorage.getItem("user_role");
        if (mounted) {
          setUserRole(role);
        }

        await loadOrders();

        // Super admins can choose company while creating orders.
        if (role === "super_admin") {
          const companyData = await apiGet<Company[]>("/api/v1/admin/companies");
          if (mounted) {
            setCompanies(companyData);
            if (companyData.length > 0) {
              setCreateForm((prev) => ({ ...prev, company_id: prev.company_id || companyData[0].id }));
            }
          }
        }

        if (mounted) {
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Could not load subscription orders.");
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [loadOrders]);

  const summary = useMemo(() => {
    if (serverSummary) {
      return serverSummary;
    }
    return {
      total_orders: 0,
      pending: 0,
      paid: 0,
      cancelled: 0,
      refunded: 0,
      revenue_cents: 0,
    };
  }, [serverSummary]);

  const formatDate = (iso: string | null, includeTime = false) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return includeTime ? d.toLocaleString() : d.toLocaleDateString();
  };

  const formatMoney = (amountCents: number, currency: string) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  };

  const getOrderEdit = (order: OrderItem) => {
    return (
      orderEdits[order.id] ?? {
        plan: order.plan,
        seats: String(order.seats),
        amount: (order.amount_cents / 100).toFixed(2),
        currency: order.currency,
        status: order.status,
        payment_status: order.payment_status,
      }
    );
  };

  const toIsoOrNull = (value: string) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingCreate(true);
    setError(null);
    setSuccess(null);

    try {
      const seats = Number.parseInt(createForm.seats, 10);
      const amount = Math.round(Number.parseFloat(createForm.amount) * 100);

      if (Number.isNaN(seats) || seats < 1) {
        throw new Error("Seats must be at least 1");
      }
      if (Number.isNaN(amount) || amount < 0) {
        throw new Error("Amount must be a valid non-negative number");
      }
      if (userRole === "super_admin" && !createForm.company_id) {
        throw new Error("Please select a company");
      }

      await apiPost("/api/v1/admin/orders", {
        company_id: createForm.company_id || undefined,
        plan: createForm.plan,
        seats,
        amount_cents: amount,
        currency: createForm.currency,
        status: createForm.status,
        payment_status: createForm.payment_status,
        period_start: toIsoOrNull(createForm.period_start),
        period_end: toIsoOrNull(createForm.period_end),
        notes: createForm.notes || null,
      });

      await loadOrders();
      setSuccess("Order created.");
      setCreateForm((prev) => ({
        ...prev,
        seats: "1",
        amount: PLAN_META[prev.plan]?.amount ?? prev.amount,
        status: "pending",
        payment_status: "unpaid",
        period_start: "",
        period_end: "",
        notes: "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create order.");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const updateOrderState = (
    order: OrderItem,
    key: "plan" | "seats" | "amount" | "currency" | "status" | "payment_status",
    value: string
  ) => {
    setOrderEdits((prev) => {
      const current =
        prev[order.id] ??
        {
          plan: order.plan,
          seats: String(order.seats),
          amount: (order.amount_cents / 100).toFixed(2),
          currency: order.currency,
          status: order.status,
          payment_status: order.payment_status,
        };
      return {
        ...prev,
        [order.id]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const saveOrderUpdate = async (order: OrderItem) => {
    const edit = getOrderEdit(order);

    const seats = Number.parseInt(edit.seats, 10);
    const amountCents = Math.round(Number.parseFloat(edit.amount) * 100);

    if (Number.isNaN(seats) || seats < 1) {
      setError("Seats must be at least 1.");
      return;
    }
    if (Number.isNaN(amountCents) || amountCents < 0) {
      setError("Amount must be a valid non-negative value.");
      return;
    }

    setSavingOrderId(order.id);
    setError(null);
    setSuccess(null);

    try {
      await apiPatch(`/api/v1/admin/orders/${order.id}`, {
        plan: edit.plan,
        seats,
        amount_cents: amountCents,
        currency: edit.currency,
        status: edit.status,
        payment_status: edit.payment_status,
      });
      await loadOrders();
      setSuccess(`Order ${order.reference_code} updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update order.");
    } finally {
      setSavingOrderId(null);
    }
  };

  const createSquarePayLink = async (order: OrderItem) => {
    setPayingOrderId(order.id);
    setError(null);
    setSuccess(null);
    try {
      const data = await createSquareCheckout<SquareCheckoutResponse>(order.id);
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
      setSuccess(`Square checkout link created for ${order.reference_code}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create Square checkout link.");
    } finally {
      setPayingOrderId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Orders</h1>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg bg-green-50 text-green-700 text-sm px-4 py-3">{success}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Orders", value: String(summary.total_orders), color: "text-slate-800" },
          { label: "Paid", value: String(summary.paid), color: "text-green-600" },
          { label: "Pending", value: String(summary.pending), color: "text-amber-600" },
          { label: "Revenue", value: formatMoney(summary.revenue_cents, "USD"), color: "text-blue-700" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl shadow p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleCreateSubmit} className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">New Order</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {userRole === "super_admin" ? (
            <label className="text-xs text-slate-600 flex flex-col gap-1">
              Company
              <select
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={createForm.company_id}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, company_id: e.target.value }))}
                required
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Plan
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.plan}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  plan: e.target.value,
                  amount: PLAN_META[e.target.value]?.amount ?? prev.amount,
                }))
              }
            >
              {PLAN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PLAN_META[option]?.label ?? option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Seats
            <input
              type="number"
              min={1}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.seats}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, seats: e.target.value }))}
            />
          </label>

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Amount (USD)
            <input
              type="number"
              min={0}
              step="0.01"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.amount}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </label>

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Status
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.status}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Payment
            <select
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.payment_status}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, payment_status: e.target.value }))}
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Period Start
            <input
              type="datetime-local"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.period_start}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, period_start: e.target.value }))}
            />
          </label>

          <label className="text-xs text-slate-600 flex flex-col gap-1">
            Period End
            <input
              type="datetime-local"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.period_end}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, period_end: e.target.value }))}
            />
          </label>
        </div>
        <label className="text-xs text-slate-600 flex flex-col gap-1 mt-3">
          Notes
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={createForm.notes}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </label>

        <div className="mt-4">
          <button
            type="submit"
            disabled={submittingCreate}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {submittingCreate ? "Creating..." : "Create Order"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Seats</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Currency</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Billing Period</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                // Keep per-row status/payment editable and persisted through API.
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800 font-medium">{order.reference_code}</td>
                  <td className="px-4 py-3 text-slate-600">{order.company_name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <select
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      value={getOrderEdit(order).plan}
                      onChange={(e) => updateOrderState(order, "plan", e.target.value)}
                    >
                      {PLAN_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {PLAN_META[option]?.label ?? option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      type="number"
                      min={1}
                      className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      value={getOrderEdit(order).seats}
                      onChange={(e) => updateOrderState(order, "seats", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      value={getOrderEdit(order).amount}
                      onChange={(e) => updateOrderState(order, "amount", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs uppercase"
                      value={getOrderEdit(order).currency}
                      maxLength={3}
                      onChange={(e) => updateOrderState(order, "currency", e.target.value.toUpperCase())}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <select
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      value={getOrderEdit(order).status}
                      onChange={(e) => updateOrderState(order, "status", e.target.value)}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <select
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs"
                      value={getOrderEdit(order).payment_status}
                      onChange={(e) => updateOrderState(order, "payment_status", e.target.value)}
                    >
                      {PAYMENT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(order.period_start)} - {formatDate(order.period_end)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.created_at, true)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveOrderUpdate(order)}
                        disabled={savingOrderId === order.id || payingOrderId === order.id}
                        className="bg-slate-800 text-white rounded px-2.5 py-1 text-xs disabled:opacity-60"
                      >
                        {savingOrderId === order.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => createSquarePayLink(order)}
                        disabled={payingOrderId === order.id || savingOrderId === order.id}
                        className="bg-emerald-600 text-white rounded px-2.5 py-1 text-xs disabled:opacity-60"
                      >
                        {payingOrderId === order.id ? "Creating..." : "Square Pay Link"}
                      </button>
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
