import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { describeSheetFamily } from "../contract";
import { printedBlockBox, sheetBlockBox } from "../chrome";
import { ticks } from "../numberline";
import { MARGINS, PAPERS, toInches } from "../paper";
import type {
  Block,
  ChartConfig,
  ChartStyle,
  GridSpec,
  MarginSize,
  PaperSize,
  Sheet,
} from "../types";

import { CHART_SHEET, chartKeyed } from "./charts";

/**
 * The family where being one out is the whole of the bug.
 *
 * The suite is arithmetic rather than judgement: a 1–100 chart has a hundred
 * squares numbered 1 to 100 in order, a 0–100 line marked every 10 has eleven
 * ticks and not ten, a first-quadrant plane to 10 has eleven gridlines each
 * way, and a heading sits over the column it names.
 *
 * **Counted off the finished blocks.** Nothing below asks the builder what it
 * built — every count is recovered from the `Block[]` a page would render,
 * because a generator asserting its own arithmetic agrees with itself whatever
 * it does.
 */

const config = (over: Partial<ChartConfig> = {}): ChartConfig => ({
  kind: "chart",
  style: "hundred",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: ["name", "date"],
  ...over,
});

/** The one grid on a sheet, or a failure that says so. */
function gridOf(sheet: Sheet): GridSpec {
  const grids = sheet.blocks.filter((block) => block.kind === "grid");
  expect(grids).toHaveLength(1);
  return grids[0].grid;
}

/** Every number-line strip on a sheet, in the order they print. */
const linesOf = (sheet: Sheet) =>
  sheet.blocks
    .filter((block) => block.kind === "numberline")
    .map((b) => b.line);

/** How much of the page the blocks take, gaps included. */
function used(blocks: Block[], grid: GridSpec | null): number {
  const spacers = blocks
    .filter((block) => block.kind === "spacer")
    .reduce((total, block) => total + block.height, 0);
  const lines = blocks.filter((block) => block.kind === "numberline").length;
  // The strip's own drawn height (`NUMBER_LINE_HEIGHT`) plus the flex gap the
  // stylesheet puts between blocks — both declared, per §4.
  return (
    spacers +
    lines * 340 +
    (blocks.length - 1) * 140 +
    (grid ? grid.rows * (grid.row ?? grid.cell) : 0)
  );
}

/* ── The hundred chart ─────────────────────────────────────────────────── */

