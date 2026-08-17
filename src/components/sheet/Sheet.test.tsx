import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { figureBounds, labelPad } from "@/engine/sheets/figure";
import { ticks } from "@/engine/sheets/numberline";
import { DEFAULT_PAPER } from "@/engine/sheets/paper";
import { SCRIPTURE_CREDIT } from "@/engine/sheets/passages";
import type {
  ArithmeticConfig,
  Block,
  FractionArt,
  FractionConfig,
  GeometryConfig,
  MoneyConfig,
  MultiplicationConfig,
  Paper,
  Problem,
  Sheet,
  SheetConfig,
  SheetFont,
  TimeConfig,
  TraceStyle,
  WordsConfig,
} from "@/engine/sheets/types";

import { SheetView } from "./Sheet";

/**
 * The properties a printable sheet lives or dies by.
 *
 * Three of them can't be seen by looking at a screen, which is why they are
 * tested rather than reviewed:
 *
 * **It prints.** Browsers drop background paint unless the reader has ticked
 * "Background graphics", so a ruling drawn with `repeating-linear-gradient`
 * looks perfect in a preview and comes out of the printer blank. Only strokes
 * and borders are foreground.
 *
 * **It ships no JavaScript.** That is the whole SEO argument (§2), and it holds
 * only while every renderer is prop-driven — the moment one needs a hook, the
 * catalog page needs `client:*` and the page becomes an app.
 *
 * **No advertising is inside the printable region** (§10). A slot beside a
 * sheet is fine; a slot inside one prints.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/* ── Fixtures ──────────────────────────────────────────────────────────────
   One block of every kind in the union, so a renderer that throws on a shape
   the engine can legally produce fails here rather than on a catalog page.  */

const EVERY_BLOCK: Block[] = [
  {
    kind: "problems",
    columns: 3,
    items: [
      { prompt: "7 × 8 =", answer: "56", factId: "7:8" },
      { prompt: "6 × 9 =", answer: "54", workspace: 500 },
      // The three shapes a problem takes: written along a line, written with
      // the gap inside the sentence, and stacked in columns.
      { prompt: "7 + _ = 15", answer: "8", factId: "7:8" },
      {
        prompt: "",
        operands: ["47", "28"],
        operator: "+",
        answer: "75",
        line: { from: 0, to: 20, step: 2, width: 2400 },
      },
      // And the two long forms: a stack with its partial products between the
      // rule and the total, and the division bracket, whose answer is written
      // above the problem rather than under it.
      {
        prompt: "",
        operands: ["347", "26"],
        operator: "×",
        working: ["2082", "6940"],
        workspace: 500,
        answer: "9022",
      },
      {
        prompt: "",
        bracket: { divisor: "4", dividend: "938" },
        answer: "234 r 2",
        workspace: 1500,
      },
      // And the one problem whose question is a picture: a whole cut into equal
      // parts with some of them shaded, which prints on the blank sheet as well
      // as on the key.
      { prompt: "", answer: "3/4", art: { shape: "bar", parts: 4, shaded: 3 } },
      {
        prompt: "",
        answer: "1/6",
        art: { shape: "circle", parts: 6, shaded: 1 },
      },
      // The two drawings that ride on a problem for the same reason: a shape to
      // measure, and a dial to read. And the one drawing that is the *answer* —
      // a dial with no hands on it, which prints no ruled slot at all.
      {
        prompt: "",
        answer: "24 cm²",
        figure: {
          shape: "rectangle",
          points: [
            { x: 0, y: 0 },
            { x: 1100, y: 0 },
            { x: 1100, y: 412 },
            { x: 0, y: 412 },
          ],
          labels: ["8 cm", "3 cm"],
        },
      },
      {
        prompt: "",
        answer: "obtuse",
        figure: {
          shape: "angle",
          points: [
            { x: 1100, y: 550 },
            { x: 550, y: 550 },
            { x: 289, y: 74 },
          ],
        },
      },
      {
        prompt: "",
        answer: "3:20",
        clock: { hour: 3, minute: 20, hands: true },
      },
      {
        prompt: "9:45",
        answer: "9:45",
        clock: { hour: 9, minute: 45, hands: false },
      },
    ],
  },
  { kind: "rules", rule: { style: "hand-5-8", descender: true }, lines: 6 },
  { kind: "rules", rule: { style: "college" }, lines: 4 },
  { kind: "rules", rule: { style: "graph" }, lines: 8 },
  { kind: "rules", rule: { style: "dot" }, lines: 8 },
  { kind: "rules", rule: { style: "isometric" }, lines: 8 },
  { kind: "rules", rule: { style: "blank" }, lines: 4 },
  {
    kind: "trace",
    rule: { style: "hand-1", midline: "dashed" },
    rows: [
      {
        cells: [
          { text: "cat", style: "solid" },
          { text: "cat", style: "dotted" },
          { text: "cat", style: "dashed" },
          { text: "", style: "none" },
        ],
      },
    ],
  },
  {
    kind: "copywork",
    text: "The quick brown fox\njumps over the lazy dog",
    rule: { style: "hand-1-2" },
    mode: "dim",
  },
  {
    kind: "grid",
    grid: {
      kind: "coordinate",
      columns: 4,
      rows: 4,
      cell: 250,
      cells: ["1", "2", "", "4"],
      // A dot where the ruling crosses, which is where a coordinate is — not
      // in the middle of a square, which is where a cell is.
      marks: [{ column: 3, row: 1, label: "A" }],
      origin: { column: 2, row: 2 },
    },
  },
  {
    kind: "grid",
    grid: {
      kind: "chart",
      columns: 3,
      rows: 3,
      cell: 250,
      // A multiplication square: headers on the sheet from the start, products
      // only on the key, and the two heavier rules that keep them apart.
      cells: ["×", "2", "3", "4", "", "", "5", "", ""],
      answers: ["", "", "", "", "8", "12", "", "10", "15"],
      origin: { column: 1, row: 1 },
    },
  },
  {
    kind: "wordsearch",
    letters: [
      ["C", "A", "T"],
      ["X", "Y", "Z"],
      ["D", "O", "G"],
    ],
    find: ["CAT", "DOG"],
    solution: [{ word: "CAT", column: 0, row: 0, dx: 1, dy: 0 }],
    // A word the grid had no room for, printed rather than dropped — the one
    // line on a sheet whose job is to admit a failure.
    omitted: ["ELEPHANT"],
    // And the ones the page had no room to *name*. The line is reserved for at
    // a capped number of rows, so past that the count carries what the names
    // cannot — see `Block.omittedMore`.
    omittedMore: 3,
  },
  {
    // Two entries crossing at their shared T, one of them numbered in both
    // directions — the smallest thing that draws every part of the block.
    kind: "crossword",
    cells: [
      [{ letter: "C", number: 1 }, { letter: "A" }, { letter: "T", number: 2 }],
      [null, null, { letter: "O" }],
      [null, null, { letter: "P" }],
    ],
    across: [
      { number: 1, clue: "It purrs.", answer: "CAT", column: 0, row: 0 },
    ],
    down: [
      { number: 2, clue: "Jumbled: O P T", answer: "TOP", column: 2, row: 0 },
    ],
  },
  {
    kind: "matching",
    left: ["one", "two"],
    right: ["uno", "dos"],
    answer: [0, 1],
  },
  {
    kind: "blanks",
    sentences: [{ text: "The __ sat on the __.", answers: ["cat", "mat"] }],
  },
  {
    kind: "choice",
    questions: [
      { prompt: "How many legs?", options: ["two", "four"], answer: 1 },
    ],
  },
  {
    // The three bands a word is written in, in one word: a tall letter, a small
    // one, and one with a tail.
    kind: "wordshapes",
    columns: 2,
    words: [
      { word: "big", letters: ["tall", "small", "tail"] },
      { word: "cat", letters: ["small", "small", "tall"] },
    ],
  },
  {
    kind: "clock",
    faces: [
      { hour: 3, minute: 20, hands: true, label: "A" },
      { hour: 9, minute: 45, hands: false },
    ],
  },
  {
    kind: "shapes",
    figures: [
      {
        shape: "rectangle",
        points: [
          { x: 0, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 500 },
          { x: 0, y: 500 },
        ],
        labels: ["8 cm", "5 cm"],
      },
      {
        shape: "circle",
        points: [
          { x: 400, y: 400 },
          { x: 700, y: 400 },
        ],
      },
      {
        shape: "angle",
        points: [
          { x: 1100, y: 550 },
          { x: 550, y: 550 },
          { x: 550, y: 0 },
        ],
      },
    ],
  },
  { kind: "cutline" },
  { kind: "spacer", height: 1200 },
];

