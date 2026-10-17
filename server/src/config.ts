import "dotenv/config";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export const config = {
  chatwootBaseUrl: required("CHATWOOT_BASE_URL").replace(/\/+$/, ""),
  chatwootAppToken: process.env.CHATWOOT_APP_TOKEN?.trim() || "",
  databaseUrl: required("DATABASE_URL"),
  port: positiveInt("PORT", 3000),
  workerPollIntervalMs: positiveInt("LATER_WORKER_POLL_INTERVAL_MS", 5_000),
  workerLeaseMs: positiveInt("LATER_WORKER_LEASE_MS", 60_000),
  workerMaxAttempts: positiveInt("LATER_WORKER_MAX_ATTEMPTS", 5),
  chatwootRequestTimeoutMs: positiveInt("LATER_CHATWOOT_REQUEST_TIMEOUT_MS", 15_000),
};
