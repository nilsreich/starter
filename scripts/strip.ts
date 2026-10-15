// Entfernt Module aus dem Starter (siehe MODULES.md): bun scripts/strip.ts <deploy|sync|server>...
// Die CI führt `bun scripts/strip.ts <Modul> && bun install && bun run check` je Modul aus (`server` entfernt auch sync und deploy) – so bleibt das Entfernen getestet.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const MODULES: Record<
  string,
  { rm: string[]; lines?: Record<string, RegExp>; scripts?: string[]; deps?: string[] }
> = {
  deploy: { rm: ["Dockerfile", ".dockerignore", "deploy"] },
  sync: {
    rm: ["src/client/sync", "src/server/sync.test.ts"],
    lines: { "src/client/main.tsx": /Modul sync/, "index.html": /id="sync"/ },
  },
  server: {
    rm: ["src/server", "migrations", "tsconfig.server.json", ".env.example"],
    lines: { "vite.config.ts": /Modul server/ },
    scripts: ["dev:server", "dev:client", "start"],
    deps: ["hono", "@hono/zod-validator"],
  },
};

const requested = process.argv.slice(2);
if (!requested.length || requested.some((m) => !MODULES[m])) {
  console.error(`Aufruf: bun scripts/strip.ts <${Object.keys(MODULES).join("|")}>...`);
  process.exit(1);
}
// Abhängigkeiten: server braucht kein deploy, aber sync und deploy brauchen server.
// server entfernt zwingend auch sync und deploy (sonst bleibt eine kaputte App bei grünem Check).
const wanted = new Set(requested);
if (wanted.has("server")) for (const m of ["sync", "deploy"]) wanted.add(m);
const order = ["sync", "deploy", "server"].filter((m) => wanted.has(m));

for (const name of order) {
  const m = MODULES[name];
  if (!m) continue;
  for (const p of m.rm) rmSync(p, { recursive: true, force: true });
  for (const [file, re] of Object.entries(m.lines ?? {})) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    // Marker-Zeile mit der Folgezeile entfernen, wenn sie nur zum Statement gehört (vite proxy).
    const out = lines.filter(
      (l, i) => !re.test(l) && !(file === "vite.config.ts" && re.test(lines[i - 1] ?? "")),
    );
    writeFileSync(file, out.join("\n"));
  }
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const s of m.scripts ?? []) delete pkg.scripts[s];
  if (name === "server") pkg.scripts.dev = "vite";
  if (name === "server")
    pkg.scripts.check = pkg.scripts.check.replace(
      " && (test ! -f tsconfig.server.json || tsc --noEmit -p tsconfig.server.json)",
      "",
    );
  for (const d of m.deps ?? []) delete pkg.dependencies[d];
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
}
console.log("entfernt:", order.join(", "), "– jetzt `bun install && bun run check`");
