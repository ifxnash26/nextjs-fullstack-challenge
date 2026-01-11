import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: "@/server", replacement: path.resolve(fileURLToPath(new URL("./src/server", import.meta.url))) },
      { find: "@", replacement: path.resolve(fileURLToPath(new URL(".", import.meta.url))) },
    ],
  },
});
