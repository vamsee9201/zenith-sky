import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
});
