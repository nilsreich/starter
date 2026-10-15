import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { z } from "zod";
import { type Item, itemSchema } from "../../shared/schema";

// Kern: IndexedDB ist die Quelle der Wahrheit. Ein Store pro Entität, schemalos (Schlüssel `id`).
// Neue Felder nur additiv mit `.default()` im Schema, damit IDB-Versionssprünge selten bleiben.
const recordSchema = itemSchema.extend({ dirty: z.number().default(0) });
type Rec = z.infer<typeof recordSchema>;

interface Schema extends DBSchema {
  items: { key: string; value: Rec };
  meta: { key: string; value: unknown };
}

export function createStore(dbName = "app") {
  let dbp: Promise<IDBPDatabase<Schema>> | undefined;
  const db = () =>
    // biome-ignore lint/suspicious/noAssignInExpressions: lazy init
    (dbp ??= openDB<Schema>(dbName, 1, {
      upgrade(d) {
        d.createObjectStore("items", { keyPath: "id" });
        d.createObjectStore("meta");
      },
    }));

  const same = (a: Item, b: Item) =>
    Object.keys({ ...a, ...b }).every((k) => a[k as keyof Item] === b[k as keyof Item]);
  const strip = ({ dirty: _d, ...item }: Rec): Item => item;
  // Ungültige Datensätze überspringen, damit einer die ganze App nicht blockiert.
  const parse = (rows: unknown[]): Rec[] =>
    rows.flatMap((r) => {
      const res = recordSchema.safeParse(r);
      if (!res.success) console.warn("Ungültiger Datensatz übersprungen", res.error.message);
      return res.success ? [res.data] : [];
    });

  const channel =
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`${dbName}-store`);
  const subs = new Set<() => void>();
  const writeSubs = new Set<() => void>();
  const emit = () => {
    for (const cb of subs) cb();
    channel?.postMessage("changed");
  };
  if (channel)
    channel.onmessage = () => {
      for (const cb of subs) cb();
    };

  /** UI-Änderungen (lokal, Sync-Ergebnisse, andere Tabs). */
  function subscribe(cb: () => void): () => void {
    subs.add(cb);
    return () => subs.delete(cb);
  }

  /** Nur echte lokale Schreibvorgänge – Auslöser für den Sync (nicht für Sync-Ergebnisse). */
  function onWrite(cb: () => void): () => void {
    writeSubs.add(cb);
    return () => writeSubs.delete(cb);
  }

  async function list(): Promise<Item[]> {
    const rows = parse(await (await db()).getAll("items"));
    return rows
      .filter((r) => !r.deleted)
      .map(strip)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function write(
    id: string,
    change: (prev: Rec | undefined) => Omit<Item, "updatedAt" | "id">,
  ) {
    const d = await db();
    const tx = d.transaction("items", "readwrite");
    const prev = (await tx.store.get(id)) as Rec | undefined;
    const next = recordSchema.parse({
      ...change(prev),
      id,
      // strikt steigend, auch bei Uhrversatz oder zwei Änderungen in derselben Millisekunde
      updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1),
      dirty: 1,
    });
    await tx.store.put(next);
    await tx.done;
    for (const cb of writeSubs) cb();
    emit();
    return strip(next);
  }

  const upsert = (input: { id?: string; title: string; done: boolean }) =>
    write(input.id ?? crypto.randomUUID(), () => ({
      title: input.title,
      done: input.done,
      deleted: false,
    }));

  const remove = async (id: string) => {
    const d = await db();
    const prev = await d.get("items", id);
    if (!prev) return;
    await write(id, (p) => ({ title: p?.title ?? prev.title, done: !!p?.done, deleted: true }));
  };

  // --- Schnittstelle für das Sync-Modul ---

  async function dirty(): Promise<Item[]> {
    return parse(await (await db()).getAll("items"))
      .filter((r) => r.dirty)
      .map(strip);
  }

  /** Als gesendet markieren – nur, wenn zwischenzeitlich keine neuere Version entstand. */
  async function markClean(item: Item): Promise<void> {
    const d = await db();
    const tx = d.transaction("items", "readwrite");
    const cur = (await tx.store.get(item.id)) as Rec | undefined;
    if (cur && cur.updatedAt === item.updatedAt) await tx.store.put({ ...cur, dirty: 0 });
    await tx.done;
  }

  /** Server-Stand übernehmen (Last-Write-Wins); lokale, neuere ungesendete Änderungen bleiben. */
  async function applyRemote(items: Item[]): Promise<void> {
    if (!items.length) return;
    const d = await db();
    const tx = d.transaction("items", "readwrite");
    let changed = false;
    for (const remote of items) {
      const cur = (await tx.store.get(remote.id)) as Rec | undefined;
      // Server entscheidet bei Gleichstand (gleicher updatedAt, anderer Inhalt) – sonst bleiben Clients dauerhaft verschieden.
      if (cur && cur.updatedAt > remote.updatedAt) continue;
      if (cur && same(strip(cur), remote)) continue;
      await tx.store.put({ ...remote, dirty: 0 });
      changed = true;
    }
    await tx.done;
    if (changed) emit();
  }

  async function getMeta<T>(key: string): Promise<T | undefined> {
    return (await (await db()).get("meta", key)) as T | undefined;
  }
  async function setMeta(key: string, value: unknown): Promise<void> {
    await (await db()).put("meta", value, key);
  }

  // --- Sicherung ---

  async function exportJson(): Promise<string> {
    // Rohdaten ohne Validierung: der Export ist der Notausstieg und darf nichts verlieren.
    const rows = (await (await db()).getAll("items")) as Record<string, unknown>[];
    return JSON.stringify(rows.map(({ dirty: _d, ...item }) => item));
  }

  /** Import wie ein lokaler Schreibvorgang: neuere Version gewinnt, Ergebnis wird synchronisiert. */
  async function importJson(text: string): Promise<number> {
    const raw = z.array(z.unknown()).parse(JSON.parse(text));
    const incoming = raw.flatMap((r) => {
      const res = itemSchema.safeParse(r);
      return res.success ? [res.data] : [];
    });
    if (incoming.length < raw.length)
      console.warn(`Import: ${raw.length - incoming.length} ungültige Einträge übersprungen`);
    if (raw.length && !incoming.length) throw new Error("keine gültigen Einträge");
    const d = await db();
    const tx = d.transaction("items", "readwrite");
    let n = 0;
    for (const item of incoming) {
      const cur = (await tx.store.get(item.id)) as Rec | undefined;
      if (cur && cur.updatedAt >= item.updatedAt) continue;
      await tx.store.put({ ...item, dirty: 1 });
      n++;
    }
    await tx.done;
    if (n) {
      for (const cb of writeSubs) cb();
      emit();
    }
    return n;
  }

  return {
    list,
    upsert,
    remove,
    subscribe,
    onWrite,
    dirty,
    markClean,
    applyRemote,
    getMeta,
    setMeta,
    exportJson,
    importJson,
  };
}

export type Store = ReturnType<typeof createStore>;

// Standard-Instanz für die App.
export const store = createStore();
export const {
  list,
  upsert,
  remove,
  subscribe,
  onWrite,
  dirty,
  markClean,
  applyRemote,
  getMeta,
  setMeta,
  exportJson,
  importJson,
} = store;

/** Schützt vor Browser-Eviction (Safari löscht IndexedDB ungenutzter Seiten nach ~7 Tagen). */
export const persist = () => navigator.storage?.persist?.();
