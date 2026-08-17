import { describe, expect, it } from "vitest";

import { declaredWidth, printedBlockBox } from "../chrome";
import { BLOCK_GAP } from "../layout";
import { MARGINS } from "../paper";
import { cardRowEms } from "../phonics/cards";
import { SCRIPTURE_CREDIT } from "../passages";
import type {
  Block,
  MarginSize,
  PaperSize,
  PlannerConfig,
  PlannerStyle,
  Sheet,
} from "../types";
import { buildSheet, describeSheet, sheetSpec } from "../index";

import {
  MONTH_NAMES,
  PLANNER_ROWS,
  daysInMonth,
  isLeapYear,
  monthGrid,
  plannerKeyed,
  weekday,
} from "./planner";

/**
 * The week, and the one thing on this shelf that has a right answer.
 *
 * Four of the five sheets here are boxes, and a box cannot be incorrect. A
 * dated calendar can: a month whose first lands under the wrong weekday is a
 * sheet somebody plans a term around, and it is wrong in a way nobody checks —
 * you do not proofread a calendar, you read off it.
 *
 * **So the weekdays are verified by an independent path.** `weekday` is
 * Sakamoto's algorithm, chosen because it is integer arithmetic with no ambient
 * state; the suite checks it against the platform's own `Date`, which knows
 * nothing about the table in that function. A generator asserting its own
 * arithmetic agrees with itself whatever it does — the same reason the word
 * search's key is found by searching its grid.
 *
 * Everything else below is geometry, held against `printedBlockBox`: the box
 * the header and footer that were *printed* left behind, rather than the one
 * the family reserved for, which is the only version a family can be caught
 * out by.
 */

const config = (over: Partial<PlannerConfig> = {}): PlannerConfig => ({
  kind: "planner",
  style: "calendar",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: [],
  ...over,
});

const STYLES: PlannerStyle[] = [
  "calendar",
  "week",
  "chores",
  "behaviour",
  "verse-week",
];

/** The one table on a sheet, or a failure that says so. */
function tableOf(sheet: Sheet) {
  const tables = sheet.blocks.filter((block) => block.kind === "table");
  expect(tables).toHaveLength(1);
  return tables[0];
}

/**
 * How tall the blocks stand, gaps included — what a browser will lay out.
 *
 * The verse is the interesting one and it is recovered from the finished block
 * rather than from the family: the size on the block decides how many lines the
 * words wrap onto, and how many lines they wrap onto decides the height. That
 * pair is the whole of what the family had to solve, so measuring it here out of
 * `declaredWidth` and `cardRowEms` — the two primitives the renderer's geometry
 * rests on, and neither of them the family's own arithmetic — is what makes "it
 * fits" a claim rather than a restatement of one.
 */
function used(sheet: Sheet): number {
  const box = printedBlockBox(sheet);
  const gaps = Math.max(0, sheet.blocks.length - 1) * BLOCK_GAP;
  return sheet.blocks.reduce((total: number, block: Block) => {
    if (block.kind === "table")
      return total + (block.head ? block.headRow : 0) + block.rows * block.row;
    if (block.kind === "cards") {
      const text = block.cards[0]?.big.map((part) => part.text).join("") ?? "";
      const rows = Math.max(
        1,
        Math.ceil(
          declaredWidth(
            text,
            { paper: sheet.paper, fontPt: sheet.fontPt, fields: [] },
            block.bigEms,
          ) / box.width,
        ),
      );
      return (
        total +
        Math.round(
          (sheet.fontPt * cardRowEms(block.bigEms, rows, true) * 1000) / 72,
        )
      );
    }
    return total;
  }, gaps);
}

/* ── The calendar's arithmetic ─────────────────────────────────────────── */

