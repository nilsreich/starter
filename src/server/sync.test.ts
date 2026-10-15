// Gehört zu den Modulen server + sync (Ende-zu-Ende: zwei Clients gegen echte Server-Routen).
import "fake-indexeddb/auto";
import { expect, test } from "bun:test";
import { createStore } from "../client/store";
import { createSync } from "../client/sync/engine";
import { createApp } from "./app";
import { openDb } from "./db";

const hash = await Bun.password.hash("pw");

async function setup() {
  const app = createApp(openDb(":memory:"), { passwordHash: hash, secureCookies: false });
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "pw" }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const client = () => {
    const store = createStore(`c-${crypto.randomUUID()}`);
    const sync = createSync(
      (url, init) =>
        Promise.resolve(app.request(url, { ...init, headers: { ...init?.headers, cookie } })),
      store,
    );
    return { store, sync };
  };
  return { app, client };
}

test("push, pull, delete propagate between two clients", async () => {
  const { client } = await setup();
  const a = client();
  const b = client();
  const item = await a.store.upsert({ title: "x", done: false });
  await a.sync.run();
  await b.sync.run();
  expect((await b.store.list()).map((i) => i.title)).toEqual(["x"]);
  await b.store.remove(item.id);
  await b.sync.run();
  await a.sync.run();
  expect(await a.store.list()).toEqual([]);
  expect(await a.store.dirty()).toEqual([]);
});

test("wrong client clock does not lose changes (server cursor)", async () => {
  const { client } = await setup();
  const a = client();
  const b = client();
  const real = Date.now;
  Date.now = () => real() - 10 * 60_000; // Client A läuft 10 min nach
  const x = await a.store.upsert({ title: "from-slow", done: false });
  Date.now = real;
  await a.sync.run();
  await b.sync.run();
  const y = await b.store.upsert({ title: "from-b", done: false });
  await b.sync.run();
  await a.sync.run();
  expect((await a.store.list()).map((i) => i.id).sort()).toEqual([x.id, y.id].sort());
});

test("offline edits are sent later; 401 sets auth-required", async () => {
  const { app } = await setup();
  const store = createStore(`c-${crypto.randomUUID()}`);
  let online = false;
  const sync = createSync(
    (url, init) =>
      online ? Promise.resolve(app.request(url, init)) : Promise.reject(new TypeError("offline")),
    store,
  );
  await store.upsert({ title: "offline", done: false });
  await sync.run();
  expect(sync.status()).toBe("offline");
  online = true; // ohne Cookie -> 401
  await sync.run();
  expect(sync.status()).toBe("auth-required");
  expect(await store.dirty()).toHaveLength(1);
});
