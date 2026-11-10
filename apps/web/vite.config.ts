import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // Must come before the React plugin.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    // The API runs under `wrangler dev`; proxying keeps the browser on one origin, like production.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: false } },
  },
  build: { outDir: "dist", sourcemap: false },
});
