import { describe, expect, it } from "vitest";

import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { describeSheet } from "../index";
import { BLOCK_GAP, noteHeight, ruleCapacity } from "../layout";
import { RULINGS, rulePitch, rulingOf } from "../paper";
import type {
  Block,
  PenmanshipConfig,
  PenmanshipStyle,
  Rule,
  RuleStyle,
  StrokePattern,
  StrokeRow,
  TraceRow,
  TraceStyle,
} from "../types";

import {
  LETTER_FAMILIES,
  SPACING_SENTENCES,
  ZONES,
  ZONE_WORDS,
  familiesOf,
  familyLetters,
} from "./letterfamilies";
import {
  MAX_LINES,
  MAX_MINUTES,
  PENMANSHIP_SHEET,
  SPACE_MARK,
  instructionOf,
  penmanshipLayout,
} from "./penmanship";
import { DEFAULT_HAND_RULE, LOWER, MODELLED, UPPER } from "./rows";
import { STROKE_PATTERNS, hasTail, strokePatterns } from "./strokes";

/**
 * The family after the letters are learnt (§24).
 *
 * What it promises is content rather than a count — every pattern asked for,
 * every letter of a family, all three heights, every sentence, the whole
 * alphabet — and a sheet that quietly dropped the last family off the foot of
 * the page would look exactly like one that printed it. So the suite reads
 * the rows back and checks the set, on as many pages as the set took.
 */

const BASE: PenmanshipConfig = {
  kind: "penmanship",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: ["name", "date"],
  style: "strokes",
  rule: DEFAULT_HAND_RULE,
  trace: "dotted",
  repeats: 3,
};

const config = (over: Partial<PenmanshipConfig> = {}): PenmanshipConfig => ({
  ...BASE,
  ...over,
});

const build = (over: Partial<PenmanshipConfig> = {}) =>
  PENMANSHIP_SHEET.build(config(over), 1);

/** The blocks a config printed, a page at a time. */
function pagesOf(over: Partial<PenmanshipConfig> = {}): Block[][] {
  const pages: Block[][] = [[]];
  for (const block of build(over).blocks) {
    if (block.kind === "break") pages.push([]);
    else pages[pages.length - 1].push(block);
  }
  return pages;
}

/** Every tracing row on every page. */
const traceRows = (over: Partial<PenmanshipConfig> = {}): TraceRow[] =>
  build(over).blocks.flatMap((block) =>
    block.kind === "trace" ? block.rows : [],
  );

/** Every stroke row on every page. */
const strokeRows = (over: Partial<PenmanshipConfig> = {}): StrokeRow[] =>
  build(over).blocks.flatMap((block) =>
    block.kind === "strokes" ? block.rows : [],
  );

/** Everything written, in order, empty places dropped. */
const written = (rows: TraceRow[]): string[] => [
  ...new Set(
    rows.flatMap((row) =>
      row.cells.map((cell) => cell.text).filter((text) => text !== ""),
    ),
  ),
];

const stylesOn = (rows: TraceRow[]): Set<TraceStyle> =>
  new Set(rows.flatMap((row) => row.cells.map((cell) => cell.style)));

const STYLES: PenmanshipStyle[] = [
  "strokes",
  "families",
  "sizes",
  "spacing",
  "check",
  "fluency",
];

describeSheetFamily("penmanship", {
  label: "Penmanship",
  spec: PENMANSHIP_SHEET,
  config,
  shapes: [
    {},
    { style: "strokes", font: "cursive", lines: 2 },
    { style: "families" },
    { style: "families", letters: "upper", family: "slant" },
    { style: "sizes" },
    { style: "spacing" },
    { style: "check", repeats: 6 },
    { style: "check", words: ["cat", "dog"] },
    { style: "fluency" },
    { style: "fluency", task: "sentence", text: "One line." },
  ],
  keyed: () => false,
});

/* ── Strokes ───────────────────────────────────────────────────────────── */

