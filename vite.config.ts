import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Starter",
        short_name: "Starter",
        display: "standalone",
        start_url: "/",
        background_color: "#0d1117",
        theme_color: "#0d1117",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
      },
    }),
  ],
  // Modul server
  server: { proxy: { "/api": "http://localhost:8080", "/health": "http://localhost:8080" } },
});
