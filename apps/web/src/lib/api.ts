const PROD_API_FALLBACK = "https://mdm-tapcard-api.fly.dev";

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (envUrl) {
    return normalizeBaseUrl(envUrl);
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000";
    }
  }

  return PROD_API_FALLBACK;
}

const BASE_URL = resolveApiBaseUrl();

export const apiBaseUrl = BASE_URL;

type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function apiRequest<T>(path: string, method: ApiMethod, body?: unknown): Promise<T> {
  const token = window.localStorage.getItem("access_token");
  if (!token) {
    throw new Error("No access token found. Please sign in again.");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error(`Network error reaching API at ${BASE_URL}. Verify frontend env vars, CORS, and backend health.`);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as { detail?: string };
      if (errorBody?.detail) {
        detail = errorBody.detail;
      }
    } catch {
      // Keep fallback detail when response is not JSON.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, "GET");
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, "POST", body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, "PATCH", body);
}

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, "DELETE");
}

// ── Admin gateway helpers ───────────────────────────────────────────────────

export async function listAdminCompanies<T = unknown[]>(): Promise<T> {
  return apiGet<T>("/api/v1/admin/companies");
}

export async function grantComplimentaryNfc(companyId: string, quantity = 1): Promise<void> {
  await apiPost(`/api/v1/admin/companies/${companyId}/complimentary-nfc`, { quantity });
}

export async function listNfcInventory<T = unknown[]>(): Promise<T> {
  return apiGet<T>("/api/v1/nfc/inventory");
}

export async function updateNfcCardNumber<T = { tag_id: string; card_number: string | null }>(
  tagId: string,
  cardNumber: string
): Promise<T> {
  return apiPatch<T>(`/api/v1/nfc/${tagId}`, { card_number: cardNumber });
}

export async function createSquareCheckout<T = { checkout_url: string }>(orderId: string): Promise<T> {
  return apiPost<T>(`/api/v1/admin/orders/${orderId}/square-checkout`, {});
}

export async function getAdminSystemStatus<T = { api_version: string; db_ok: boolean; alembic_revision?: string | null; server_time: string }>(): Promise<T> {
  return apiGet<T>("/api/v1/admin/system-status");
}

export async function fetchProfile(slug: string) {
  const res = await fetch(`${BASE_URL}/api/v1/profiles/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function uploadLogo(file: File): Promise<string> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("No access token found. Please sign in again.");

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/api/v1/profiles/upload-logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // keep fallback
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function trackEvent(payload: {
  profile_id: string;
  tag_token?: string;
  event_type: string;
  device_type?: string;
}) {
  await fetch(`${BASE_URL}/api/v1/analytics/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function submitLead(payload: {
  profile_id: string;
  tag_token?: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  consent_to_contact: boolean;
  consent_text?: string;
  phone_verification_id?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/leads/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export async function startLeadPhoneOtp(payload: {
  profile_id: string;
  tag_token?: string;
  phone: string;
}): Promise<{ verification_id: string; expires_at: string; provider: string; debug_code?: string | null }> {
  const res = await fetch(`${BASE_URL}/api/v1/leads/otp/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = "Could not send verification code.";
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }
  return (await res.json()) as { verification_id: string; expires_at: string; provider: string; debug_code?: string | null };
}

export async function verifyLeadPhoneOtp(payload: {
  verification_id: string;
  code: string;
}): Promise<{ verified: boolean }> {
  const res = await fetch(`${BASE_URL}/api/v1/leads/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = "Could not verify code.";
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }
  return (await res.json()) as { verified: boolean };
}
