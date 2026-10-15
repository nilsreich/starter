import { expect, test } from "bun:test";
import { createApp } from "./app";
import { openDb } from "./db";

const hash = await Bun.password.hash("geheim");
const setup = () => createApp(openDb(":memory:"), { passwordHash: hash, secureCookies: false });
const json = (body: unknown, extra: Record<string, string> = {}): RequestInit => ({
  method: "PUT",
  headers: { "content-type": "application/json", ...extra },
  body: JSON.stringify(body),
});

async function login(app: ReturnType<typeof setup>) {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "geheim" }),
  });
  expect(res.status).toBe(200);
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

const item = (over = {}) => ({
  id: crypto.randomUUID(),
  title: "a",
  done: false,
  deleted: false,
  updatedAt: 100,
  ...over,
});

test("health", async () => {
  expect(await (await setup().request("/health")).text()).toBe("ok");
});

test("items need auth", async () => {
  expect((await setup().request("/api/items")).status).toBe(401);
});

test("wrong password rejected", async () => {
  const res = await setup().request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "falsch" }),
  });
  expect(res.status).toBe(401);
});

test("PUT is idempotent and last-write-wins", async () => {
  const app = setup();
  const cookie = await login(app);
  const a = item();
  const put = (i: object) => app.request(`/api/items/${a.id}`, json(i, { cookie }));
  expect((await put(a)).status).toBe(200);
  expect((await put(a)).status).toBe(200);
  await put({ ...a, title: "neu", updatedAt: 200 });
  const stale = await put({ ...a, title: "alt", updatedAt: 150 });
  expect((await stale.json()).title).toBe("neu");
  const list = await (await app.request("/api/items", { headers: { cookie } })).json();
  expect(list.items).toHaveLength(1);
  expect(list.cursor).toBeGreaterThan(0);
});

test("soft-deleted items are listed for sync with a cursor", async () => {
  const app = setup();
  const cookie = await login(app);
  const a = item();
  await app.request(`/api/items/${a.id}`, json({ ...a, deleted: true }, { cookie }));
  const res = await (await app.request("/api/items?since=0", { headers: { cookie } })).json();
  expect(res.items).toHaveLength(1);
  expect(res.items[0].deleted).toBe(true);
  const after = await (
    await app.request(`/api/items?since=${res.cursor}`, { headers: { cookie } })
  ).json();
  expect(after.items).toEqual([]);
});

test("cross-origin writes are blocked (CSRF)", async () => {
  const app = setup();
  const cookie = await login(app);
  const a = item();
  const res = await app.request(
    `/api/items/${a.id}`,
    json(a, { cookie, origin: "https://evil.example" }),
  );
  expect(res.status).toBe(403);
});

test("logout invalidates the session", async () => {
  const app = setup();
  const cookie = await login(app);
  await app.request("/api/auth/logout", { method: "POST", headers: { cookie } });
  expect((await app.request("/api/items", { headers: { cookie } })).status).toBe(401);
});

test("expired session is rejected", async () => {
  const db = openDb(":memory:");
  const app = createApp(db, { passwordHash: hash, secureCookies: false });
  const cookie = await login(app);
  db.run("UPDATE sessions SET expires_at = 1");
  expect((await app.request("/api/items", { headers: { cookie } })).status).toBe(401);
});

test("login is locked after too many failures", async () => {
  const app = setup();
  const bad = () =>
    app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "x" }),
    });
  for (let i = 0; i < 10; i++) expect((await bad()).status).toBe(401);
  expect((await bad()).status).toBe(429);
});

test("id mismatch is rejected", async () => {
  const app = setup();
  const cookie = await login(app);
  const res = await app.request(`/api/items/${crypto.randomUUID()}`, json(item(), { cookie }));
  expect(res.status).toBe(400);
});

test("same-origin and origin-less writes are allowed; 'null' origin is 403", async () => {
  const app = setup();
  const cookie = await login(app);
  const a = item();
  const ok = await app.request(
    `http://localhost/api/items/${a.id}`,
    json(a, { cookie, origin: "http://localhost" }),
  );
  expect(ok.status).toBe(200);
  const nul = await app.request(`/api/items/${a.id}`, json(a, { cookie, origin: "null" }));
  expect(nul.status).toBe(403);
});

test("unknown api route is 404", async () => {
  expect((await setup().request("/api/nope")).status).toBe(404);
});

test("snapshot writes a readable copy", async () => {
  const { snapshot } = await import("./db");
  const { Database } = await import("bun:sqlite");
  const db = openDb(":memory:");
  db.run("INSERT INTO items (id, title, done, deleted, updated_at) VALUES ('x','t',0,0,1)");
  const path = `/tmp/snap-${crypto.randomUUID()}.db`;
  snapshot(db, path);
  expect(new Database(path).query("SELECT count(*) AS n FROM items").get()).toEqual({ n: 1 });
});

test("CSRF hinter TLS-Proxy: https-Origin mit passendem Host ok, fremder abgelehnt", async () => {
  const app = setup();
  const post = (origin: string) =>
    app.request("http://app.example.com/api/auth/login", {
      method: "POST",
      headers: { origin, host: "app.example.com", "content-type": "application/json" },
      body: JSON.stringify({ password: "falsch" }),
    });
  expect((await post("https://app.example.com")).status).toBe(401);
  expect((await post("https://evil.example")).status).toBe(403);
});

test("gleicher updatedAt mit anderem Inhalt: erster Schreiber gewinnt, Antwort zeigt Server-Stand", async () => {
  const app = setup();
  const cookie = await login(app);
  const a = item();
  await app.request(`/api/items/${a.id}`, json({ ...a, title: "a" }, { cookie }));
  const res = await app.request(`/api/items/${a.id}`, json({ ...a, title: "b" }, { cookie }));
  expect(((await res.json()) as { title: string }).title).toBe("a");
});
