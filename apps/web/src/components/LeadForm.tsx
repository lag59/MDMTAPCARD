"use client";

import { useEffect, useState } from "react";
import { startLeadPhoneOtp, submitLead, verifyLeadPhoneOtp } from "@/lib/api";

const copy = {
  en: {
    name: "Your Name",
    email: "Email",
    phone: "Phone",
    sendCode: "Send Code",
    code: "Verification Code",
    verifyCode: "Verify Code",
    phoneVerified: "Phone verified",
    phoneRequired: "Verify your phone to continue.",
    mockCode: "Test code",
    message: "Message",
    consent: "I agree to be contacted by phone/text/email.",
    send: "Send",
    useMyInfo: "Use my contact info",
    success: "Message sent! We'll be in touch.",
    error: "Something went wrong. Please try again.",
  },
  es: {
    name: "Tu Nombre",
    email: "Correo",
    phone: "Teléfono",
    sendCode: "Enviar código",
    code: "Código de verificación",
    verifyCode: "Verificar código",
    phoneVerified: "Teléfono verificado",
    phoneRequired: "Verifica tu teléfono para continuar.",
    mockCode: "Código de prueba",
    message: "Mensaje",
    consent: "Acepto ser contactado por teléfono/SMS/correo.",
    send: "Enviar",
    useMyInfo: "Usar mi información de contacto",
    success: "¡Mensaje enviado! Estaremos en contacto.",
    error: "Algo salió mal. Inténtalo de nuevo.",
  },
};

interface Props {
  profileId: string;
  tagToken?: string;
  lang: "en" | "es";
  lightBackground: boolean;
  prefill?: { name?: string; email?: string; phone?: string };
}