describe("a hundred chart", () => {
  it("holds a hundred squares numbered 1 to 100, in order", () => {
    // The classic off-by-one, counted rather than trusted: a chart that starts
    // at nought and calls itself 1–100, or one whose last row is short.
    const grid = gridOf(buildSheet(config({ filled: true }), 1));
    expect(grid.columns).toBe(10);
    expect(grid.rows).toBe(10);
    expect(grid.cells).toHaveLength(100);
    expect(grid.cells?.[0]).toBe("1");
    expect(grid.cells?.[99]).toBe("100");
    expect(grid.cells).toEqual(
      Array.from({ length: 100 }, (_, index) => String(index + 1)),
    );
  });

  it("starts at nought when that is what was asked for", () => {
    // The other chart a school prints, and the argument between the two is a
    // real one: 0–99 puts every multiple of ten at the head of its own row.
    const grid = gridOf(
      buildSheet(config({ range: { min: 0, max: 99 }, filled: true }), 1),
    );
    expect(grid.cells?.[0]).toBe("0");
    expect(grid.cells?.[99]).toBe("99");
    expect(grid.rows).toBe(10);
  });

  it("completes its last row rather than printing a ragged one", () => {
    // 1–105 is eleven rows, not ten and a half: the shape is the lesson, and
    // every number asked for has to be on the paper.
    const sheet = buildSheet(config({ range: { min: 1, max: 105 } }), 1);
    const grid = gridOf(sheet);
    expect(grid.rows).toBe(11);
    expect(grid.answers).toHaveLength(110);
    expect(grid.answers?.[104]).toBe("105");
    expect(sheet.header.title).toBe("Number chart, 1 to 110");
  });

  it("says a hundred chart only when it is one", () => {
    expect(buildSheet(config(), 1).header.title).toBe("Hundred chart");
    expect(
      buildSheet(config({ range: { min: 0, max: 99 } }), 1).header.title,
    ).toBe("Hundred chart");
    expect(
      buildSheet(config({ range: { min: 1, max: 20 } }), 1).header.title,
    ).toBe("Number chart, 1 to 20");
  });

  it("prints squares that are square, inside the paper", () => {
    const built = config();
    const grid = gridOf(buildSheet(built, 1));
    const box = sheetBlockBox(built);
    // One length for both directions is what makes a square square — the
    // renderer reads `row ?? cell`, and a chart never sets `row`.
    expect(grid.row).toBeUndefined();
    expect(grid.columns * grid.cell).toBeLessThanOrEqual(box.width);
    expect(grid.rows * grid.cell).toBeLessThanOrEqual(box.height);
  });

  it("is filled in by its own answer key, and by nothing else", () => {
    // The key is verified against a list built here rather than against the
    // one the family built: a generator that agreed with itself would pass a
    // check written the other way round whatever it printed.
    const built = config();
    const blank = buildSheet(built, 1);
    const key = answerKey(built, 1);

    expect(blank.answers).toBe(false);
    expect(key.answers).toBe(true);
    expect(gridOf(blank).cells?.every((cell) => cell === "")).toBe(true);

    const grid = gridOf(key);
    for (let row = 0; row < grid.rows; row++) {
      for (let column = 0; column < grid.columns; column++) {
        // Worked out from where the square *is* on the page, which is the
        // property a child reads off it: down a column is ten more.
        expect(grid.answers?.[row * grid.columns + column]).toBe(
          String(1 + row * 10 + column),
        );
      }
    }
  });

  it("is the wall chart and the exercise, from one build", () => {
    // Same numbers, filed under a different key: `cells` when they print on the
    // sheet and `answers` when they only print on the key.
    const blank = gridOf(buildSheet(config(), 1));
    const filled = gridOf(buildSheet(config({ filled: true }), 1));
    expect(filled.cells).toEqual(blank.answers);
    expect(filled.answers).toBeUndefined();
  });

  it("asks for the missing numbers only on the sheet that withholds them", () => {
    expect(buildSheet(config(), 1).header.instructions).toBe(
      "Write the numbers in, one to a square.",
    );
    expect(
      buildSheet(config({ filled: true }), 1).header.instructions,
    ).toBeUndefined();
  });
});

/* ── The number line ───────────────────────────────────────────────────── */

