import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  publicDir: "./src/assets",
  build: {
    outDir: "../../dist/front",
  },
  plugins: [react()],
});
