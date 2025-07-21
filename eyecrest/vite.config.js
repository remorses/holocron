import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": new URL(
        "./src/mocks/cloudflare-workers.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
