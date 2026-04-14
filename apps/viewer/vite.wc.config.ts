import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Web Component / library build (V11 – NF1).
 * Produces a single self-contained JS bundle that registers
 * <logo-viewer> as a custom element using shadow DOM.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-wc",
    lib: {
      entry: "src/web-component.ts",
      name: "LogoViewer",
      fileName: "logo-viewer",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
