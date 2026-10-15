import type { Database } from "bun:sqlite";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type Item, itemSchema } from "../shared/schema";

type Row = {
  id: string;
  title: string;
  done: number;
  deleted: number;
  updated_at: number;
  seq: number;
};
const toItem = (r: Row): Item => ({
  id: r.id,
  title: r.title,
  done: !!r.done,
  deleted: !!r.deleted,
  updatedAt: r.updated_at,
});

export function itemRoutes(db: Database) {
  const app = new Hono();

  // Änderungen seit Cursor (server-vergebene `seq`), inkl. gelöschter – für den Sync-Pull.
  app.get(
    "/",
    zValidator("query", z.object({ since: z.coerce.number().int().min(0).default(0) })),
    (c) => {
      const { since } = c.req.valid("query");
      const rows = db.query("SELECT * FROM items WHERE seq > ? ORDER BY seq").all(since) as Row[];
      const cursor = rows.reduce((m, r) => Math.max(m, r.seq), since);
      return c.json({ items: rows.map(toItem), cursor });
    },
  );

  // Idempotenter Upsert; Last-Write-Wins über updatedAt (ältere Schreibvorgänge werden ignoriert).
  app.put(
    "/:id",
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", itemSchema),
    (c) => {
      const { id } = c.req.valid("param");
      const item = c.req.valid("json");
      if (item.id !== id) return c.json({ error: "id_mismatch" }, 400);
      db.run(
        `INSERT INTO items (id, title, done, deleted, updated_at, seq)
           VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM items))
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, done = excluded.done,
           deleted = excluded.deleted, updated_at = excluded.updated_at,
           seq = (SELECT COALESCE(MAX(seq), 0) + 1 FROM items)
         WHERE excluded.updated_at > items.updated_at`,
        [item.id, item.title, +item.done, +item.deleted, item.updatedAt],
      );
      const row = db.query("SELECT * FROM items WHERE id = ?").get(id) as Row;
      return c.json(toItem(row));
    },
  );

  return app;
}