describe("a strokes sheet", () => {
  it("draws every pattern, in teaching order, when none was asked for", () => {
    const drawn = strokeRows().map((row) => row.pattern);
    expect(drawn).toEqual(STROKE_PATTERNS.map((set) => set.id));
  });

  it("draws the patterns asked for, in the order they were asked", () => {
    const patterns: StrokePattern[] = ["humps", "lines", "circles"];
    expect(strokeRows({ patterns }).map((row) => row.pattern)).toEqual(
      patterns,
    );
  });

  it("walks the progression across the first row and leaves the rest to the child", () => {
    const rows = strokeRows({ patterns: ["waves"], lines: 3, repeats: 4 });
    expect(rows).toHaveLength(3);
    expect(rows[0].cells).toEqual(["solid", "dotted", "dotted", "none"]);
    expect(rows[1].cells).toEqual(["none"]);
    expect(rows[2].cells).toEqual(["none"]);
    expect(rows.every((row) => row.pattern === "waves")).toBe(true);
  });

  it("caps the lines a pattern gets and never gives fewer than one", () => {
    expect(strokeRows({ patterns: ["cups"], lines: 99 })).toHaveLength(
      MAX_LINES,
    );
    expect(strokeRows({ patterns: ["cups"], lines: 0 })).toHaveLength(1);
  });

  it("leaves a tail loop off a ruling with no room for a tail", () => {
    // A loop that drops below the baseline on paper with no descender space
    // would print through the row below, which is worse than a row missing.
    const flat: Rule = { style: "hand-5-8", descender: false };
    expect(hasTail(flat)).toBe(false);
    expect(hasTail(DEFAULT_HAND_RULE)).toBe(true);
    expect(strokeRows({ rule: flat }).map((row) => row.pattern)).not.toContain(
      "tails",
    );
    expect(strokeRows({ rule: DEFAULT_HAND_RULE }).map((r) => r.pattern)) //
      .toContain("tails");
    // A notebook rule has no tail space either.
    expect(strokePatterns(["tails", "lines"], { style: "wide" })).toEqual([
      "lines",
    ]);
  });

  it("drops a pattern this build has never heard of, and falls back to all when none is left", () => {
    const patterns = ["spirals", "lines"] as unknown as StrokePattern[];
    expect(strokePatterns(patterns, DEFAULT_HAND_RULE)).toEqual(["lines"]);
    const none = ["spirals"] as unknown as StrokePattern[];
    expect(strokePatterns(none, DEFAULT_HAND_RULE)).toEqual(
      STROKE_PATTERNS.map((set) => set.id),
    );
    // Asked for twice is drawn once.
    expect(strokePatterns(["cups", "cups"], DEFAULT_HAND_RULE)).toEqual([
      "cups",
    ]);
  });

  it("is called by what it does, in either hand", () => {
    expect(build().header.title).toBe("Pencil strokes");
    expect(build({ font: "cursive" }).header.title).toBe("Cursive strokes");
    expect(instructionOf(config())).toBe(
      "Trace each pattern, then carry it on to the end of the line. Keep every stroke the same size.",
    );
    expect(instructionOf(config({ progression: false }))).toBe(
      "Trace each pattern. Keep every stroke the same size.",
    );
    expect(instructionOf(config({ trace: "none" }))).toBe(
      "Copy each pattern on to the end of the line. Keep every stroke the same size.",
    );
  });
});

/* ── Families ──────────────────────────────────────────────────────────── */

