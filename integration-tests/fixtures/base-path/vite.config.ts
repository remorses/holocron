import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/vite";

export default defineConfig({
  base: "/docs",
  clearScreen: false,
  plugins: [holocron()],
});
