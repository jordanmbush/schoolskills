import { describe, expect, it } from "vitest";

import {
  CURSIVE_FACES,
  FACES,
  glyphAdvance,
  glyphEm,
  isCursive,
} from "../faces";
import { ruleCapacity, ruledLines } from "../layout";
import { RULINGS, inches, rulePitch, toInches, writingSpace } from "../paper";
import {
  SCRIPTURE_CREDIT,
  listPassages,
  passage,
  passageText,
} from "../passages";
import type {
  HandwritingConfig,
  Rule,
  RuleStyle,
  TraceRow,
  TraceStyle,
} from "../types";

import { MAX_TEXT, copyworkSource } from "./copywork";
import {
  DEFAULT_HAND_RULE,
  HANDWRITING_SHEET,
  MAX_REPEATS,
  describeHandwriting,
  fontOf,
  handwritingLayout,
  instructionOf,
  traceStyles,
  wrapPassage,
} from "./handwriting";
import { JOIN_FAMILIES, joinPairs } from "./joins";

/**
 * The family where the paper is the exercise.
 *
 * Three properties carry this sheet, and none of them can be seen by looking at
 * a screen: the ruling is the size it says it is, which is the row pitch and
 * nothing else; the tallest letter stands on the baseline and reaches the top
 * line in whichever of the five faces the sheet is set in; and what is asked
 * for is what is printed — a page that quietly dropped `8` and `9` off a sheet
 * of number formation is a sheet that teaches eight numerals.
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
    // Ten things at three repeats each is two to a row on inch-high paper —
    // which is the point of checking it rather than assuming it, because one
    // more repeat drops the last two numerals off the bottom of the page. A
    // numeral that fills a 1-inch rule's writing space is 0.47in wide at
    // Andika's mean advance (`Face.figure`, `Face.advance`), so four of them
    // and their air is 3.79in and two groups no longer fit across 7.5in.
    const rule: Rule = { style: "hand-1", midline: "solid", descender: true };
    const drawn = written(rowsOf({ style: "numbers", rule, repeats: 3 }));
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
    // The whole of the difference between the styles: something short
    // enough to write several times on one line does, and a line of a passage
    // takes the next row instead.
    const across = rowsOf({ letters: "upper", repeats: 4 });
    const group = ["solid", "dotted", "dotted", "none"];
    const cells = across[0].cells.map((cell) => cell.style);
    // A whole number of progressions, more than one of them, and no partial
    // group at the end. How many fit is the packing's business and depends on
    // the face and on what is written (`glyphAdvance`); that several do is
    // this style's, and it is what the assertion is for.
    expect(cells.length % group.length).toBe(0);
    expect(cells.length / group.length).toBeGreaterThan(1);
    for (let at = 0; at < cells.length; at += group.length) {
      expect(cells.slice(at, at + group.length)).toEqual(group);
    }

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
    // Nothing to copy either: `trace: "none"` with the progression off draws
    // no model anywhere, so the sheet is blank ruled paper and must not tell a
    // child to copy something that was never printed.
    expect(instructionOf(config({ trace: "none", progression: false }))).toBe(
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

  it("puts a capital on the top line when a capital is the tallest thing", () => {
    // The claim the capitals page makes and invites a reader to measure. The
    // em is fixed to the tallest thing the sheet writes, and on a sheet of
    // nothing but capitals that is a capital rather than an ascender — so
    // sizing it off `ascent` would leave every capital a tenth of the writing
    // space short of the line the page says it starts on.
    const rule: Rule = {
      style: "hand-3-4",
      midline: "dashed",
      descender: true,
    };
    const writing = writingSpace(rule);
    for (const face of Object.values(FACES)) {
      const { em } = handwritingLayout(
        config({ rule, font: face.id, letters: "upper" }),
        1,
      );
      expect(Math.abs(em * face.capHeight - writing), face.family) //
        .toBeLessThanOrEqual(1);
    }

    // And a numeral on a sheet of nothing but numerals, which is not the same
    // number: OpenDyslexic's digits are a tenth shorter than its capitals.
    for (const face of Object.values(FACES)) {
      const { em } = handwritingLayout(
        config({ rule, font: face.id, style: "numbers" }),
        1,
      );
      expect(Math.abs(em * face.figure - writing), face.family) //
        .toBeLessThanOrEqual(1);
    }
  });

  it("goes back to the ascender the moment a small letter is on the row", () => {
    // The other half of it. A row cannot put a capital and an `l` on the same
    // line, and an ascender through the top rule is the worse of the two
    // misses — so `Aa` is sized off the ascender and the capital rides low.
    const rule: Rule = {
      style: "hand-3-4",
      midline: "dashed",
      descender: true,
    };
    const both = handwritingLayout(config({ rule, letters: "both" }), 1);
    const upper = handwritingLayout(config({ rule, letters: "upper" }), 1);
    expect(both.em * FACES.print.ascent).toBeCloseTo(writingSpace(rule), -1);
    expect(upper.em).toBeGreaterThan(both.em);
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

  it("gives a cell room for what is written in it, in every face", () => {
    // The invariant the packing exists to hold, and the one that broke: a row
    // is divided into equal cells (`TracedRow`), so a group packed off a mean
    // that is too small for what is actually on the row puts the model's ink
    // over the trace beside it. In a joined hand that does not look like
    // crowding — it looks like one continuous joined string, on the sheet
    // whose whole subject is where a join belongs.
    //
    // Asserted against the face's own declared width for what is written
    // (`glyphAdvance`), because there is no DOM here to measure ink in — the
    // same bargain the packing itself strikes. A row with one group on it is
    // exempt: `perRow` floors at one, and past that point it is `fittedEm` in
    // `TracedRow` that shrinks the type rather than the packing that widens
    // the cell.
    for (const face of Object.values(FACES)) {
      for (const style of STYLES) {
        for (const letters of ["both", "upper", "lower"] as const) {
          const over = { rule: { style }, font: face.id, letters } as const;
          const rows = rowsOf(over);
          const { box, em, perRow } = handwritingLayout(config(over), 2);
          if (perRow < 2) continue;
          for (const row of rows) {
            const said = row.cells.map((cell) => cell.text).join("");
            if (said === "") continue;
            const cell = Math.floor(box.width / row.cells.length);
            const longest = row.cells.reduce(
              (most, one) => Math.max(most, one.text.length),
              0,
            );
            // The longest thing on the row plus the character of air the
            // packing reserved for it — the whole of what a cell was promised.
            const need = em * glyphAdvance(said, face) * (longest + 1);
            // A mil of slack, and only a mil: `across` and the cell width are
            // each floored to a whole thousandth of an inch, which is already
            // finer than a 600dpi printer can place a dot.
            expect(cell, `${face.id} / ${style} / ${letters}`) //
              .toBeGreaterThanOrEqual(need - 1);
          }
        }
      }
    }
  });
});

/* ── Cursive, and the one style only cursive has ───────────────────────────
   A cursive sheet is these same sheets in a joining face, so most of what is
   asserted above covers it already — the rulings, the progression, the em set
   from the face's own ascent. What is new is a set of content that print has no
   use for, and a face that a sheet can insist on.                           */

