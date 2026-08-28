"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Me = {
  role: string;
  company_id?: string | null;
};

type Company = {
  id: string;
  name: string;
};

type UserCreateResponse = {
  id: string;
  email: string;
  role: string;
};

export default function AdminUsersPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const current = await apiGet<Me>("/api/v1/admin/me");
        const isSuperAdmin = current.role === "super_admin";
        const companyList = isSuperAdmin ? await apiGet<Company[]>("/api/v1/admin/companies") : [];

        if (!mounted) return;

        setMe(current);
        setCompanies(companyList);
        setCompanyId(isSuperAdmin ? companyList[0]?.id ?? "" : current.company_id ?? "");
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Could not load user setup data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const roleOptions = useMemo(() => {
    if (me?.role === "super_admin") {
      return ["employee", "programmer", "business_owner", "super_admin"];
    }
    return ["employee"];
  }, [me?.role]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email, and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      };

      if (companyId) payload.company_id = companyId;

      const created = await apiPost<UserCreateResponse>("/api/v1/admin/users", payload);
      setSuccess(`Created user ${created.email} (${created.role}).`);
      setPassword("");
      setName("");
      setEmail("");
      setRole(roleOptions[0] ?? "employee");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading users setup…</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Users</h1>

      {error ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <form onSubmit={onSubmit} className="rounded-xl bg-white p-6 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Team Member"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Temporary Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Minimum 8 characters"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {roleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={me?.role !== "super_admin"}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {me?.role === "super_admin" ? (
                <>
                  <option value="">No company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value={companyId}>{companyId ? "Current company" : "No company"}</option>
              )}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create User"}
        </button>
      </form>
    </div>
  );
}
