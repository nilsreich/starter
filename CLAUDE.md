# Starter – Regeln für Agenten

Stack: TypeScript strict · React 19 + Vite · PWA · Design „Klar & leicht“ · optional Server: Bun + Hono + `bun:sqlite` + zod.
Aufbau und Module: **`MODULES.md`** (Kern: store/ui/shared; Module: sync, server, deploy).

- **Fertig = `bun run check` grün** (tsc client+server, biome, bun test, vite build). Vorher nie „fertig“ melden.
- **Local-first:** IndexedDB (`src/client/store`) ist die einzige Quelle der Wahrheit. Die UI spricht nur mit dem Store (`list/upsert/remove/subscribe`), nie mit dem Netz. Sync (`src/client/sync`) läuft im Hintergrund und zeigt nur einen Status.
- **Kern darf nie aus `sync/` oder `server/` importieren** (CI-Job `strip` entfernt alle Module und führt `check` aus). Neue Berührungspunkte in `MODULES.md` und `scripts/strip.ts` eintragen.
- Datenmodell: Client-UUID, `updatedAt` strikt steigend (vergibt der Store), Soft-Delete, Schema nur additiv mit `.default()`; Sync-Cursor ist die server-vergebene `seq`, nie `updatedAt`.
- Neues Feature: Schema in `shared` → Store → UI → Test. Mit Server zusätzlich: Migration (`migrations/NNN_name.sql`, lückenlos) → Route (`zValidator`) → Test.
- UI: nur Komponenten aus `src/client/ui/atoms.tsx` und Tokens aus `ui/tokens.css`; Regeln in `~/.claude/design-systems/klar-leicht/CLAUDE-CODE-RULES.md`. `src/client/ui` ist vendored (nicht von Biome geprüft).
- Auth (Modul server): Einzelnutzer, Passwort-Hash in `APP_PASSWORD_HASH` (siehe `.env.example`, in einfachen Anführungszeichen), Session in SQLite, Cookie HttpOnly/SameSite=Lax. Login nur als Hinweis im Sync-Panel.
- Neue Abhängigkeiten nur mit Begründung; wenige Deps sind Ziel.
- Deploy (Modul deploy): Image → ghcr → `deploy.yml` (SSH, Backup, Smoke-Test `/health` = `ok`, Rollback). Daten in `/data` (`app.db`, `backup.db` = `VACUUM INTO`-Snapshot).
- Dev: `bun run dev` (mit Server: :8080 + Vite-Proxy; ohne: nur Vite).
