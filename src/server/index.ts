import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { openDb, snapshot } from "./db";

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? "./data";
const cmd = process.argv[2];

// `healthcheck`: Exit-Code für Docker HEALTHCHECK (kein wget/curl im Image nötig), ohne DB zu öffnen.
if (cmd === "healthcheck") {
  const res = await fetch(`http://127.0.0.1:${port}/health`).catch(() => null);
  process.exit(res?.ok ? 0 : 1);
}

const db = openDb(join(dataDir, "app.db"));
const backupPath = join(dataDir, "backup.db");

/** Atomar: erst in Temp-Datei, dann umbenennen – ein altes Backup bleibt bei Fehlern erhalten. */
function runBackup() {
  const tmp = `${backupPath}.tmp`;
  try {
    rmSync(tmp, { force: true });
    snapshot(db, tmp);
    renameSync(tmp, backupPath);
  } catch (e) {
    console.error("backup failed", e);
    return false;
  }
  return true;
}

// `backup`: einmaliger Snapshot (z. B. vor einem Volume-Backup per `docker compose exec app bun src/server/index.ts backup`).
if (cmd === "backup") process.exit(runBackup() ? 0 : 1);

const passwordHash = process.env.APP_PASSWORD_HASH ?? "";
if (!passwordHash) {
  console.error("APP_PASSWORD_HASH fehlt (Hash erzeugen: siehe .env.example)");
  process.exit(1);
}

const app = createApp(db, {
  passwordHash,
  secureCookies: process.env.SECURE_COOKIES !== "false",
  staticDir: "./dist",
});
const server = Bun.serve({ port, fetch: app.fetch });
console.log(`listening on :${server.port}`);

runBackup();
setInterval(runBackup, 6 * 3600 * 1000);

const shutdown = async () => {
  await server.stop();
  db.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
