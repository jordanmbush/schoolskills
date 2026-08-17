import { describe, expect, it } from "vitest";

import { FACES, glyphEm } from "../faces";
import { ruleCapacity, ruledLines } from "../layout";
import { RULINGS, inches, rulePitch, toInches, writingSpace } from "../paper";
import type {
  HandwritingConfig,
  Rule,
  RuleStyle,
  TraceRow,
  TraceStyle,
} from "../types";

import {
  DEFAULT_HAND_RULE,
  HANDWRITING_SHEET,
  MAX_REPEATS,
  describeHandwriting,
  handwritingLayout,
  instructionOf,
  traceStyles,
  wrapPassage,
} from "./handwriting";

/**
 * The family where the paper is the exercise.
 *
 * Three properties carry this sheet, and none of them can be seen by looking at
 * a screen:
 *
 * **The ruling is the size it says it is.** A ⅝ rule is ⅝ of an inch under a
 * ruler or the child is being taught the wrong size of letter. Every row is one
 * repeat of the ruling, so that promise is the row pitch and nothing else.
 *
 * **The model sits on the rules.** The tallest letter stands on the baseline
 * and reaches the top line, in whichever of the three faces the sheet is set
 * in — which is arithmetic over proportions measured out of the font files
 * (`faces.ts`), not a guess that happens to look right in one of them.
 *
 * **What is asked for is what is printed.** A page that quietly dropped `8` and
 * `9` off a sheet of number formation is a sheet that teaches eight numerals,
 * and nothing on screen would say so.
 */

const BASE: HandwritingConfig = {
  kind: "handwriting",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: ["name", "date"],
  style: "letters",
  rule: DEFAULT_HAND_RULE,
  letters: "both",
  trace: "dotted",
  repeats: 3,
};

const config = (over: Partial<HandwritingConfig> = {}): HandwritingConfig => ({
  ...BASE,
  ...over,
});

/** The rows a config actually printed. */
function rowsOf(over: Partial<HandwritingConfig> = {}): TraceRow[] {
  const [block] = HANDWRITING_SHEET.build(config(over), 1).blocks;
  return block?.kind === "trace" ? block.rows : [];
}

/**
 * Everything written on a sheet, in the order a child meets it.
 *
 * The empty places drop out, which is what they are: a cell the child fills in
 * carries no text at all, so that nothing announces the word they are supposed
 * to have thought of.
 */
const written = (rows: TraceRow[]): string[] => [
  ...new Set(
    rows.flatMap((row) =>
      row.cells.map((cell) => cell.text).filter((text) => text !== ""),
    ),
  ),
];

