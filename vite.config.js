import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Set base path for GitHub Pages deployment
  // Use relative paths for maximum compatibility
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(new Date().toLocaleTimeString()),
  },
});
