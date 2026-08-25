import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/test.ts", "src/**/*.test.ts"],
    // Standalone tsx suites (run via `npm run test:*`), not vitest suites.
    exclude: [
      "src/features/lib/generator/generator.test.ts",
      "src/features/lib/traits/traits.test.ts",
      "src/features/lib/import/import.test.ts",
      "src/features/lib/import/zip-import.test.ts",
      "node_modules/**",
    ],
  },
});
