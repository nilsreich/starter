import { itemSchema, pullSchema } from "../../shared/schema";
import { store as defaultStore, type Store } from "../store";

export type SyncStatus = "idle" | "syncing" | "offline" | "auth-required" | "error";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const DROP = new Set([400, 404, 422]); // dauerhaft ungültig: verwerfen statt ewig wiederholen

/** Hintergrund-Sync: Push der Dirty-Einträge (idempotentes PUT), dann Pull ab Server-Cursor. */
export function createSync(
  fetchFn: Fetch = (input, init) => fetch(input, init),
  { applyRemote, dirty, getMeta, markClean, onWrite, setMeta }: Store = defaultStore,
) {
  let status: SyncStatus = "idle";
  let running = false;
  let again = false;
  let retryMs = 2000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subs = new Set<() => void>();
  const set = (s: SyncStatus) => {
    status = s;
    for (const cb of subs) cb();
  };

  const json = (init?: RequestInit): RequestInit => ({
    ...init,
    headers: { "content-type": "application/json" },
  });

  async function cycle(): Promise<SyncStatus> {
    for (const item of await dirty()) {
      const res = await fetchFn(
        `/api/items/${item.id}`,
        json({ method: "PUT", body: JSON.stringify(item) }),
      );
      if (res.status === 401) return "auth-required";
      if (!res.ok && !DROP.has(res.status)) return "error";
      if (res.ok) {
        // Server-Stand gewinnt bei Gleichstand/Konflikt; unlesbare Antwort ist nicht fatal (der Pull holt den Stand).
        const body = itemSchema.safeParse(await res.json().catch(() => null));
        if (body.success) await applyRemote([body.data]);
      }
      await markClean(item);
    }
    const cursor = (await getMeta<number>("cursor")) ?? 0;
    const res = await fetchFn(`/api/items?since=${cursor}`);
    if (res.status === 401) return "auth-required";
    if (!res.ok) return "error";
    const pull = pullSchema.parse(await res.json());
    await applyRemote(pull.items);
    await setMeta("cursor", pull.cursor);
    return "idle";
  }

  async function run(): Promise<void> {
    if (running) {
      again = true; // Änderung während des Laufs: danach nochmal
      return;
    }
    running = true;
    clearTimeout(timer);
    try {
      do {
        again = false;
        set("syncing");
        let next: SyncStatus;
        try {
          next = await cycle();
        } catch (e) {
          next = e instanceof TypeError ? "offline" : "error"; // fetch wirft TypeError ohne Netz
        }
        set(next);
        if (next === "offline" || next === "error") {
          timer = setTimeout(run, retryMs);
          retryMs = Math.min(retryMs * 2, 5 * 60_000);
          break;
        }
        if (next === "idle") retryMs = 2000;
        else break;
      } while (again);
    } finally {
      running = false;
    }
  }

  return {
    run,
    status: () => status,
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    start() {
      onWrite(() => void run());
      addEventListener("online", () => void run());
      document.addEventListener(
        "visibilitychange",
        () => document.visibilityState === "visible" && void run(),
      );
      void run();
    },
    async login(password: string): Promise<"ok" | "invalid" | "locked" | "error"> {
      try {
        const res = await fetchFn(
          "/api/auth/login",
          json({ method: "POST", body: JSON.stringify({ password }) }),
        );
        if (res.ok) {
          void run();
          return "ok";
        }
        return res.status === 401 ? "invalid" : res.status === 429 ? "locked" : "error";
      } catch {
        return "error";
      }
    },
    async logout() {
      try {
        await fetchFn("/api/auth/logout", { method: "POST" });
        set("auth-required");
      } catch {
        set("offline");
      }
    },
  };
}