describe("the calendar's arithmetic", () => {
  it("agrees with the platform's own calendar, day for day", () => {
    // Twenty years of dates against `Date`, which reaches the same answer by a
    // completely different route. This is the independent verification the
    // epic asks for wherever something is computed.
    for (let year = 2015; year <= 2035; year++) {
      for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= daysInMonth(year, month); day++) {
          expect(weekday(year, month, day), `${year}-${month}-${day}`).toBe(
            new Date(year, month - 1, day).getDay(),
          );
        }
      }
    }
  });

  it("gets all three clauses of the leap-year rule right", () => {
    // The two a naive `% 4` misses, and they are a century apart: 1900 was not
    // a leap year and 2000 was.
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
  });

  it("counts the days of every month", () => {
    for (let month = 1; month <= 12; month++) {
      // The last day of a month is the day before the first of the next, which
      // `Date` will work out for us — and it is not how `daysInMonth` does it.
      const last = new Date(2027, month, 0).getDate();
      expect(daysInMonth(2027, month)).toBe(last);
    }
  });
});

/* ── The month grid ────────────────────────────────────────────────────── */

describe("a dated calendar", () => {
  it("puts every date under the weekday it actually falls on", () => {
    // Read off the finished cells rather than off the offset that placed them:
    // this is the claim a reader would disprove by looking at the paper.
    for (const year of [2026, 2027, 2028]) {
      for (let month = 1; month <= 12; month++) {
        const table = tableOf(buildSheet(config({ year, month }), 1));
        const columns = table.columns.length;
        expect(columns).toBe(7);

        const printed = table.cells
          .map((cell, index) => ({ cell, index }))
          .filter((entry) => entry.cell.corner !== undefined);

        expect(printed).toHaveLength(daysInMonth(year, month));
        for (const { cell, index } of printed) {
          const day = Number(cell.corner);
          expect(index % columns, `${year}-${month}-${day}`).toBe(
            new Date(year, month - 1, day).getDay(),
          );
        }
        // In order, and every day of the month exactly once.
        expect(printed.map(({ cell }) => Number(cell.corner))).toEqual(
          Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
        );
      }
    }
  });

  it("takes a sixth row where a month needs one", () => {
    // The classic bug is five rows always. A 31-day month beginning on the last
    // day of the week needs six, and a calendar that printed five would leave
    // the last two days off the paper.
    const six = Object.entries({ 2026: 8, 2027: 5 }).map(([year, month]) =>
      monthGrid(config({ year: Number(year), month })),
    );
    for (const grid of six) {
      expect(grid.offset + grid.days).toBeGreaterThan(35);
      expect(grid.rows).toBe(6);
    }
    // And never more than six, whatever the month.
    for (let year = 2020; year <= 2040; year++) {
      for (let month = 1; month <= 12; month++) {
        const grid = monthGrid(config({ year, month }));
        expect(grid.rows).toBeGreaterThanOrEqual(4);
        expect(grid.rows).toBeLessThanOrEqual(6);
        expect(grid.offset + grid.days).toBeLessThanOrEqual(grid.rows * 7);
      }
    }
  });

  it("moves the whole month when the week starts on Monday", () => {
    // A real difference rather than a preference — and the weekend has to move
    // with it, not just the heading.
    const sunday = tableOf(buildSheet(config({ year: 2026, month: 3 }), 1));
    const monday = tableOf(
      buildSheet(config({ year: 2026, month: 3, weekStart: "monday" }), 1),
    );
    expect(sunday.columns[0].label).toBe("Sunday");
    expect(monday.columns[0].label).toBe("Monday");
    expect(monday.columns[6].label).toBe("Sunday");

    const firstAt = (table: { cells: Array<{ corner?: string }> }) =>
      table.cells.findIndex((cell) => cell.corner === "1");
    // 1 March 2026 is a Sunday: column 0 of a Sunday week, column 6 of a Monday
    // one.
    expect(firstAt(sunday) % 7).toBe(0);
    expect(firstAt(monday) % 7).toBe(6);
  });

  it("names itself after the month it prints", () => {
    const sheet = buildSheet(config({ year: 2026, month: 11 }), 1);
    expect(sheet.header.title).toBe("November 2026");
    expect(MONTH_NAMES).toHaveLength(12);
  });
});

