import type { LayoutId, Palette } from "./templates";

// Shared API types used across the Next.js app

export interface TemplateBackground {
  image_url: string | null;
  position: string;
  size_mode: "cover" | "contain";
  opacity: number;
  overlay_color: string | null;
  overlay_opacity: number;
  text_color: string | null;
  lock_background: boolean;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  layout: LayoutId;
  palette: Palette;
  branding: Record<string, string>;
  locked: boolean;
}

export interface Profile {
  id: string;
  slug: string;
  display_name: string;
  title?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  biography?: string;
  photo_url?: string;
  whatsapp_number?: string;
  language: "en" | "es";
  theme_id?: string;
  custom_theme?: string;
  booking_url?: string;
  payment_url?: string;
  payment_label?: string;
  social_links: SocialLink[];
  profile_url: string;
  is_active: boolean;
  template_background?: TemplateBackground | null;
  template_definition?: TemplateDefinition | null;
}

export interface SocialLink {
  id: string;
  platform: "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube";
  url: string;
}

export interface NfcTag {
  id: string;
  tag_token: string;
  tag_uid?: string;
  tag_type?: string;
  capacity_bytes?: number;
  written_url?: string;
  status: "inventory" | "written" | "verified" | "activated" | "failed" | "replaced" | "locked";
  written_at?: string;
}

export interface Lead {
  id: string;
  profile_id: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  created_at: string;
}
