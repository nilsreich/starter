import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(import.meta.dir, "../../migrations");

export function openDb(path: string): Database {
  if (path !== ":memory:") mkdirSync(join(path, ".."), { recursive: true });
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA synchronous = NORMAL");
  migrate(db);
  return db;
}

function migrate(db: Database) {
  const row = db.query("PRAGMA user_version").get() as { user_version: number };
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  files.forEach((file, i) => {
    const version = Number(file.match(/^(\d+)_/)?.[1]);
    if (version !== i + 1)
      throw new Error(`Migration ${file}: erwartete Nummer ${i + 1} (lückenlos, ohne Dubletten)`);
    if (version <= row.user_version) return;
    db.transaction(() => {
      db.run(readFileSync(join(MIGRATIONS, file), "utf8"));
      db.run(`PRAGMA user_version = ${version}`);
    })();
  });
}

/** Konsistenter Snapshot (WAL-sicher) für Datei-Backups. */
export function snapshot(db: Database, target: string) {
  db.run("VACUUM INTO ?", [target]);
}
