import type { Profile } from "@/lib/types";

const labels = {
  en: { call: "Call", text: "Text", email: "Email" },
  es: { call: "Llamar", text: "Mensaje", email: "Correo" },
};

interface Props {
  profile: Profile;
  lang: "en" | "es";
}

export default function ContactButtons({ profile, lang }: Props) {
  const l = labels[lang];
  return (
    <div className="grid grid-cols-3 gap-3">
      {profile.phone && (
        <a
          href={`tel:${profile.phone}`}
          className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3 text-sm font-medium hover:bg-white/20 transition"
        >
          <span className="text-xs uppercase tracking-wide">tel</span>
          {l.call}
        </a>
      )}
      {profile.phone && (
        <a
          href={`sms:${profile.phone}`}
          className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3 text-sm font-medium hover:bg-white/20 transition"
        >
          <span className="text-xs uppercase tracking-wide">sms</span>
          {l.text}
        </a>
      )}
      {profile.email && (
        <a
          href={`mailto:${profile.email}`}
          className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3 text-sm font-medium hover:bg-white/20 transition"
        >
          <span className="text-xs uppercase tracking-wide">mail</span>
          {l.email}
        </a>
      )}
    </div>
  );
}
