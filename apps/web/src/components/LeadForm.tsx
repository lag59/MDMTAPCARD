"use client";

import { useState } from "react";
import { submitLead } from "@/lib/api";

const copy = {
  en: {
    name: "Your Name",
    email: "Email",
    phone: "Phone",
    message: "Message",
    send: "Send",
    success: "Message sent! We'll be in touch.",
    error: "Something went wrong. Please try again.",
  },
  es: {
    name: "Tu Nombre",
    email: "Correo",
    phone: "Teléfono",
    message: "Mensaje",
    send: "Enviar",
    success: "¡Mensaje enviado! Estaremos en contacto.",
    error: "Algo salió mal. Inténtalo de nuevo.",
  },
};

interface Props {
  profileId: string;
  lang: "en" | "es";
}

export default function LeadForm({ profileId, lang }: Props) {
  const c = copy[lang];
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setStatus("sending");
    const ok = await submitLead({ profile_id: profileId, ...form });
    setStatus(ok ? "done" : "error");
  }

  if (status === "done") {
    return <p className="text-green-400 text-sm text-center py-2">{c.success}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        required
        placeholder={c.name}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="rounded-lg bg-white/10 px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-white/30"
      />
      <input
        type="email"
        placeholder={c.email}
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        className="rounded-lg bg-white/10 px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-white/30"
      />
      <input
        type="tel"
        placeholder={c.phone}
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        className="rounded-lg bg-white/10 px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-white/30"
      />
      <textarea
        rows={3}
        placeholder={c.message}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        className="rounded-lg bg-white/10 px-3 py-2 text-sm placeholder-slate-400 outline-none focus:ring-2 focus:ring-white/30 resize-none"
      />
      {status === "error" && <p className="text-red-400 text-xs">{c.error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-xl bg-blue-600 py-2 font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
      >
        {status === "sending" ? "…" : c.send}
      </button>
    </form>
  );
}
