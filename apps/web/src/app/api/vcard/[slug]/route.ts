import { NextRequest, NextResponse } from "next/server";

// Generates a vCard 3.0 file for the given profile slug so browsers can "Save Contact"
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  const apiRes = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/profiles/${slug}`,
    { next: { revalidate: 60 } }
  );

  if (!apiRes.ok) {
    return new NextResponse("Not found", { status: 404 });
  }

  const p = await apiRes.json();
  const escapeVCard = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");

  const normalizeUrl = (value?: string) => {
    if (!value) return null;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  };

  const website = normalizeUrl(p.website);
  const photo = normalizeUrl(p.photo_url);

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(p.display_name ?? "")}`,
    p.title ? `TITLE:${escapeVCard(p.title)}` : null,
    p.phone ? `TEL;TYPE=CELL:${escapeVCard(p.phone)}` : null,
    p.email ? `EMAIL:${escapeVCard(p.email)}` : null,
    website ? `URL:${escapeVCard(website)}` : null,
    p.address ? `ADR;TYPE=WORK:;;${escapeVCard(p.address)};;;;` : null,
    p.biography ? `NOTE:${escapeVCard(p.biography)}` : null,
    photo ? `PHOTO;VALUE=URI:${escapeVCard(photo)}` : null,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `${disposition}; filename="${slug}.vcf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
