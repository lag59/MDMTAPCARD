import { NextRequest, NextResponse } from "next/server";

// Generates a vCard 3.0 file for the given profile slug so browsers can "Save Contact"
export async function GET(
  _req: NextRequest,
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

  const p = await apiRes.json();

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${p.display_name}`,
    p.title ? `TITLE:${p.title}` : null,
    p.phone ? `TEL;TYPE=CELL:${p.phone}` : null,
    p.email ? `EMAIL:${p.email}` : null,
    p.website ? `URL:${p.website}` : null,
    p.address ? `ADR;TYPE=WORK:;;${p.address};;;;` : null,
    p.biography ? `NOTE:${p.biography.replace(/\n/g, "\\n")}` : null,
    p.photo_url ? `PHOTO;VALUE=URI:${p.photo_url}` : null,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.vcf"`,
    },
  });
}
