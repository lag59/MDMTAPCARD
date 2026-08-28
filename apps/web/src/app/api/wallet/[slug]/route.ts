import { NextRequest, NextResponse } from "next/server";

function normalizeBase(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function appendSlug(base: string, slug: string): string {
  const normalized = normalizeBase(base);
  return normalized.includes("{slug}")
    ? normalized.replaceAll("{slug}", encodeURIComponent(slug))
    : `${normalized}/${encodeURIComponent(slug)}`;
}

function isIOS(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const apiRes = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/profiles/${slug}`,
    { next: { revalidate: 60 } }
  );

  if (!apiRes.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const appleBase = process.env.NEXT_PUBLIC_APPLE_WALLET_BASE_URL;
  const googleBase = process.env.NEXT_PUBLIC_GOOGLE_WALLET_BASE_URL;

  if (isIOS(ua) && appleBase) {
    return NextResponse.redirect(appendSlug(appleBase, slug));
  }

  if (isAndroid(ua) && googleBase) {
    return NextResponse.redirect(appendSlug(googleBase, slug));
  }

  if (appleBase) {
    return NextResponse.redirect(appendSlug(appleBase, slug));
  }

  if (googleBase) {
    return NextResponse.redirect(appendSlug(googleBase, slug));
  }

  // Fallback: save contact if wallet providers are not configured yet.
  return NextResponse.redirect(new URL(`/api/vcard/${slug}?download=1`, req.url));
}