const sheet = (over: Partial<Sheet> = {}): Sheet => ({
  paper: DEFAULT_PAPER,
  fontPt: 12,
  header: {
    title: "Times tables",
    instructions: "Work down each column.",
    fields: ["name", "date"],
    score: { outOf: 20 },
  },
  blocks: EVERY_BLOCK,
  footer: {
    credit: "Free printables and learning games",
    url: "schoolskills.app",
    seed: 4242,
  },
  answers: false,
  ...over,
});

const render = (value: Sheet = sheet()) =>
  renderToStaticMarkup(<SheetView sheet={value} />);

/** Every file under `dir` whose name ends in one of `endings`. */
function filesUnder(dir: string, endings: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, endings);
    return endings.some((end) => entry.name.endsWith(end)) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(path, "utf8");

/**
 * How far a rule holds its text off the right edge of its own box, as written.
 *
 * Compared as the source string rather than as a length, because that is all
 * this can honestly claim without a browser: two rules that declare `0.06in`
 * agree, and two that declare different things are a question for whoever
 * changed one of them. Both the longhand and the three-value shorthand are
 * read, since the two rules this compares are written each way.
 */
function rightInset(css: string, rule: string): string {
  const block = css.slice(css.indexOf(rule));
  const body = block.slice(0, block.indexOf("}"));
  const longhand = /padding-right:\s*([^;]+);/.exec(body);
  if (longhand) return longhand[1].trim();
  const shorthand = /padding:\s*([^;]+);/.exec(body);
  if (!shorthand) throw new Error(`${rule} declares no padding at all`);
  // top | right-and-left | bottom, and the one-value form besides.
  const parts = shorthand[1].trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[1];
}

/**
 * The landmarks a page puts around a sheet: its sections, its page header, and
 * any full-width wrap that is not the sheet's own frame. Everything nested
 * inside one of these goes wherever it goes, so these are the elements the
 * `.no-print` contract is actually about.
 */
function landmarks(source: string): Array<[string, string]> {
  return [...source.matchAll(/<(section|header|div)\s[^>]*class="([^"]*)"/g)]
    .filter(([, tag, classes]) => tag !== "div" || /\bwrap\b/.test(classes))
    .map(([, tag, classes]) => [tag, classes] as [string, string]);
}

/* ── The blocks ────────────────────────────────────────────────────────── */

describe("rendering a sheet", () => {
  it("draws every kind of block the engine can produce", () => {
    const html = render();
    for (const block of EVERY_BLOCK) {
      expect(() =>
        renderToStaticMarkup(<SheetView sheet={sheet({ blocks: [block] })} />),
      ).not.toThrow();
    }
    expect(html).toContain('class="sheet"');
    expect(html).toContain("Times tables");
    expect(html).toContain("schoolskills.app");
    expect(html).toContain("#4242");
  });

  it("admits what a puzzle could not hold, and counts what it could not name", () => {
    // The one line on a sheet whose job is to admit a failure. Both halves of
    // it, because a page that named three of twenty-three and said nothing
    // about the rest would be the silent drop again in a smaller font.
    const search = EVERY_BLOCK.filter((block) => block.kind === "wordsearch");
    const html = renderToStaticMarkup(
      <SheetView sheet={sheet({ blocks: search })} />,
    );
    expect(html).toContain("Not in the grid: ELEPHANT … and 3 more");
  });

  it("keeps the problems as real text, not as a picture of text", () => {
    // Half of §2: the problems on a multiplication sheet are content a crawler
    // reads and a parent can select. A canvas would rank for nothing.
    expect(render()).toContain("7 × 8 =");
  });

  it("prints the name line blank", () => {
    // §1. There is nowhere in a config for a child's name, and this is the
    // component that would otherwise be the place it leaked out.
    const html = render();
    expect(html).toContain("Name");
    expect(html).toContain("sheet__field-rule");
  });

  it("prints the credit its words came with, beside the note and not instead of it", () => {
    // §12, in the one place it has to be: the credit line is a condition of the
    // World English Bible's name rather than a courtesy, and `.sheet__source`
    // has no CSS rule of its own — so a renamed or dropped span would pass every
    // other gate in this file and every gate in the engine's, which only assert
    // the `Sheet` object's field. This is the assertion that it reaches paper.
    const credited = (over: Partial<Sheet["footer"]> = {}) =>
      render(
        sheet({
          footer: {
            credit: "Free printables and learning games",
            source: SCRIPTURE_CREDIT,
            url: "schoolskills.app",
            seed: 4242,
            ...over,
          },
        }),
      );

    // Nothing where the words are the sheet's own: an 1885 poem needs no credit
    // line, and one printed anyway would be noise on a child's page.
    expect(render()).not.toContain("sheet__source");

    expect(credited()).toContain(SCRIPTURE_CREDIT);
    // And on an answer key, both — the page that carries the whole passage is
    // the one that most needs to say where the passage came from.
    const key = credited({ note: "Answer key" });
    expect(key).toContain(SCRIPTURE_CREDIT);
    expect(key).toContain("Answer key");
    expect(key).toContain("Free printables and learning games");
  });

  it("prints the answers only when the sheet says so", () => {
    expect(render()).not.toContain(">56<");
    const key = render(sheet({ answers: true }));
    expect(key).toContain(">56<");
    expect(key).toContain('data-answers="true"');
  });

  it("sizes the page in inches, from the paper the sheet was built on", () => {
    expect(render()).toContain("--sheet-w:8.5in");
    const a4 = render(
      sheet({
        paper: { size: "a4", orientation: "landscape", margin: "narrow" },
      }),
    );
    // A4 landscape is 11.693in × 8.268in, and it has to say so in `@page` —
    // print is the whole output path, so a page box that disagrees with the
    // sheet on it prints scaled or across two pages (§10).
    expect(a4).toContain("--sheet-w:11.693in");
    expect(a4).toContain("@page{size:11.693in 8.268in;margin:0}");
  });

  it("draws rules in mil inside a box measured in inches, so ⅝ prints as ⅝", () => {
    // The whole physical-measurement claim rests on one correspondence, and it
    // lives in three attributes of one element: the <svg> is sized in inches
    // while its viewBox counts mil, so one user unit is a thousandth of an
    // inch and a 625-unit gap comes off the printer at ⅝. Put the viewBox in
    // inches, or drop the width and height, and every other test in this file
    // stays green while every printed rule is a thousand times the wrong size
    // — the one bug this feature cannot afford, and the one a screen never
    // shows. The engine's own tests stop short of it: they never render.
    const LINES = 14;
    const ruled: Block = {
      kind: "rules",
      rule: { style: "hand-5-8", descender: true },
      lines: LINES,
    };

    const measure = (paper: Paper, inches: string, mil: number) => {
      const html = render(sheet({ paper, blocks: [ruled] }));
      expect(html).toContain(
        `<svg class="sheet__ink" width="${inches}in" height="8.75in" viewBox="0 0 ${mil} 8750"`,
      );

      const tops = [...html.matchAll(/sheet__rule--top"[^>]*y1="(\d+)"/g)].map(
        (line) => Number(line[1]),
      );
      expect(tops.length).toBe(LINES);
      for (let i = 1; i < tops.length; i++) {
        expect(tops[i] - tops[i - 1]).toBe(625);
      }
    };

    // 8.5in less two half-inch margins, and 14 × ⅝ of an inch down the page.
    measure(DEFAULT_PAPER, "7.5", 7500);
    // The same ruling on the second stock: 210mm less the same margins.
    measure(
      { size: "a4", orientation: "portrait", margin: "normal" },
      "7.268",
      7268,
    );
  });
});

/* ── The answer key, as a parent receives it ───────────────────────────────
   The engine's suite proves the answers are right and stops at the edge of the
   markup — "the renderer's rule, stated here as the engine's half of it". This
   is the other half, and it is the half a parent actually holds: a key whose
   answers are correct and printed into a blank built for one of them is still
   a bad sheet. The sheets below are built through the real family rather than
   hand-written, so a shape the engine starts producing is a shape these see. */

const arithmetic = (
  over: Partial<ArithmeticConfig> = {},
): ArithmeticConfig => ({
  kind: "arithmetic",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name"],
  operation: "add",
  style: "standard",
  form: "horizontal",
  range: { min: 1, max: 20 },
  count: 6,
  columns: 2,
  regrouping: "either",
  ...over,
});

const SEED = 7;

const blank = (over: Partial<ArithmeticConfig> = {}) =>
  render(buildSheet(arithmetic(over), SEED) as Sheet);
const keyed = (over: Partial<ArithmeticConfig> = {}) =>
  render(answerKey(arithmetic(over), SEED) as Sheet);

/**
 * The problems of a built sheet, narrowed out of the block union.
 *
 * One helper for every family rather than one each: what a caller holds is a
 * config, and what it wants is the list the renderer is about to be handed.
 */
function itemsOf(config: SheetConfig): Problem[] {
  const block = buildSheet(config, SEED).blocks[0];
  if (block.kind !== "problems") throw new Error(`got ${block.kind}`);
  return block.items;
}

/** The markup of each problem, one string per `<li>`. */
const problems = (html: string): string[] =>
  html.split('<li class="sheet__problem"').slice(1);

const count = (html: string, needle: string): number =>
  html.split(needle).length - 1;

describe("a rendered arithmetic sheet", () => {
  /** Every shape the family prints, as the renderer sees them. */
  const SHAPES: Array<Partial<ArithmeticConfig>> = [
    {},
    { style: "missing" },
    { form: "vertical" },
    { style: "fact-family", count: 4 },
    { numberLine: true },
    { workspace: true },
  ];

  it("gives every problem exactly one place to write the answer", () => {
    // The rule `Problems.tsx` is built around, and the one a sheet is unusable
    // without: a child handed a ruled blank *and* four ruled lines has been
    // asked the same question twice and does not know which one counts.
    for (const shape of SHAPES) {
      for (const html of [blank(shape), keyed(shape)]) {
        const items = problems(html);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          const places =
            count(item, 'class="sheet__slot') +
            count(item, 'class="sheet__total') +
            count(item, 'class="sheet__answers"');
          expect(places, `${JSON.stringify(shape)}: ${item}`).toBe(1);
        }
      }
    }
  });

  it("splices a missing number into the sentence, not onto the end of it", () => {
    const [item] = problems(keyed({ style: "missing" }));
    const prompt = item.indexOf('<span class="sheet__prompt">');
    const slot = item.indexOf('<span class="sheet__slot');
    expect(prompt).toBeGreaterThanOrEqual(0);
    expect(slot).toBeGreaterThan(prompt);
    // Nothing closes the prompt before the slot opens, which is the whole
    // difference between "7 + _ = 15" and "7 + _ = 15 ____".
    expect(item.slice(prompt, slot)).not.toContain("</span>");
    // And the ordinary shape does put it after — otherwise the check above
    // would pass on markup that had lost the distinction entirely.
    const [plain] = problems(keyed());
    expect(
      plain.slice(
        plain.indexOf('<span class="sheet__prompt">'),
        plain.indexOf('<span class="sheet__slot'),
      ),
    ).toContain("</span>");
  });

  it("stacks a column sum with its sign and rules the total", () => {
    const [item] = problems(keyed({ form: "vertical" }));
    expect(count(item, 'class="sheet__addend"')).toBe(2);
    expect(item).toContain('class="sheet__operator"');
    expect(item).toMatch(/class="sheet__total sheet__total--answered">\d+</);
  });

  it("draws a number line under every problem, ticks and labels included", () => {
    const items = itemsOf(arithmetic({ numberLine: true }));
    const line = items[0].line;
    if (!line) throw new Error("no number line was built");

    const html = blank({ numberLine: true });
    expect(count(html, 'class="sheet__ink sheet__number-line"')).toBe(
      items.length,
    );
    expect(count(html, 'class="sheet__tick"')).toBe(
      ticks(line).length * items.length,
    );
  });

  it("rules a line for each of a fact family's four sentences", () => {
    const family = { style: "fact-family" as const, count: 4 };
    const written = itemsOf(arithmetic(family)).flatMap(
      (problem) => problem.answers ?? [],
    );
    expect(written.length).toBe(16);

    const sheet = blank(family);
    expect(count(sheet, 'class="sheet__answer-line"')).toBe(written.length);
    // Each line carries a share of the height the family reserved, so the row
    // is as tall as the layout arithmetic said it was.
    expect(sheet).toContain("height:0.25in");

    const key = keyed(family);
    for (const sentence of written) {
      expect(sheet).not.toContain(sentence);
      expect(key).toContain(sentence);
    }
  });

  it("prints nothing in any answer place until the sheet is a key", () => {
    // Read off the answer places themselves rather than by hunting the answer
    // strings in the page: "15" is the answer to one problem and half the
    // prompt of another, and a test that searched for it would fail on a sheet
    // that was perfectly blank.
    const PLACES = [
      /<span class="sheet__slot"[^>]*>(.*?)<\/span>/g,
      /<span class="sheet__total"[^>]*>(.*?)<\/span>/g,
      /<span class="sheet__answer-line"[^>]*>(.*?)<\/span>/g,
    ];
    for (const shape of SHAPES) {
      const html = blank(shape);
      const where = JSON.stringify(shape);
      expect(html, where).not.toContain("--answered");
      let found = 0;
      for (const place of PLACES) {
        for (const [, inside] of html.matchAll(place)) {
          expect(inside, where).toBe("");
          found += 1;
        }
      }
      expect(found, where).toBeGreaterThan(0);
    }
  });
});

