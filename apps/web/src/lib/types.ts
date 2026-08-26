// Shared API types used across the Next.js app

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
