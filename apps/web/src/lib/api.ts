const PROD_API_FALLBACK = "https://mdm-tapcard-api.fly.dev";
const PROXY_PREFIX = "/api/proxy";

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

function proxied(path: string): string {
  return `${PROXY_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function apiRequest<T>(path: string, method: ApiMethod, body?: unknown): Promise<T> {
  const token = window.localStorage.getItem("access_token");
  if (!token) {
    throw new Error("No access token found. Please sign in again.");
  }

  const proxiedUrl = proxied(path);
  const directUrl = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const requestInit: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  };

  let response: Response;
  try {
    response = await fetch(proxiedUrl, requestInit);
    if (response.status === 405) {
      response = await fetch(directUrl, requestInit);
    }
  } catch {
    throw new Error(`Network error reaching API via ${PROXY_PREFIX} or direct API. Verify frontend deploy and backend health.`);
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
    throw new ApiError(response.status, detail);
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

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, "PUT", body);
}

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, "DELETE");
}

export async function apiDeleteJson<T>(path: string): Promise<T> {
  return apiRequest<T>(path, "DELETE");
}

// ── Admin gateway helpers ───────────────────────────────────────────────────

export async function listAdminCompanies<T = unknown[]>(): Promise<T> {
  return apiGet<T>("/api/v1/admin/companies");
}

export async function grantComplimentaryNfc(companyId: string, quantity = 1): Promise<void> {
  await apiPost(`/api/v1/admin/companies/${companyId}/complimentary-nfc`, { quantity });
}

export async function deleteCompany(companyId: string): Promise<void> {
  await apiDelete(`/api/v1/admin/companies/${companyId}`);
}

export async function cancelSignupSubscription(requestId: string): Promise<void> {
  await apiPost(`/api/v1/admin/signup-requests/${requestId}/cancel-subscription`, {});
}

export async function listNfcInventory<T = unknown[]>(): Promise<T> {
  return apiGet<T>("/api/v1/nfc/inventory");
}

export async function deleteNfcInventoryTag(tagId: string): Promise<void> {
  await apiDelete(`/api/v1/nfc/inventory/${tagId}`);
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

export async function createSignupRequestShippingLabel<
  T = { request_id: string; carrier: string; service: string; tracking_number: string; tracking_url: string | null; label_url: string; cost_cents: number | null }
>(requestId: string): Promise<T> {
  return apiPost<T>(`/api/v1/admin/signup-requests/${requestId}/shipping-label`, {});
}

export async function getAdminSystemStatus<T = { api_version: string; db_ok: boolean; alembic_revision?: string | null; server_time: string }>(): Promise<T> {
  return apiGet<T>("/api/v1/admin/system-status");
}

export async function getApiHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(proxied("/health"), { cache: "no-store", signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export type TemplateBackgroundInfo = {
  theme_id: string;
  image_url: string | null;
  position: string;
  size_mode: "cover" | "contain";
  opacity: number;
  overlay_color: string | null;
  overlay_opacity: number;
  text_color: string | null;
  lock_background: boolean;
};

export async function listTemplateBackgrounds(): Promise<TemplateBackgroundInfo[]> {
  return apiGet<TemplateBackgroundInfo[]>("/api/v1/admin/template-backgrounds");
}

export async function updateTemplateBackgroundSettings(
  themeId: string,
  updates: Partial<Pick<TemplateBackgroundInfo, "position" | "size_mode" | "opacity" | "overlay_color" | "overlay_opacity" | "text_color" | "lock_background">>
): Promise<TemplateBackgroundInfo> {
  return apiPut<TemplateBackgroundInfo>(`/api/v1/admin/template-backgrounds/${themeId}`, updates);
}

export async function deleteTemplateBackgroundImage(themeId: string): Promise<TemplateBackgroundInfo> {
  return apiDeleteJson<TemplateBackgroundInfo>(`/api/v1/admin/template-backgrounds/${themeId}/image`);
}

export async function uploadTemplateBackgroundImage(themeId: string, file: File): Promise<TemplateBackgroundInfo> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("No access token found. Please sign in again.");

  const form = new FormData();
  form.append("file", file);

  const path = `/api/v1/admin/template-backgrounds/${themeId}/image`;
  const proxiedUrl = proxied(path);
  const directUrl = `${BASE_URL}${path}`;

  let res = await fetch(proxiedUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (res.status === 405) {
    res = await fetch(directUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

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

  return (await res.json()) as TemplateBackgroundInfo;
}

export type ImportedTemplate = {
  id: string;
  name: string;
  layout: "classic" | "minimal" | "corporate" | "spotlight";
  palette: import("./templates").Palette;
  branding: Record<string, string>;
  locked: boolean;
  background: TemplateBackgroundInfo | null;
};

export async function importTemplateZip(file: File): Promise<ImportedTemplate> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("No access token found. Please sign in again.");
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(proxied("/api/v1/admin/templates/import-zip"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? "Could not import template ZIP.");
  }
  return (await response.json()) as ImportedTemplate;
}

export async function listReusableTemplates(): Promise<ImportedTemplate[]> {
  return apiGet<ImportedTemplate[]>("/api/v1/admin/templates");
}

export async function fetchProfile(slug: string) {
  const path = `/api/v1/profiles/${slug}`;
  const url = typeof window === "undefined" ? `${BASE_URL}${path}` : proxied(path);
  const res = await fetch(url, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export interface PaymentsConfig {
  application_id: string | null;
  location_id: string | null;
  environment: string;
  subscriptions_enabled: boolean;
}

export async function getPaymentsConfig(): Promise<PaymentsConfig> {
  const fallback: PaymentsConfig = {
    application_id: null,
    location_id: null,
    environment: "sandbox",
    subscriptions_enabled: false,
  };
  try {
    const res = await fetch(proxied("/api/v1/public/payments-config"), { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as PaymentsConfig;
  } catch {
    return fallback;
  }
}

export async function uploadLogo(file: File): Promise<string> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("No access token found. Please sign in again.");

  const form = new FormData();
  form.append("file", file);

  const path = "/api/v1/profiles/upload-logo";
  const proxiedUrl = proxied(path);
  const directUrl = `${BASE_URL}${path}`;

  let res = await fetch(proxiedUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (res.status === 405) {
    res = await fetch(directUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

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

export async function uploadProfileBackground(slug: string, file: File): Promise<import("./types").Profile> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("No access token found. Please sign in again.");

  const form = new FormData();
  form.append("file", file);

  const path = `/api/v1/profiles/${slug}/background`;
  const proxiedUrl = proxied(path);
  const directUrl = `${BASE_URL}${path}`;

  let res = await fetch(proxiedUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (res.status === 405) {
    res = await fetch(directUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

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

  return (await res.json()) as import("./types").Profile;
}

export async function deleteProfileBackground(slug: string): Promise<import("./types").Profile> {
  return apiDeleteJson<import("./types").Profile>(`/api/v1/profiles/${slug}/background`);
}

export async function trackEvent(payload: {
  profile_id: string;
  tag_token?: string;
  event_type: string;
  device_type?: string;
}) {
  await fetch(proxied("/api/v1/analytics/track"), {
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
  const res = await fetch(proxied("/api/v1/leads/"), {
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
  const res = await fetch(proxied("/api/v1/leads/otp/start"), {
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
  const res = await fetch(proxied("/api/v1/leads/otp/verify"), {
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

export async function submitSignupRequest(payload: {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  plan_interest?: string;
  service_interest: string;
  team_size?: string;
  quantity?: number;
  shipping_name?: string;
  shipping_company?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postal_code?: string;
  shipping_country?: string;
  notes?: string;
  card_source_id?: string;
}): Promise<{ request_id: string; submitted: boolean; message: string; payment_required?: boolean; checkout_url?: string | null; is_design_request?: boolean }> {
  const res = await fetch(proxied("/api/v1/public/signup-request"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "Could not submit signup request.";
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }

  return (await res.json()) as {
    request_id: string;
    submitted: boolean;
    message: string;
    payment_required?: boolean;
    checkout_url?: string | null;
    is_design_request?: boolean;
  };
}

export async function submitEnterpriseSignupRequest(payload: {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  user_count: number;
  billing: "monthly" | "annual";
  hardware: string;
  hardware_quantity?: number;
  shipping_name?: string;
  shipping_company?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postal_code?: string;
  shipping_country?: string;
  notes?: string;
  card_source_id?: string;
}): Promise<{ request_id: string; submitted: boolean; message: string; payment_required?: boolean; checkout_url?: string | null; is_design_request?: boolean }> {
  const res = await fetch(proxied("/api/v1/public/enterprise-signup-request"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "Could not submit enterprise request.";
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }

  return (await res.json()) as {
    request_id: string;
    submitted: boolean;
    message: string;
    payment_required?: boolean;
    checkout_url?: string | null;
    is_design_request?: boolean;
  };
}
