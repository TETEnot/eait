import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { uxp } from "vite-uxp-plugin";
import manifest from "./uxp/manifest.json" assert { type: "json" };

// Spike build output is loaded by the Adobe UXP Developer Tool.
// `dist/` becomes the plugin folder you point UDT at.
export default defineConfig({
  plugins: [
    react(),
    uxp({
      manifest,
      hotReloadPort: 8080,
      copyZipAssets: [],
    }),
  ],
  build: {
    target: "chrome104",
    sourcemap: true,
    rollupOptions: {
      external: ["uxp", "premierepro", "fs", "os", "path"],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
