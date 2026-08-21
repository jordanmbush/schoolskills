import { describe, expect, it } from "vitest";

import { auditSections, docFor } from "./section-guard.mjs";

/**
 * A guard that always passes is indistinguishable from a guard that works,
 * right up until the day it was supposed to fire. So this suite makes it fire,
 * once per way a citation and the document it points into can come apart.
 *
 * The build-time half reads the tree that actually shipped; this half proves
 * that what it reads it also judges correctly — and, for the bare references
 * that are most of them, that it resolves them the way CLAUDE.md says it does.
 */

const DOCS = new Map([
  ["docs/typing.md", "## 5 · The ladder\n\n### 5.4 · Ghost identity\n"],
  ["docs/printables.md", "## 7 · Answer keys\n\n## 14 · The builder\n"],
]);

const source = (/** @type {string} */ text) => new Map([["src/a.ts", text]]);

describe("which document a bare § means", () => {
  it("resolves a subtree", () => {
    expect(docFor("src/engine/sheets/maths/money.ts")).toBe("printables");
    expect(docFor("src/games/typing/storm/StormHud.tsx")).toBe("typing");
  });

  it("resolves the stylesheets that belong to one subject", () => {
    // Not a subtree: src/styles/ holds both subjects' sheets side by side.
    expect(docFor("src/styles/game/keyboard.css")).toBe("typing");
    // And not the whole of src/styles/game/ — the race and the card are drawn
    // by both islands, so nothing about where they sit names a document.
    expect(docFor("src/styles/game/race.css")).toBeNull();
    expect(docFor("src/styles/print.css")).toBe("printables");
  });

  it("claims nothing for shared code", () => {
    expect(docFor("src/engine/records.ts")).toBeNull();
  });
});

describe("auditing the citations against docs/", () => {
  it("passes a reference that lands, named or bare", () => {
    const sources = new Map([
      ["src/engine/typing/ladder.ts", "// the rung it files under (§5.4)"],
      ["src/engine/records.ts", "// see docs/printables.md §14"],
    ]);
    expect(auditSections(sources, DOCS)).toEqual([]);
  });

  it("fails a bare reference to a section nobody wrote", () => {
    const sources = new Map([
      ["src/engine/typing/ladder.ts", "// the rung it files under (§5.9)"],
    ]);
    const problems = auditSections(sources, DOCS);
    expect(problems).toHaveLength(1);
    // The file, the reference, and the doc it was resolved against — with a
    // bare citation the last of those is the half a reader cannot see.
    expect(problems[0]).toContain("src/engine/typing/ladder.ts");
    expect(problems[0]).toContain("§5.9");
    expect(problems[0]).toContain("docs/typing.md");
  });

  it("fails a named reference to a section nobody wrote", () => {
    const problems = auditSections(source("// see docs/typing.md §9.9"), DOCS);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("§9.9");
  });

  it("resolves a shared file by the one document it cites", () => {
    // `engine/progress.ts` is the real case: no subtree owns it, eleven of its
    // references are bare, and every named one of them is typing's.
    const sources = new Map([
      ["src/engine/progress.ts", "// docs/typing.md §5 says, and so (§5.4)"],
    ]);
    expect(auditSections(sources, DOCS)).toEqual([]);
  });

  it("fails a bare reference in a file with two subjects", () => {
    // The rule CLAUDE.md already states — anywhere genuinely shared, name the
    // document — with a build behind it. §14 exists, in the other doc.
    const sources = new Map([
      [
        "src/engine/decks/index.ts",
        "// docs/typing.md §5.4 and docs/printables.md §7, then (§14)",
      ],
    ]);
    const problems = auditSections(sources, DOCS);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("nothing resolves it");
  });

  it("ignores a legal citation", () => {
    // `17 U.S.C. §105` is in passages/documents.ts, under the sheets subtree.
    // Resolving it would fail the build over a section of printables.md that
    // was never meant to exist.
    const sources = new Map([
      [
        "src/engine/sheets/passages/documents.ts",
        "// Federal works carry no copyright (17 U.S.C. §105); §7 keys them.",
      ],
    ]);
    expect(auditSections(sources, DOCS)).toEqual([]);
  });

  it("says so rather than passing when docs/ numbers nothing", () => {
    // How a two-ended check rots: headings that stopped being numbered leave
    // every citation resolving against an empty set, and a strict guard would
    // report a thousand breaks. Neither answer is "fine".
    const docs = new Map([["docs/typing.md", "## The ladder\n"]]);
    const problems = auditSections(source("// see docs/typing.md §5.4"), docs);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("No numbered headings");
  });

  it("says so rather than passing when there is nothing to check", () => {
    // The other way: a moved source directory finds no files, and an empty
    // loop reports no problems forever.
    expect(auditSections(new Map(), DOCS)[0]).toContain(
      "No § references were found",
    );
  });
});
