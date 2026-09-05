import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "RoadShare",
        short_name: "RoadShare",
        theme_color: "#123a52",
        background_color: "#f4f1e8",
        display: "standalone",
        icons: [],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
  test: { environment: "jsdom", setupFiles: "./src/tests/setup.ts" },
});