describe("a number line", () => {
  const line = (over: Partial<ChartConfig> = {}) =>
    config({ style: "number-line", ...over });

  it("has one more tick than it has intervals", () => {
    // The off-by-one this sheet exists to avoid: 0 to 100 in tens is ten hops
    // and eleven ticks, and a line with ten of them is missing an end.
    const [strip] = linesOf(
      buildSheet(line({ range: { min: 0, max: 100 }, step: 10 }), 1),
    );
    expect(ticks(strip)).toHaveLength(11);
    expect(ticks(strip)[0]).toBe(0);
    expect(ticks(strip)[10]).toBe(100);
  });

  it("marks every value the interval says, and nothing between them", () => {
    const [strip] = linesOf(
      buildSheet(line({ range: { min: 0, max: 20 }, step: 2 }), 1),
    );
    expect(ticks(strip)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  });

  it("runs to a whole number of intervals rather than stopping short", () => {
    // 0 to 25 in tens would otherwise draw its last tick two thirds along and
    // leave the end of the axis unmarked — a line a child counts wrongly.
    const [strip] = linesOf(
      buildSheet(line({ range: { min: 0, max: 25 }, step: 10 }), 1),
    );
    expect(strip.to).toBe(30);
    expect((strip.to - strip.from) % strip.step).toBe(0);
  });

  it("thins the numbers out, and keeps the number on the last tick", () => {
    // A hundred and one numerals across seven and a half inches is a smudge, so
    // the ticks stay and the labels step back to something a child counts in —
    // and to something that divides the run, or the end of the line loses its
    // number.
    const [strip] = linesOf(
      buildSheet(line({ range: { min: 0, max: 100 }, step: 1 }), 1),
    );
    expect(ticks(strip)).toHaveLength(101);
    expect(strip.label).toBeGreaterThan(1);
    expect((ticks(strip).length - 1) % (strip.label ?? 1)).toBe(0);
  });

  it("labels every tick when they fit", () => {
    const [strip] = linesOf(
      buildSheet(line({ range: { min: 0, max: 20 }, step: 1 }), 1),
    );
    expect(strip.label).toBe(1);
  });

  it("prints the strips it was asked for, and cuts none of them off", () => {
    const built = line({ range: { min: 0, max: 20 }, step: 1, strips: 6 });
    const sheet = buildSheet(built, 1);
    const strips = linesOf(sheet);
    expect(strips).toHaveLength(6);
    // Every strip is the same line: a page of six is six copies to cut apart,
    // not six different scales to read.
    for (const strip of strips) expect(strip).toEqual(strips[0]);
    expect(used(sheet.blocks, null)).toBeLessThanOrEqual(
      sheetBlockBox(built).height,
    );
  });

  it("caps the strips at what the paper holds", () => {
    const built = line({ strips: 40 });
    const sheet = buildSheet(built, 1);
    expect(linesOf(sheet).length).toBeLessThan(40);
    expect(used(sheet.blocks, null)).toBeLessThanOrEqual(
      sheetBlockBox(built).height,
    );
  });
});

/* ── The coordinate grid ───────────────────────────────────────────────── */

describe("a coordinate grid", () => {
  const plane = (over: Partial<ChartConfig> = {}) =>
    config({ style: "coordinate", ...over });

  it("runs to the number on the axis, with a margin for the numerals", () => {
    // Eleven squares across for a plane that runs to ten: ten of them are the
    // plane and the eleventh is where the numbers down the side are printed.
    const grid = gridOf(buildSheet(plane({ span: 10 }), 1));
    expect(grid.kind).toBe("coordinate");
    expect(grid.columns).toBe(11);
    expect(grid.rows).toBe(11);
    expect(grid.origin).toEqual({ column: 1, row: 10 });
    expect(grid.axis).toEqual({ min: 0, max: 10 });
  });

  it("puts nothing negative on a first-quadrant sheet", () => {
    // The margin square outside the axes is where the numerals sit, not a
    // column of −1: `axis` is what tells the renderer the difference.
    const grid = gridOf(buildSheet(plane({ span: 10 }), 1));
    expect(grid.axis?.min).toBe(0);
  });

  it("counts both ways from the middle when all four are asked for", () => {
    const grid = gridOf(buildSheet(plane({ quadrants: 4, span: 8 }), 1));
    expect(grid.columns).toBe(16);
    expect(grid.origin).toEqual({ column: 8, row: 8 });
    expect(grid.axis).toEqual({ min: -8, max: 8 });
  });

  it("keeps its squares square and on the paper, at every span", () => {
    for (const span of [4, 7, 10, 15, 20]) {
      for (const quadrants of [1, 4]) {
        const built = plane({ span, quadrants });
        const grid = gridOf(buildSheet(built, 1));
        const box = sheetBlockBox(built);
        expect(grid.row, `${span}/${quadrants}`).toBeUndefined();
        expect(grid.columns * grid.cell).toBeLessThanOrEqual(box.width);
        expect(grid.rows * grid.cell).toBeLessThanOrEqual(box.height);
      }
    }
  });
});

/* ── The place-value chart ─────────────────────────────────────────────── */

describe("a place-value chart", () => {
  const mat = (over: Partial<ChartConfig> = {}) =>
    config({ style: "place-value", ...over });

  it("has one column for each power of ten, ends included", () => {
    // Hundreds to ones is three columns, not two: the off-by-one a chart of
    // consecutive places invites.
    const grid = gridOf(
      buildSheet(mat({ places: { largest: 2, smallest: 0 } }), 1),
    );
    expect(grid.columns).toBe(3);
    expect(grid.cells?.slice(0, 3)).toEqual(["Hundreds", "Tens", "Ones"]);
  });

  it("names every column, largest first, decimals included", () => {
    const grid = gridOf(
      buildSheet(mat({ places: { largest: 3, smallest: -2 } }), 1),
    );
    expect(grid.columns).toBe(6);
    expect(grid.cells?.slice(0, 6)).toEqual([
      "Thousands",
      "Hundreds",
      "Tens",
      "Ones",
      "Tenths",
      "Hundredths",
    ]);
  });

  it("puts the heavier upright where the decimal point goes", () => {
    // Immediately right of the ones column, counted in columns — which is what
    // makes it land on the ruling rather than near it.
    expect(
      gridOf(buildSheet(mat({ places: { largest: 2, smallest: -2 } }), 1))
        .origin,
    ).toEqual({ column: 3, row: 1 });
    // And on a chart with nothing smaller than ones, that is its right edge.
    expect(
      gridOf(buildSheet(mat({ places: { largest: 3, smallest: 0 } }), 1))
        .origin,
    ).toEqual({ column: 4, row: 1 });
  });

  it("leaves the rows blank under the headings", () => {
    const grid = gridOf(buildSheet(mat({ rows: 6 }), 1));
    expect(grid.rows).toBe(7);
    expect(grid.cells).toHaveLength(grid.columns * 7);
    expect(grid.cells?.slice(grid.columns).every((cell) => cell === "")).toBe(
      true,
    );
    expect(grid.answers).toBeUndefined();
  });

  it("is the one grid whose rows are not squares, and stays on the page", () => {
    for (const rows of [1, 4, 8, 12, 40]) {
      const built = mat({ rows });
      const grid = gridOf(buildSheet(built, 1));
      const box = sheetBlockBox(built);
      expect(grid.row, `${rows}`).toBeDefined();
      expect(grid.columns * grid.cell).toBeLessThanOrEqual(box.width);
      expect(grid.rows * (grid.row ?? 0)).toBeLessThanOrEqual(box.height);
    }
  });

  it("never orders its places the wrong way round", () => {
    // Both ends arrive from outside the build, and a chart from ones down to
    // thousands would be a chart with minus two columns.
    const grid = gridOf(
      buildSheet(mat({ places: { largest: 0, smallest: 3 } }), 1),
    );
    expect(grid.columns).toBeGreaterThan(0);
    expect(grid.cells?.[0]).toBe("Ones");
  });
});

/* ── The bargain every family keeps ────────────────────────────────────── */

const STYLES: ChartStyle[] = [
  "hundred",
  "number-line",
  "coordinate",
  "place-value",
];

describeSheetFamily("chart", {
  label: "Charts, number lines and grids",
  spec: CHART_SHEET,
  config,
  shapes: STYLES.map((style) => ({ style })),
  keyed: chartKeyed,
});

describe("every reference sheet", () => {
  it("is the same sheet on every build, and on every seed", () => {
    // §7. Nothing here is drawn from the seed — a hundred chart is the same
    // hundred numbers whenever it is printed — so the sheet has to be identical
    // across seeds as well as across builds, which is the stronger claim.
    for (const style of STYLES) {
      const built = config({ style });
      expect(JSON.stringify(buildSheet(built, 1))).toBe(
        JSON.stringify(buildSheet(built, 1)),
      );
      expect(JSON.stringify(buildSheet(built, 7).blocks)).toBe(
        JSON.stringify(buildSheet(built, 1).blocks),
      );
    }
  });

  it("fits the paper, on every stock and at every margin", () => {
    // Measured against the chrome the *finished sheet* carries rather than
    // against what the family reserved for, because those are the two numbers
    // that can disagree — and the way they disagree is silent. A family prints
    // a title whatever its config says; one that reserved no row for it builds
    // a page an inch and a half too long, `.sheet` is `min-height` so nothing
    // overflows on screen, and the last inch comes out on a second sheet of
    // paper. Reserving from the config was exactly that bug.
    for (const style of STYLES) {
      for (const size of Object.keys(PAPERS) as PaperSize[]) {
        for (const margin of Object.keys(MARGINS) as MarginSize[]) {
          for (const fontPt of [8, 12, 24, 36]) {
            const built = config({
              style,
              fontPt,
              paper: { size, orientation: "portrait", margin },
            });
            // The key as well as the sheet: the two are laid out against one
            // box, and a key prints a word in the footer that its sheet does
            // not — so a footer that wraps on one and not the other is a key
            // whose last row is on a second page.
            for (const sheet of [buildSheet(built, 1), answerKey(built, 1)]) {
              const grids = sheet.blocks.filter(
                (block) => block.kind === "grid",
              );
              const box = printedBlockBox(sheet);
              const where = `${style}/${size}/${margin}/${fontPt}`;
              expect(sheet.blocks.length, where).toBeGreaterThan(0);
              expect(
                used(sheet.blocks, grids[0]?.grid ?? null),
                where,
              ).toBeLessThanOrEqual(box.height);
              for (const grid of grids) {
                expect(
                  grid.grid.columns * grid.grid.cell,
                  where,
                ).toBeLessThanOrEqual(box.width);
              }
            }
          }
        }
      }
    }
  });

  it("prints something a parent can measure, in inches", () => {
    // The unit the whole subtree is in (§4). A square that came out as a
    // fraction of a millimetre would still pass every count above.
    const grid = gridOf(buildSheet(config(), 1));
    expect(toInches(grid.cell)).toBeGreaterThan(0.2);
    expect(toInches(grid.cell)).toBeLessThanOrEqual(0.8);
  });

  it("says in one line what it is", () => {
    expect(describeSheet(config())).toBe(
      "Hundred chart, 1 to 100, blank to fill in",
    );
    expect(describeSheet(config({ filled: true }))).toBe(
      "Hundred chart, 1 to 100, filled in",
    );
    expect(
      describeSheet(
        config({ style: "number-line", range: { min: 0, max: 20 }, step: 2 }),
      ),
    ).toBe("Number line from 0 to 20, a tick every 2 — 11 of them");
    expect(describeSheet(config({ style: "coordinate", span: 10 }))).toBe(
      "Coordinate grid, the first quadrant, 0 to 10",
    );
    expect(
      describeSheet(
        config({ style: "place-value", places: { largest: 2, smallest: 0 } }),
      ),
    ).toBe("Place-value chart, hundreds to ones");
  });

  it("prints a page rather than throwing on a config from outside this build", () => {
    // Every field here can arrive from a bookmarked link or a sheet saved last
    // term, and a `NaN` range has to produce paper rather than an exception.
    const hostile = {
      ...config(),
      style: "constructor",
      range: { min: NaN, max: "lots" },
      step: -4,
      strips: 1e9,
      span: NaN,
      quadrants: "four",
      places: { largest: 99, smallest: -99 },
      rows: -1,
    } as unknown as ChartConfig;
    expect(() => buildSheet(hostile, 1)).not.toThrow();
    const sheet = buildSheet(hostile, 1);
    expect(sheet.blocks.length).toBeGreaterThan(0);
    expect(used(sheet.blocks, gridOf(sheet))).toBeLessThanOrEqual(
      sheetBlockBox(hostile).height,
    );
  });
});
