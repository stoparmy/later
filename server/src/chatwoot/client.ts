import { config } from "../config";
import { HttpError } from "../errors";
import { dashboardHeaderNames, type DashboardAuthBundle } from "../types";

export async function dashboardFetchJson(path: string, auth: DashboardAuthBundle, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  for (const name of dashboardHeaderNames) headers.set(name, auth[name]);
  return fetchJson(path, { ...init, headers });
}

export async function appFetchJson(path: string, init: RequestInit = {}) {
  if (!config.chatwootAppToken) throw new HttpError(500, "chatwoot_app_token_missing");
  const headers = new Headers(init.headers);
  headers.set("api_access_token", config.chatwootAppToken);
  return fetchJson(path, { ...init, headers });
}

async function fetchJson(path: string, init: RequestInit) {
  const response = await fetch(`${config.chatwootBaseUrl}${path}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(config.chatwootRequestTimeoutMs),
  });
  const body = await response.text();
  let payload: unknown = null;
  if (body) {
    try { payload = JSON.parse(body); } catch { payload = body; }
  }
  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.status === 401 ? "chatwoot_auth_rejected" : "chatwoot_request_failed",
      `Chatwoot request failed (${response.status})`,
      { path, payload },
    );
  }
  return payload;
}
