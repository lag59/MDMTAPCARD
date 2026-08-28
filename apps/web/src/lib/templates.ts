// Central registry of digital business card templates.
// A template = a layout (structure) + a palette (colors). Stored on the profile
// via `theme_id`. Custom uploaded templates use theme_id "custom" plus a JSON
// blob in `custom_theme`.

export type LayoutId = "classic" | "minimal" | "corporate" | "spotlight";

export interface Palette {
  /** Tailwind classes for the page background. */
  bg: string;
  /** Primary text color class. */
  text: string;
  /** Secondary/subtitle text color class. */
  sub: string;
  /** Card/glass surface classes. */
  glass: string;
  /** Save-contact button classes. */
  save: string;
  /** Secondary/inquiry button classes. */
  inquiry: string;
  /** Accent color classes (banners, dividers). */
  accent: string;
}

export interface CardTemplate {
  /** Stored in profile.theme_id. */
  id: string;
  name: string;
  description: string;
  layout: LayoutId;
  palette: Palette;
  /** Tailwind class for the swatch preview dot. */
  swatch: string;
  /** Grouping tag for the gallery. */
  category: "Classic" | "Minimal" | "Corporate" | "Spotlight";
}

// ── Palettes ────────────────────────────────────────────────────────────────

export const PALETTES: Record<string, Palette> = {
  dark: {
    bg: "bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950",
    text: "text-white",
    sub: "text-slate-300",
    glass: "bg-white/10 border border-white/15",
    save: "bg-white text-slate-900 hover:bg-slate-100",
    inquiry: "border border-white/30 text-white hover:bg-white/10",
    accent: "bg-slate-900",
  },
  ocean: {
    bg: "bg-gradient-to-b from-sky-500 via-blue-600 to-indigo-900",
    text: "text-white",
    sub: "text-sky-100",
    glass: "bg-white/15 border border-white/20",
    save: "bg-white text-blue-900 hover:bg-sky-50",
    inquiry: "border border-white/40 text-white hover:bg-white/15",
    accent: "bg-blue-700",
  },
  sunset: {
    bg: "bg-gradient-to-b from-amber-500 via-orange-600 to-rose-800",
    text: "text-white",
    sub: "text-orange-100",
    glass: "bg-white/15 border border-white/20",
    save: "bg-white text-orange-900 hover:bg-orange-50",
    inquiry: "border border-white/40 text-white hover:bg-white/15",
    accent: "bg-orange-700",
  },
  forest: {
    bg: "bg-gradient-to-b from-emerald-600 via-teal-700 to-emerald-950",
    text: "text-white",
    sub: "text-emerald-100",
    glass: "bg-white/15 border border-white/20",
    save: "bg-white text-emerald-900 hover:bg-emerald-50",
    inquiry: "border border-white/40 text-white hover:bg-white/15",
    accent: "bg-emerald-800",
  },
  midnight: {
    bg: "bg-gradient-to-b from-violet-800 via-purple-900 to-slate-950",
    text: "text-white",
    sub: "text-violet-300",
    glass: "bg-white/10 border border-white/15",
    save: "bg-white text-violet-900 hover:bg-violet-50",
    inquiry: "border border-white/30 text-white hover:bg-white/10",
    accent: "bg-violet-900",
  },
  light: {
    bg: "bg-gradient-to-b from-slate-100 to-white",
    text: "text-slate-900",
    sub: "text-slate-500",
    glass: "bg-white border border-slate-200 shadow-sm",
    save: "bg-slate-900 text-white hover:bg-slate-800",
    inquiry: "border border-slate-300 text-slate-700 hover:bg-slate-100",
    accent: "bg-slate-900",
  },
  rose: {
    bg: "bg-gradient-to-b from-rose-400 via-pink-500 to-fuchsia-800",
    text: "text-white",
    sub: "text-rose-100",
    glass: "bg-white/15 border border-white/20",
    save: "bg-white text-rose-900 hover:bg-rose-50",
    inquiry: "border border-white/40 text-white hover:bg-white/15",
    accent: "bg-rose-700",
  },
  gold: {
    bg: "bg-gradient-to-b from-yellow-600 via-amber-700 to-stone-900",
    text: "text-white",
    sub: "text-amber-100",
    glass: "bg-white/10 border border-amber-200/25",
    save: "bg-amber-300 text-stone-900 hover:bg-amber-200",
    inquiry: "border border-amber-200/40 text-amber-50 hover:bg-white/10",
    accent: "bg-amber-800",
  },
  mono: {
    bg: "bg-white",
    text: "text-neutral-900",
    sub: "text-neutral-500",
    glass: "bg-neutral-50 border border-neutral-200",
    save: "bg-neutral-900 text-white hover:bg-neutral-700",
    inquiry: "border border-neutral-300 text-neutral-700 hover:bg-neutral-100",
    accent: "bg-neutral-900",
  },
  aurora: {
    bg: "bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-700",
    text: "text-white",
    sub: "text-cyan-50",
    glass: "bg-white/15 border border-white/25",
    save: "bg-white text-indigo-900 hover:bg-indigo-50",
    inquiry: "border border-white/40 text-white hover:bg-white/15",
    accent: "bg-indigo-700",
  },
  brand: {
    bg: "bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-700",
    text: "text-white",
    sub: "text-cyan-50",
    glass: "bg-white/15 border border-white/25",
    save: "bg-white text-indigo-900 hover:bg-indigo-50",
    inquiry: "border border-white/40 text-white hover:bg-white/15",
    accent: "bg-indigo-700",
  },
  graphite: {
    bg: "bg-gradient-to-b from-zinc-800 to-zinc-950",
    text: "text-white",
    sub: "text-zinc-400",
    glass: "bg-white/5 border border-white/10",
    save: "bg-white text-zinc-900 hover:bg-zinc-100",
    inquiry: "border border-white/20 text-white hover:bg-white/10",
    accent: "bg-zinc-900",
  },
};

