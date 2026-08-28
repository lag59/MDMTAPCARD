"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import { apiBaseUrl, trackEvent } from "@/lib/api";
import { resolveTemplate, type LayoutId, type Palette } from "@/lib/templates";
import ContactButtons from "./ContactButtons";
import SocialLinks from "./SocialLinks";
import LeadForm from "./LeadForm";

const i18n = {
  en: {
    saveContact: "Save Contact",
    saveFallback: "Having trouble saving? Download .VCF",
    addToWallet: "Add to Wallet",
    contactInfo: "Contact Info",
    phone: "Phone",
    email: "Email",
    website: "Website",
    address: "Address",
    inquiry: "Send Inquiry",
    about: "About",
    connect: "Connect",
    socialProfiles: "Social Profiles",
    scan: "Scan to share this card",
    book: "Book an Appointment",
    pay: "Pay Now",
  },
  es: {
    saveContact: "Guardar Contacto",
    saveFallback: "¿Problemas para guardar? Descarga .VCF",
    addToWallet: "Agregar a Wallet",
    contactInfo: "Información de Contacto",
    phone: "Teléfono",
    email: "Correo",
    website: "Sitio Web",
    address: "Dirección",
    inquiry: "Enviar Consulta",
    about: "Acerca de",
    connect: "Conectar",
    socialProfiles: "Redes Sociales",
    scan: "Escanear para compartir",
    book: "Reservar una Cita",
    pay: "Pagar Ahora",
  },
};

interface Props {
  profile: Profile;
  tagToken?: string;
  /** Renders a non-interactive, self-contained preview (used in the gallery). */
  preview?: boolean;
}

