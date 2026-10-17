import fs from "node:fs";
import path from "node:path";
import express from "express";
import { requireDashboardActor } from "./auth";
import { pool } from "./db/pool";
import { errorHandler } from "./errors";
import { embeddedRouter } from "./routes/embedded";

export function createApp(publicDir = path.resolve(__dirname, "..", "public")) {
  const app = express();
  const indexHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");

  app.set("trust proxy", 1);
  app.use((req, _res, next) => { req.url = normalizeMountedUrl(req.url); next(); });
  app.use("/api/embedded", (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.vary("Cookie");
    res.vary("access-token, token-type, client, expiry, uid");
    next();
  });
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, service: "later", database: "ready" });
    } catch {
      res.status(503).json({ ok: false, service: "later", database: "unavailable" });
    }
  });
  app.use("/api/embedded", requireDashboardActor, embeddedRouter);
  app.use(express.static(publicDir, { index: false }));
  app.get("*", (_req, res) => res.type("html").send(indexHtml));
  app.use(errorHandler);
  return app;
}

export function normalizeMountedUrl(url: string) {
  if (url === "/" || url === "") return url;
  const [pathname, search = ""] = url.split("?");
  if (pathname === "/api" || pathname.startsWith("/api/") || pathname === "/assets" || pathname.startsWith("/assets/")) return url;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) return `/${search ? `?${search}` : ""}`;
  if (segments[1] !== "api" && segments[1] !== "assets") return url;
  return `/${segments.slice(1).join("/")}${search ? `?${search}` : ""}`;
}