// ── Templates (layout + palette presets) ─────────────────────────────────────
// Classic template ids match palette ids for backward compatibility with
// existing profiles.

export const TEMPLATES: CardTemplate[] = [
  // Classic layout — the original gradient card.
  { id: "dark",     name: "Classic Dark",     description: "Deep slate gradient with glass panels.",  layout: "classic",   palette: PALETTES.dark,     swatch: "bg-slate-700",  category: "Classic" },
  { id: "ocean",    name: "Classic Ocean",    description: "Bright blue-to-indigo gradient.",         layout: "classic",   palette: PALETTES.ocean,    swatch: "bg-blue-500",   category: "Classic" },
  { id: "sunset",   name: "Classic Sunset",   description: "Warm amber-to-rose gradient.",            layout: "classic",   palette: PALETTES.sunset,   swatch: "bg-orange-500", category: "Classic" },
  { id: "forest",   name: "Classic Forest",   description: "Rich emerald-to-teal gradient.",          layout: "classic",   palette: PALETTES.forest,   swatch: "bg-emerald-600",category: "Classic" },
  { id: "midnight", name: "Classic Midnight", description: "Violet-to-purple night gradient.",        layout: "classic",   palette: PALETTES.midnight, swatch: "bg-violet-700", category: "Classic" },
  { id: "light",    name: "Classic Light",    description: "Clean light card on soft grey.",          layout: "classic",   palette: PALETTES.light,    swatch: "bg-slate-200 border border-slate-300", category: "Classic" },

  // Minimal layout — flat, quiet, generous whitespace.
  { id: "minimal-mono",  name: "Minimal Mono",   description: "Pure black & white, editorial feel.",    layout: "minimal",   palette: PALETTES.mono,     swatch: "bg-neutral-900", category: "Minimal" },
  { id: "minimal-light", name: "Minimal Soft",   description: "Airy light layout, subtle borders.",     layout: "minimal",   palette: PALETTES.light,    swatch: "bg-slate-100 border border-slate-300", category: "Minimal" },
  { id: "minimal-rose",  name: "Minimal Rose",   description: "Soft pink accents on white.",            layout: "minimal",   palette: PALETTES.rose,     swatch: "bg-rose-400", category: "Minimal" },

  // Corporate layout — colored header banner, left-aligned identity.
  { id: "corporate-ocean", name: "Corporate Ocean", description: "Blue banner header, business-ready.",  layout: "corporate", palette: PALETTES.ocean,    swatch: "bg-blue-600", category: "Corporate" },
  { id: "corporate-gold",  name: "Corporate Gold",  description: "Premium gold banner, dark base.",       layout: "corporate", palette: PALETTES.gold,     swatch: "bg-amber-600", category: "Corporate" },
  { id: "corporate-dark",  name: "Corporate Slate", description: "Neutral slate banner, professional.",   layout: "corporate", palette: PALETTES.dark,     swatch: "bg-slate-700", category: "Corporate" },

  // Spotlight layout — full-bleed hero with name overlaid.
  { id: "spotlight-aurora",   name: "Spotlight Aurora",   description: "Vivid aurora gradient hero.",     layout: "spotlight", palette: PALETTES.aurora,   swatch: "bg-indigo-500", category: "Spotlight" },
  { id: "spotlight-brand",    name: "My Brand Card",      description: "Custom cyan-indigo spotlight hero.", layout: "spotlight", palette: PALETTES.brand,    swatch: "bg-indigo-600", category: "Spotlight" },
  { id: "spotlight-midnight", name: "Spotlight Midnight", description: "Dramatic violet spotlight.",      layout: "spotlight", palette: PALETTES.midnight, swatch: "bg-violet-700", category: "Spotlight" },
  { id: "spotlight-graphite", name: "Spotlight Graphite", description: "Sleek graphite hero, high-end.",  layout: "spotlight", palette: PALETTES.graphite, swatch: "bg-zinc-800", category: "Spotlight" },
];

