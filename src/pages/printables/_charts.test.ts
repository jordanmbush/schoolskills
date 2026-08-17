import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { ticks } from "@/engine/sheets/numberline";
import { toInches } from "@/engine/sheets/paper";
import type { GridSpec, NumberLine, Sheet } from "@/engine/sheets/types";

import { BIBLE_SHEETS, hrefFor as bibleHref } from "./_bible";
import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import {
  CHART_GROUPS,
  CHART_SEED,
  CHART_SHEETS,
  builderHref,
  chartShelf,
  keyed,
  pathFor,
  type ChartSheet,
} from "./_charts";
import { CURSIVE_SHEETS, hrefFor as cursiveHref } from "./_cursive";
import { GRAMMAR_SHEETS, pathFor as grammarPath } from "./_grammar";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import { PHONICS_SHEETS, pathFor as phonicsPath } from "./_phonics";
import { SPELLING_SHEETS, pathFor as spellingPath } from "./_spelling";

/**
 * The charts catalog, held to what a catalog page has to be — and to the one
 * thing this shelf exists to get right.
 *
 * A worksheet can be marked, so a mistake on one is found. A reference sheet
 * cannot: a child counts along it and trusts it. So the numbers the prose says
 * out loud — twenty-one ticks, ten rows of ten, a numeral every five, four
 * columns — are checked here against the sheet the page prints under them,
 * because the page *is* the sheet (§8) and a reader could otherwise disprove it
 * by looking.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const built = (sheet: ChartSheet): Sheet =>
  buildSheet(sheet.config, CHART_SEED);

/** The one grid a sheet prints, where it prints one. */
const gridOf = (sheet: Sheet): GridSpec | undefined =>
  sheet.blocks.find((block) => block.kind === "grid")?.grid;

/** Every number-line strip a sheet prints. */
const linesOf = (sheet: Sheet): NumberLine[] =>
  sheet.blocks
    .filter((block) => block.kind === "numberline")
    .map((b) => b.line);

const bySlug = (slug: string): ChartSheet => {
  const sheet = CHART_SHEETS.find((entry) => entry.slug === slug);
  if (!sheet) throw new Error(`no sheet at ${slug}`);
  return sheet;
};

describe("the charts catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of CHART_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(CHART_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      CHART_SHEETS.length,
    );
  });

  it("never claims a path another shelf already prints on", () => {
    // Nine route patterns over one prefix. They only coexist because the paths
    // they emit are disjoint; the day they are not, Astro has two routes for
    // one URL and picks one of them.
    const taken = new Set<string>([
      ...PAPER_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => `/printables/${paperPath(sheet, stock)}`),
      ),
      ...MATHS_SHEETS.map((sheet) => mathsPath(sheet)),
      ...SPELLING_SHEETS.map((sheet) => spellingPath(sheet)),
      ...GRAMMAR_SHEETS.map((sheet) => grammarPath(sheet)),
      ...PHONICS_SHEETS.map((sheet) => phonicsPath(sheet)),
      ...HANDWRITING_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => handwritingHref(sheet, stock)),
      ),
      ...CURSIVE_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => cursiveHref(sheet, stock)),
      ),
      ...BIBLE_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => bibleHref(sheet, stock)),
      ),
    ]);
    for (const sheet of CHART_SHEETS) {
      expect(taken.has(pathFor(sheet)), sheet.slug).toBe(false);
    }
  });

  it("shows every kind of reference the family can make", () => {
    // Four styles, and a style with no page is a sheet a parent can only find
    // by opening the builder and reading a dropdown.
    expect(new Set(CHART_SHEETS.map((sheet) => sheet.config.style))).toEqual(
      new Set(["hundred", "number-line", "coordinate", "place-value"]),
    );
  });

  it("answers a different query on every page", () => {
    const keywords = CHART_SHEETS.map((sheet) => sheet.keyword.toLowerCase());
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of CHART_SHEETS) {
      expect(sheet.notes.length, sheet.slug).toBeGreaterThanOrEqual(2);
      for (const note of sheet.notes)
        expect(note.length, sheet.slug).toBeGreaterThan(200);
      expect(sheet.lead.length, sheet.slug).toBeGreaterThan(100);
      expect(sheet.summary.length, sheet.slug).toBeGreaterThan(60);
    }
  });

  it("shelves every sheet exactly once", () => {
    const shelved = chartShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(CHART_SHEETS.length);
    for (const group of CHART_GROUPS)
      expect(
        CHART_SHEETS.some((sheet) => sheet.group === group.id),
        group.id,
      ).toBe(true);
  });
});

