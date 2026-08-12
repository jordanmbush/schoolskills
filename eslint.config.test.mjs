import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/**
 * The architecture boundaries, tested like the code they guard.
 *
 * These rules only earn their keep if they actually fire, and a flat config has
 * two quiet ways to stop firing: a same-rule-id block over an overlapping file
 * set silently replaces an earlier one, and a plugin namespace declared twice
 * throws only for files matching both blocks. The first draft of
 * `eslint.config.mjs` shipped the second bug — every probe passed except the
 * one file in the overlap. A rule that has stopped reporting looks exactly like
 * a codebase with no violations, so nothing else would have caught it.
 *
 * Each case lints a snippet AS IF it lived at a path in the layer under test,
 * and asserts on rule ids rather than message text so rewording a message
 * doesn't fail the suite.
 */

const eslint = new ESLint({ cwd: import.meta.dirname });

/** Rule ids reported for `code`, resolved against the config for `filePath`. */
async function rulesFiredFor(filePath, code) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

const LAYER = "@typescript-eslint/no-restricted-imports";
const PACKAGE = "no-restricted-imports";
const SYNTAX = "no-restricted-syntax";

describe("model layer (src/engine/)", () => {
  it("rejects React — the engine must stay framework-agnostic", async () => {
    const fired = await rulesFiredFor(
      "src/engine/deck.ts",
      `import { useState } from "react";\nexport const x = useState;\n`,
    );
    expect(fired).toContain(LAYER);
  });

  it("rejects the storage package", async () => {
    const fired = await rulesFiredFor(
      "src/engine/deck.ts",
      `import { openDB } from "idb";\nexport const x = openDB;\n`,
    );
    expect(fired).toContain(PACKAGE);
  });

  it("rejects bare and window-qualified storage globals", async () => {
    const bare = await rulesFiredFor(
      "src/engine/deck.ts",
      `export const x = localStorage.getItem("k");\n`,
    );
    expect(bare).toContain("no-restricted-globals");

    // The `window.`-prefixed form is a member expression, invisible to
    // no-restricted-globals — it needs the local rule.
    const qualified = await rulesFiredFor(
      "src/engine/deck.ts",
      `export const x = window.localStorage.getItem("k");\n`,
    );
    expect(qualified).toContain("local/no-window-storage");
  });
});

describe("view layer (src/components/, src/games/, src/pages/)", () => {
  it("rejects reaching past a service into storage", async () => {
    const fired = await rulesFiredFor(
      "src/components/Hub.tsx",
      `import { db } from "@/services/storage/db";\nexport const x = db;\n`,
    );
    expect(fired).toContain(LAYER);
  });

  it("rejects hand-rolled native controls", async () => {
    const fired = await rulesFiredFor(
      "src/components/Hub.tsx",
      `export const X = () => <button type="button">go</button>;\n`,
    );
    expect(fired).toContain(SYNTAX);
  });

  // The test above uses a made-up path, so it passed for the whole time an
  // allowlist exempted eight real files from the same rule. These are those
  // files. If an allowlist ever comes back, this is what fails.
  it.each([
    "src/components/PlayerEditor.tsx",
    "src/components/TopBar.tsx",
    "src/components/BackupPanel.tsx",
    "src/components/screens/PlayerHub.tsx",
    "src/components/screens/PlayerSelect.tsx",
    "src/components/screens/Progress.tsx",
    "src/games/flashcards/App.tsx",
    "src/games/flashcards/RaceSetup.tsx",
    "src/games/flashcards/RaceTrack.tsx",
    "src/games/flashcards/RaceResults.tsx",
  ])("rejects native controls at %s, which used to be exempt", async (path) => {
    const fired = await rulesFiredFor(
      path,
      `export const X = () => <button type="button">go</button>;\n`,
    );
    expect(fired).toContain(SYNTAX);
  });

  it('rejects role="button" on a non-button', async () => {
    const fired = await rulesFiredFor(
      "src/components/Hub.tsx",
      `export const X = () => <div role="button" tabIndex={0} onClick={() => {}} onKeyDown={() => {}} />;\n`,
    );
    expect(fired).toContain("local/prefer-button-component");
  });

  // The regression that motivated this file: the storage rules and the button
  // rules apply to overlapping file sets, and a .tsx in src/components/ is the
  // one path that matches both. If the `local` plugin is ever re-declared
  // per-block, linting this file throws instead of reporting.
  it("reports both overlapping rule families on one file", async () => {
    const fired = await rulesFiredFor(
      "src/components/Hub.tsx",
      `export const X = () => {\n  const v = window.localStorage.getItem("k");\n  return <button type="button">{v}</button>;\n};\n`,
    );
    expect(fired).toContain("local/no-window-storage");
    expect(fired).toContain(SYNTAX);
  });
});

describe("primitive kit (src/components/ui/)", () => {
  it("rejects service imports — primitives are prop-driven", async () => {
    const fired = await rulesFiredFor(
      "src/components/ui/Button.tsx",
      `import { profiles } from "@/services/profiles";\nexport const x = profiles;\n`,
    );
    expect(fired).toContain(LAYER);
  });

  it("allows the native controls it exists to wrap", async () => {
    const fired = await rulesFiredFor(
      "src/components/ui/Button.tsx",
      `export const Button = () => <button type="button">go</button>;\n`,
    );
    expect(fired).not.toContain(SYNTAX);
  });

  it("allows a type-only import of an engine contract", async () => {
    const fired = await rulesFiredFor(
      "src/components/ui/Badge.tsx",
      `import type { Operation } from "@/engine/types";\nexport const x = (o: Operation) => o;\n`,
    );
    expect(fired).not.toContain(LAYER);
  });
});

describe("storage service (src/services/storage/)", () => {
  it("is the one layer allowed to touch storage", async () => {
    const fired = await rulesFiredFor(
      "src/services/storage/db.ts",
      `import { openDB } from "idb";\nexport const x = async () => [openDB, window.localStorage, indexedDB];\n`,
    );
    expect(fired).not.toContain(PACKAGE);
    expect(fired).not.toContain("no-restricted-globals");
    expect(fired).not.toContain("local/no-window-storage");
  });
});
