# Module

Kern (immer): `src/shared`, `src/client/store` (IndexedDB, Quelle der Wahrheit), `src/client/ui`, `src/client/App.tsx`, PWA.
Neue App: Ordner kopieren, dann `git -C <starter> rev-parse HEAD > .starter-version` (Basis für spätere Updates: `git -C <starter> diff $(cat .starter-version)..HEAD -- <Modulpfade>`).

Entfernen: `bun scripts/strip.ts deploy sync server` (beliebige Teilmenge; `server` entfernt immer auch `sync` und `deploy`), dann `bun install && bun run check`. `bun run check` prüft das – Kern darf nie aus `sync/` oder `server/` importieren.

| Modul | Ordner/Dateien | Berührungspunkte außerhalb |
|---|---|---|
| **sync** (braucht server) | `src/client/sync/`, `src/server/sync.test.ts` | `main.tsx`: Import + `mountSync(...)` (Zeilen mit `Modul sync`), `index.html`: `<div id="sync">` |
| **server** | `src/server/`, `migrations/`, `tsconfig.server.json`, `.env.example` | `package.json`: Skripte `dev:server`/`dev:client`/`start`, `dev` = `bun run --parallel dev:server dev:client` (Ebene 0: `vite`), `check` um den `tsconfig.server`-Teil ergänzt, Deps `hono`, `@hono/zod-validator`; `vite.config.ts`: Proxy (Marker `Modul server`) |
| **deploy** (braucht server) | `Dockerfile`, `.dockerignore`, `deploy/` | – |

Hinzufügen zu einer Ebene-0-App: Ordner aus dem Starter kopieren, Berührungspunkte aus der Tabelle übernehmen, `bun add hono @hono/zod-validator`, `bun run check`.

Datenmodell-Regeln (damit Ebene 1 kein Rewrite wird): Client-UUID, `updatedAt` strikt steigend, Soft-Delete (`deleted`), Schema nur additiv (`.default()`), jeder Datensatz wird beim Lesen mit zod geparst. Lokale Daten hängen am Origin: Ebene 0 gleich auf der Ziel-Domain hosten, sonst Export/Import nutzen.
