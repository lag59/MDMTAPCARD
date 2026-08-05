const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const apiBaseUrl = BASE_URL;

type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function apiRequest<T>(path: string, method: ApiMethod, body?: unknown): Promise<T> {
  const token = window.localStorage.getItem("access_token");
  if (!token) {
    throw new Error("No access token found. Please sign in again.");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

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

export async function fetchProfile(slug: string) {
  const res = await fetch(`${BASE_URL}/api/v1/profiles/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
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
  name: string;
  email?: string;
  phone?: string;
  message?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/v1/leads/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}
