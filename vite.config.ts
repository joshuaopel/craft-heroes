import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "docs",
    emptyOutDir: false,
    target: "es2020",
    rollupOptions: {
      input: {
        editor: "index.html",
        client: "client.html"
      }
    }
  }
});
