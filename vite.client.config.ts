import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist-client",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        client: "client.html"
      }
    }
  }
});
