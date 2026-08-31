"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, listReusableTemplates, type ImportedTemplate } from "@/lib/api";

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ImportedTemplate[]>([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState("");

  useEffect(() => {
    listReusableTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/v1/admin/companies", { name, default_template_id: defaultTemplateId || null });
      router.push("/admin/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client.");
      setSaving(false);
    }
  };

  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/clients" className="text-sm text-slate-500 hover:text-slate-700">
          ← Clients
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">New Client</h1>
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-md">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company Name *</label>
            <input
              required
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Profile Template</label>
            <select value={defaultTemplateId} onChange={(e) => setDefaultTemplateId(e.target.value)} className={input}>
              <option value="">No default (choose per profile)</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">New profiles for this client automatically use this template unless an admin chooses another.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {saving ? "Creating…" : "Create Client"}
          </button>
        </form>
      </div>
    </div>
  );
}
