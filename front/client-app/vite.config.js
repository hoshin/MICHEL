import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  // Only user drop-in assets are served verbatim. The bundled assets under
  // src/assets/{misc_logos,portraits} are consumed via `import` /
  // `import.meta.glob`, so they must NOT live in the public directory (Vite
  // forbids importing from it). A caster drops e.g. a tournament logo into
  // src/assets/custom/ and references it by its served root URL (e.g.
  // /my-logo.png).
  publicDir: "./src/assets/custom",
  build: {
    outDir: "../../dist/front",
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
  },
});
