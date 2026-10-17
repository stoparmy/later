import type { NextFunction, Request, Response } from "express";
import { dashboardFetchJson } from "./chatwoot/client";
import { extractDashboardAuth } from "./chatwoot/dashboardAuth";
import { HttpError } from "./errors";
import type { DashboardActor } from "./types";

export async function requireDashboardActor(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = extractDashboardAuth(req);
    if (!auth) throw new HttpError(401, "chatwoot_auth_missing");
    await dashboardFetchJson("/auth/validate_token", auth);
    const profile = await dashboardFetchJson("/api/v1/profile", auth);
    req.laterActor = parseActor(profile);
    req.laterDashboardAuth = auth;
    next();
  } catch (error) {
    next(error);
  }
}

export function actorFrom(req: Request) {
  if (!req.laterActor) throw new HttpError(500, "missing_actor");
  return req.laterActor;
}

export function dashboardAuthFrom(req: Request) {
  if (!req.laterDashboardAuth) throw new HttpError(500, "chatwoot_auth_missing");
  return req.laterDashboardAuth;
}

function parseActor(input: unknown): DashboardActor {
  const record = asRecord(input);
  const account = asRecord(record?.account);
  const id = positiveInt(record?.id);
  const accountId = positiveInt(account?.id ?? record?.account_id);
  const email = stringValue(record?.email);
  const name = stringValue(record?.name) || email;
  const rawRole = stringValue(record?.role);
  if (!id || !accountId || !email || !name || !rawRole) throw new HttpError(401, "chatwoot_auth_rejected");
  const isAdmin = rawRole === "administrator" || rawRole === "admin";
  return { id, accountId, email, name, role: isAdmin ? "admin" : "agent", isAdmin };
}

function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function stringValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function positiveInt(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