export default function LeadForm({ profileId, tagToken, lang, lightBackground, prefill }: Props) {
  const c = copy[lang];
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpVerificationId, setOtpVerificationId] = useState<string | null>(null);
  const [otpDebugCode, setOtpDebugCode] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", consent_to_contact: false });

  const phoneChangedAfterVerify = otpVerified && form.phone.trim().length > 0;

  const [canPickContact, setCanPickContact] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { contacts?: { select?: unknown } };
    setCanPickContact(typeof navigator !== "undefined" && !!nav.contacts && typeof nav.contacts.select === "function");
  }, []);

  // Populate fields when the parent card captures a contact from a tap-anywhere exchange.
  useEffect(() => {
    if (!prefill) return;
    setForm((f) => ({
      ...f,
      name: prefill.name ?? f.name,
      email: prefill.email ?? f.email,
      phone: prefill.phone ?? f.phone,
    }));
    if (prefill.phone) {
      setOtpVerified(false);
      setOtpVerificationId(null);
      setOtpCode("");
    }
  }, [prefill]);

  async function handlePickContact() {
    try {
      const nav = navigator as Navigator & {
        contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; email?: string[]; tel?: string[] }>> };
      };
      if (!nav.contacts?.select) return;
      const results = await nav.contacts.select(["name", "email", "tel"], { multiple: false });
      if (!results || results.length === 0) return;
      const picked = results[0];
      const name = picked.name?.[0];
      const email = picked.email?.[0];
      const tel = picked.tel?.[0];
      setForm((f) => ({
        ...f,
        name: name ?? f.name,
        email: email ?? f.email,
        phone: tel ?? f.phone,
      }));
      if (tel) {
        setOtpVerified(false);
        setOtpVerificationId(null);
        setOtpCode("");
      }
    } catch {
      // Visitor cancelled the picker or it is unavailable; keep the manual form.
    }
  }

  async function handleSendCode() {
    if (!form.phone.trim()) return;
    setSendingOtp(true);
    setOtpError(null);
    try {
      const result = await startLeadPhoneOtp({
        profile_id: profileId,
        tag_token: tagToken,
        phone: form.phone,
      });
      setOtpVerificationId(result.verification_id);
      setOtpDebugCode(result.debug_code ?? null);
      setOtpVerified(false);
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Could not send verification code.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyCode() {
    if (!otpVerificationId || !otpCode.trim()) return;
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const result = await verifyLeadPhoneOtp({ verification_id: otpVerificationId, code: otpCode.trim() });
      setOtpVerified(Boolean(result.verified));
    } catch (e) {
      setOtpVerified(false);
      setOtpError(e instanceof Error ? e.message : "Could not verify code.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.phone.trim() && !form.email.trim()) return;
    if (!form.consent_to_contact) return;
    if (form.phone.trim() && !otpVerified) {
      setOtpError(c.phoneRequired);
      return;
    }
    setStatus("sending");
    const ok = await submitLead({
      profile_id: profileId,
      tag_token: tagToken,
      name: form.name,
      email: form.email,
      phone: form.phone,
      message: form.message,
      consent_to_contact: form.consent_to_contact,
      consent_text: c.consent,
      phone_verification_id: otpVerificationId ?? undefined,
    });
    setStatus(ok ? "done" : "error");
  }

  if (status === "done") {
    return <p className={`${lightBackground ? "text-emerald-700" : "text-emerald-300"} text-sm text-center py-2`}>{c.success}</p>;
  }

  const inputClass = lightBackground
    ? "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-black placeholder-slate-500 outline-none focus:ring-2 focus:ring-slate-500/30"
    : "rounded-lg border border-white/30 bg-black/20 px-3 py-2 text-sm text-white placeholder-white/70 outline-none focus:ring-2 focus:ring-white/30";
  const secondaryButtonClass = lightBackground
    ? "rounded-lg border border-slate-300 px-3 py-2 text-xs text-black hover:bg-slate-100 disabled:opacity-50"
    : "rounded-lg border border-white/30 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50";
  const labelClass = lightBackground ? "text-xs text-slate-700" : "text-xs text-white/85";
  const errorClass = lightBackground ? "text-rose-700" : "text-red-300";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {canPickContact && (
        <button
          type="button"
          onClick={handlePickContact}
          className={`rounded-lg py-2.5 text-sm font-semibold ${lightBackground ? "bg-slate-800 text-white hover:bg-slate-900" : "bg-white text-slate-900 hover:bg-white/90"}`}
        >
          {c.useMyInfo}
        </button>
      )}
      <input
        required
        autoComplete="name"
        placeholder={c.name}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className={inputClass}
      />
      <input
        type="email"
        autoComplete="email"
        placeholder={c.email}
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        className={inputClass}
      />
      <input
        type="tel"
        autoComplete="tel"
        required={!form.email.trim()}
        placeholder={c.phone}
        value={form.phone}
        onChange={(e) => {
          const nextPhone = e.target.value;
          setForm((f) => ({ ...f, phone: nextPhone }));
          setOtpVerified(false);
          setOtpVerificationId(null);
          setOtpCode("");
          setOtpDebugCode(null);
          setOtpError(null);
        }}
        className={inputClass}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sendingOtp || !form.phone.trim()}
          className={secondaryButtonClass}
        >
          {sendingOtp ? "…" : c.sendCode}
        </button>
        {otpVerified && !phoneChangedAfterVerify ? (
          <span className="text-xs text-green-300">{c.phoneVerified}</span>
        ) : null}
      </div>
      {otpVerificationId ? (
        <div className="flex items-center gap-2">
          <input
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder={c.code}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleVerifyCode}
            disabled={verifyingOtp || !otpCode.trim()}
            className={secondaryButtonClass}
          >
            {verifyingOtp ? "…" : c.verifyCode}
          </button>
        </div>
      ) : null}
      {otpDebugCode ? (
        <p className="text-[11px] text-amber-200">{c.mockCode}: {otpDebugCode}</p>
      ) : null}
      {otpError ? <p className={`${errorClass} text-xs`}>{otpError}</p> : null}
      <textarea
        rows={3}
        placeholder={c.message}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        className={`${inputClass} resize-none`}
      />
      <label className={`flex items-start gap-2 ${labelClass}`}>
        <input
          type="checkbox"
          checked={form.consent_to_contact}
          onChange={(e) => setForm((f) => ({ ...f, consent_to_contact: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>{c.consent}</span>
      </label>
      {status === "error" && <p className={`${errorClass} text-xs`}>{c.error}</p>}
      <button
        type="submit"
        disabled={status === "sending" || !form.name.trim() || (!form.phone.trim() && !form.email.trim()) || !form.consent_to_contact}
        className="rounded-xl bg-blue-600 py-2 font-semibold text-sm text-white hover:bg-blue-700 transition disabled:opacity-50"
      >
        {status === "sending" ? "…" : c.send}
      </button>
    </form>
  );
}
