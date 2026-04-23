import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "service-worker.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: "VenueNav",
        short_name: "VenueNav",
        description: "Indoor venue maps and step-by-step navigation",
        start_url: "/",
        display: "standalone",
        background_color: "#0c1220",
        theme_color: "#0c1220",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5174, proxy: { "/v1": { target: "http://127.0.0.1:8080", changeOrigin: true } } },
});
