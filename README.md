# Starter

Persönlicher Standard für Web-Apps: React/Vite-PWA, local-first (IndexedDB), Klar & leicht. Server (Hono/Bun/SQLite), Sync und Deploy sind Module, die man per `bun scripts/strip.ts` entfernt oder aus diesem Starter dazukopiert – siehe `MODULES.md`.

Neues Projekt: Ordner kopieren, `name` in `package.json`/`vite.config.ts` anpassen, unnötige Module entfernen, `bun install`, `bun run dev`. Regeln für Agenten: `CLAUDE.md`.

Lokale Entwicklung mit Server: in `.env` `DATA_DIR=./data` und `SECURE_COOKIES=false` setzen (die Werte in `.env.example` gelten für Produktion).

`APP_PASSWORD_HASH` enthält `$`: in `.env` und im Secret `PROD_ENV` in einfache Anführungszeichen setzen (siehe `.env.example`). Deploy-Secrets/Variablen: `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`, `PROD_ENV`, Variablen `VPS_HOST`, `VPS_USER`, `APP_DOMAIN`.
