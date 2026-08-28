import { NextRequest, NextResponse } from "next/server";

const PROD_API_FALLBACK = "https://mdm-tapcard-api.fly.dev";

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveApiBaseUrl(): string {
  const envUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return normalizeBaseUrl(envUrl);
  return PROD_API_FALLBACK;
}

async function proxyToApi(request: NextRequest, paramsPromise: Promise<{ path: string[] }>) {
  const { path } = await paramsPromise;
  const apiBase = resolveApiBaseUrl();
  const targetPath = `/${path.join("/")}`;
  const targetUrl = `${apiBase}${targetPath}${request.nextUrl.search}`;

  const headers = new Headers();
  const incomingContentType = request.headers.get("content-type");
  const incomingAuthorization = request.headers.get("authorization");

  if (incomingAuthorization) headers.set("authorization", incomingAuthorization);
  if (incomingContentType) headers.set("content-type", incomingContentType);

  let body: BodyInit | undefined = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const buffer = await request.arrayBuffer();
    body = buffer.byteLength > 0 ? buffer : undefined;
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  const upstreamBuffer = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  const passHeaders = [
    "content-type",
    "content-disposition",
    "cache-control",
    "etag",
    "last-modified",
  ];

  for (const key of passHeaders) {
    const value = upstream.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }

  return new NextResponse(upstreamBuffer, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToApi(request, context.params);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToApi(request, context.params);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToApi(request, context.params);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToApi(request, context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToApi(request, context.params);
}