describe("what goes on a handwriting sheet", () => {
  it("writes the whole alphabet, upper and lower, on one page", () => {
    // The acceptance criterion, and the reason a row carries a text per cell:
    // fifty-two rows of one letter each is four sheets of ⅝ paper, and a sheet
    // that stopped at M would be a sheet that teaches half an alphabet.
    const pairs = written(rowsOf({ letters: "both" }));
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      expect(pairs, letter).toContain(`${letter}${letter.toLowerCase()}`);
    }

    expect(written(rowsOf({ letters: "upper" }))).toContain("Z");
    expect(written(rowsOf({ letters: "lower" }))).toContain("z");
    expect(written(rowsOf({ letters: "lower" }))).not.toContain("Z");
  });

  it("writes every numeral from nought to nine", () => {
    // Ten things at four repeats each is two to a row on inch-high paper —
    // which is the point of checking it rather than assuming it, because one
    // more repeat drops the last two numerals off the bottom of the page.
    const rule: Rule = { style: "hand-1", midline: "solid", descender: true };
    const drawn = written(rowsOf({ style: "numbers", rule, repeats: 4 }));
    for (const numeral of "0123456789") {
      expect(drawn, numeral).toContain(numeral);
    }
  });

  it("writes the words it was given, in the order they were given", () => {
    const words = ["because", "thought", "friend"];
    expect(written(rowsOf({ style: "words", words }))).toEqual(words);
  });

  it("keeps a capital and a small letter apart in a word list", () => {
    // The one place this family parts company with the spelling sheet: a
    // marker sees "The" and "the" as one word, and a handwriting sheet is
    // about the shape of the letters, where they are two different exercises.
    const words = ["The", "the", "the"];
    expect(written(rowsOf({ style: "words", words }))).toEqual(["The", "the"]);
  });

  it("breaks a passage where the paper runs out, and nowhere else", () => {
    const text =
      "The quick brown fox jumps over the lazy dog.\nHandwriting is slow before it is neat.";
    const lines = written(rowsOf({ style: "passage", text })).filter(
      (line) => line !== "",
    );
    expect(lines.length).toBeGreaterThan(2);
    // Nothing is lost and nothing is invented: the lines put back together are
    // the passage, with the author's own break kept.
    expect(lines.join(" ").replace(/\s+/g, " ")).toBe(
      text.replace(/\n/g, " ").replace(/\s+/g, " "),
    );
  });

  it("puts a passage on lines that fit the width it was measured against", () => {
    const line = "a".repeat(9);
    // Six words of nine letters and five spaces is fifty-nine characters; a
    // limit of twenty takes two of them per line.
    const wrapped = wrapPassage(`${line} ${line} ${line} ${line}`, 20);
    expect(wrapped).toEqual([`${line} ${line}`, `${line} ${line}`]);
    // A word longer than the whole line still gets a line rather than being
    // dropped or cut in half.
    expect(wrapPassage("antidisestablishmentarianism", 5)).toEqual([
      "antidisestablishmentarianism",
    ]);
  });
});

describe("trace, copy, then write it alone", () => {
  it("is a model, the tracing, and the place the child is on their own", () => {
    expect(traceStyles(config({ repeats: 4 }))).toEqual([
      "solid",
      "dotted",
      "dotted",
      "none",
    ]);
  });

  it("draws every repeat the same way when the progression is off", () => {
    expect(traceStyles(config({ repeats: 3, progression: false }))).toEqual([
      "dotted",
      "dotted",
      "dotted",
    ]);
  });

  it("gives the model on its own when there is nowhere to progress to", () => {
    expect(traceStyles(config({ repeats: 1 }))).toEqual(["solid"]);
    expect(traceStyles(config({ repeats: 2 }))).toEqual(["solid", "none"]);
  });

  it("stops where a row stops being legible", () => {
    expect(traceStyles(config({ repeats: 99 }))).toHaveLength(MAX_REPEATS);
    expect(traceStyles(config({ repeats: 0 }))).toHaveLength(1);
  });

  it("runs across the row for a letter and down the page for a line", () => {
    // The whole of the difference between the four styles: something short
    // enough to write several times on one line does, and a line of a passage
    // takes the next row instead.
    const across = rowsOf({ letters: "upper", repeats: 4 });
    expect(across[0].cells.map((cell) => cell.style)).toEqual([
      "solid",
      "dotted",
      "dotted",
      "none",
      "solid",
      "dotted",
      "dotted",
      "none",
      "solid",
      "dotted",
      "dotted",
      "none",
    ]);

    const down = rowsOf({ style: "passage", text: "One line.", repeats: 3 });
    expect(down.map((row) => row.cells.length)).toEqual([1, 1, 1]);
    expect(down.map((row) => row.cells[0].style)).toEqual([
      "solid",
      "dotted",
      "none",
    ]);
  });

  it("gives every row the same number of cells, short last row included", () => {
    // A final row that divided the page between four cells instead of twelve
    // would set its letters three times as far apart as the row above it,
    // which looks like a mistake because it is one.
    const rows = rowsOf({ letters: "upper", repeats: 4 });
    const widths = new Set(rows.map((row) => row.cells.length));
    expect(widths.size).toBe(1);
  });

  it("says what the row actually does, rather than what was asked for", () => {
    expect(instructionOf(config({ repeats: 4 }))).toBe(
      "Trace each letter, then write it on your own.",
    );
    expect(instructionOf(config({ repeats: 3, progression: false }))).toBe(
      "Trace each letter.",
    );
    // Nothing to trace: a solid model and an empty place is a copying sheet,
    // and it must not tell a child to trace something that isn't dotted.
    expect(instructionOf(config({ trace: "none", repeats: 3 }))).toBe(
      "Copy each letter on your own.",
    );
    expect(instructionOf(config({ trace: "solid", progression: false }))).toBe(
      "Write each letter.",
    );
    expect(instructionOf(config({ style: "passage", repeats: 3 }))).toBe(
      "Trace each line, then write it on the line below.",
    );
  });
});