describe("a blank calendar", () => {
  it("prints seven columns of empty squares and no dates", () => {
    // What "printable blank calendar" means, and the version that does not go
    // out of date on a wall.
    const sheet = buildSheet(config(), 1);
    const table = tableOf(sheet);
    expect(table.columns).toHaveLength(7);
    expect(table.cells.every((cell) => cell.corner === undefined)).toBe(true);
    expect(sheet.header.title).toBe("Calendar");
  });

  it("rules seven columns nobody could measure apart", () => {
    // Equal, or it is a week that is not a week. Flooring seven shares of a
    // Letter page loses three thousandths of an inch; spread one at a time, no
    // two columns differ by more than one — 25 microns, finer than a printer.
    for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
      const sheet = buildSheet(
        config({ paper: { size, orientation: "portrait", margin: "normal" } }),
        1,
      );
      const table = tableOf(sheet);
      const widths = table.columns.map((column) => column.width);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
      expect(widths.reduce((sum, width) => sum + width, 0)).toBe(
        printedBlockBox(sheet).width,
      );
    }
  });
});

/* ── The charts ────────────────────────────────────────────────────────── */

describe("the charts", () => {
  it("names the days down the left of a planner", () => {
    const table = tableOf(buildSheet(config({ style: "week" }), 1));
    expect(table.rows).toBe(7);
    const first = table.cells
      .filter((_, index) => index % table.columns.length === 0)
      .map((cell) => cell.text);
    expect(first).toEqual([
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
  });

  it("leaves a chore chart's jobs blank until a parent writes them", () => {
    // The tier's argument: a chart with our idea of a child's jobs printed down
    // the left is a chart most families would have to cross out.
    const table = tableOf(buildSheet(config({ style: "chores" }), 1));
    expect(table.columns[0].label).toBe("Job");
    expect(table.columns).toHaveLength(8);
    expect(table.cells.every((cell) => cell.text === undefined)).toBe(true);
  });

  it("writes a parent's own rows into the first column", () => {
    const table = tableOf(
      buildSheet(
        config({
          style: "chores",
          // Blanks and stray whitespace, because the box they come from is a
          // textarea and a trailing newline is not a row.
          labels: ["Make my bed", "  ", " Feed the rabbit "],
        }),
        1,
      ),
    );
    const first = table.cells
      .filter((_, index) => index % table.columns.length === 0)
      .map((cell) => cell.text);
    expect(first.slice(0, 2)).toEqual(["Make my bed", "Feed the rabbit"]);
    expect(first[2]).toBeUndefined();
  });

  it("never prints fewer rows than a parent wrote jobs for", () => {
    const labels = Array.from({ length: 14 }, (_, at) => `Job ${at + 1}`);
    const table = tableOf(buildSheet(config({ style: "chores", labels }), 1));
    expect(table.rows).toBe(labels.length);
  });

  it("counts the week on a behaviour chart", () => {
    const table = tableOf(buildSheet(config({ style: "behaviour" }), 1));
    expect(table.columns.map((column) => column.label)).toEqual([
      "What I am working on",
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "How many",
    ]);
  });
});

/* ── The verse ─────────────────────────────────────────────────────────── */

describe("a verse of the week", () => {
  it("prints the verse over its reference, and credits where it came from", () => {
    // §12's condition rather than a courtesy: the credit travels on the passage,
    // through the same door copywork resolves one by.
    const sheet = buildSheet(
      config({ style: "verse-week", passage: "trust-in-the-lord" }),
      1,
    );
    const cards = sheet.blocks.filter((block) => block.kind === "cards");
    expect(cards).toHaveLength(1);
    expect(cards[0].cards[0].big[0].text).toContain("Trust in the LORD");
    expect(cards[0].cards[0].small?.[0].text).toBe("Proverbs 3:5-6");
    expect(cards[0].boxed).toBe(false);
    expect(sheet.footer.source).toBe(SCRIPTURE_CREDIT);
    expect(sheet.header.title).toBe("Proverbs 3:5-6");
  });

  it("takes a pasted verse, and credits nothing it cannot vouch for", () => {
    const sheet = buildSheet(
      config({ style: "verse-week", text: "A verse somebody typed." }),
      1,
    );
    expect(sheet.footer.source).toBeUndefined();
    const cards = sheet.blocks.filter((block) => block.kind === "cards");
    expect(cards[0].cards[0].big[0].text).toBe("A verse somebody typed.");
  });

  it("leaves the chart room even under a psalm", () => {
    // The verse is whatever a parent pasted. Psalm 23 set at nearly twice the
    // body size runs thirteen lines, and a chart whose verse took the page
    // would be a chart with no week on it.
    const sheet = buildSheet(
      config({ style: "verse-week", passage: "psalm-23" }),
      1,
    );
    expect(tableOf(sheet).rows).toBeGreaterThanOrEqual(3);
    expect(used(sheet)).toBeLessThanOrEqual(printedBlockBox(sheet).height);
  });
});

/* ── The promises every family makes ───────────────────────────────────── */

describe("the planner family", () => {
  it("closes the page at every size, on every stock", () => {
    for (const style of STYLES) {
      for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
        for (const margin of Object.keys(MARGINS) as MarginSize[]) {
          for (const fontPt of [8, 12, 18, 36]) {
            const sheet = buildSheet(
              config({
                style,
                fontPt,
                paper: { size, orientation: "portrait", margin },
                ...(style === "verse-week"
                  ? { passage: "for-god-so-loved-the-world" }
                  : {}),
              }),
              1,
            );
            expect(
              used(sheet),
              `${style} at ${fontPt}pt on ${size}/${margin}`,
            ).toBeLessThanOrEqual(printedBlockBox(sheet).height);
          }
        }
      }
    }
  });

  it("rules columns that add up to the page exactly, on every chart", () => {
    for (const style of STYLES) {
      const sheet = buildSheet(config({ style, passage: "psalm-23" }), 1);
      const table = tableOf(sheet);
      expect(
        table.columns.reduce((total, column) => total + column.width, 0),
        style,
      ).toBe(printedBlockBox(sheet).width);
    }
  });

  it("is deterministic in (config, seed)", () => {
    for (const style of STYLES) {
      const built = config({ style, passage: "psalm-23" });
      expect(JSON.stringify(buildSheet(built, 9))).toBe(
        JSON.stringify(buildSheet(built, 9)),
      );
    }
  });

  it("withholds nothing, and says so where a page can ask", () => {
    expect(plannerKeyed()).toBe(false);
    const sheet = buildSheet(config(), 1);
    const key = sheetSpec("planner").key(sheet);
    expect(key.blocks).toEqual(sheet.blocks);
    expect(key.footer.note).toBe("Answer key");
  });

  it("prints a page from a config that arrived from outside this build", () => {
    // Half a date is the interesting one: `PlannerConfig.year` is both fields
    // or neither, so a year with no month is a config that arrived incomplete
    // and must not print January of it.
    const half = buildSheet(config({ year: 2026 }), 1);
    expect(half.header.title).toBe("Calendar");
    expect(tableOf(half).cells.every((cell) => !cell.corner)).toBe(true);

    const hostile = {
      ...config(),
      style: "toString" as PlannerStyle,
      rows: Number.NaN,
      labels: [7, null, "Real"] as unknown as string[],
      month: 99,
      year: 12,
    };
    const sheet = buildSheet(hostile, 1);
    expect(tableOf(sheet).rows).toBeGreaterThan(0);
    expect(tableOf(sheet).rows).toBeLessThanOrEqual(PLANNER_ROWS.max);
    expect(describeSheet(hostile)).not.toBe("");
  });
});
