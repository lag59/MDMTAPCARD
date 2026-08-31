import { NextRequest, NextResponse } from "next/server";

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
  const apiBase = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const profileRes = await fetch(
    `${apiBase}/api/v1/profiles/${slug}`,
    { next: { revalidate: 60 } }
  );

  if (!profileRes.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const profile = (await profileRes.json()) as { id?: string };
  const ua = req.headers.get("user-agent") ?? "";
  const vcardFallback = () => NextResponse.redirect(new URL(`/api/vcard/${slug}?download=1`, req.url));

  if (!profile.id) {
    return vcardFallback();
  }

  if (isIOS(ua)) {
    // Fetched here (not redirected) so a backend error can fall back to the
    // vCard download instead of surfacing a raw error to the visitor.
    try {
      const passRes = await fetch(`${apiBase}/api/v1/profiles/${profile.id}/wallet/apple`, { cache: "no-store" });
      if (passRes.ok) {
        const buffer = await passRes.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": passRes.headers.get("content-type") ?? "application/vnd.apple.pkpass",
            "Content-Disposition":
              passRes.headers.get("content-disposition") ?? `attachment; filename="mdm-tapcard-${slug}.pkpass"`,
          },
        });
      }
    } catch {
      // fall through to vCard fallback below
    }
    return vcardFallback();
  }

  if (isAndroid(ua)) {
    // Same pattern: fetch server-side so a backend/config error falls back
    // to the vCard download instead of redirecting to a broken save link.
    try {
      const passRes = await fetch(`${apiBase}/api/v1/profiles/${profile.id}/wallet/google`, { cache: "no-store" });
      if (passRes.ok) {
        const { saveUrl } = (await passRes.json()) as { saveUrl?: string };
        if (saveUrl) {
          return NextResponse.redirect(saveUrl);
        }
      }
    } catch {
      // fall through to vCard fallback below
    }
    return vcardFallback();
  }

  return vcardFallback();
}

