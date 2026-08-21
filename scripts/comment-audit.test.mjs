import { describe, expect, it } from "vitest";

import {
  audit,
  classifyLines,
  commentBlocks,
  commentText,
  quotedPhrases,
  sectionRefs,
  sectionsIn,
  shingles,
} from "./comment-audit.mjs";

/**
 * A measurement is only worth anything if two runs of it are comparable, so
 * what this suite pins is the yardstick rather than any particular number.
 *
 * The cases that matter are the ones where a hand count and this tool would
 * disagree: JSX comments, a block that closes on the same line it opens, and
 * the legal citation that looks exactly like a doc reference.
 */

describe("classifying lines", () => {
  it("counts the three kinds apart", () => {
    const source = ["// a note", "", "const x = 1;", "const y = 2;"].join("\n");
    expect(classifyLines(source)).toEqual({ code: 2, comment: 1, blank: 1 });
  });

  it("counts every line of a block, including its continuations", () => {
    const source = ["/**", " * why", " */", "const x = 1;"].join("\n");
    expect(classifyLines(source)).toEqual({ code: 1, comment: 3, blank: 0 });
  });

  it("does not leave a one-line block open", () => {
    // `/* … */` on one line closes itself. Treating it as an opener would
    // swallow the rest of the file as commentary and report a ratio of ∞.
    const source = ["/* short */", "const x = 1;", "const y = 2;"].join("\n");
    expect(classifyLines(source)).toEqual({ code: 2, comment: 1, blank: 0 });
  });

  it("counts a JSX comment as a comment", () => {
    const source = ["{/* a note */}", "<p />"].join("\n");
    expect(classifyLines(source).comment).toBe(1);
  });
});

describe("finding long blocks", () => {
  const header = (/** @type {number} */ n) =>
    Array.from({ length: n }, (_, i) => ` * line ${i}`).join("\n");

  it("ignores a run under the threshold", () => {
    expect(commentBlocks(`/**\n${header(5)}\n */\nconst x = 1;`)).toEqual([]);
  });

  it("reports a run at or over it, with where it starts", () => {
    const blocks = commentBlocks(
      `const x = 1;\n/**\n${header(25)}\n */\nconst y = 2;`,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].length).toBe(27);
    expect(blocks[0].start).toBe(2);
  });

  it("does not run two separate blocks together", () => {
    const source = [
      `/**\n${header(22)}\n */`,
      "const x = 1;",
      `/**\n${header(22)}\n */`,
    ].join("\n");
    expect(commentBlocks(source)).toHaveLength(2);
  });
});

describe("comparing comments against the docs", () => {
  it("reads comment prose and leaves code alone", () => {
    const source = [
      "// One streak, one multiplier.",
      'const label = "not a comment";',
    ].join("\n");
    expect(commentText(source)).toBe("one streak one multiplier");
  });

  it("matches a phrase whose punctuation was changed", () => {
    // The failure this guards against is real: the same sentence appears in a
    // module and its design doc with different dashes, and a raw string
    // comparison would call that two different facts.
    const doc = shingles(
      "one streak one multiplier two currencies and one ring",
      4,
    );
    expect(
      quotedPhrases("one streak — one multiplier, two currencies", doc, 4),
    ).toBe(0);
    expect(
      quotedPhrases(
        commentText("// one streak — one multiplier, two currencies"),
        doc,
        4,
      ),
    ).toBeGreaterThan(0);
  });

  it("does not match prose the docs never carried", () => {
    const doc = shingles(
      "the sitemap is built from the world registry itself",
      8,
    );
    expect(
      quotedPhrases(
        "a completely unrelated sentence about something else entirely",
        doc,
      ),
    ).toBe(0);
  });
});

describe("resolving § references", () => {
  it("reads a reference that names its doc", () => {
    expect(sectionRefs("see docs/typing.md §8.6 for why")).toEqual([
      { doc: "typing", section: "8.6" },
    ]);
  });

  it("reads a citation that wrapped onto the next line", () => {
    // Still named. Read as bare, it would be resolved by where the file sits
    // when it already said where it points.
    expect(sectionRefs("the record book (docs/typing.md\n * §5.4)")).toEqual([
      { doc: "typing", section: "5.4" },
    ]);
  });

  it("reads a bare reference without guessing a doc", () => {
    expect(sectionRefs("the invariant in §5.3")).toEqual([
      { doc: null, section: "5.3" },
    ]);
  });

  it("ignores a legal citation", () => {
    // `17 U.S.C. §105` is in passages/documents.ts. Counting it would report a
    // reference to a section of printables.md that was never meant to exist.
    expect(
      sectionRefs("Federal works carry no copyright (17 U.S.C. §105)"),
    ).toEqual([]);
  });

  it("finds the sections a doc defines", () => {
    const markdown = [
      "## 8 · Hailstorm",
      "### 8.6 · Score can fall",
      "## Not numbered",
    ].join("\n");
    expect(sectionsIn(markdown)).toEqual(new Set(["8", "8.6"]));
  });
});

describe("the report", () => {
  const docs = new Map([
    [
      "docs/typing.md",
      "### 8.6 · Score\n\none streak one multiplier two currencies is the rule here",
    ],
  ]);

  it("adds the parts up", () => {
    const sources = new Map([
      ["src/a.ts", "// a note\nconst x = 1;"],
      ["src/b.ts", "// another\nconst y = 2;\nconst z = 3;"],
    ]);
    const report = audit(sources, docs);
    expect(report.totals.comment).toBe(2);
    expect(report.totals.code).toBe(3);
    expect(report.totals.ratio).toBeCloseTo(2 / 3);
  });

  it("notices a phrase lifted from a doc", () => {
    const sources = new Map([
      [
        "src/a.ts",
        "// one streak one multiplier two currencies is the rule here\nconst x = 1;",
      ],
    ]);
    expect(audit(sources, docs).totals.quoted).toBeGreaterThan(0);
  });

  it("reports a reference to a section that does not exist", () => {
    const sources = new Map([
      ["src/a.ts", "// see docs/typing.md §9.9\nconst x = 1;"],
    ]);
    const report = audit(sources, docs);
    expect(report.broken).toHaveLength(1);
    expect(report.broken[0]).toContain("§9.9");
  });

  it("passes a reference that resolves", () => {
    const sources = new Map([
      ["src/a.ts", "// see docs/typing.md §8.6\nconst x = 1;"],
    ]);
    expect(audit(sources, docs).broken).toEqual([]);
  });
});
