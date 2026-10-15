import { useEffect, useRef, useState } from "react";
import type { Item } from "../shared/schema";
import { exportJson, importJson, list, remove, subscribe, upsert } from "./store";
import { Button, Checkbox, TextField } from "./ui/atoms";

export function App() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

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
          if (!title.trim()) return;
          void run(() => upsert({ title, done: false }));
          setTitle("");
        }}
      >
        <TextField label="Neuer Eintrag" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" variant="primary">
          Hinzufügen
        </Button>
      </form>
      {error && (
        <p className="kl-error" role="alert">
          {error}
        </p>
      )}
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
      <Backup onError={setError} />
    </main>
  );
}

/** JSON-Sicherung: Daten liegen im Browser, daher Export/Import als Notweg (Gerätewechsel). */
function Backup({ onError }: { onError: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <p>
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
    </p>
  );
}