describe("the sheet on a catalog page", () => {
  it("prints something on every page", () => {
    for (const sheet of CHART_SHEETS) {
      const printed = built(sheet);
      expect(printed.blocks.length, sheet.slug).toBeGreaterThan(0);
      expect(printed.header.title, sheet.slug).toBeTruthy();
    }
  });

  it("is the same sheet on every build", () => {
    // §7, and the reason these pages can be prerendered at all: a crawler that
    // comes back next month has to read the page it indexed.
    for (const sheet of CHART_SHEETS) {
      expect(built(sheet), sheet.slug).toEqual(built(sheet));
    }
  });

  it("keys the one page that withholds an answer, and only that one", () => {
    for (const sheet of CHART_SHEETS) {
      const key = answerKey(sheet.config, CHART_SEED);
      expect(key.blocks, sheet.slug).toEqual(built(sheet).blocks);
      expect(keyed(sheet), sheet.slug).toBe(
        sheet.slug === "blank-hundred-chart",
      );
    }
  });

  it("prints a name line where a child works on the sheet, and not on a wall chart", () => {
    // The one editorial judgement on this shelf that shows up on the paper: a
    // chart to pin up and a strip about to be cut into six have nothing to
    // write a name on. Blank either way, always (§1).
    for (const sheet of CHART_SHEETS) {
      const worked = ["blank-hundred-chart", "place-value-chart"];
      if (worked.includes(sheet.slug))
        expect(sheet.config.fields, sheet.slug).toContain("name");
      if (sheet.slug === "hundred-chart" || sheet.slug === "number-line")
        expect(sheet.config.fields, sheet.slug).toEqual([]);
    }
  });
});

/* ── The numbers the prose says out loud ───────────────────────────────── */

describe("what the pages claim", () => {
  it("prints a hundred squares numbered 1 to 100, on both hundred charts", () => {
    for (const slug of ["hundred-chart", "blank-hundred-chart"]) {
      const grid = gridOf(built(bySlug(slug)));
      expect(grid?.columns, slug).toBe(10);
      expect(grid?.rows, slug).toBe(10);
      const numbers =
        (grid?.cells?.[0] === "" ? grid?.answers : grid?.cells) ?? [];
      expect(numbers, slug).toHaveLength(100);
      expect(numbers[0], slug).toBe("1");
      expect(numbers[99], slug).toBe("100");
    }
  });

  it("prints them at the three quarters of an inch the page says", () => {
    // The one measurement quoted in the prose, and the sort of claim that goes
    // quietly wrong when the chrome above the grid changes height.
    for (const slug of ["hundred-chart", "blank-hundred-chart"]) {
      expect(toInches(gridOf(built(bySlug(slug)))?.cell ?? 0), slug).toBe(0.75);
    }
  });

  it("prints six strips of twenty-one ticks on the 0 to 20 line", () => {
    const strips = linesOf(built(bySlug("number-line")));
    expect(strips).toHaveLength(6);
    expect(ticks(strips[0])).toHaveLength(21);
    expect(strips[0].label).toBe(1);
    for (const strip of strips) expect(strip).toEqual(strips[0]);
  });

  it("keeps every tick and numbers every fifth on the line to 100", () => {
    const strips = linesOf(built(bySlug("number-line-to-100")));
    expect(strips).toHaveLength(3);
    expect(ticks(strips[0])).toHaveLength(101);
    // "numbered every five", in as many words on the page above it.
    expect(strips[0].label).toBe(5);
  });

  it("heads the place-value charts with the columns their prose names", () => {
    expect(
      gridOf(built(bySlug("place-value-chart")))?.cells?.slice(0, 4),
    ).toEqual(["Thousands", "Hundreds", "Tens", "Ones"]);
    expect(
      gridOf(built(bySlug("decimal-place-value-chart")))?.cells?.slice(0, 6),
    ).toEqual([
      "Hundreds",
      "Tens",
      "Ones",
      "Tenths",
      "Hundredths",
      "Thousandths",
    ]);
  });

  it("rules the decimal point between the ones and the tenths", () => {
    // The claim the decimal page is built on, counted in columns: hundreds,
    // tens, ones is three, so the heavier upright is the third gridline in.
    expect(gridOf(built(bySlug("decimal-place-value-chart")))?.origin).toEqual({
      column: 3,
      row: 1,
    });
  });

  it("numbers the coordinate grids the way each page promises", () => {
    // Eleven squares for a plane that runs to ten — ten of them the plane, and
    // one the margin the numerals are printed in.
    const first = gridOf(built(bySlug("coordinate-grid")));
    expect(first?.columns).toBe(11);
    expect(first?.axis).toEqual({ min: 0, max: 10 });

    const four = gridOf(built(bySlug("four-quadrant-graph-paper")));
    expect(four?.columns).toBe(20);
    expect(four?.axis).toEqual({ min: -10, max: 10 });
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed", () => {
    for (const sheet of CHART_SHEETS) {
      expect(
        builderHref(sheet).startsWith("/printables/make#s="),
        sheet.slug,
      ).toBe(true);
    }
  });
});

describe("the sitemap", () => {
  /*
   * A URL missing from the sitemap is the failure nobody notices — nothing
   * breaks, the page is simply never submitted. Skipped when there is no
   * `dist/`, exactly as the other catalogs' are; CI builds before it runs the
   * suite.
   */
  it("carries every chart slug and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/charts")).toBe(true);
    for (const sheet of CHART_SHEETS) {
      expect(found.has(pathFor(sheet)), sheet.slug).toBe(true);
    }
    // And the metric squares that arrived on the paper shelf with them.
    for (const slug of [
      "graph-paper-1-cm",
      "graph-paper-5-mm",
      "dot-grid-paper-1-cm",
      "isometric-graph-paper-1-cm",
    ]) {
      expect(found.has(`/printables/${slug}`), slug).toBe(true);
    }
  });
});
