import { defineConfig } from "vitest/config";

export default defineConfig({
  // Don't inherit a postcss config from a parent directory we may have
  // sitting around (Next.js apps in the monorepo, etc.) — this is a
  // pure TypeScript test bundle, no CSS pipeline.
  css: { postcss: { plugins: [] } },
  test: {
    include: ["tests/**/*.spec.ts", "src/**/*.spec.ts"],
    reporters: ["default"],
  },
});
