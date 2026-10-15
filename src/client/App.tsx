import { useEffect, useRef, useState } from "react";
import type { Item } from "../shared/schema";
import { exportJson, importJson, list, remove, subscribe, upsert } from "./store";
import { Button, Checkbox, TextField } from "./ui/atoms";

export function App() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => void list().then(setItems);
    load();
    return subscribe(load);
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch {
      setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    }
  };

  if (!items)
    return (
      <main>
        <p>Lädt …</p>
      </main>
    );

  return (
    <main>
      <h1>Einträge</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setFieldError("Bitte einen Titel eingeben.");
            fieldRef.current?.focus();
            return;
          }
          setFieldError("");
          void run(() => upsert({ title: title.trim(), done: false }));
          setTitle("");
          fieldRef.current?.focus();
        }}
      >
        <TextField
          ref={fieldRef}
          label="Neuer Eintrag"
          maxLength={120}
          value={title}
          error={fieldError}
          onChange={(e) => {
            setTitle(e.target.value);
            setFieldError("");
          }}
        />
        <Button type="submit" variant="primary">
          Hinzufügen
        </Button>
      </form>
      {error && (
        <p className="kl-error" role="alert">
          {error}
        </p>
      )}
      {items.length === 0 && (
        <p className="kl-status">Noch keine Einträge. Lege oben den ersten an.</p>
      )}
      {items.length > 0 && (
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <Checkbox
                checked={i.done}
                onChange={() => void run(() => upsert({ ...i, done: !i.done }))}
              >
                {i.title}
              </Checkbox>
              <Button variant="quiet" onClick={() => void run(() => remove(i.id))}>
                Löschen
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Backup onError={setError} />
    </main>
  );
}

/** JSON-Sicherung: Daten liegen im Browser, daher Export/Import als Notweg (Gerätewechsel). */
function Backup({ onError }: { onError: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="actions">
      <Button
        variant="quiet"
        onClick={async () => {
          const url = URL.createObjectURL(
            new Blob([await exportJson()], { type: "application/json" }),
          );
          const a = Object.assign(document.createElement("a"), {
            href: url,
            download: "daten.json",
          });
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Exportieren
      </Button>
      <Button type="button" variant="quiet" onClick={() => fileRef.current?.click()}>
        Importieren
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            await importJson(await file.text());
          } catch {
            onError("Import fehlgeschlagen: Datei ist kein gültiger Export.");
          }
        }}
      />
    </div>
  );
}
