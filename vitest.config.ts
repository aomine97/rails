import { defineConfig } from "vitest/config";
import path from "node:path";

// The extension has its own package, jsdom and test run (cd extension && npx vitest run).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], exclude: ["node_modules", "extension/**", ".next/**"] },
});