describe("a letter families sheet", () => {
  it("writes the whole alphabet once, family by family, in print", () => {
    const letters = written(traceRows({ style: "families" }));
    expect([...letters].sort()).toEqual([...LOWER].sort());
    // In the order the families are taught, not the order of the alphabet.
    const round = familyLetters("round", "print", "lower");
    expect(letters.slice(0, round.length)).toEqual(round);
  });

  it("writes every capital once when capitals are asked for", () => {
    const letters = written(traceRows({ style: "families", letters: "upper" }));
    expect([...letters].sort()).toEqual([...UPPER].sort());
  });

  it("groups the letters by how a joined hand enters them", () => {
    // Print has no loop letters and cursive has no straight slants; both
    // still cover the alphabet exactly once.
    const cursive = familiesOf("cursive", "lower").map((family) => family.id);
    expect(cursive).toContain("loop");
    expect(cursive).not.toContain("slant");
    const print = familiesOf("print", "lower").map((family) => family.id);
    expect(print).toContain("slant");
    expect(print).not.toContain("loop");

    const joined = written(traceRows({ style: "families", font: "cursive" }));
    expect([...joined].sort()).toEqual([...LOWER].sort());
    const loops = familyLetters("loop", "cursive", "lower");
    expect(joined.slice(-loops.length)).toEqual(loops);
  });

  it("writes one family when one is asked for, and every letter of it", () => {
    for (const family of LETTER_FAMILIES) {
      for (const hand of ["print", "cursive"] as const) {
        const font = hand === "cursive" ? "cursive" : undefined;
        const letters = familyLetters(family.id, hand, "lower");
        const drawn = written(
          traceRows({ style: "families", family: family.id, font }),
        );
        if (letters.length === 0) {
          // A family this hand has not got prints every family it has,
          // rather than a title over nothing.
          expect([...drawn].sort()).toEqual([...LOWER].sort());
        } else {
          expect(drawn).toEqual(letters);
        }
      }
    }
  });

  it("starts each family on a row of its own", () => {
    // On ⅜ paper several letters share a row, so the test is that no row
    // holds letters from two families.
    const rows = traceRows({
      style: "families",
      rule: { style: "hand-3-8", descender: true },
      repeats: 2,
    });
    const family = (letter: string): string =>
      LETTER_FAMILIES.find((set) =>
        familyLetters(set.id, "print", "lower").includes(letter),
      )?.id ?? "";
    for (const row of rows) {
      const on = new Set(written([row]).map(family));
      expect(on.size).toBeLessThanOrEqual(1);
    }
  });

  it("reads `both` as the small letters, because a family is one case", () => {
    expect(written(traceRows({ style: "families", letters: "both" }))) //
      .toEqual(written(traceRows({ style: "families", letters: "lower" })));
  });
});

/* ── Sizes ─────────────────────────────────────────────────────────────── */

describe("a tall, small and tail sheet", () => {
  it("writes every small letter in its zone, then words that mix the three", () => {
    const drawn = written(traceRows({ style: "sizes" }));
    const zones = ZONES.flatMap((zone) => zone.letters);
    expect(drawn.slice(0, zones.length)).toEqual(zones);
    expect(drawn.slice(zones.length)).toEqual(ZONE_WORDS);
    expect([...zones].sort()).toEqual([...LOWER].sort());
  });

  it("chose words with more than one height in each", () => {
    const zoneOf = (letter: string) =>
      ZONES.find((zone) => zone.letters.includes(letter))?.id;
    for (const word of ZONE_WORDS) {
      expect(new Set([...word].map(zoneOf)).size, word).toBeGreaterThan(1);
    }
  });

  it("says what each height does", () => {
    expect(instructionOf(config({ style: "sizes" }))).toBe(
      "Tall letters touch the top line, small letters stop at the midline, and tails hang below it. Trace each one, then write it on your own.",
    );
  });
});

/* ── Spacing ───────────────────────────────────────────────────────────── */