/* ── The long forms, and the square ────────────────────────────────────────
   The two sheets where the answer is not the only thing written down. The
   engine's suite proves the partials and the quotients are right; this is
   where they have to land in the right place on the paper, which is the whole
   of what a long form teaches and the one thing no unit test of the engine can
   see. Built through the real family, so a shape it starts producing is a
   shape these see.                                                          */

const multiplication = (
  over: Partial<MultiplicationConfig> = {},
): MultiplicationConfig => ({
  kind: "multiplication",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name"],
  operation: "multiply",
  style: "standard",
  form: "horizontal",
  tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  factors: { min: 0, max: 12 },
  count: 4,
  columns: 2,
  ...over,
});

const timesTable = (over: Partial<MultiplicationConfig> = {}) =>
  render(buildSheet(multiplication(over), SEED) as Sheet);
const timesKey = (over: Partial<MultiplicationConfig> = {}) =>
  render(answerKey(multiplication(over), SEED) as Sheet);

const LONG_MULTIPLICATION = {
  style: "long",
  digits: { into: 3, by: 2 },
} as const;
const LONG_DIVISION = {
  style: "long",
  operation: "divide",
  digits: { into: 3, by: 1 },
  remainders: true,
} as const;

describe("a rendered multiplication sheet", () => {
  /** Every shape the family prints a problem in, as the renderer sees them. */
  const SHAPES: Array<Partial<MultiplicationConfig>> = [
    {},
    { form: "vertical" },
    { operation: "divide" },
    { operation: "divide", form: "vertical" },
    { style: "missing" },
    LONG_MULTIPLICATION,
    LONG_DIVISION,
  ];

  it("gives every problem exactly one place to write the answer", () => {
    // The rule `Problems.tsx` is built around. A long multiplication's working
    // lines are not one of them — they are working, and they are marked as
    // working — so what is counted is the four places an *answer* goes.
    for (const shape of SHAPES) {
      for (const html of [timesTable(shape), timesKey(shape)]) {
        const items = problems(html);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          const places =
            count(item, 'class="sheet__slot') +
            count(item, 'class="sheet__total') +
            count(item, 'class="sheet__quotient') +
            count(item, 'class="sheet__answers"');
          expect(places, `${JSON.stringify(shape)}: ${item}`).toBe(1);
        }
      }
    }
  });

  it("sets a long division in a bracket, with the answer on top of the bar", () => {
    const [item] = problems(timesKey(LONG_DIVISION));
    const divisor = item.indexOf('class="sheet__divisor"');
    const quotient = item.indexOf('class="sheet__quotient');
    const dividend = item.indexOf('class="sheet__dividend"');
    // The divisor is outside the bracket, the quotient is written along the
    // top of the bar, and the dividend is under it. In that order, because
    // that is the order they are on paper and there is only one of it.
    expect(divisor).toBeGreaterThanOrEqual(0);
    expect(quotient).toBeGreaterThan(divisor);
    expect(dividend).toBeGreaterThan(quotient);
    expect(item).toMatch(
      /class="sheet__quotient sheet__quotient--answered">\d+ r \d+</,
    );
    // And the blank sheet is the same drawing with nothing written on it.
    expect(problems(timesTable(LONG_DIVISION))[0]).toContain(
      '<span class="sheet__quotient"></span>',
    );
  });

  it("rules the bracket rather than drawing it, so it always prints", () => {
    // §5: browsers drop background paint, and a bracket that came out of the
    // printer as three numbers in a row is not a long division.
    const css = read(join(ROOT, "src/styles/sheet.css"));
    const bracket = css.slice(css.indexOf(".sheet__dividend {"));
    expect(bracket).toContain("border-top");
    expect(bracket).toContain("border-left");
  });

  it("writes a long multiplication's partials between the rule and the total", () => {
    const items = itemsOf(multiplication(LONG_MULTIPLICATION));
    const partials = items.flatMap((problem) => problem.working ?? []);
    expect(partials.length).toBe(items.length * 2);

    const sheet = problems(timesTable(LONG_MULTIPLICATION));
    for (const item of sheet) {
      expect(count(item, 'class="sheet__work-line')).toBe(2);
      // Inside the stack and above the total, which is where the algorithm
      // puts them — under the sheet's own rule, not under the answer.
      expect(item.indexOf('class="sheet__work"')).toBeLessThan(
        item.indexOf('class="sheet__total'),
      );
      // Each line carries a share of the height the family reserved, so the
      // row is as tall as the layout arithmetic said it was — and that height
      // is spent once. Blank paper under the total *as well* would be a row
      // twice as tall as the reservation, which is the bottom of the page on a
      // second sheet.
      expect(item).toContain("height:0.25in");
      expect(count(item, 'class="sheet__workspace"')).toBe(0);
    }
    // Long division does take blank paper under the bracket, which is where a
    // child works it: the two forms spend the same reservation differently.
    for (const item of problems(timesTable(LONG_DIVISION))) {
      expect(count(item, 'class="sheet__workspace"')).toBe(1);
    }

    const key = timesKey(LONG_MULTIPLICATION);
    for (const partial of partials) expect(key).toContain(partial);
  });

  it("keeps the digits in their columns on both long forms", () => {
    // The whole of what a long form teaches is which column a digit lands in,
    // and a proportional face puts a 1 half a column left of where a 4 goes.
    const css = read(join(ROOT, "src/styles/sheet.css"));
    for (const rule of [".sheet__column {", ".sheet__bracket {"]) {
      const block = css.slice(css.indexOf(rule));
      expect(block.slice(0, block.indexOf("}"))).toContain(
        "font-variant-numeric: tabular-nums",
      );
    }

    // Tabular figures only line a quotient up with its dividend while the two
    // boxes hold their digits the same distance off their shared right edge. A
    // padding added to one and not the other slides the whole quotient across
    // by a fraction of a digit — invisible in review, and the one thing the
    // sheet exists to teach. Asserted rather than trusted.
    expect(rightInset(css, ".sheet__quotient {")).toBe(
      rightInset(css, ".sheet__dividend {"),
    );
  });

  it("fills a multiplication grid in only on the key", () => {
    // The square a child fills in: headers from the start, products at the
    // end, and the same build for both — `answers` flipped and nothing else.
    const grid = { style: "grid" as const, tables: [2, 3] };
    const sheet = timesTable(grid);
    const key = timesKey(grid);
    for (const header of [">×<", ">2<", ">3<"]) expect(sheet).toContain(header);
    // Twelve times three and twelve times two, on the key and nowhere else.
    expect(sheet).not.toContain(">36<");
    expect(key).toContain(">36<");
    expect(key).toContain(">24<");
    expect(count(key, "sheet__cell--answered")).toBe(2 * 13);
    expect(count(sheet, "sheet__cell--answered")).toBe(0);
    // And the headers are ruled off from the answers, so a child does not read
    // the row label as part of the sum.
    expect(sheet).toContain('class="sheet__axes"');
  });

  it("prints nothing in any answer place until the sheet is a key", () => {
    const PLACES = [
      /<span class="sheet__slot"[^>]*>(.*?)<\/span>/g,
      /<span class="sheet__total"[^>]*>(.*?)<\/span>/g,
      /<span class="sheet__quotient"[^>]*>(.*?)<\/span>/g,
      /<span class="sheet__work-line"[^>]*>(.*?)<\/span>/g,
    ];
    for (const shape of SHAPES) {
      const html = timesTable(shape);
      const where = JSON.stringify(shape);
      expect(html, where).not.toContain("--answered");
      let found = 0;
      for (const place of PLACES) {
        for (const [, inside] of html.matchAll(place)) {
          expect(inside, where).toBe("");
          found += 1;
        }
      }
      expect(found, where).toBeGreaterThan(0);
    }
  });
});

