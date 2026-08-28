import type { Profile } from "@/lib/types";

const labels = {
  en: { call: "Call", text: "Text", email: "Email" },
  es: { call: "Llamar", text: "Mensaje", email: "Correo" },
};

interface Props {
  profile: Profile;
  lang: "en" | "es";
  textClass?: string;
  highContrast?: boolean;
}

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export default function ContactButtons({ profile, lang, textClass = "text-white", highContrast = false }: Props) {
  const l = labels[lang];
  const dialPhone = profile.phone ? normalizePhone(profile.phone) : "";
  const telHref = dialPhone ? `tel:${dialPhone}` : undefined;
  const smsHref = dialPhone ? `sms:${dialPhone}` : undefined;
  const base = highContrast
    ? "flex flex-col items-center gap-1 rounded-xl border border-slate-300 bg-slate-100/80 py-3 text-sm font-medium text-slate-800 hover:bg-slate-200/80 transition"
    : `flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3 text-sm font-medium ${textClass} hover:bg-white/20 transition`;
  const badge = highContrast ? "text-[11px] uppercase tracking-wide text-slate-500" : "text-xs uppercase tracking-wide";

  return (
    <div className="grid grid-cols-3 gap-3">
      {profile.phone && telHref && (
        <a
          href={telHref}
          className={base}
          aria-label={`${l.call} ${profile.phone}`}
        >
          <span className={badge}>tel</span>
          {l.call}
        </a>
      )}
      {profile.phone && smsHref && (
        <a
          href={smsHref}
          className={base}
          aria-label={`${l.text} ${profile.phone}`}
        >
          <span className={badge}>sms</span>
          {l.text}
        </a>
      )}
      {profile.email && (
        <a
          href={`mailto:${profile.email}`}
          className={base}
        >
          <span className={badge}>mail</span>
          {l.email}
        </a>
      )}
    </div>
  );
}
