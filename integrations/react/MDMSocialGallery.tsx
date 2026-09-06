"use client";

// Reusable MDM TapCard social gallery for client websites (React / Next.js).
// It only ever calls the site's own Netlify Function — never the MDM API or a
// social platform directly, and never sees the MDM API key.
//
// Usage:
//   <MDMSocialGallery limit={12} layout="masonry" />

import { useEffect, useState } from "react";

type GalleryItem = {
  id: string;
  platform: string;
  type: "image" | "video" | "carousel";
  imageUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  altText: string | null;
  postUrl: string | null;
  publishedAt: string | null;
  featured: boolean;
};

type GalleryResponse = {
  business: { id: string; slug: string; name: string };
  feed: { layout?: string; updatedAt: string | null };
  items: GalleryItem[];
};

export type MDMSocialGalleryProps = {
  limit?: number;
  layout?: "grid" | "masonry" | "carousel" | "featured-first";
  platform?: "instagram" | "facebook" | "tiktok";
  category?: string;
  linkToSource?: boolean;
  functionPath?: string;
};

export default function MDMSocialGallery({
  limit = 12,
  layout = "grid",
  platform,
  category,
  linkToSource = true,
  functionPath = "/.netlify/functions/mdm-gallery",
}: MDMSocialGalleryProps) {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (platform) params.set("platform", platform);
    if (category) params.set("category", category);

    (async () => {
      try {
        const res = await fetch(`${functionPath}?${params.toString()}`);
        if (!res.ok) throw new Error("request failed");
        const data: GalleryResponse = await res.json();
        if (!active) return;
        const list = layout === "featured-first"
          ? [...data.items].sort((a, b) => Number(b.featured) - Number(a.featured))
          : data.items;
        setItems(list);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [limit, platform, category, layout, functionPath]);

  if (status === "loading") return <GallerySkeleton count={Math.min(limit, 8)} layout={layout} />;

  if (status === "error") {
    return (
      <div className="mdm-gallery-state" role="alert">
        We couldn&apos;t load the gallery right now. Please check back soon.
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <div className="mdm-gallery-state">No photos to show yet — check back soon!</div>;
  }

  const containerClass =
    layout === "masonry"
      ? "mdm-gallery mdm-gallery--masonry"
      : layout === "carousel"
      ? "mdm-gallery mdm-gallery--carousel"
      : "mdm-gallery mdm-gallery--grid";

  return (
    <>
      <style>{GALLERY_CSS}</style>
      <div className={containerClass}>
        {items.map((item) => {
          const src = item.thumbnailUrl || item.imageUrl || "";
          const media = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={item.altText || item.caption || "Social media post"}
              loading="lazy"
              className="mdm-gallery__img"
            />
          );
          return (
            <figure key={item.id} className={`mdm-gallery__item${item.featured ? " is-featured" : ""}`}>
              {linkToSource && item.postUrl ? (
                <a href={item.postUrl} target="_blank" rel="noopener noreferrer">
                  {media}
                </a>
              ) : (
                media
              )}
              {item.caption ? <figcaption className="mdm-gallery__caption">{item.caption}</figcaption> : null}
            </figure>
          );
        })}
      </div>
    </>
  );
}

function GallerySkeleton({ count, layout }: { count: number; layout: string }) {
  return (
    <>
      <style>{GALLERY_CSS}</style>
      <div className={`mdm-gallery mdm-gallery--${layout === "masonry" ? "masonry" : "grid"}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="mdm-gallery__item mdm-gallery__skeleton" />
        ))}
      </div>
    </>
  );
}

const GALLERY_CSS = `
.mdm-gallery{gap:12px}
.mdm-gallery--grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.mdm-gallery--masonry{column-count:2;column-gap:12px}
@media(min-width:640px){.mdm-gallery--masonry{column-count:3}}
@media(min-width:1024px){.mdm-gallery--masonry{column-count:4}}
.mdm-gallery--masonry .mdm-gallery__item{break-inside:avoid;margin-bottom:12px}
.mdm-gallery--carousel{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}
.mdm-gallery--carousel .mdm-gallery__item{flex:0 0 70%;scroll-snap-align:start;margin-right:12px}
.mdm-gallery__item{margin:0;border-radius:12px;overflow:hidden;background:#f1f5f9}
.mdm-gallery__item.is-featured{outline:2px solid #f59e0b}
.mdm-gallery__img{display:block;width:100%;height:auto;object-fit:cover}
.mdm-gallery__caption{font-size:12px;color:#475569;padding:6px 8px}
.mdm-gallery__skeleton{aspect-ratio:1/1;animation:mdmPulse 1.4s ease-in-out infinite}
.mdm-gallery-state{padding:32px;text-align:center;color:#64748b;font-size:14px}
@keyframes mdmPulse{0%,100%{opacity:1}50%{opacity:.5}}
`;