describe("joined writing", () => {
  it("writes the joins, all six families, on one page", () => {
    // The story's own criterion. A join is only correct in the company of the
    // letters either side of it, so what goes on the page is pairs — and the
    // sheet has to hold every family rather than as many as happen to fit.
    const written = new Set(
      rowsOf({ style: "joins", font: "cursive", repeats: 3 }).flatMap((row) =>
        row.cells.map((cell) => cell.text).filter((text) => text !== ""),
      ),
    );
    for (const pair of joinPairs()) expect(written, pair).toContain(pair);
    expect(written.size).toBe(joinPairs().length);
  });

  it("writes one family when one was asked for", () => {
    for (const family of JOIN_FAMILIES) {
      const written = new Set(
        rowsOf({ style: "joins", joins: family.id }).flatMap((row) =>
          row.cells.map((cell) => cell.text).filter((text) => text !== ""),
        ),
      );
      expect([...written].sort(), family.id).toEqual([...family.pairs].sort());
    }
  });

  it("sets a joins sheet in a joining hand, whatever face was asked for", () => {
    // Two letters that do not touch are not a join, so this is the one style
    // that resolves its own face. A saved sheet or a hand-edited link can say
    // `print` here, and the sheet still has to teach what it says it teaches.
    for (const font of ["print", "dyslexic", undefined] as const) {
      const joined = config({ style: "joins", font });
      expect(isCursive(fontOf(joined)), `${font}`).toBe(true);
      expect(isCursive(HANDWRITING_SHEET.build(joined, 1).font), `${font}`) //
        .toBe(true);
    }
  });

  it("keeps the cursive model that was chosen", () => {
    // Resolving is not overriding: a parent who picked the unlooped model gets
    // it, and the three are genuinely different hands rather than three names
    // for one — which is why the em they are set at differs too.
    const sizes = new Set<number>();
    for (const font of CURSIVE_FACES) {
      const joined = config({ style: "joins", font });
      expect(fontOf(joined), font).toBe(font);
      expect(HANDWRITING_SHEET.build(joined, 1).font, font).toBe(font);
      sizes.add(handwritingLayout(joined, 2).em);
    }
    expect(sizes.size).toBe(CURSIVE_FACES.length);
  });

  it("leaves every other style's face exactly as it found it", () => {
    for (const style of ["letters", "numbers", "words", "passage"] as const) {
      expect(fontOf(config({ style, font: "print" })), style).toBe("print");
      expect(fontOf(config({ style })), style).toBeUndefined();
    }
  });

  it("asks for a join rather than a letter, and says so on the paper", () => {
    expect(instructionOf(config({ style: "joins", repeats: 3 }))).toBe(
      "Trace each join, then write it on your own.",
    );
    const sheet = HANDWRITING_SHEET.build(config({ style: "joins" }), 1);
    expect(sheet.header.title).toBe("Joining letters");
  });

  it("calls a cursive sheet cursive, and a printed one nothing of the kind", () => {
    // The title is what somebody reads off the paper on the fridge a week
    // later, so it follows the hand the sheet was actually set in.
    const titleOf = (over: Partial<HandwritingConfig>) =>
      HANDWRITING_SHEET.build(config(over), 1).header.title;
    expect(titleOf({ font: "cursive" })).toBe("Cursive letters");
    expect(titleOf({ font: "cursive-uk", style: "passage" })) //
      .toBe("Cursive copywork");
    expect(titleOf({ font: "cursive-modern", style: "words" })) //
      .toBe("Cursive practice");
    expect(titleOf({})).toBe("Letter practice");
    // A numeral is a numeral in any hand.
    expect(titleOf({ font: "cursive", style: "numbers" })) //
      .toBe("Number formation");
    // And a title somebody typed always wins.
    expect(titleOf({ font: "cursive", title: "Tuesday" })).toBe("Tuesday");
  });

  it("prints on every ruling, in every trace style, in every model", () => {
    // The criterion, for the family that added a face rather than a ruling:
    // three cursive models against twelve rulings and six ways of drawing a
    // model, including the combinations nobody would choose.
    for (const font of CURSIVE_FACES) {
      for (const style of STYLES) {
        for (const trace of TRACES) {
          const over = {
            style: "joins",
            font,
            rule: { style },
            trace,
          } as const;
          const rows = rowsOf(over);
          const where = `${font} / ${style} / ${trace}`;
          expect(rows.length, where).toBeGreaterThan(0);
          expect(rows[0].cells.length, where).toBeGreaterThan(0);
          // And never more rows than the paper holds, which is the only way a
          // handwriting sheet can silently become two sheets.
          const rule: Rule = { style };
          const { box } = handwritingLayout(config(over), 2);
          expect(rows.length, where).toBeLessThanOrEqual(
            ruleCapacity(
              box.height,
              rulePitch(rule) > 0 ? rule : DEFAULT_HAND_RULE,
            ),
          );
        }
      }
    }
  });

  it("names itself by the hand it is written in", () => {
    expect(describeHandwriting(config({ style: "joins", repeats: 3 }))).toBe(
      'Joining letters — the common joins — handwriting ⅝" — written 3 times',
    );
    expect(
      describeHandwriting(config({ style: "joins", joins: "round" })),
    ).toContain("joins into a round letter");
  });
});

