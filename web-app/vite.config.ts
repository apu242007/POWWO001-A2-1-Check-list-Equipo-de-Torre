import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages sirve bajo /<repo>/. VITE_BASE lo inyecta el workflow.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/",
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
