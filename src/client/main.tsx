import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { persist } from "./store";
import { mountSync } from "./sync"; // Modul sync
import "./ui/tokens.css";
import "./ui/components.css";
import "./app.css";

void persist();
mountSync(document.getElementById("sync")); // Modul sync
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
