import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Button, TextField } from "../ui/atoms";
import { createSync } from "./engine";

const sync = createSync();

const TEXT = {
  idle: "Synchronisiert",
  syncing: "Synchronisiert …",
  offline: "Offline – Änderungen werden später gesendet",
  error: "Synchronisierung fehlgeschlagen, neuer Versuch folgt",
  "auth-required": "Anmelden zum Synchronisieren",
} as const;

function SyncPanel() {
  const status = useSyncExternalStore(sync.subscribe, sync.status);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <section aria-label="Synchronisierung">
      <p role="status">{TEXT[status]}</p>
      {status === "auth-required" ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await sync.login(password);
            setPassword("");
            setError(
              r === "ok"
                ? ""
                : r === "invalid"
                  ? "Passwort falsch."
                  : r === "locked"
                    ? "Zu viele Versuche. Bitte später erneut versuchen."
                    : "Anmeldung nicht möglich. Bitte Verbindung prüfen.",
            );
          }}
        >
          <TextField
            label="Passwort"
            type="password"
            autoComplete="current-password"
            value={password}
            error={error}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary">
            Anmelden
          </Button>
        </form>
      ) : (
        <Button variant="quiet" onClick={() => void sync.logout()}>
          Abmelden
        </Button>
      )}
    </section>
  );
}

/** Einziger Berührungspunkt mit dem Kern: main.tsx ruft mountSync(<Element>) auf. */
export function mountSync(el: HTMLElement | null) {
  if (!el) return;
  sync.start();
  createRoot(el).render(<SyncPanel />);
}
