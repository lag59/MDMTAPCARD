"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

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

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string | null;
  company_name: string | null;
  is_active: boolean;
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
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const current = await apiGet<Me>("/api/v1/admin/me");
        const isSuperAdmin = current.role === "super_admin";
        const companyList = isSuperAdmin ? await apiGet<Company[]>("/api/v1/admin/companies") : [];
        const userList = isSuperAdmin ? await apiGet<ManagedUser[]>("/api/v1/admin/users") : [];

        if (!mounted) return;

        setMe(current);
        setCompanies(companyList);
        setUsers(userList);
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

  const saveUser = async () => {
    if (!editingUser) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiPatch<ManagedUser>(`/api/v1/admin/users/${editingUser.id}`, {
        name: editingUser.name, email: editingUser.email, role: editingUser.role,
        company_id: editingUser.company_id, is_active: editingUser.is_active,
        ...(resetPassword ? { password: resetPassword } : {}),
      });
      setUsers((all) => all.map((user) => user.id === updated.id ? { ...user, ...updated, company_name: companies.find((company) => company.id === updated.company_id)?.name ?? null } : user));
      setEditingUser(null);
      setResetPassword("");
      setSuccess(`Updated ${updated.email}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update user."); }
    finally { setSubmitting(false); }
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

      {me?.role === "super_admin" ? <section className="mt-8 rounded-xl bg-white p-6 shadow"><h2 className="text-lg font-semibold text-slate-800">Existing Users</h2><div className="mt-3 divide-y divide-slate-100">{users.map((user) => <div key={user.id} className="flex items-center gap-3 py-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium text-slate-800">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email} · {user.role} · {user.company_name ?? "No company"}</p></div><span className={`rounded-full px-2 py-1 text-xs ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.is_active ? "Active" : "Inactive"}</span><button type="button" onClick={() => { setEditingUser({ ...user }); setResetPassword(""); }} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700">Edit</button></div>)}</div></section> : null}

      {editingUser ? <section className="mt-6 rounded-xl bg-white p-6 shadow"><h2 className="text-lg font-semibold text-slate-800">Edit User</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Name" /><input type="email" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Email" /><select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm">{roleOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={editingUser.company_id ?? ""} onChange={(e) => setEditingUser({ ...editingUser, company_id: e.target.value || null })} className="rounded border border-slate-300 px-3 py-2 text-sm"><option value="">No company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2" placeholder="Optional new password (minimum 8 characters)" /><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={editingUser.is_active} onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })} /> Active account</label></div><div className="mt-4 flex gap-2"><button disabled={submitting} onClick={saveUser} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{submitting ? "Saving…" : "Save changes"}</button><button onClick={() => setEditingUser(null)} className="rounded border border-slate-300 px-3 py-2 text-sm">Cancel</button></div></section> : null}
    </div>
  );
}