/* ── The sheets whose questions are pictures, and whose answers have points ──
   Fractions, decimals and money. The engine's suites prove the answers are
   right and stop at the edge of the markup; these are the two halves of that
   which only exist once it is drawn — a diagram that has to survive a printer
   with background graphics turned off, and a column of amounts whose points
   have to land under one another.                                           */

const fractions = (over: Partial<FractionConfig> = {}): FractionConfig => ({
  kind: "fractions",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name"],
  style: "identify",
  operation: "add",
  denominators: [2, 3, 4, 5, 6, 8],
  pairing: "either",
  count: 4,
  columns: 2,
  ...over,
});

const named = (over: Partial<FractionConfig> = {}) =>
  render(buildSheet(fractions(over), SEED) as Sheet);
const namedKey = (over: Partial<FractionConfig> = {}) =>
  render(answerKey(fractions(over), SEED) as Sheet);

/**
 * One numeric attribute off the first element carrying `className`.
 *
 * Anchored on the space before the name, because `stroke-width` ends in `width`
 * too — a regex without it would compare the shading against the ink weight and
 * pass for the wrong reason.
 */
function attr(html: string, className: string, name: string): number {
  const found = new RegExp(`class="${className}"[^>]*? ${name}="(-?\\d+)"`) //
    .exec(html);
  if (found === null) throw new Error(`no ${name} on .${className}`);
  return Number(found[1]);
}

/** The picture riding on a problem, which a naming problem always has. */
function artOf(problem: Problem, where: number): FractionArt {
  if (problem.art === undefined) throw new Error(`problem ${where} has no art`);
  return problem.art;
}

