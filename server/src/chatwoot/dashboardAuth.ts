import { parse as parseCookie } from "cookie";
import type { Request } from "express";
import { dashboardHeaderNames, type DashboardAuthBundle } from "../types";

export function extractDashboardAuth(req: Request): DashboardAuthBundle | null {
  const headers = dashboardHeaderNames.reduce<Partial<DashboardAuthBundle>>((result, name) => {
    const value = req.header(name);
    if (value) result[name] = value;
    return result;
  }, {});
  if (hasBundle(headers)) return headers;

  const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
  const encoded = parseCookie(cookieHeader).cw_d_session_info;
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Record<string, string>;
    return hasBundle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasBundle(value: Partial<DashboardAuthBundle> | Record<string, string>): value is DashboardAuthBundle {
  return dashboardHeaderNames.every((name) => typeof value[name] === "string" && value[name]!.length > 0);
}
