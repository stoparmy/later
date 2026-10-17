export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function apiFetch<T>(url: string, init: RequestInit = {}, auth?: Record<string, string>): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(auth || {})) headers.set(name, value);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(response.status, payload.error || "request_failed");
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function embeddedApiBase() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const mount = segments.length ? `/${segments[0]}` : "";
  return `${mount}/api/embedded`;
}

export function queryUrl(path: string, values: Record<string, string | number>) {
  return `${path}?${new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString()}`;
}