describe("a rendered fraction sheet", () => {
  it("draws the picture on the blank sheet, not only on the key", () => {
    // The one drawing on a sheet that is the *question*. A child handed a
    // naming sheet with no pictures on it has been handed a page of blanks.
    const sheet = named();
    expect(count(sheet, 'class="sheet__ink sheet__art"')).toBe(4);
    expect(count(namedKey(), 'class="sheet__ink sheet__art"')).toBe(4);
    expect(count(sheet, 'class="sheet__shade"')).toBe(4);
  });

  it("shades with a fill, so it survives a printer with backgrounds off", () => {
    // §5, and the reason this block is drawn rather than styled: a browser
    // drops background paint unless the reader has found the "Background
    // graphics" checkbox, and a naming sheet whose shading was a background
    // comes out as a row of empty boxes. `fill` is content — it always prints.
    expect(named()).not.toContain("background");
    const css = read(join(ROOT, "src/styles/sheet.css"));
    const shade = css.slice(css.indexOf(".sheet__shade {"));
    const rule = shade.slice(0, shade.indexOf("}"));
    expect(rule).toContain("fill: currentcolor");
    expect(rule).not.toContain("background");
  });

  it("draws the diagram in mil inside a box measured in inches", () => {
    // The same correspondence every ruled thing on a sheet rests on: the <svg>
    // is sized in inches while its viewBox counts mil, so one user unit is a
    // thousandth of an inch. Get it wrong and the picture is a thousand times
    // the size it says — which a screen never shows.
    expect(named({ model: "bar" })).toContain(
      'width="1.3in" height="0.36in" viewBox="0 0 1300 360"',
    );
    expect(named({ model: "circle" })).toContain(
      'width="0.9in" height="0.9in" viewBox="0 0 900 900"',
    );
  });

  it("cuts the whole into as many parts as the fraction has", () => {
    // A bar in sixths has five cuts in it, because its two ends are its own
    // outline; a circle in sixths has six, because none of them is. A picture
    // whose cuts and whose answer disagree is a question with no right answer.
    for (const model of ["bar", "circle"] as const) {
      const items = itemsOf(fractions({ model, count: 6 }));
      const drawn = problems(named({ model, count: 6 }));
      expect(drawn.length).toBe(items.length);
      items.forEach((problem, index) => {
        const parts = problem.art?.parts ?? 0;
        expect(count(drawn[index], "<line")).toBe(
          model === "bar" ? parts - 1 : parts,
        );
      });
    }
  });

  it("shades as much of the bar as the answer says is shaded", () => {
    // The other half of the test above. The cuts say how many parts there are;
    // this says how many of them are filled — and on a naming sheet the picture
    // *is* the question, so a bar that disagrees with the key is a page with no
    // right answer on it, which every other assertion here would let through.
    const items = itemsOf(fractions({ model: "bar", count: 6 }));
    const drawn = problems(named({ model: "bar", count: 6 }));
    expect(items.length).toBeGreaterThan(0);
    items.forEach((problem, index) => {
      const art = artOf(problem, index);
      // Taken off the outline rather than off a constant: the bar is inset by
      // half its own stroke, and the shading is a fraction of what is left.
      const span = attr(drawn[index], "sheet__shape", "width");
      expect(attr(drawn[index], "sheet__shade", "width"), problem.answer) //
        .toBe(Math.round((art.shaded * span) / art.parts));
    });
  });

  it("sweeps as much of the circle as the answer says is shaded", () => {
    const items = itemsOf(fractions({ model: "circle", count: 6 }));
    const drawn = problems(named({ model: "circle", count: 6 }));
    expect(items.length).toBeGreaterThan(0);
    items.forEach((problem, index) => {
      const art = artOf(problem, index);
      const centre = attr(drawn[index], "sheet__shape", "cx");
      const radius = attr(drawn[index], "sheet__shape", "r");
      // The wedge starts at twelve o'clock and ends `turn` degrees round from
      // it: sine east, cosine *up* the page, because y grows downwards.
      const turn = (art.shaded * 360) / art.parts;
      const end = [
        Math.round(centre + radius * Math.sin((turn * Math.PI) / 180)),
        Math.round(centre - radius * Math.cos((turn * Math.PI) / 180)),
      ];
      const wedge = /A \d+ \d+ 0 ([01]) 1 (-?\d+) (-?\d+) Z/.exec(drawn[index]);
      if (wedge === null) throw new Error(`problem ${index} draws no wedge`);
      // The large-arc flag is the difference between five sixths and one sixth:
      // SVG takes the short way round the circle unless it is told not to.
      expect(wedge[1], problem.answer).toBe(turn > 180 ? "1" : "0");
      expect([Number(wedge[2]), Number(wedge[3])], problem.answer).toEqual(end);
    });
  });

  it("gives every problem exactly one place to write the answer", () => {
    // The rule `Problems.tsx` is built around, over the four styles this family
    // prints: the picture is not an answer place, and the blank beside it is.
    for (const shape of [
      { style: "identify" as const },
      { style: "equivalent" as const },
      { style: "simplify" as const },
      { style: "arithmetic" as const },
    ]) {
      for (const html of [named(shape), namedKey(shape)]) {
        const items = problems(html);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(count(item, 'class="sheet__slot'), item).toBe(1);
        }
      }
    }
  });

  it("prints nothing in the blank until the sheet is a key", () => {
    const sheet = named();
    expect(sheet).not.toContain("--answered");
    for (const [, inside] of sheet.matchAll(
      /<span class="sheet__slot"[^>]*>(.*?)<\/span>/g,
    )) {
      expect(inside).toBe("");
    }
    // And the key writes the fraction into it — the same drawing, answered.
    for (const problem of itemsOf(fractions())) {
      expect(namedKey()).toContain(`>${problem.answer}<`);
    }
  });
});

const money = (over: Partial<MoneyConfig> = {}): MoneyConfig => ({
  kind: "money",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name"],
  currency: "gbp",
  operation: "add",
  form: "vertical",
  range: { min: 1, max: 20 },
  count: 4,
  columns: 2,
  ...over,
});

describe("a rendered money sheet", () => {
  it("stacks the amounts so their points land under one another", () => {
    // Every amount carries both its digits of change, so right-aligned tabular
    // figures put the points in a column with nothing having to align them —
    // which is the whole of what a stacked money sum teaches. The alignment
    // itself is `.sheet__column`, asserted with the long forms above; what is
    // checked here is that the amounts reach it in the shape that makes it
    // work.
    const html = render(answerKey(money(), SEED) as Sheet);
    for (const item of problems(html)) {
      expect(count(item, 'class="sheet__addend"')).toBe(2);
      expect(item).toMatch(/<span>£\d+\.\d\d<\/span>/);
      expect(item).toMatch(
        /class="sheet__total sheet__total--answered">£\d+\.\d\d</,
      );
    }
    // And the blank sheet is the same stack with nothing under the rule.
    expect(render(buildSheet(money(), SEED) as Sheet)).toContain(
      '<span class="sheet__total"></span>',
    );
  });
});

/* ── The sheets whose answer is a drawing ──────────────────────────────────
   Telling the time and geometry. Two things here exist only once the sheet is
   drawn, and neither can be seen by reading the engine's output: a clock face
   whose hands are the answer place rather than a ruled blank, and a shape whose
   proportions have to be the ones its labels claim.                          */

const clock = (over: Partial<TimeConfig> = {}): TimeConfig => ({
  kind: "time",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name"],
  style: "read",
  step: 5,
  count: 3,
  columns: 3,
  ...over,
});

const geometry = (over: Partial<GeometryConfig> = {}): GeometryConfig => ({
  kind: "geometry",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name"],
  style: "area",
  system: "metric",
  range: { min: 2, max: 12 },
  count: 3,
  columns: 3,
  ...over,
});

/**
 * The coordinate plane on a rendered sheet: how big the drawing is, and every
 * glyph inside it with where and how large it was set.
 *
 * Read back out of the markup rather than out of the block, because what is
 * being checked is whether the ink lands on the paper — a letter drawn past the
 * viewBox is markup that renders and paper that comes out blank.
 */
function drawnPlane(html: string): {
  width: number;
  height: number;
  glyphs: Array<{ x: number; y: number; size: number; text: string }>;
} {
  const drawing =
    /<svg[^>]*viewBox="0 0 (\d+) (\d+)"><title>[^<]*coordinate grid<\/title>(.*?)<\/svg>/s.exec(
      html,
    );
  if (drawing === null) throw new Error("no coordinate plane on the sheet");
  const glyphs = [
    ...drawing[3].matchAll(
      /<text class="sheet__cell" x="(-?\d+(?:\.\d+)?)" y="(-?\d+(?:\.\d+)?)" font-size="(\d+)"[^>]*>([^<]*)<\/text>/g,
    ),
  ].map((one) => ({
    x: Number(one[1]),
    y: Number(one[2]),
    size: Number(one[3]),
    text: one[4],
  }));
  return {
    width: Number(drawing[1]),
    height: Number(drawing[2]),
    glyphs,
  };
}

