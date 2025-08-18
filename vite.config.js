import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  build: { 
    target: "es2020",
    outDir: "dist"
  },
  // Set base path for GitHub Pages deployment
  // If this is deployed to pixshatterer.github.io/cast-receiver, set base: "/cast-receiver/"
  // If this is the main site, keep base: "/"
  base: process.env.NODE_ENV === 'production' ? '/cast-receiver/' : '/'
});