describe("a finger spaces sheet", () => {
  it("sets the five sentences when none were typed, each written down the page", () => {
    const rows = traceRows({ style: "spacing" });
    expect(rows).toHaveLength(SPACING_SENTENCES.length * 3);
    expect(rows.every((row) => row.cells.length === 1)).toBe(true);
    expect(rows.map((row) => row.cells[0].style).slice(0, 3)).toEqual([
      "solid",
      "dotted",
      "none",
    ]);
  });

  it("marks the spaces on the model and nowhere else", () => {
    const [model, trace] = traceRows({ style: "spacing" });
    expect(model.cells[0].text).toBe(
      SPACING_SENTENCES[0].replaceAll(" ", SPACE_MARK),
    );
    expect(trace.cells[0].text).toBe(SPACING_SENTENCES[0]);
    // The mark stands in for the space, so the model is as long as the trace
    // under it and sets at the same size.
    expect(model.cells[0].text).toHaveLength(trace.cells[0].text.length);
  });

  it("sets the sentences a parent typed, one a line, blank lines dropped", () => {
    const text = "One two.\n\n  Three   four.  \n";
    const models = traceRows({ style: "spacing", text })
      .filter((row) => row.cells[0].style === "solid")
      .map((row) => row.cells[0].text);
    expect(models).toEqual([`One${SPACE_MARK}two.`, `Three${SPACE_MARK}four.`]);
  });

  it("keeps a sentence and its copies on one page", () => {
    const pages = pagesOf({
      style: "spacing",
      text: "The quick brown fox jumps over the lazy dog.\n".repeat(12),
      rule: { style: "hand-1", descender: true },
    });
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      const rows = page.flatMap((block) =>
        block.kind === "trace" ? block.rows : [],
      );
      expect(rows.length % 3).toBe(0);
    }
  });
});

/* ── Check ─────────────────────────────────────────────────────────────── */

describe("a circle-your-best sheet", () => {
  it("is a model and then the child's own tries, whatever the trace says", () => {
    const rows = traceRows({ style: "check", repeats: 6, trace: "dotted" });
    const first = rows[0].cells.slice(0, 6).map((cell) => cell.style);
    expect(first).toEqual(["solid", "none", "none", "none", "none", "none"]);
    expect(stylesOn(rows).has("dotted")).toBe(false);
  });

  it("never has fewer than one try", () => {
    const rows = traceRows({ style: "check", repeats: 1 });
    expect(rows[0].cells.slice(0, 2).map((cell) => cell.style)).toEqual([
      "solid",
      "none",
    ]);
  });

  it("writes the alphabet, or the parent's words instead", () => {
    expect(written(traceRows({ style: "check" }))).toEqual([...LOWER]);
    expect(written(traceRows({ style: "check", letters: "upper" }))).toEqual([
      ...UPPER,
    ]);
    expect(written(traceRows({ style: "check", letters: "both" }))[1]).toBe(
      "Bb",
    );
    expect(
      written(traceRows({ style: "check", words: ["because", "friend"] })),
    ).toEqual(["because", "friend"]);
  });

  it("asks for the tries it printed, and for a judgement", () => {
    expect(instructionOf(config({ style: "check", repeats: 6 }))).toBe(
      "Write each letter 5 times, then circle the one that looks most like the model.",
    );
    expect(instructionOf(config({ style: "check", repeats: 2 }))).toBe(
      "Write each letter once, then circle the one that looks most like the model.",
    );
    expect(
      instructionOf(config({ style: "check", repeats: 4, words: ["cat"] })),
    ).toBe(
      "Write each word 3 times, then circle the one that looks most like the model.",
    );
    expect(
      instructionOf(config({ style: "check", repeats: 3, letters: "both" })),
    ).toBe(
      "Write each pair 2 times, then circle the one that looks most like the model.",
    );
  });
});

/* ── Fluency ───────────────────────────────────────────────────────────── */

