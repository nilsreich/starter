import "fake-indexeddb/auto";
import { expect, test } from "bun:test";
import { createStore } from "./index";

const fresh = () => createStore(`t-${crypto.randomUUID()}`);

test("upsert/list/remove with soft delete", async () => {
  const s = fresh();
  const a = await s.upsert({ title: "a", done: false });
  expect((await s.list()).map((i) => i.title)).toEqual(["a"]);
  await s.upsert({ ...a, done: true });
  expect((await s.list())[0]?.done).toBe(true);
  await s.remove(a.id);
  expect(await s.list()).toEqual([]);
  expect((await s.dirty())[0]?.deleted).toBe(true);
});

test("updatedAt is strictly increasing", async () => {
  const s = fresh();
  const a = await s.upsert({ title: "a", done: false });
  const b = await s.upsert({ ...a, title: "b" });
  const c = await s.upsert({ ...a, title: "c" });
  expect(b.updatedAt).toBeGreaterThan(a.updatedAt);
  expect(c.updatedAt).toBeGreaterThan(b.updatedAt);
});

test("invalid input is rejected", async () => {
  expect(fresh().upsert({ title: "  ", done: false })).rejects.toThrow();
});

test("markClean ignores newer local versions; applyRemote keeps newer dirty local", async () => {
  const s = fresh();
  const a = await s.upsert({ title: "a", done: false });
  const b = await s.upsert({ ...a, title: "b" });
  await s.markClean(a);
  expect(await s.dirty()).toHaveLength(1);
  await s.applyRemote([{ ...a, title: "remote-old" }]);
  expect((await s.list())[0]?.title).toBe("b");
  await s.applyRemote([{ ...b, title: "remote-new", updatedAt: b.updatedAt + 5 }]);
  expect((await s.list())[0]?.title).toBe("remote-new");
});

test("export/import round trip and LWW", async () => {
  const s1 = fresh();
  const a = await s1.upsert({ title: "a", done: false });
  const dump = await s1.exportJson();
  const s2 = fresh();
  expect(await s2.importJson(dump)).toBe(1);
  expect(await s2.importJson(dump)).toBe(0);
  expect((await s2.list())[0]?.id).toBe(a.id);
  expect(await s2.dirty()).toHaveLength(1);
  expect(s2.importJson("nope")).rejects.toThrow();
});

test("Gleichstand bei updatedAt: Server-Stand gewinnt", async () => {
  const s = fresh();
  const a = await s.upsert({ title: "lokal", done: false });
  await s.applyRemote([{ ...a, title: "server" }]);
  expect((await s.list())[0]?.title).toBe("server");
});

test("ungültiger Datensatz blockiert list() nicht", async () => {
  const name = `t-${crypto.randomUUID()}`;
  const s = createStore(name);
  await s.upsert({ title: "ok", done: false });
  const raw = indexedDB.open(name);
  await new Promise<void>((res) => {
    raw.onsuccess = () => {
      const tx = raw.result.transaction("items", "readwrite");
      tx.objectStore("items").put({ id: "kaputt" });
      tx.oncomplete = () => {
        raw.result.close();
        res();
      };
    };
  });
  expect((await s.list()).map((i) => i.title)).toEqual(["ok"]);
});

test("Import gemischter Datei übernimmt nur gültige Einträge", async () => {
  const s = fresh();
  const ok = { id: crypto.randomUUID(), title: "x", done: false, deleted: false, updatedAt: 1 };
  expect(await s.importJson(JSON.stringify([ok, { id: "kaputt" }]))).toBe(1);
  expect((await s.list()).map((i) => i.title)).toEqual(["x"]);
});