export default function ProfileCard({ profile, tagToken, preview = false }: Props) {
  const lang = (profile.language === "es" ? "es" : "en") as "en" | "es";
  const copy = i18n[lang];
  const { layout, palette, backgroundImage } = resolveTemplate(profile);
  const [showForm, setShowForm] = useState(false);

  const paletteSurface = `${palette.bg} ${palette.glass}`.toLowerCase();
  const paletteText = `${palette.text} ${palette.sub}`.toLowerCase();
  const looksLightSurface = /(bg-white|from-white|to-white|via-white|slate-50|slate-100|neutral-50|zinc-50)/.test(
    paletteSurface
  );
  const asksForWhiteText = /text-white/.test(paletteText);
  const useHighContrastDarkText = looksLightSurface && asksForWhiteText;

  const textClass = useHighContrastDarkText ? "text-slate-900" : palette.text;
  const subClass = useHighContrastDarkText ? "text-slate-600" : palette.sub;
  const inquiryClass = useHighContrastDarkText
    ? "border border-slate-300 text-slate-800 hover:bg-slate-100"
    : palette.inquiry;
  const sectionCardClass = useHighContrastDarkText
    ? "bg-white/90 border border-slate-200 shadow-sm"
    : palette.glass;

  useEffect(() => {
    if (preview) return;
    trackEvent({
      profile_id: profile.id,
      tag_token: tagToken,
      event_type: tagToken ? "nfc_tap" : "direct_visit",
      device_type:
        typeof navigator !== "undefined"
          ? /iPhone|iPad|Android/i.test(navigator.userAgent)
            ? "mobile"
            : "desktop"
          : undefined,
    });
  }, [profile.id, tagToken, preview]);

  const vcardUrl = `/api/vcard/${profile.slug}`;
  const vcardDownloadUrl = `/api/vcard/${profile.slug}?download=1`;
  const walletUrl = `/api/wallet/${profile.slug}`;
  const qrUrl = `${apiBaseUrl}/api/v1/profiles/qr/${profile.slug}`;
  const initials = profile.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const hasContactDetails = !!(profile.phone || profile.email || profile.website || profile.address);
  const hasSocialDetails = (profile.social_links?.length ?? 0) > 0;

  const renderAvatar = (size: string) =>
    profile.photo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.photo_url}
        alt={profile.display_name}
        className={`${size} rounded-full object-cover ring-4 ring-white/30 shadow-2xl`}
      />
    ) : (
      <div className={`${size} rounded-full bg-white/20 flex items-center justify-center shadow-2xl ring-4 ring-white/20`}>
        <span className={`text-4xl font-bold ${textClass} opacity-80`}>{initials}</span>
      </div>
    );

  // ── Header variants per layout ────────────────────────────────────────────
  const header = (() => {
    switch (layout) {
      case "minimal":
        return (
          <div className="flex flex-col items-center pt-14 pb-8 px-6 text-center">
            {renderAvatar("w-24 h-24")}
            <h1 className={`mt-5 text-2xl font-semibold tracking-tight ${textClass}`}>{profile.display_name}</h1>
            {profile.title && <p className={`mt-1 text-sm ${subClass}`}>{profile.title}</p>}
            <div className={`mt-4 h-px w-12 ${palette.accent} opacity-40`} />
            {profile.website && (
              <a
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-3 text-xs ${subClass} hover:opacity-100 opacity-75 transition`}
              >
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        );
      case "corporate":
        return (
          <div className="relative">
            <div className={`h-28 ${palette.accent}`} />
            <div className="px-6 -mt-12 flex items-end gap-4">
              {renderAvatar("w-24 h-24")}
              <div className="pb-1">
                <h1 className={`text-2xl font-bold tracking-tight ${textClass}`}>{profile.display_name}</h1>
                {profile.title && <p className={`text-sm font-medium ${subClass}`}>{profile.title}</p>}
              </div>
            </div>
            {(profile.website || profile.address) && (
              <div className="px-6 mt-3 space-y-0.5">
                {profile.website && (
                  <a
                    href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-xs ${subClass} opacity-80 hover:opacity-100 transition`}
                  >
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {profile.address && <p className={`text-xs ${subClass} opacity-60`}>{profile.address}</p>}
              </div>
            )}
          </div>
        );
      case "spotlight":
        return (
          <div className="relative flex flex-col items-center justify-end text-center px-6 pt-24 pb-10 min-h-[20rem]">
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="relative z-10 flex flex-col items-center">
              {renderAvatar("w-36 h-36")}
              <h1 className={`mt-5 text-4xl font-extrabold tracking-tight ${textClass} drop-shadow`}>
                {profile.display_name}
              </h1>
              {profile.title && <p className={`mt-2 text-base font-medium ${subClass}`}>{profile.title}</p>}
              {profile.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 text-xs ${subClass} opacity-80 hover:opacity-100 transition`}
                >
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        );
      case "classic":
      default:
        return (
          <div className="flex flex-col items-center pt-14 pb-10 px-6 text-center">
            <div className="mb-5">
              {renderAvatar("w-32 h-32")}
            </div>
            <h1 className={`text-3xl font-bold tracking-tight ${textClass}`}>{profile.display_name}</h1>
            {profile.title && <p className={`mt-1.5 text-base font-medium ${subClass}`}>{profile.title}</p>}
            {profile.website && (
              <a
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-2 text-xs ${subClass} opacity-75 hover:opacity-100 transition`}
              >
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {profile.address && <p className={`mt-1 text-xs ${subClass} opacity-60`}>{profile.address}</p>}
          </div>
        );
    }
  })();

  // ── Shared body sections ──────────────────────────────────────────────────
  const body = (
    <div className="px-4 flex flex-col gap-3">
      {hasContactDetails && (
        <div className={`${sectionCardClass} rounded-2xl p-4`}>
          <h2 className={`text-xs font-semibold uppercase tracking-widest ${subClass} mb-3`}>{copy.contactInfo}</h2>
          <div className="space-y-2">
            {profile.phone && (
              <a href={preview ? undefined : `tel:${profile.phone}`} className="block">
                <p className={`text-[11px] uppercase tracking-wide ${subClass} opacity-80`}>{copy.phone}</p>
                <p className={`text-sm ${textClass}`}>{profile.phone}</p>
              </a>
            )}
            {profile.email && (
              <a href={preview ? undefined : `mailto:${profile.email}`} className="block">
                <p className={`text-[11px] uppercase tracking-wide ${subClass} opacity-80`}>{copy.email}</p>
                <p className={`text-sm ${textClass} break-all`}>{profile.email}</p>
              </a>
            )}
            {profile.website && (
              <a
                href={preview ? undefined : (profile.website.startsWith("http") ? profile.website : `https://${profile.website}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <p className={`text-[11px] uppercase tracking-wide ${subClass} opacity-80`}>{copy.website}</p>
                <p className={`text-sm ${textClass} break-all`}>{profile.website.replace(/^https?:\/\//, "")}</p>
              </a>
            )}
            {profile.address && (
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${subClass} opacity-80`}>{copy.address}</p>
                <p className={`text-sm ${textClass}`}>{profile.address}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`${sectionCardClass} rounded-2xl p-4`}>
        <ContactButtons profile={profile} lang={lang} textClass={textClass} highContrast={useHighContrastDarkText} />
      </div>

      <a
        href={preview ? undefined : vcardUrl}
        className={`flex items-center justify-center gap-2 rounded-2xl ${palette.save} font-semibold py-4 text-sm shadow-md transition`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        {copy.saveContact}
      </a>

      {!preview && (
        <a
          href={walletUrl}
          className={`flex items-center justify-center gap-2 rounded-2xl ${inquiryClass} font-semibold py-4 text-sm transition`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          {copy.addToWallet}
        </a>
      )}

      {!preview && (
        <a
          href={vcardDownloadUrl}
          className={`text-center text-xs ${subClass} hover:opacity-100 opacity-80 underline underline-offset-2`}
        >
          {copy.saveFallback}
        </a>
      )}

      {profile.whatsapp_number && (
        <a
          href={preview ? undefined : `https://wa.me/${profile.whatsapp_number.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-semibold py-4 text-sm shadow-md transition"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </a>
      )}

      {profile.booking_url && (
        <a
          href={preview ? undefined : (profile.booking_url.startsWith("http") ? profile.booking_url : `https://${profile.booking_url}`)}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 rounded-2xl ${palette.save} font-semibold py-4 text-sm shadow-md transition`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {copy.book}
        </a>
      )}

      {profile.payment_url && (
        <a
          href={preview ? undefined : (profile.payment_url.startsWith("http") ? profile.payment_url : `https://${profile.payment_url}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 text-sm shadow-md transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          {profile.payment_label || copy.pay}
        </a>
      )}

      {profile.biography && (
        <div className={`${sectionCardClass} rounded-2xl p-4`}>
          <h2 className={`text-xs font-semibold uppercase tracking-widest ${subClass} mb-2`}>{copy.about}</h2>
          <p className={`${textClass} text-sm leading-relaxed opacity-90`}>{profile.biography}</p>
        </div>
      )}

      {profile.social_links?.length > 0 && (
        <div className={`${sectionCardClass} rounded-2xl p-4`}>
          <h2 className={`text-xs font-semibold uppercase tracking-widest ${subClass} mb-3`}>{copy.connect}</h2>
          {hasSocialDetails && (
            <div className="mb-3 space-y-2">
              <h3 className={`text-[11px] uppercase tracking-wide ${subClass} opacity-80`}>{copy.socialProfiles}</h3>
              {profile.social_links.map((link) => {
                const href = link.url.startsWith("http") ? link.url : `https://${link.url}`;
                const display = link.url.replace(/^https?:\/\//, "");
                return (
                  <a
                    key={`detail-${link.id}`}
                    href={preview ? undefined : href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <p className={`text-[11px] uppercase tracking-wide ${subClass} opacity-80`}>{link.platform}</p>
                    <p className={`text-sm ${textClass} break-all`}>{display}</p>
                  </a>
                );
              })}
            </div>
          )}
          <SocialLinks links={profile.social_links} />
        </div>
      )}

      {!preview && (
        <div className={`${sectionCardClass} rounded-2xl p-6 flex flex-col items-center gap-3`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR code" className="w-44 h-44 rounded-xl bg-white p-2 shadow-md" />
          <p className={`text-xs ${subClass} text-center`}>{copy.scan}</p>
        </div>
      )}

      <button
        onClick={() => !preview && setShowForm((v) => !v)}
        className={`rounded-2xl ${inquiryClass} py-4 font-semibold text-sm transition`}
      >
        {copy.inquiry}
      </button>
      {showForm && !preview && <LeadForm profileId={profile.id} lang={lang} />}
    </div>
  );

  const bgStyle = backgroundImage
    ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;
  const bgClass = backgroundImage ? "" : palette.bg;

  return (
    <main className={`min-h-screen ${bgClass} flex justify-center pb-16`} style={bgStyle}>
      <div className="w-full max-w-sm">
        {header}
        {body}
        <p className={`text-center text-xs ${subClass} opacity-40 mt-8 mb-4`}>Powered by MDM TapCard</p>
      </div>
    </main>
  );
}

export type { LayoutId, Palette };