describe("a timed sheet", () => {
  it("is the alphabet once, empty lines to the foot, and a box for the count", () => {
    const { blocks } = build({ style: "fluency" });
    expect(blocks.map((block) => block.kind)).toEqual(["trace", "note"]);
    const [trace, note] = blocks;
    if (trace.kind !== "trace" || note.kind !== "note") return;
    const models = trace.rows
      .filter((row) => row.cells[0].style === "solid")
      .map((row) => row.cells[0].text);
    expect(models.join("")).toBe(LOWER);
    const empties = trace.rows.filter((row) => row.cells[0].style === "none");
    expect(empties.length).toBeGreaterThan(models.length);
    expect(note.text[0]).toContain("one minute");
  });

  it("copies the first sentence typed, or the pangram", () => {
    const models = (over: Partial<PenmanshipConfig>) =>
      traceRows({ style: "fluency", task: "sentence", ...over })
        .filter((row) => row.cells[0].style === "solid")
        .map((row) => row.cells[0].text)
        .join(" ");
    expect(models({})).toBe("The quick brown fox jumps over the lazy dog.");
    expect(models({ text: "\nShort one.\nAnother." })).toBe("Short one.");
  });

  it("times a minute for the alphabet and two for a sentence unless told", () => {
    expect(instructionOf(config({ style: "fluency" }))).toBe(
      "Set a timer for one minute. Write the alphabet in order, a to z, again and again, as neatly as you can. When the timer rings, count the letters.",
    );
    expect(instructionOf(config({ style: "fluency", task: "sentence" }))).toBe(
      "Set a timer for two minutes. Copy the sentence again and again, as neatly as you can. When the timer rings, count the letters.",
    );
    expect(instructionOf(config({ style: "fluency", minutes: 3 }))).toContain(
      "Set a timer for 3 minutes.",
    );
    expect(instructionOf(config({ style: "fluency", minutes: 99 }))).toContain(
      `${MAX_MINUTES} minutes`,
    );
  });

  it("pays for the count box out of the rows, on every ruling", () => {
    // The box is a `note` the layout took off the height before it counted
    // rows, so the last row and the box cannot both claim the same inch — and
    // a printed sheet must still fit the box it printed.
    for (const style of Object.keys(RULINGS) as RuleStyle[]) {
      const rule: Rule = { style, descender: true };
      const sheet = build({ style: "fluency", rule });
      const [trace, note] = sheet.blocks;
      if (trace.kind !== "trace" || note.kind !== "note") throw new Error();
      const box = printedBlockBox(sheet);
      const drawn = trace.rows.length * rulePitch(trace.rule);
      expect(
        drawn + BLOCK_GAP + noteHeight(note.lines, sheet.fontPt),
        style,
      ).toBeLessThanOrEqual(box.height);
      expect(trace.rows.length, style).toBe(
        ruleCapacity(
          box.height - BLOCK_GAP - noteHeight(note.lines, sheet.fontPt),
          trace.rule,
        ),
      );
    }
  });

  it("is one page, because the page is the task", () => {
    expect(pagesOf({ style: "fluency" })).toHaveLength(1);
    expect(
      pagesOf({ style: "fluency", rule: { style: "hand-1", descender: true } }),
    ).toHaveLength(1);
  });
});

/* ── Every ruling, every trace style, every style ──────────────────────── */

const RULES: RuleStyle[] = Object.keys(RULINGS) as RuleStyle[];
const TRACES: TraceStyle[] = [
  "solid",
  "dim",
  "hollow",
  "dotted",
  "dashed",
  "none",
];