/** Where the ink says a dial's two hands are pointing, clockwise from twelve. */
function pointing(html: string): { hour: number; minute: number } {
  const drawn = /<g class="sheet__hands">(.*?)<\/g>/s.exec(html);
  if (drawn === null) throw new Error("no hands on the dial");
  const hands = [
    ...drawn[1].matchAll(/x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"/g),
  ].map((hand) => hand.slice(1).map(Number));
  if (hands.length !== 2) throw new Error(`${hands.length} hands`);

  // The long one is the minute hand, whichever order they were drawn in.
  const [hour, minute] = hands.sort(
    (a, b) =>
      Math.hypot(a[2] - a[0], a[3] - a[1]) -
      Math.hypot(b[2] - b[0], b[3] - b[1]),
  );
  const around = ([x1, y1, x2, y2]: number[]) =>
    ((Math.atan2(x2 - x1, y1 - y2) * 180) / Math.PI + 360) % 360;
  return { hour: around(hour), minute: around(minute) };
}

describe("a rendered time sheet", () => {
  it("puts the hands where the time says, measured off the ink", () => {
    // The one answer in the shop that a parent marks by looking at a picture,
    // so the picture is checked by measuring it: the angles are recovered from
    // the two lines and compared against the time printed beside them.
    const html = problems(
      render(buildSheet(clock({ count: 6 }), SEED) as Sheet),
    );
    for (const [where, problem] of itemsOf(clock({ count: 6 })).entries()) {
      const [, hour, minute] = /^(\d+):(\d\d)$/.exec(problem.answer) ?? [];
      const drawn = pointing(html[where]);
      // Within half a degree, because the ends of the hands land on whole
      // thousandths of an inch — a hand one minute out is six degrees out.
      expect(drawn.minute, problem.answer).toBeCloseTo(Number(minute) * 6, 0);
      // The hour hand has moved on by the part of the hour that has gone: at
      // twenty past three it is a third of the way to four.
      expect(drawn.hour, problem.answer).toBeCloseTo(
        ((Number(hour) % 12) * 60 + Number(minute)) / 2,
        0,
      );
    }
  });

  it("gives a reading problem a blank and a drawing problem the dial", () => {
    // The rule every family shares, reached from the one sheet whose answer
    // place is a picture: exactly one place to write the answer. A dial with a
    // ruled blank beside it is a sheet a child answers twice.
    for (const item of problems(render(buildSheet(clock(), SEED) as Sheet))) {
      expect(count(item, 'class="sheet__slot')).toBe(1);
      expect(count(item, 'class="sheet__hands"')).toBe(1);
    }
    for (const item of problems(
      render(buildSheet(clock({ style: "draw" }), SEED) as Sheet),
    )) {
      expect(count(item, 'class="sheet__slot')).toBe(0);
      expect(count(item, 'class="sheet__hands"')).toBe(0);
      // The dial is still there — it is the answer place, drawn empty.
      expect(count(item, 'class="sheet__dial"')).toBe(1);
    }
  });

  it("draws the hands in only when a drawing sheet is a key", () => {
    const key = render(answerKey(clock({ style: "draw" }), SEED) as Sheet);
    for (const item of problems(key)) {
      expect(count(item, 'class="sheet__hands"')).toBe(1);
    }
    for (const problem of itemsOf(clock({ style: "draw" }))) {
      // And the time is printed once, as the question — never as an answer in
      // a blank that isn't there.
      expect(count(key, `>${problem.answer}</span>`)).toBe(1);
    }
  });

  it("draws the dial in mil inside a box measured in inches", () => {
    // The same correspondence every ruled thing on a sheet rests on: an inch
    // and a half of paper, whatever the body type is set at (§17).
    for (const fontPt of [12, 18]) {
      expect(render(buildSheet(clock({ fontPt }), SEED) as Sheet)).toContain(
        'width="1.5in" height="1.5in" viewBox="0 0 1500 1500"',
      );
    }
  });
});

describe("a rendered geometry sheet", () => {
  it("draws the shape on the blank sheet, not only on the key", () => {
    // The drawing *is* the question. A child handed an area sheet with no
    // shapes on it has been handed a page of blanks.
    for (const style of ["area", "perimeter", "identify", "angles"] as const) {
      const html = render(buildSheet(geometry({ style }), SEED) as Sheet);
      expect(count(html, 'class="sheet__ink sheet__figure"'), style).toBe(3);
      expect(html, style).not.toContain("background");
    }
  });

  it("puts the outline on the points the engine gave it", () => {
    // The renderer scales nothing. A shape drawn to fit its box would be a
    // shape that can disagree with the numbers written on it, and a rectangle
    // labelled 8 by 3 and drawn 8 by 4 teaches a child not to trust the
    // picture.
    const html = render(buildSheet(geometry(), SEED) as Sheet);
    for (const [where, problem] of itemsOf(geometry()).entries()) {
      const figure = problem.figure;
      if (!figure) throw new Error(`problem ${where} has no figure`);
      const box = figureBounds(figure);
      const pad = labelPad(12);
      const drawn = figure.points
        .map(
          (point) => `${point.x - box.minX + pad},${point.y - box.minY + pad}`,
        )
        .join(" ");
      expect(problems(html)[where]).toContain(`points="${drawn}"`);
    }
  });

  it("leaves an angle open, and marks which of the two it means", () => {
    // An angle is not a shape: a triangle drawn where an angle was meant is a
    // different question. The arc is what says which side of the arms is being
    // asked about, and it is a stroke rather than a fill so it prints.
    const html = render(
      buildSheet(geometry({ style: "angles" }), SEED) as Sheet,
    );
    expect(count(html, "<polyline")).toBe(3);
    expect(count(html, "<polygon")).toBe(0);
    expect(count(html, "<path")).toBe(3);
    expect(html).toContain('fill="none"');
  });

  it("gives every problem exactly one place to write the answer", () => {
    for (const style of [
      "area",
      "volume",
      "identify",
      "coordinates",
    ] as const) {
      const html = render(buildSheet(geometry({ style }), SEED) as Sheet);
      for (const item of problems(html)) {
        expect(count(item, 'class="sheet__slot'), style).toBe(1);
      }
    }
  });

  it("numbers the axes of a plane and dots the points on it", () => {
    // The numbers are drawn inside the grid, in the squares beside the axes:
    // the drawing is exactly as wide as its squares say it is (§4), so a
    // numeral outside it is a numeral that gets clipped.
    const html = render(
      buildSheet(geometry({ style: "coordinates", count: 6 }), SEED) as Sheet,
    );
    expect(count(html, 'class="sheet__dot"')).toBe(6);
    expect(html).toContain(">10</text>");
    expect(html).not.toContain(">0</text>");
    // And nothing a child has not met. The ruling runs one square past the
    // axes so the numerals have somewhere to sit, and numbering that square
    // would put a negative number on the sheet that promised none.
    expect(html).not.toContain(">-1</text>");
    const four = render(
      buildSheet(
        geometry({ style: "coordinates", quadrants: 4, count: 6 }),
        SEED,
      ) as Sheet,
    );
    expect(four).toContain(">-8</text>");
    expect(four).not.toContain(">-9</text>");
  });

  it("keeps every letter and numeral inside the plane they are drawn on", () => {
    // An `<svg>` clips to its viewBox and the outermost gridline of a plane is
    // the edge of it — so a point sitting there gets its letter drawn off the
    // paper, and the sheet asks "E = ___" with no E next to any dot. Measured
    // off the ink rather than argued about: every glyph's box has to be inside
    // the drawing.
    for (const quadrants of [1, 4]) {
      const plane = drawnPlane(
        render(
          buildSheet(
            geometry({ style: "coordinates", quadrants, count: 8 }),
            SEED,
          ) as Sheet,
        ),
      );
      expect(plane.glyphs.length, `${quadrants} quadrant(s)`) //
        .toBeGreaterThan(8);
      for (const glyph of plane.glyphs) {
        const half = glyph.size / 2;
        expect(glyph.x - half, glyph.text).toBeGreaterThanOrEqual(0);
        expect(glyph.x + half, glyph.text).toBeLessThanOrEqual(plane.width);
        expect(glyph.y - half, glyph.text).toBeGreaterThanOrEqual(0);
        expect(glyph.y + half, glyph.text).toBeLessThanOrEqual(plane.height);
      }
      // The letters are the question, so all eight of them are on the paper.
      const letters = plane.glyphs.filter((one) => /^[A-Z]$/.test(one.text));
      expect(letters.length, `${quadrants} quadrant(s)`).toBe(8);
    }
  });

  it("prints nothing in the blank until the sheet is a key", () => {
    const blank = render(buildSheet(geometry(), SEED) as Sheet);
    expect(blank).not.toContain("--answered");
    for (const problem of itemsOf(geometry())) {
      expect(render(answerKey(geometry(), SEED) as Sheet)).toContain(
        `>${problem.answer}<`,
      );
    }
  });
});

/* ── The sheet whose answer is a box ───────────────────────────────────────
   Word shapes. The engine's suite proves which band each letter belongs in;
   this is the half that only exists once it is drawn, and it is the half the
   exercise is: a tall box has to *look* taller than a small one and a tail box
   has to hang below it, or the outline a child is being taught to recognise is
   not on the paper.                                                          */

const spelling = (over: Partial<WordsConfig> = {}): WordsConfig => ({
  kind: "words",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name"],
  style: "shapes",
  words: ["big", "cat"],
  times: 3,
  gaps: 2,
  count: 2,
  columns: 1,
  ...over,
});

/** Every box on the sheet, as the ink says it was drawn. */
function boxes(html: string): Array<{ y: number; height: number }> {
  return [
    ...html.matchAll(
      /<rect class="sheet__box" x="\d+" y="(\d+)" width="\d+" height="(\d+)"/g,
    ),
  ].map((box) => ({ y: Number(box[1]), height: Number(box[2]) }));
}

describe("a rendered word-shape sheet", () => {
  it("draws a box per letter, in the band that letter is written in", () => {
    // "big" is tall, small, tail — three boxes, three different geometries, and
    // the whole point of the sheet is that they are visibly different.
    const html = render(
      buildSheet(spelling({ words: ["big"], count: 1 }), SEED),
    );
    const [tall, small, tail] = boxes(html);
    expect(boxes(html)).toHaveLength(3);

    expect(tall.y).toBeLessThan(small.y);
    expect(tall.height).toBeGreaterThan(small.height);
    // A tail starts where a small letter does and finishes below it.
    expect(tail.y).toBe(small.y);
    expect(tail.height).toBeGreaterThan(small.height);
    expect(tail.y + tail.height).toBeGreaterThan(tall.y + tall.height);
  });

  it("draws the boxes in mil inside a box measured in inches", () => {
    // The same correspondence every drawn thing on a sheet rests on: the <svg>
    // is sized in inches while its viewBox counts mil, so one user unit is a
    // thousandth of an inch. Get it wrong and the boxes are a thousand times the
    // size they say — which a screen never shows.
    expect(render(buildSheet(spelling({ words: ["big"], count: 1 }), SEED))) //
      .toContain('width="0.685in" height="0.434in" viewBox="0 0 685 434"');
  });

  it("rules the boxes rather than tinting them, so they always print", () => {
    // §5: a browser drops background paint unless the reader has found the
    // "Background graphics" checkbox, and a word-shape sheet whose boxes were a
    // tint comes out of the printer as an empty page.
    const html = render(buildSheet(spelling(), SEED));
    expect(html).not.toContain("background");
    const css = read(join(ROOT, "src/styles/sheet.css"));
    const box = css.slice(css.indexOf(".sheet__box {"));
    const rule = box.slice(0, box.indexOf("}"));
    expect(rule).toContain("fill: none");
    expect(rule).toContain("stroke: currentcolor");
  });

  it("writes the letters into the boxes only on the key", () => {
    const blank = render(buildSheet(spelling(), SEED));
    const key = render(answerKey(spelling(), SEED));
    // The word is printed either way — it is the question — so what is counted
    // is the letters inside the boxes.
    expect(blank).toContain(">big<");
    expect(blank).not.toContain("sheet__cell--answered");
    expect(count(key, "sheet__cell--answered")).toBe(6);
    expect(key).toContain(">b</text>");
  });
});

/* ── It has to survive the printer ─────────────────────────────────────── */

describe("ruled blocks", () => {
  it("draws rules as <svg> <line>, never as a background image", () => {
    const html = render(
      sheet({ blocks: [{ kind: "rules", rule: { style: "wide" }, lines: 5 }] }),
    );
    expect(html).toContain("<svg");
    expect(html).toContain("<line");
    expect(html).not.toContain("repeating-linear-gradient");
    expect(html).not.toContain("background");
  });

  it("draws a dot grid with lines too, rather than a thousand circles", () => {
    // A zero-length dash with a round cap is a dot. One <line> per row instead
    // of one element per intersection, and the two print identically.
    const html = render(
      sheet({ blocks: [{ kind: "rules", rule: { style: "dot" }, lines: 20 }] }),
    );
    expect(html).toContain('stroke-dasharray="0 250"');
    expect(html).not.toContain("<circle");
  });

  it("never reaches for a gradient anywhere in the sheet's own styles", () => {
    // The obvious implementation, and the one that prints blank.
    for (const file of ["sheet.css", "print.css"]) {
      expect(read(join(ROOT, "src/styles", file))).not.toContain(
        "repeating-linear-gradient",
      );
    }
  });
});

/* ── The five trace styles (§6) ────────────────────────────────────────────
   All five out of one ordinary font, which is the whole reason a handwriting
   sheet here needs no per-seat tracing licence: `<text>` can be stroked, and a
   dash pattern runs along the glyph outline. Every one of them is fill or
   stroke — foreground paint — so they survive a printer with "Background
   graphics" unticked, which is the default and the thing that silently ruins
   this kind of page.                                                        */

describe("trace styles", () => {
  const tracedIn = (style: TraceStyle, font?: SheetFont) =>
    render(
      sheet({
        font,
        blocks: [
          {
            kind: "trace",
            rule: { style: "hand-5-8", midline: "dashed", descender: true },
            rows: [{ cells: [{ text: "cat", style }] }],
          },
        ],
      }),
    );

  /** The `<text>` a trace row drew, with the attributes that decide its look. */
  const drawn = (html: string) =>
    /<text class="sheet__glyph sheet__glyph--(\w+)"[^>]*font-size="(\d+)"([^>]*)>/.exec(
      html,
    );

  it("is one font and five appearances, never a file per style", () => {
    const looks = new Map<TraceStyle, string>();
    for (const style of [
      "solid",
      "dim",
      "hollow",
      "dotted",
      "dashed",
    ] as TraceStyle[]) {
      const glyph = drawn(tracedIn(style));
      expect(glyph, style).not.toBeNull();
      expect(glyph?.[1]).toBe(style);
      looks.set(style, glyph?.[3] ?? "");
    }

    // Filled: no outline to weight and nothing to break up.
    expect(looks.get("solid")).toBe("");
    expect(looks.get("dim")).toBe("");
    // Outlined: a weight, and a pattern on two of the three.
    expect(looks.get("hollow")).toContain("stroke-width=");
    expect(looks.get("hollow")).not.toContain("stroke-dasharray=");
    // A zero-length dash under a round cap is a dot, the same trick the dot
    // grid uses — so a dotted letterform needs no second font either.
    expect(looks.get("dotted")).toMatch(/stroke-dasharray="0 \d+"/);
    expect(looks.get("dotted")).toContain('stroke-linecap="round"');
    expect(looks.get("dashed")).toMatch(/stroke-dasharray="[1-9]\d* \d+"/);
    expect(looks.get("dashed")).not.toContain("stroke-linecap=");

    // The face is named once, in the stylesheet, for the whole sheet.
    expect(tracedIn("dotted")).not.toContain("font-family");
  });

  it("draws nothing where the child is on their own", () => {
    expect(drawn(tracedIn("none"))).toBeNull();
  });

  it("sizes the letters to the face, not to a shared guess", () => {
    // The same ⅝ rule in the three faces is three type sizes, because the
    // tallest ascender is a whole em of Playwrite and 0.79 of one in Andika. A
    // single ratio here would print two of the three through the top line.
    const sizes = (["print", "cursive", "dyslexic"] as SheetFont[]).map(
      (font) => Number(drawn(tracedIn("solid", font))?.[2]),
    );
    expect(new Set(sizes).size).toBe(3);
  });

  it("keeps a tail out of the box without letting the ruling out of it", () => {
    // A trace row is exactly one repeat tall, so `overflow: visible` is what
    // stops a `g` printing with its loop cut off at the baseline. It also
    // un-clips the row sideways, which two things rely on: the isometric
    // ruling draws its diagonals half a side past each edge (`Ruling.tsx`) on
    // the understanding that a viewport takes them off again, and a word wider
    // than the declared mean advance would otherwise run past the margin.
    //
    // The AC names this combination — every ruling of PRINT04 with every trace
    // style of PRINT15 — so it is the one drawn here.
    const row = render(
      sheet({
        blocks: [
          {
            kind: "trace",
            rule: { style: "isometric" },
            rows: [{ cells: [{ text: "gg", style: "dotted" }] }],
          },
        ],
      }),
    );

    // A second viewport inside the row's own: as wide as the row exactly, and
    // taller than it at both ends. The overhang is vertical and only vertical.
    const inner = /<svg x="0" y="(-?\d+)" width="(\d+)" height="(\d+)"/.exec(
      row,
    );
    expect(inner, "the trace row nests a clipping viewport").not.toBeNull();
    const [, y, width, height] = (inner ?? []).map(Number);
    expect(y).toBeLessThan(0);
    expect(height).toBeGreaterThan(-2 * y);
    // The row's own box, in the same mil the viewBox is written in.
    const outer = /viewBox="0 0 (\d+) (\d+)"/.exec(
      row.slice(row.indexOf("sheet__ink--trace")),
    );
    expect(width).toBe(Number(outer?.[1]));

    // And the diagonals really do run outside it, which is why the clip is
    // load-bearing rather than decorative.
    const diagonals = [...row.matchAll(/<line[^>]*\sx1="(-?\d+)"/g)] //
      .map((match) => Number(match[1]));
    expect(Math.min(...diagonals)).toBeLessThan(0);
  });

  it("paints them with ink rather than with a background", () => {
    // The failure this guards is invisible on screen: a style that leaned on
    // `background` looks right in the preview and prints as nothing.
    const css = read(join(ROOT, "src/styles/sheet.css"));
    const styles =
      /Letterforms, from an ordinary font.*$/s.exec(css)?.[0] ?? "";
    expect(styles).toContain(".sheet__glyph--dotted");
    expect(styles.slice(0, styles.indexOf("── Problems"))) //
      .not.toContain("background");
  });
});

/* ── Print isolation (§20) ─────────────────────────────────────────────── */

describe("print isolation", () => {
  it("never puts an ad inside a sheet", () => {
    expect(render()).not.toMatch(/class="[^"]*\bad\b[^"]*"/);
  });

  it("has no renderer that could put one there", () => {
    // The rendered markup only proves it for the blocks this fixture holds.
    // The source proves it for every sheet anybody builds later.
    for (const file of filesUnder(HERE, [".tsx", ".ts"])) {
      if (file.endsWith(".test.tsx")) continue;
      expect(read(file)).not.toMatch(/AdSlot|adsbygoogle|"ad[ "]/);
    }
  });

  it("hides the site, the ad slots and the builder's controls when printing", () => {
    const css = read(join(ROOT, "src/styles/print.css"));
    const print = css.slice(css.indexOf("@media print"));
    for (const hidden of [".mast", ".foot", ".skip", ".ad", ".no-print"]) {
      expect(print).toContain(hidden);
    }
    expect(css).toMatch(/@page\s*\{[^}]*size:/);
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*0/);
  });

  it("keeps everything that is not the sheet off the paper", () => {
    // print.css zeroes the `@page` margin on every page that renders a sheet,
    // because the sheet owns its own geometry. On a catalog page — an h1, some
    // prose, and then the paper — the only thing stopping the article printing
    // off the edge is that every section of it carries `.no-print`. print.css
    // records that as the settled decision; this is what holds a page to it. A
    // section added later without the class prints an article with no page
    // margin, silently, and "⌘P with no interaction produces usable paper"
    // stops being true with nothing failing.
    const pages = filesUnder(join(ROOT, "src/pages"), [".astro"]).filter(
      (page) => read(page).includes("components/sheet"),
    );
    expect(pages.length).toBeGreaterThan(0);

    for (const page of pages) {
      for (const [tag, classes] of landmarks(read(page))) {
        expect(classes, `<${tag} class="${classes}"> in ${page}`).toMatch(
          /\bno-print\b/,
        );
      }
    }
  });

  it("takes the builder's own layout out from under the sheet", () => {
    // `.no-print` empties the bench's columns; it does not remove them. A print
    // copy left inside a live two-column grid prints indented by the bench's
    // padding and a row down from where the preview was — on Letter, 18px off
    // the right edge of the paper and a full-page sheet onto a second one. It
    // cannot be seen on screen, because the preview is a separate scaled copy.
    //
    // The smoke run measures the real box in a browser, which is the only place
    // that can. This is the fast half: the two lines that make it possible.
    const css = read(join(ROOT, "src/styles/printshop.css"));
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\.bench\s*\{[^}]*display:\s*block/);
    expect(print).toMatch(/\.bench\s*\{[^}]*padding:\s*0/);
    expect(print).toMatch(/\.bench\s*\{[^}]*max-width:\s*none/);

    // And the column itself, not only the two controls inside it — an empty
    // grid item still occupies the row above the paper.
    const app = read(join(ROOT, "src/games/printshop/App.tsx"));
    expect(app).toMatch(/className="bench__paper[^"]*\bno-print\b/);
  });

  it("breaks pages where a reader would expect it to", () => {
    const css = read(join(ROOT, "src/styles/sheet.css"));
    expect(css).toContain("break-after: page");
    expect(css).toContain("break-inside: avoid");
  });

  it("takes the sheet out of the app's scale, rather than inheriting it", () => {
    // §4: a ⅝ rule is ⅝ of an inch or it is wrong. `--ui-scale` grows every
    // size on the site with the player's age, and paper must not do that.
    const css = read(join(ROOT, "src/styles/sheet.css"));
    const rule = css.slice(css.indexOf(".sheet {"), css.indexOf("}"));
    expect(rule).toContain("--ui-scale: 1");
  });
});

