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
  // A snippet that does not parse reports one message with `ruleId: null`, and
  // no rule ever runs on it — which satisfies every `not.toContain` in this
  // file. The cases asserting a rule stays quiet would then pass by not having
  // been linted at all, so a fatal is raised rather than mapped over.
  const fatal = result.messages.find((message) => message.fatal);
  if (fatal) throw new Error(`${filePath} did not parse: ${fatal.message}`);
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

/**
 * The one boundary here that a measurement drew rather than a principle
 * (docs/typing.md §5.3, decision 7).
 *
 * `decks/index.ts` is imported by every island on the site, so the deck layer's
 * import graph is the shared chunk. The passage library got into it once and
 * took that chunk from 46 KB to 222 KB, which is why thirty-three verses are
 * written out by hand in `decks/typing.ts` today — and why the corpus one
 * directory over is a lint rule instead of a paragraph.
 *
 * The negative cases matter as much as the positives. `lessons.ts` has to stay
 * importable or `deckSpec("typing:L07")` cannot name a lesson in a record book,
 * and the typing island has to be free to import the corpus, since that is the
 * whole plan.
 *
 * And because `lessons.ts` is importable, the ban cannot stop at the deck
 * directory: what §5.3 requires is that the corpus never become *reachable*
 * from `decks/index.ts`, and a corpus import inside `lessons.ts` is the shared
 * chunk one hop further out, with nothing in `decks/` looking wrong. Two cases
 * below are that hop — including the `./lexicon` spelling, which is the only
 * one a file in that directory would ever write.
 */
describe("the typing corpus (src/engine/decks/ → engine/typing/)", () => {
  const CORPUS = "local/no-corpus-in-decks";

  it.each([
    [
      'import { WORDS } from "@/engine/typing/lexicon";\nexport const x = WORDS;\n',
    ],
    ['import { words } from "../typing/generate";\nexport const x = words;\n'],
    ['export * from "@/engine/typing/lexicon";\n'],
    ['export const load = () => import("@/engine/typing/generate");\n'],
  ])("rejects %s", async (code) => {
    const fired = await rulesFiredFor("src/engine/decks/typing.ts", code);
    expect(fired).toContain(CORPUS);
  });

  /**
   * The one hop. `lessons.ts` is the single engine/typing module the deck layer
   * may import, so it is the single file where a corpus import buys the whole
   * site a 222 KB chunk without a line of `decks/` changing. Both spellings are
   * pinned: the aliased one, and the relative one a neighbour actually writes.
   */
  it.each([
    ['import { WORDS } from "./lexicon";\nexport const x = WORDS;\n'],
    [
      'import { words } from "@/engine/typing/generate";\nexport const x = words;\n',
    ],
    ['export * from "./lexicon";\n'],
  ])(
    "rejects %s from lessons.ts, one hop from the deck layer",
    async (code) => {
      const fired = await rulesFiredFor("src/engine/typing/lessons.ts", code);
      expect(fired).toContain(CORPUS);
    },
  );

  it("allows lessons.ts, which is how a saved run gets its name", async () => {
    const fired = await rulesFiredFor(
      "src/engine/decks/typing.ts",
      `import { LESSONS } from "@/engine/typing/lessons";\nexport const x = LESSONS;\n`,
    );
    expect(fired).not.toContain(CORPUS);
  });

  it("allows the island the corpus was written for", async () => {
    const fired = await rulesFiredFor(
      "src/games/typing/ladder/Lesson.tsx",
      `import { WORDS } from "@/engine/typing/lexicon";\nexport const x = WORDS;\n`,
    );
    expect(fired).not.toContain(CORPUS);
  });

  /**
   * The exemptions. Banning the engine by default is what makes the rule
   * survive the graph growing, but the corpus has to be readable by the two
   * modules whose whole job is to read it — the generator that filters it
   * (LES04) and the test that walks every character of it. Neither is
   * importable from `decks/`, which is the property the rule protects.
   */
  it.each([
    ["src/engine/typing/generate.ts"],
    ["src/engine/typing/lexicon.test.ts"],
  ])("allows %s to read the corpus it exists for", async (filePath) => {
    const fired = await rulesFiredFor(
      filePath,
      `import { WORDS } from "./lexicon";\nexport const x = WORDS;\n`,
    );
    expect(fired).not.toContain(CORPUS);
  });

  /** Not every `./lexicon` is this one — the rule resolves before it judges. */
  it("leaves an unrelated module's own neighbour alone", async () => {
    const fired = await rulesFiredFor(
      "src/engine/decks/typing.ts",
      `import { WORDS } from "./lexicon";\nexport const x = WORDS;\n`,
    );
    expect(fired).not.toContain(CORPUS);
  });
});