describe("every style on every ruling with every trace", () => {
  it("prints something on all of them", () => {
    for (const style of STYLES) {
      for (const rule of RULES) {
        for (const trace of TRACES) {
          const { blocks } = build({ style, rule: { style: rule }, trace });
          const rows = blocks.reduce(
            (sum, block) =>
              sum +
              (block.kind === "trace" || block.kind === "strokes"
                ? block.rows.length
                : 0),
            0,
          );
          expect(rows, `${style} / ${rule} / ${trace}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("falls back to ⅝ paper when there is no ruling to write on", () => {
    const [block] = build({ rule: { style: "blank" } }).blocks;
    expect(block.kind).toBe("strokes");
    if (block.kind !== "strokes") return;
    expect(block.rule).toEqual(DEFAULT_HAND_RULE);
  });

  it("never puts more rows on a page than the paper holds", () => {
    for (const style of STYLES) {
      for (const rule of RULES) {
        const over = { style, rule: { style: rule, descender: true } };
        const sheet = build(over);
        const held = ruleCapacity(printedBlockBox(sheet).height, {
          style: rulePitch({ style: rule }) > 0 ? rule : "hand-5-8",
          descender: true,
        });
        for (const page of pagesOf(over)) {
          const rows = page.reduce(
            (sum, block) =>
              sum +
              (block.kind === "trace" || block.kind === "strokes"
                ? block.rows.length
                : 0),
            0,
          );
          expect(rows, `${style} / ${rule}`).toBeLessThanOrEqual(held);
        }
      }
    }
  });

  it("runs on to another page rather than cutting the set", () => {
    // Nine patterns at four lines each is thirty-six rows: four pages of ⅝
    // paper with a tail, and every pattern still there.
    const pages = pagesOf({ lines: 4 });
    expect(pages.length).toBeGreaterThan(2);
    const patterns = new Set(strokeRows({ lines: 4 }).map((r) => r.pattern));
    expect(patterns.size).toBe(STROKE_PATTERNS.length);
    // Every page but the last is full.
    const { rows } = penmanshipLayout(config({ lines: 4 }), 1);
    for (const page of pages.slice(0, -1)) {
      const [block] = page;
      expect(block.kind).toBe("strokes");
      if (block.kind === "strokes") expect(block.rows).toHaveLength(rows);
    }
  });

  it("walks the progression on every traced style", () => {
    for (const style of ["families", "sizes", "spacing"] as const) {
      const on = stylesOn(traceRows({ style }));
      expect(on.has("solid"), style).toBe(true);
      expect(on.has("none"), style).toBe(true);
      expect(
        [...on].some((s) => MODELLED.has(s)),
        style,
      ).toBe(true);
    }
  });
});

/* ── What it says about itself ─────────────────────────────────────────── */

describe("the one-line description", () => {
  const RULED = rulingOf(DEFAULT_HAND_RULE).label.toLowerCase();

  it("names the style, the content, the ruling and the repeats", () => {
    expect(describeSheet(config())).toBe(
      `Pencil strokes — 9 patterns — ${RULED} — written 3 times`,
    );
    expect(describeSheet(config({ patterns: ["loops"] }))).toBe(
      `Pencil strokes — loops — ${RULED} — written 3 times`,
    );
    expect(describeSheet(config({ style: "families", repeats: 4 }))).toBe(
      `Letter families — every family — ${RULED} — written 4 times`,
    );
    expect(
      describeSheet(
        config({ style: "families", family: "round", letters: "upper" }),
      ),
    ).toBe(
      `Letter families — round letters, capitals — ${RULED} — written 3 times`,
    );
    expect(describeSheet(config({ style: "sizes" }))).toBe(
      `Tall, small and tail — the three heights — ${RULED} — written 3 times`,
    );
    expect(describeSheet(config({ style: "spacing" }))).toBe(
      `Finger spaces — 5 sentences — ${RULED} — written 3 times`,
    );
    expect(describeSheet(config({ style: "check", repeats: 6 }))).toBe(
      `Circle your best one — small letters — ${RULED} — written 6 times`,
    );
    expect(describeSheet(config({ style: "fluency" }))).toBe(
      `Against the clock — the alphabet in one minute — ${RULED}`,
    );
    expect(
      describeSheet(config({ style: "fluency", task: "sentence", minutes: 5 })),
    ).toBe(`Against the clock — a sentence in 5 minutes — ${RULED}`);
  });

  it("names a stepped size, as the handwriting family does", () => {
    expect(
      describeSheet(config({ rule: { ...DEFAULT_HAND_RULE, pitch: 500 } })),
    ).toContain("36pt letters");
  });

  it("prints strokes for a style this build has never heard of", () => {
    const style = "flourishes" as unknown as PenmanshipStyle;
    expect(build({ style }).header.title).toBe("Pencil strokes");
    expect(strokeRows({ style })).not.toHaveLength(0);
  });
});
