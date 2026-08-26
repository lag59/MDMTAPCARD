"use client";

import type { Profile } from "@/lib/types";
import { apiBaseUrl } from "@/lib/api";
import { resolveTemplate } from "@/lib/templates";

interface Props {
  profile: Profile;
}

/** Print-ready 3.5in x 2in business card (front + back). */
export default function PrintableCard({ profile }: Props) {
  const { palette } = resolveTemplate(profile);
  const qrUrl = `${apiBaseUrl}/api/v1/profiles/qr/${profile.slug}`;
  const initials = profile.display_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const card = "relative w-[3.5in] h-[2in] rounded-lg overflow-hidden shadow-lg print:shadow-none bg-white border border-slate-200";

  return (
    <div className="flex flex-wrap gap-6 justify-center">
      {/* FRONT */}
      <div className={card}>
        <div className={`absolute inset-y-0 left-0 w-2 ${palette.accent}`} />
        <div className="h-full flex items-center gap-4 pl-8 pr-6">
          {profile.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photo_url} alt={profile.display_name} className="w-20 h-20 rounded-full object-cover ring-2 ring-slate-200" />
          ) : (
            <div className={`w-20 h-20 rounded-full ${palette.accent} flex items-center justify-center`}>
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">{profile.display_name}</h2>
            {profile.title && <p className="text-xs text-slate-500 truncate">{profile.title}</p>}
            <div className="mt-2 space-y-0.5">
              {profile.phone && <p className="text-[10px] text-slate-600">{profile.phone}</p>}
              {profile.email && <p className="text-[10px] text-slate-600 truncate">{profile.email}</p>}
              {profile.website && (
                <p className="text-[10px] text-slate-600 truncate">{profile.website.replace(/^https?:\/\//, "")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BACK */}
      <div className={card}>
        <div className={`absolute inset-x-0 top-0 h-2 ${palette.accent}`} />
        <div className="h-full flex items-center justify-between px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Scan to connect</p>
            <h3 className="text-base font-bold text-slate-900 mt-1 truncate">{profile.display_name}</h3>
            {profile.address && <p className="text-[10px] text-slate-500 mt-1 max-w-[1.6in]">{profile.address}</p>}
            <p className="text-[9px] text-slate-400 mt-3">Powered by MDM TapCard</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR code" className="w-24 h-24 shrink-0" />
        </div>
      </div>
    </div>
  );
}