/* ── Copywork, from the library or from a paste ────────────────────────────
   The passage style's other door (§12). Two things have to hold, and the
   second is a licence condition rather than a nicety: the words that reach the
   paper are the library's exactly, and the credit its source asks for is on the
   sheet that quotes it.                                                      */

describe("copywork out of the passage library", () => {
  const VERSE = "trust-in-the-lord";

  /** Everything a copywork sheet printed, as one string. */
  const copied = (over: Partial<HandwritingConfig>): string =>
    written(rowsOf({ style: "passage", trace: "dim", repeats: 2, ...over }))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  it("sets a library passage at every ruling and every trace style", () => {
    // The story's first line, as an assertion. A passage is not a special kind
    // of sheet: it is the same rows on the same twelve rulings, so all sixty
    // combinations have to print something rather than the handful the catalog
    // happens to use.
    for (const style of STYLES) {
      for (const trace of TRACES) {
        const rows = rowsOf({
          style: "passage",
          passage: VERSE,
          rule: { style },
          trace,
          repeats: 2,
        });
        expect(rows.length, `${style} / ${trace}`).toBeGreaterThan(0);
        expect(rows[0].cells.length, `${style} / ${trace}`).toBeGreaterThan(0);
      }
    }
  });

  it("prints the passage's own words, not a paraphrase of them", () => {
    // The line breaks are the family's — a row is one repeat of the ruling —
    // but nothing between them may change, which for Scripture is the condition
    // attached to the name (§12).
    const words = passageText(passage(VERSE)!).replace(/\s+/g, " ");
    expect(copied({ passage: VERSE, rule: { style: "hand-3-8" } })).toBe(words);
  });

  it("hands on the longest passage in the library whole, and cuts a paste on a word", () => {
    /*
     * The cap on a paste is not a cap on the library, and the difference is a
     * licence condition rather than a tidiness one (§12). A library passage
     * travels as its id — nine characters in a `#s=` link — so §14's reason for
     * capping a config never reaches it; applying the cap there anyway cost the
     * longest entry its last eight words *and* half of the word before them, and
     * on a memory sheet that truncated text is what the answer key prints, under
     * an instruction line promising the passage whole.
     *
     * Over the longest entry rather than a named one, so the case cannot quietly
     * stop being the interesting one when a longer passage is added.
     */
    const longest = listPassages().reduce((most, entry) =>
      passageText(entry).length > passageText(most).length ? entry : most,
    );
    expect(passageText(longest).length).toBeGreaterThan(MAX_TEXT);
    expect(copyworkSource({ passage: longest.id }).text, longest.id) //
      .toBe(passageText(longest));

    // A paste is still capped, because a config does have to fit in a URL — but
    // on a boundary its author put there, so nothing reaches the paper as half a
    // word. Every word of the cut is a whole word of the paste, in order.
    const paste = `${"seven-letter ".repeat(200)}last`;
    const cut = copyworkSource({ text: paste }).text;
    expect(cut.length).toBeLessThanOrEqual(MAX_TEXT);
    const words = cut.split(/\s+/);
    expect(words.length).toBeGreaterThan(1);
    expect(paste.split(/\s+/).slice(0, words.length)).toEqual(words);
  });

  it("puts the credit its source asks for at the foot of the page", () => {
    const verse = HANDWRITING_SHEET.build(
      config({ style: "passage", passage: VERSE }),
      1,
    );
    expect(verse.footer.source).toBe(SCRIPTURE_CREDIT);
    // And nothing where nothing is asked for. An 1885 poem needs no credit
    // line, and one printed anyway is noise on a child's page.
    const poem = HANDWRITING_SHEET.build(
      config({ style: "passage", passage: "bed-in-summer" }),
      1,
    );
    expect(poem.footer.source).toBeUndefined();
  });

  it("reads a verse in the translation that was asked for", () => {
    const webu = copied({ passage: VERSE, rule: { style: "hand-3-8" } });
    const kjv = copied({
      passage: VERSE,
      translation: "kjv",
      rule: { style: "hand-3-8" },
    });
    expect(kjv).not.toBe(webu);
    expect(kjv).toContain("Trust in the LORD with all thine heart");
    // Whole, not half: the text and the credit under it come from the same
    // translation or the page is quoting one edition under another's name.
    expect(
      HANDWRITING_SHEET.build(
        config({ style: "passage", passage: VERSE, translation: "kjv" }),
        1,
      ).footer.source,
    ).toContain("King James");
  });

  it("names the passage on the paper, so the sheet says what is on it", () => {
    const sheet = HANDWRITING_SHEET.build(
      config({ style: "passage", passage: VERSE }),
      1,
    );
    expect(sheet.header.title).toBe("Copywork — Proverbs 3:5-6");
    expect(
      describeHandwriting(config({ style: "passage", passage: VERSE })),
    ).toContain("Proverbs 3:5-6");
  });

  it("prefers the library to whatever the paste box was holding", () => {
    // Which way round matters for a shared link: the id is the choice somebody
    // made in the picker, and the text is what was underneath it beforehand.
    const both = { passage: VERSE, text: "Something else entirely." };
    expect(copied({ ...both, rule: { style: "hand-3-8" } })).toBe(
      passageText(passage(VERSE)!).replace(/\s+/g, " "),
    );
    // And clearing the id is how a parent gets their own words back.
    expect(copied({ text: "Something else entirely." })).toBe(
      "Something else entirely.",
    );
  });

  it("falls back to the paste when the passage has been retired", () => {
    // A bookmark outlives the library it was made on, the same way a saved
    // sheet outlives its family — so an id this build never heard of prints
    // whatever else the config had rather than throwing mid-build.
    const stale = { passage: "no-such-passage", text: "Still prints." };
    expect(() => rowsOf({ style: "passage", ...stale })).not.toThrow();
    expect(copied(stale)).toBe("Still prints.");
    expect(
      HANDWRITING_SHEET.build(config({ style: "passage", ...stale }), 1).footer
        .source,
    ).toBeUndefined();
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
