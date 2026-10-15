import type { Database } from "bun:sqlite";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { loginSchema } from "../shared/schema";

const COOKIE = "sid";
const TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const sha256 = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");

export function authRoutes(db: Database, passwordHash: string, secure: boolean) {
  // Einzelnutzer-App, ein Prozess: In-Memory reicht. Bewusst global: zu viele Fehlversuche sperren auch den Besitzer kurz.
  const fails: number[] = [];
  const app = new Hono();

  app.post("/login", zValidator("json", loginSchema), async (c) => {
    const now = Date.now();
    while (fails.length && now - (fails[0] ?? 0) > WINDOW_MS) fails.shift();
    if (fails.length >= MAX_FAILS) return c.json({ error: "too_many_attempts" }, 429);
    const { password } = c.req.valid("json");
    if (!passwordHash || !(await Bun.password.verify(password, passwordHash))) {
      fails.push(now);
      return c.json({ error: "invalid_credentials" }, 401);
    }
    db.run("DELETE FROM sessions WHERE expires_at < ?", [now]);
    const token = crypto.randomUUID() + crypto.randomUUID();
    db.run("INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)", [
      sha256(token),
      now + TTL_MS,
    ]);
    setCookie(c, COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: TTL_MS / 1000,
    });
    return c.json({ ok: true });
  });

  app.post("/logout", (c) => {
    const token = getCookie(c, COOKIE);
    if (token) db.run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  return app;
}

export function requireAuth(db: Database) {
  return createMiddleware(async (c, next) => {
    const token = getCookie(c, COOKIE);
    const row = token
      ? (db.query("SELECT expires_at FROM sessions WHERE token_hash = ?").get(sha256(token)) as {
          expires_at: number;
        } | null)
      : null;
    if (!row || row.expires_at < Date.now()) return c.json({ error: "unauthorized" }, 401);
    await next();
  });
}
