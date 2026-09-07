"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type Me = { role: string; company_id?: string | null };
type Company = { id: string; name: string };
type UserCreateResponse = { id: string; email: string; role: string; password?: string; sms_sent?: boolean };
type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string | null;
  company_name: string | null;
  phone: string | null;
  card_phone: string | null;
  is_active: boolean;
};

export default function AdminUsersPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "employee",
    companyId: "",
    sendSms: false,
  });

  const isSuperAdmin = me?.role === "super_admin";
  const roleOptions = useMemo(
    () => (isSuperAdmin ? ["employee", "programmer", "business_owner", "super_admin"] : ["employee"]),
    [isSuperAdmin],
  );

  const load = async () => {
    const current = await apiGet<Me>("/api/v1/admin/me");
    const superAdmin = current.role === "super_admin";
    const [companyList, userList] = await Promise.all([
      superAdmin ? apiGet<Company[]>("/api/v1/admin/companies") : Promise.resolve([]),
      superAdmin ? apiGet<ManagedUser[]>("/api/v1/admin/users") : Promise.resolve([]),
    ]);
    setMe(current);
    setCompanies(companyList);
    setUsers(userList);
    setCreateForm((form) => ({ ...form, companyId: superAdmin ? form.companyId || companyList[0]?.id || "" : current.company_id || "" }));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load users."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const generatePassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const values = new Uint32Array(11);
    crypto.getRandomValues(values);
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join("") + "!";
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!createForm.name.trim() || !createForm.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (createForm.sendSms && !createForm.phone.trim()) {
      setError("A phone number is required to text credentials.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        role: createForm.role,
      };
      if (createForm.password.trim()) payload.password = createForm.password;
      if (createForm.phone.trim()) payload.phone = createForm.phone.trim();
      if (createForm.companyId) payload.company_id = createForm.companyId;
      if (createForm.sendSms) payload.send_credentials_sms = true;

      const created = await apiPost<UserCreateResponse>("/api/v1/admin/users", payload);
      const passwordNote = createForm.password.trim() ? "" : ` Temporary password: ${created.password}`;
      const smsNote = createForm.sendSms ? (created.sms_sent ? " Credentials texted." : " SMS could not be sent.") : "";
      setSuccess(`Created ${created.email}.${passwordNote}${smsNote}`);
      setCreateForm((form) => ({ ...form, name: "", email: "", password: "", phone: "", sendSms: false, role: roleOptions[0] || "employee" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create user.");
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
        name: editingUser.name.trim(),
        email: editingUser.email.trim().toLowerCase(),
        phone: editingUser.phone || null,
        role: editingUser.role,
        company_id: editingUser.company_id,
        is_active: editingUser.is_active,
        ...(resetPassword ? { password: resetPassword } : {}),
      });
      setUsers((all) => all.map((user) => user.id === updated.id ? { ...user, ...updated, company_name: companies.find((company) => company.id === updated.company_id)?.name ?? null } : user));
      setEditingUser(null);
      setResetPassword("");
      setSuccess(`Updated ${updated.email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update user.");
    } finally {
      setSubmitting(false);
    }
  };

  const textCredentials = async (user: ManagedUser) => {
    setError(null);
    setSuccess(null);
    const phone = user.phone || user.card_phone || window.prompt(`Mobile number for ${user.name}:`, "");
    if (!phone) return;
    const password = window.prompt("New temporary password to text (minimum 8 characters):", "");
    if (!password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await apiPost(`/api/v1/admin/users/${user.id}/text-credentials`, { phone, password });
      setUsers((all) => all.map((entry) => entry.id === user.id ? { ...entry, phone } : entry));
      setSuccess(`Texted login credentials to ${user.name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not text credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Loading users…</div>;

  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Users</h1>
      {error ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <form onSubmit={createUser} className="space-y-4 rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-800">Create User</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className={inputClass} placeholder="Team member" required /></Field>
          <Field label="Email"><input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className={inputClass} placeholder="user@example.com" required /></Field>
          <Field label="Temporary Password (optional)">
            <div className="flex gap-2"><input type="text" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className={inputClass} placeholder="Default or generated" /><button type="button" onClick={() => setCreateForm({ ...createForm, password: generatePassword() })} className="rounded-md border border-slate-300 px-3 text-sm">Generate</button></div>
          </Field>
          <Field label="Mobile Number"><input type="tel" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} className={inputClass} placeholder="+1 555 123 4567" /></Field>
          <Field label="Role"><select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className={inputClass}>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></Field>
          <Field label="Company"><select value={createForm.companyId} onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })} disabled={!isSuperAdmin} className={inputClass}><option value="">No company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={createForm.sendSms} onChange={(e) => setCreateForm({ ...createForm, sendSms: e.target.checked })} /> Text credentials to the client</label>
        <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Creating…" : "Create User"}</button>
      </form>

      {isSuperAdmin ? <section className="mt-8 rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-800">Existing Users</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {users.map((user) => <div key={user.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1"><p className="font-medium text-slate-800">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email} · {user.role} · {user.company_name ?? "No company"}</p></div>
            <span className={`rounded-full px-2 py-1 text-xs ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.is_active ? "Active" : "Inactive"}</span>
            <button type="button" onClick={() => textCredentials(user)} disabled={submitting} className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50">Text credentials</button>
            <button type="button" onClick={() => { setEditingUser({ ...user }); setResetPassword(""); }} disabled={submitting} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 disabled:opacity-50">Edit</button>
          </div>)}
        </div>
      </section> : null}

      {editingUser ? <section className="mt-6 rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-800">Edit User</h2>
        <form onSubmit={(event) => { event.preventDefault(); void saveUser(); }} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className={inputClass} required /></Field>
          <Field label="Email"><input type="email" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className={inputClass} required /></Field>
          <Field label="Role"><select value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })} className={inputClass}>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></Field>
          <Field label="Company"><select value={editingUser.company_id ?? ""} onChange={(e) => setEditingUser({ ...editingUser, company_id: e.target.value || null })} className={inputClass}><option value="">No company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
          <Field label="Mobile Number"><input type="tel" value={editingUser.phone ?? ""} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value || null })} className={inputClass} placeholder="+1 555 123 4567" /></Field>
          <Field label="New Temporary Password"><input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className={inputClass} placeholder="Leave blank to keep current" minLength={resetPassword ? 8 : undefined} /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={editingUser.is_active} onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.checked })} /> Active account</label>
          <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={submitting} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{submitting ? "Saving…" : "Save changes"}</button><button type="button" onClick={() => setEditingUser(null)} disabled={submitting} className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Cancel</button></div>
        </form>
      </section> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm font-medium text-slate-700"><span>{label}</span>{children}</label>;
}