/* ── Zero JavaScript ───────────────────────────────────────────────────── */

describe("the zero-JavaScript property", () => {
  it("renders to markup with nothing to run in it", () => {
    const html = render();
    expect(html).not.toContain("<script");
    expect(html).not.toContain("astro-island");
    // A handler attribute is the tell that a renderer wanted to be an app.
    expect(html).not.toMatch(/\son[a-z]+="/);
  });

  it("has no renderer that would need hydrating", () => {
    // The issue's own note: if a renderer needs a hook, it belongs in the
    // builder, not here. A hook is also exactly what forces `client:*` onto a
    // catalog page, which is what would cost the section its SEO argument.
    for (const file of filesUnder(HERE, [".tsx", ".ts"])) {
      if (file.endsWith(".test.tsx")) continue;
      expect(read(file)).not.toMatch(
        /\buse(State|Effect|Ref|Reducer|Context|Memo|Callback|Id|SyncExternalStore)\b/,
      );
      expect(read(file)).not.toContain("react-dom/client");
    }
  });

  it("is never mounted with a client directive by a page", () => {
    const pages = filesUnder(join(ROOT, "src/pages"), [".astro"]).concat(
      filesUnder(join(ROOT, "src/layouts"), [".astro"]),
    );
    for (const page of pages) {
      const source = read(page);
      if (!source.includes("components/sheet")) continue;
      expect(source).not.toMatch(/<Sheet[A-Za-z]*[^>]*\sclient:/);
    }
  });

  /*
   * The same property, against the built output.
   *
   * An `<astro-island>` is the one thing that would show up in `dist/` if a
   * sheet were ever hydrated, and it is the whole tell: an island is how a
   * component's JavaScript reaches a page at all, so a page that prints a sheet
   * and carries no island has shipped no renderer, whatever is in the chunks
   * beside it.
   *
   * This used to scan every JavaScript chunk for the renderer's class names.
   * That stopped being the property once the builder landed — `/printables/make`
   * hydrates a `SheetView` on purpose, so the classes are legitimately in a
   * chunk now — and scanning them would have to grow an exception, which is the
   * point at which a test stops meaning anything. What matters was never "the
   * renderer is nowhere in the bundle": it is "no page that IS a sheet needs
   * JavaScript to be one", which is what this asserts and what §2 claims.
   */
  it("ships no sheet renderer to a page that is a sheet", () => {
    const dist = join(ROOT, "dist");
    if (!existsSync(dist)) return; // `npm run build` hasn't run yet.

    let checked = 0;
    for (const page of filesUnder(dist, [".html"])) {
      const html = read(page);
      if (!/class="[^"]*\bsheet\b/.test(html)) continue;
      expect(html).not.toContain("astro-island");
      checked += 1;
    }
    // Guards the guard: a rename of `.sheet` would otherwise turn this into a
    // loop over nothing that passes for the wrong reason.
    expect(checked).toBeGreaterThan(0);
  });

  it("is hydrated on the builder, which is why the builder is noindex", () => {
    const builder = join(ROOT, "dist/printables/make/index.html");
    if (!existsSync(builder)) return;

    const html = read(builder);
    // The exception, stated rather than implied. The bench has to run the
    // renderer — a live preview is the whole feature — and the page pays for it
    // with `noindex` rather than by pretending to be crawlable content.
    expect(html).toContain("astro-island");
    expect(html).toMatch(/<meta name="robots" content="[^"]*noindex/);
  });
});