/* ── Every ruling, every trace style ───────────────────────────────────────
   The acceptance criterion in as many words: the rulings of PRINT04 and the
   letterforms of PRINT15 are two independent choices, so all of them have to
   work together — including the combinations nobody would print.           */

const STYLES: RuleStyle[] = Object.keys(RULINGS) as RuleStyle[];
const TRACES: TraceStyle[] = [
  "solid",
  "dim",
  "hollow",
  "dotted",
  "dashed",
  "none",
];

describe("every ruling with every trace style", () => {
  it("prints something on all of them", () => {
    for (const style of STYLES) {
      for (const trace of TRACES) {
        const rows = rowsOf({ rule: { style }, trace, letters: "upper" });
        expect(rows.length, `${style} / ${trace}`).toBeGreaterThan(0);
        expect(rows[0].cells.length, `${style} / ${trace}`).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to ⅝ paper when there is no ruling to write on", () => {
    // Blank paper is the one ruling with no pitch, so a sheet ruled on it
    // would have no rows at all — a title and an empty page. It answers with
    // the commonest primary size instead, the way `rulingOf` answers with
    // something that prints rather than with nothing.
    const [block] = HANDWRITING_SHEET.build(
      config({ rule: { style: "blank" } }),
      1,
    ).blocks;
    expect(block.kind).toBe("trace");
    if (block.kind !== "trace") return;
    expect(block.rule).toEqual(DEFAULT_HAND_RULE);
  });

  it("never asks for more rows than the paper holds", () => {
    // Print is the whole of the output path (§10): a row past the bottom
    // margin is a second sheet out of the printer, and the preview would have
    // looked right.
    for (const style of STYLES) {
      for (const repeats of [1, 3, MAX_REPEATS]) {
        const rule: Rule = { style, descender: true };
        const drawn = rowsOf({ rule, repeats, letters: "both" });
        const { box } = handwritingLayout(config({ rule, repeats }), 1);
        const held = ruleCapacity(
          box.height,
          rulePitch(rule) > 0 ? rule : DEFAULT_HAND_RULE,
        );
        expect(drawn.length, `${style} × ${repeats}`).toBeLessThanOrEqual(held);
      }
    }
  });
});

/* ── The paper is the size it says it is ───────────────────────────────── */

describe("a ⅝ rule under a ruler", () => {
  it("repeats every five eighths of an inch, down a whole page of them", () => {
    const rule: Rule = {
      style: "hand-5-8",
      midline: "dashed",
      descender: true,
    };
    // A row is one repeat of the ruling and rows sit against each other, so
    // the distance between one baseline and the next is the pitch — measured
    // from the repeat index rather than accumulated, which is what stops a
    // rounding error compounding down the page (`layout.ts`).
    expect(toInches(rulePitch(rule))).toBe(0.625);

    const rows = rowsOf({ rule, letters: "both" });
    const page = ruledLines(
      { x: 0, y: 0, width: inches(7.5), height: rows.length * rulePitch(rule) },
      rule,
    );
    const bases = page.filter((line) => line.role === "base").map((l) => l.y);
    expect(bases).toHaveLength(rows.length);
    for (let at = 1; at < bases.length; at++) {
      expect(bases[at] - bases[at - 1]).toBe(inches(0.625));
    }
  });

  it("sets the model to the writing space, in whichever face it is in", () => {
    // The em is fixed to the top line, so the tallest letter stands on the
    // baseline and reaches it. Two faces on one rule are two type sizes, which
    // is the reason `faces.ts` measures rather than shares a ratio.
    const rule: Rule = {
      style: "hand-5-8",
      midline: "dashed",
      descender: true,
    };
    const writing = writingSpace(rule);
    const sizes = new Set<number>();
    for (const face of Object.values(FACES)) {
      const { em } = handwritingLayout(config({ rule, font: face.id }), 1);
      expect(Math.abs(em * face.ascent - writing), face.family) //
        .toBeLessThanOrEqual(1);
      sizes.add(em);
    }
    expect(sizes.size).toBe(Object.keys(FACES).length);
  });

  it("fits a wider face on the same line by writing fewer of them", () => {
    // OpenDyslexic is half as wide again as Andika, so a row of it holds
    // fewer groups — which is a fact about the font file, not a guess, and it
    // is why the packing is per face rather than a constant.
    const rule: Rule = { style: "hand-5-8", descender: true };
    const print = handwritingLayout(config({ rule, font: "print" }), 1);
    const wide = handwritingLayout(config({ rule, font: "dyslexic" }), 1);
    expect(wide.perRow).toBeLessThan(print.perRow);
  });

  it("writes smaller letters on smaller paper, not the same ones", () => {
    const big = glyphEm(
      writingSpace({ style: "hand-1", descender: true }),
      FACES.print,
    );
    const small = glyphEm(writingSpace({ style: "hand-3-8" }), FACES.print);
    expect(small).toBeLessThan(big);
  });
});

/* ── The sheet itself ──────────────────────────────────────────────────── */

describe("the sheet", () => {
  it("is the same page on every build", () => {
    // §7, and what lets a catalog page be prerendered: a parent who printed
    // this in March prints the identical sheet in June.
    for (const seed of [0, 1, 4242]) {
      expect(JSON.stringify(HANDWRITING_SHEET.build(config(), seed))).toBe(
        JSON.stringify(HANDWRITING_SHEET.build(config(), seed)),
      );
    }
  });

  it("has nothing to mark and no key to disagree with it", () => {
    const sheet = HANDWRITING_SHEET.build(config(), 1);
    // No score box: a handwriting sheet is not marked out of anything, and a
    // "___ / 26" over a page of letters would be a number nobody can award.
    expect(sheet.header.score).toBeUndefined();
    expect(sheet.answers).toBe(false);
    expect(HANDWRITING_SHEET.key(sheet)).toBe(sheet);
  });

  it("prints the name line blank, because it has nothing to fill it with", () => {
    expect(HANDWRITING_SHEET.build(config(), 1).header.fields) //
      .toEqual(["name", "date"]);
  });

  it("names itself in the terms it was chosen by", () => {
    expect(describeHandwriting(config())).toBe(
      'Letter practice — capitals and small letters — handwriting ⅝" — written 3 times',
    );
    expect(describeHandwriting(config({ style: "numbers", repeats: 4 }))).toBe(
      'Number formation — 0 to 9 — handwriting ⅝" — written 4 times',
    );
  });

  it("survives a config that says something this build has never heard of", () => {
    // Every field here can arrive from a shared link or a sheet saved before a
    // rename, so a lookup keyed on one has to answer rather than throw.
    const stale = {
      ...config(),
      style: "toString",
      letters: "constructor",
      rule: { style: "runes" },
    } as unknown as HandwritingConfig;
    expect(() => HANDWRITING_SHEET.build(stale, 1)).not.toThrow();
    expect(HANDWRITING_SHEET.build(stale, 1).blocks.length).toBe(1);
  });
});
