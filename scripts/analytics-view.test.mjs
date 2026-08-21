import { describe, expect, it } from "vitest";

import {
  dailyLines,
  fitDays,
  mergedLines,
  sectionRows,
  shorten,
} from "./analytics-view.mjs";

/**
 * The rollup has always counted by day; until `--by-day` the summary threw
 * that away on the way to the screen. So the cases that matter here are the
 * ones where a day and a total disagree — a field that only some days
 * recorded, a window wider than the terminal, and a label too long to print.
 *
 * The shape of a day is `scripts/rollup-analytics.mjs`'s output: see `main`
 * there for which keys are written and which are omitted entirely.
 */

/** A day before the place lookup or referrers existed — see `loadGeo`. */
const EARLY = {
  visitors: 4,
  pageViews: 9,
  pages: { "/": 5, "/typing/": 4 },
  edges: { SEA: 9 },
  events: { race_start: 2 },
  decks: {},
};

const FULL = {
  visitors: 2,
  pageViews: 3,
  pages: { "/": 1, "/flash-cards/": 2 },
  countries: { US: 2, "(unknown)": 1 },
  regions: { "US / Washington": 2 },
  cities: { "US / Washington / Seattle": 1, "US / Iowa / Council Bluffs": 1 },
  referrers: { "(none)": 2, "t.co": 1 },
  edges: { SEA: 3 },
  events: { race_start: 1, "race_end:quit": 1 },
  decks: { multiply: 1 },
};

const DAYS = { "2026-08-14": EARLY, "2026-08-15": FULL };
const DATES = ["2026-08-14", "2026-08-15"];

describe("sectionRows", () => {
  it("gives every key a cell per day, ordered by total", () => {
    expect(sectionRows(DAYS, DATES, "pages")).toEqual([
      { name: "/", cells: [5, 1], total: 6 },
      { name: "/typing/", cells: [4, 0], total: 4 },
      { name: "/flash-cards/", cells: [0, 2], total: 2 },
    ]);
  });

  /**
   * The distinction the whole grid turns on. `/typing/` got no views on the
   * 15th, which the day counted and found none of — a zero. Nothing at all is
   * known about referrers on the 14th, because that rollup did not record the
   * field. Both would be `0` if the cells were built by summing.
   */
  it("separates a day that counted none from a day that never looked", () => {
    expect(sectionRows(DAYS, DATES, "referrers")).toEqual([
      { name: "(none)", cells: [null, 2], total: 2 },
      { name: "t.co", cells: [null, 1], total: 1 },
    ]);
  });

  it("treats an empty section as counted, not as missing", () => {
    expect(
      sectionRows(
        { a: { decks: {} }, b: { decks: { x: 1 } } },
        ["a", "b"],
        "decks",
      ),
    ).toEqual([{ name: "x", cells: [0, 1], total: 1 }]);
  });

  it("breaks ties on the name, so a row cannot move when the window does", () => {
    const rows = sectionRows(
      { a: { pages: { z: 1 } }, b: { pages: { y: 1 } } },
      ["a", "b"],
      "pages",
    );
    expect(rows.map((row) => row.name)).toEqual(["y", "z"]);
  });

  it("has nothing to say about a field no day recorded", () => {
    expect(sectionRows(DAYS, DATES, "countries")).toHaveLength(2);
    expect(sectionRows({ a: EARLY }, ["a"], "countries")).toEqual([]);
  });
});

describe("mergedLines", () => {
  it("prints one total per row", () => {
    expect(mergedLines(DAYS, DATES)).toContain("       6  /");
  });

  /** An empty heading and a genuine zero must not look the same. */
  it("stays quiet about a section the window predates", () => {
    const lines = mergedLines({ a: EARLY }, ["a"]).join("\n");
    expect(lines).not.toContain("COUNTRY");
    expect(lines).not.toContain("CAME FROM");
  });

  it("names countries and counts distinct cities", () => {
    const lines = mergedLines(DAYS, DATES).join("\n");
    expect(lines).toContain("US         United States");
    expect(lines).toContain("(unknown)  address not in the table");
    expect(lines).toContain("CITY (2 distinct)");
    expect(lines).toContain("2 of them seen exactly once");
  });
});

describe("fitDays", () => {
  const widths = { label: 25, cell: 5, total: 5 };

  it("fills the space the fixed columns leave", () => {
    // 2 indent + 25 label + 6 × (5 + 2) + 3 gap + 5 total = 77.
    expect(fitDays(80, widths)).toBe(6);
    expect(fitDays(77, widths)).toBe(6);
    expect(fitDays(76, widths)).toBe(5);
  });

  /** Overflowing beats printing a table with no days in it. */
  it("keeps one column however narrow the terminal", () => {
    expect(fitDays(20, widths)).toBe(1);
  });
});

describe("shorten", () => {
  it("leaves a label that fits alone", () => {
    expect(shorten("US / Washington", 36)).toBe("US / Washington");
  });

  /** The city is at the end of a place key, so the end is what must survive. */
  it("drops the middle, keeping both ends", () => {
    const cut = shorten("United States / Washington / Seattle", 20);
    expect(cut).toHaveLength(20);
    expect(cut.startsWith("United")).toBe(true);
    expect(cut.endsWith("Seattle")).toBe(true);
  });
});

describe("dailyLines", () => {
  const at = (terminal) => dailyLines(DAYS, DATES, terminal).join("\n");

  it("puts a column under each day and the window's total behind them", () => {
    expect(at(120)).toMatch(/^TOP PAGES\s+08-14\s+08-15\s+TOTAL$/m);
    expect(at(120)).toMatch(/^ {2}\/ {2,}5 {2,}1 {2,}6$/m);
  });

  it("draws a counted zero and an unrecorded field differently", () => {
    expect(at(120)).toMatch(/^ {2}\/typing\/ {2,}4 {2,}\. {2,}4$/m);
    expect(at(120)).toMatch(/^ {2}\(none\) {2,}— {2,}2 {2,}2$/m);
  });

  it("spends no width spelling out a country the COUNTRY grid just named", () => {
    expect(at(120)).toContain("US / Washington / Seattle");
    expect(at(120)).not.toContain("United States / Washington / Seattle");
  });

  /**
   * A table quietly showing half the window it was asked for is the failure
   * this pipeline is least allowed to have — see the header of
   * scripts/rollup-analytics.mjs on the outage that made that the rule.
   */
  it("says so when the terminal cannot hold the window", () => {
    const narrow = dailyLines(DAYS, DATES, 40).join("\n");
    expect(narrow).toContain("fits 1 of the window's 2 days");
    expect(narrow).toContain("1 are off the table");
  });

  it("re-totals against the days on screen, not the window asked for", () => {
    // `/` is 5 on the 14th and 1 on the 15th; dropping the 14th must leave a
    // table whose rows add up to what is in front of you.
    expect(dailyLines(DAYS, DATES, 40).join("\n")).toMatch(
      /^ {2}\/ {2,}1 {2,}1$/m,
    );
  });

  it("says how many rows the top ten left out", () => {
    const many = {
      a: {
        pages: Object.fromEntries(
          Array.from({ length: 14 }, (_, i) => [`/p${i}`, i + 1]),
        ),
      },
    };
    expect(dailyLines(many, ["a"], 120).join("\n")).toContain(
      "… and 4 more not shown",
    );
  });

  it("has nothing to draw with no days", () => {
    expect(dailyLines({}, [], 120)).toEqual([]);
  });
});
