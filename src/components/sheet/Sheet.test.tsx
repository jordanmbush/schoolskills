import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { ticks } from "@/engine/sheets/numberline";
import { DEFAULT_PAPER } from "@/engine/sheets/paper";
import type {
  ArithmeticConfig,
  Block,
  MultiplicationConfig,
  Paper,
  Problem,
  Sheet,
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
    rows: [{ text: "cat", repeats: ["solid", "dotted", "dashed", "none"] }],
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
      ["c", "a", "t"],
      ["x", "y", "z"],
      ["d", "o", "g"],
    ],
    find: ["cat", "dog"],
    solution: [{ word: "cat", column: 0, row: 0, dx: 1, dy: 0 }],
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

/** The problems of a built sheet, narrowed out of the block union. */
function itemsOf(over: Partial<ArithmeticConfig> = {}): Problem[] {
  const block = buildSheet(arithmetic(over), SEED).blocks[0];
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
    const items = itemsOf({ numberLine: true });
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
    const written = itemsOf(family).flatMap((problem) => problem.answers ?? []);
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
    const items = itemsOfMultiplication(LONG_MULTIPLICATION);
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

/** The problems of a built multiplication sheet, narrowed out of the union. */
function itemsOfMultiplication(over: Partial<MultiplicationConfig>): Problem[] {
  const block = buildSheet(multiplication(over), SEED).blocks[0];
  if (block.kind !== "problems") throw new Error(`got ${block.kind}`);
  return block.items;
}

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
   * Two things would show up in `dist/` if a sheet were ever hydrated: an
   * `<astro-island>` naming the renderer, and the renderer's own class names
   * inside a JavaScript chunk. Neither is there while every mount is
   * directive-free — which is the point, and is why this passes before the
   * first catalog page exists and keeps passing after PRINT03 adds one.
   */
  it("ships no sheet renderer in the built JavaScript", () => {
    const dist = join(ROOT, "dist");
    if (!existsSync(dist)) return; // `npm run build` hasn't run yet.

    for (const script of filesUnder(join(dist, "_astro"), [".js"])) {
      expect(read(script)).not.toContain("sheet__glyph");
      expect(read(script)).not.toContain("sheet__blocks");
    }
    for (const page of filesUnder(dist, [".html"])) {
      const html = read(page);
      if (!/class="[^"]*\bsheet\b/.test(html)) continue;
      expect(html).not.toContain("astro-island");
    }
  });
});
