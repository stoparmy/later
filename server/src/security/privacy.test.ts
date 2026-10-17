import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("private API rejects anonymous, forged, revoked and out-of-scope requests without leaking or caching data", async () => {
  const auth = { "access-token": "synthetic-session", "token-type": "Bearer", client: "synthetic-client", expiry: "9999999999", uid: "agent@example.invalid" };
  let revoked = false;
  let queries = 0;
  const upstream = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    assert.equal(req.headers.api_access_token, undefined, "Dashboard must not use service-account credentials");
    if (revoked || req.headers["access-token"] !== auth["access-token"]) {
      res.writeHead(401).end(JSON.stringify({ secret: "synthetic-upstream-private" })); return;
    }
    if (req.url === "/auth/validate_token") { res.end("{}"); return; }
    if (req.url === "/api/v1/profile") {
      res.end(JSON.stringify({ id: 1, account: { id: 1 }, name: "Synthetic Author", email: auth.uid, role: "agent" })); return;
    }
    if (req.url === "/api/v1/accounts/1/conversations/10") { res.end('{"inbox_id":2}'); return; }
    res.writeHead(403).end(JSON.stringify({ secret: "synthetic-upstream-private" }));
  });
  const listen = (server: Server) => new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port));
  });
  const close = (server: Server) => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  const upstreamPort = await listen(upstream);
  process.env.CHATWOOT_BASE_URL = `http://127.0.0.1:${upstreamPort}`;
  process.env.DATABASE_URL = "postgresql://synthetic:synthetic@127.0.0.1:1/unused";
  const { pool } = require("../db/pool") as typeof import("../db/pool");
  const originalQuery = pool.query;
  pool.query = (async () => { queries++; return { rows: [] }; }) as unknown as typeof pool.query;
  const publicDir = mkdtempSync(path.join(tmpdir(), "scheduled-reply-privacy-"));
  writeFileSync(path.join(publicDir, "index.html"), "<!doctype html><title>Scheduled replies</title>");
  const { createApp } = require("../app") as typeof import("../app");
  const server = createServer(createApp(publicDir));
  try {
    const port = await listen(server);
    const probe = async (url: string, headers: Record<string, string>, status: number, method = "GET") => {
      const before = queries;
      const response = await fetch(`http://127.0.0.1:${port}${url}`, { headers, method });
      assert.equal(response.status, status, `${method} ${url}`);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      for (const name of ["Cookie", ...Object.keys(auth)]) assert.ok(response.headers.get("vary")?.toLowerCase().includes(name.toLowerCase()));
      const body = await response.text();
      if (status !== 200) {
        assert.equal(queries, before, "Denied requests must not query message storage");
        assert.doesNotMatch(body, /Synthetic Author|agent@example.invalid|synthetic-upstream-private/);
      }
      return body;
    };
    const scoped = "/api/embedded/scheduled-messages?conversationId=10&inboxId=2";
    for (const prefix of ["", "/later", "/other"]) {
      for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]) await probe(prefix + scoped, {}, 401, method);
    }
    await probe("/api/embedded/me", {}, 401);
    await probe(scoped, { uid: auth.uid }, 401);
    await probe(scoped, { ...auth, "access-token": "forged" }, 401);
    await probe(scoped, { cookie: "cw_d_session_info=%7Binvalid" }, 401);
    await probe(scoped, { api_access_token: "forged" }, 401);
    assert.match(await probe("/api/embedded/me", auth, 200), /Synthetic Author/);
    await probe(scoped, auth, 200);
    await probe(scoped, { cookie: `cw_d_session_info=${encodeURIComponent(JSON.stringify(auth))}` }, 200);
    await probe(scoped.replace("conversationId=10", "conversationId=11"), auth, 403);
    await probe(scoped.replace("inboxId=2", "inboxId=999"), auth, 403);
    revoked = true;
    await probe(scoped, auth, 401);
  } finally {
    pool.query = originalQuery;
    await close(server);
    await close(upstream);
    await pool.end();
    rmSync(publicDir, { recursive: true });
  }
});
