import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import { authRoutes, requireAuth } from "./auth";
import { itemRoutes } from "./items";

export type Config = { passwordHash: string; secureCookies: boolean; staticDir?: string };

export function createApp(db: Database, cfg: Config) {
  const app = new Hono();
  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
      },
    }),
  );
  app.get("/health", (c) => c.text("ok"));
  // CSRF: zustandsändernde Requests mit fremdem Origin ablehnen (zusätzlich zu SameSite=Lax).
  app.use("/api/*", async (c, next) => {
    // Setzt voraus, dass der Proxy Host unverändert durchreicht (Caddy-Standard). Nur den Host vergleichen: hinter dem TLS-Proxy ist c.req.url http://, der Browser-Origin https://.
    const origin = c.req.header("origin");
    if (c.req.method !== "GET" && origin) {
      let host = "";
      try {
        host = new URL(origin).host;
      } catch {
        // ungültiger Origin → leerer Host → 403
      }
      if (host !== (c.req.header("host") ?? new URL(c.req.url).host))
        return c.json({ error: "forbidden" }, 403);
    }
    await next();
  });
  app.route("/api/auth", authRoutes(db, cfg.passwordHash, cfg.secureCookies));
  app.use("/api/items/*", requireAuth(db));
  app.use("/api/items", requireAuth(db));
  app.route("/api/items", itemRoutes(db));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal" }, 500);
  });
  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));
  if (cfg.staticDir) {
    app.use("/*", serveStatic({ root: cfg.staticDir }));
    app.get("*", serveStatic({ path: `${cfg.staticDir}/index.html` }));
  }
  return app;
}