export const DEFAULT_TEMPLATE_ID = "dark";

// ── Custom templates ─────────────────────────────────────────────────────────

export interface CustomTheme {
  layout: LayoutId;
  palette: Palette;
  /** Optional full-bleed background image URL. */
  backgroundImage?: string;
  name?: string;
}

export function isValidCustomTheme(value: unknown): value is CustomTheme {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const layoutOk = ["classic", "minimal", "corporate", "spotlight"].includes(v.layout as string);
  const p = v.palette as Record<string, unknown> | undefined;
  const paletteOk =
    !!p &&
    typeof p.bg === "string" &&
    typeof p.text === "string" &&
    typeof p.sub === "string" &&
    typeof p.glass === "string" &&
    typeof p.save === "string" &&
    typeof p.inquiry === "string" &&
    typeof p.accent === "string";
  return layoutOk && paletteOk;
}

// ── Resolution ───────────────────────────────────────────────────────────────

export function getTemplateById(id?: string | null): CardTemplate {
  if (!id) return TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;
  const found = TEMPLATES.find((t) => t.id === id);
  if (found) return found;
  // Legacy/unknown id that matches a palette name → treat as classic.
  if (PALETTES[id]) {
    return { id, name: id, description: "", layout: "classic", palette: PALETTES[id], swatch: "bg-slate-700", category: "Classic" };
  }
  return TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;
}

/** Resolves the effective template + palette for a profile, honoring custom uploads. */
export function resolveTemplate(profile: { theme_id?: string | null; custom_theme?: string | null }): {
  layout: LayoutId;
  palette: Palette;
  backgroundImage?: string;
} {
  if (profile.theme_id === "custom" && profile.custom_theme) {
    try {
      const parsed = JSON.parse(profile.custom_theme);
      if (isValidCustomTheme(parsed)) {
        return { layout: parsed.layout, palette: parsed.palette, backgroundImage: parsed.backgroundImage };
      }
    } catch {
      // fall through to default
    }
  }
  const template = getTemplateById(profile.theme_id);
  return { layout: template.layout, palette: template.palette };
}
