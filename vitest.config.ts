import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The engine suite runs in plain Node, with no Astro and no browser.
 *
 * That is the point of the model boundary: `src/engine/` is banned from
 * importing React or Astro (see block A of `eslint.config.mjs`), so scoring,
 * mastery and the deck registry can be exercised as ordinary functions over
 * plain data — no DOM, no `client:only` island, no build step.
 *
 * The alias has to be restated here. `tsconfig.json` teaches the type checker
 * what `@/` means and Astro teaches the bundler, but Vitest reads neither.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.test.{ts,tsx,mjs}"],
    exclude: ["node_modules/**", "dist/**", ".sst/**", "e2e/**"],
  },
});
