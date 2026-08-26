"use client";

import type { Profile } from "@/lib/types";
import ProfileCard from "./ProfileCard";

const SAMPLE: Profile = {
  id: "preview",
  slug: "preview",
  display_name: "Alex Rivera",
  title: "Founder & CEO",
  phone: "+1 555 0100",
  email: "alex@example.com",
  website: "https://example.com",
  address: "Miami, FL",
  biography: "Helping brands grow with tap-to-share networking and beautifully simple digital cards.",
  photo_url: "",
  whatsapp_number: "+15550100",
  language: "en",
  social_links: [
    { id: "1", platform: "instagram", url: "#" },
    { id: "2", platform: "linkedin", url: "#" },
  ],
  profile_url: "#",
  is_active: true,
};

interface Props {
  /** Overrides applied to the sample profile (theme_id / custom_theme, etc.). */
  overrides: Partial<Profile>;
  /** Rendered width of the frame in pixels. */
  width?: number;
  /** Rendered height of the frame in pixels. */
  height?: number;
}

/** Renders a scaled, non-interactive thumbnail of a card template. */
export default function TemplatePreview({ overrides, width = 240, height = 420 }: Props) {
  const CARD_WIDTH = 384; // Tailwind max-w-sm
  const scale = width / CARD_WIDTH;
  const profile: Profile = { ...SAMPLE, ...overrides };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
      style={{ width, height }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left pointer-events-none"
        style={{ transform: `scale(${scale})`, width: CARD_WIDTH }}
      >
        <ProfileCard profile={profile} preview />
      </div>
    </div>
  );
}
