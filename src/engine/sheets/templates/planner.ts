/**
 * The week, on a wall.
 *
 * A calendar, a weekly planner, a chore chart, a behaviour chart and a verse of
 * the week — five sheets that are one table with different headings, which is
 * why they are one family rather than five. The blank ones are blank on purpose
 * (§11): the left column is where a household's own words go.
 *
 * The dated calendar is the one thing on the shelf that can be *wrong*, so its
 * weekdays are computed and then checked by a second path (§11).
 *
 * An *undated* calendar is a first-class option rather than a degenerate one.
 * "Printable blank calendar" is the commoner query by some way, a chart with no
 * year on it does not go out of date on the wall, and a family that wants
 * January writes January in the box.
 */
import { declaredWidth, sheetBlockBox } from "../chrome";
import { BLOCK_GAP, type Box } from "../layout";
import { own, points, whole } from "../paper";
import { cardRowEms } from "../phonics/metrics";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  Mil,
  PlannerConfig,
  PlannerStyle,
  Sheet,
  SheetOptions,
  TableCell,
  TableColumn,
} from "../types";

import { copyworkSource } from "../writing/copywork";
import {
  headRowHeight,
  minRowHeight,
  tableColumns,
  tableShape,
  type ColumnShare,
  type TableShape,
} from "./table";

/* ── The calendar's arithmetic ────────────────────────────────────────────
   Neither function reaches for `Date`, and that is deliberate rather than
   fussy: `new Date(y, m, d)` is resolved in whatever timezone the machine
   happens to be in, and a catalog built in one place and read in another must
   print the same calendar. The suite is where `Date` belongs — as the second
   opinion.                                                                  */

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The Gregorian rule, all three clauses of it. */
export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** How many days a month has. `month` is 1–12, the way a human writes one. */
export function daysInMonth(year: number, month: number): number {
  const index = Math.max(1, Math.min(12, month)) - 1;
  return index === 1 && isLeapYear(year) ? 29 : MONTH_DAYS[index];
}

/**
 * Which weekday a date falls on: 0 is Sunday.
 *
 * Sakamoto's algorithm. The table is the running total of month lengths taken
 * modulo seven, with January and February shifted into the previous year —
 * which is the trick that makes the leap day a single correction rather than a
 * special case in the middle of the sum.
 */
export function weekday(year: number, month: number, day: number): number {
  const shift = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const index = Math.max(1, Math.min(12, month));
  const y = index < 3 ? year - 1 : year;
  const leaps = Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
  return (y + leaps + shift[index - 1] + day) % 7;
}

/** Sunday first, because that is how an American wall calendar is printed. */
const DAYS = [
  { full: "Sunday", short: "Sun" },
  { full: "Monday", short: "Mon" },
  { full: "Tuesday", short: "Tue" },
  { full: "Wednesday", short: "Wed" },
  { full: "Thursday", short: "Thu" },
  { full: "Friday", short: "Fri" },
  { full: "Saturday", short: "Sat" },
];

/** Exported: a second list would be a second spelling of "February". */
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The oldest and newest year worth printing a month of. */
const YEARS = { min: 1900, max: 2999 };

/**
 * The week, rotated to start where the config says — a real difference rather
 * than a preference. An American calendar starts on Sunday and most of the rest
 * of the world starts on Monday, and a family handed the wrong one counts the
 * weekend on the wrong end of the row.
 */
const weekDays = (config: PlannerConfig) =>
  config.weekStart === "monday" ? [...DAYS.slice(1), DAYS[0]] : DAYS;

/** A dated month, or nothing where the config asked for a blank chart. */
export type Month = { year: number; month: number };

/**
 * Which month this is, or `undefined` for the undated grid.
 *
 * Both fields or neither, per `PlannerConfig.year`: a year with no month is a
 * config that arrived incomplete, and printing January of it would be inventing
 * the missing half.
 */
export function monthOf(config: PlannerConfig): Month | undefined {
  if (typeof config.year !== "number" || typeof config.month !== "number")
    return undefined;
  return {
    year: whole(config.year, YEARS.min, YEARS.min, YEARS.max),
    month: whole(config.month, 1, 1, 12),
  };
}

export type MonthGrid = {
  month?: Month;
  /** How many blank squares there are before the first of the month. */
  offset: number;
  /** How many days the month has. Zero on an undated grid. */
  days: number;
  rows: number;
};

/**
 * The grid a month lays out on: how far in the first lands, and how many rows
 * it takes.
 *
 * Five rows or six — never five always, which is the classic bug: a 31-day
 * month beginning on a Friday needs six, and a calendar that printed five would
 * leave the last two days off the paper. An undated grid takes whatever it was
 * asked for, because there is nothing to fit.
 */
export function monthGrid(config: PlannerConfig): MonthGrid {
  const month = monthOf(config);
  if (!month) return { offset: 0, days: 0, rows: whole(config.rows, 5, 4, 6) };

  const first = weekday(month.year, month.month, 1);
  const start = config.weekStart === "monday" ? 1 : 0;
  const offset = (first - start + 7) % 7;
  const days = daysInMonth(month.year, month.month);
  return { month, offset, days, rows: Math.ceil((offset + days) / 7) };
}

/* ── The tables ───────────────────────────────────────────────────────────
   Everything below is headings and shares. The lengths are `table.ts`'s.    */

/** What the row column is called on each of the charts that has one. */
const ROW_HEAD: Record<string, string> = {
  week: "Day",
  chores: "Job",
  behaviour: "What I am working on",
  "verse-week": "",
};

/** What a planner's columns are, where the parent has not named them. */
const PARTS = ["Morning", "Afternoon", "Evening"];

/** And what the verse chart counts, one row each. */
const VERSE_ROWS = ["Read it", "Said it with help", "Said it on my own"];

/**
 * How many rows a chart prints when nothing has said, and the most it may.
 *
 * Exported so the stepper in the builder cannot offer a number the family would
 * then quietly move somebody off, as `layoutsFor` is on the cards shelf.
 */
export const PLANNER_ROWS = { fallback: 10, max: 24 } as const;

/**
 * The labels a parent gave, cleaned up.
 *
 * Trimmed and emptied of blanks, because the box they come from is a textarea
 * and a trailing newline is not a row. Left short rather than padded out to the
 * row count (§11).
 */
export function labelsOf(config: PlannerConfig): string[] {
  const given = Array.isArray(config.labels) ? config.labels : [];
  return given
    .filter((label): label is string => typeof label === "string")
    .map((label) => label.trim())
    .filter((label) => label !== "")
    .slice(0, PLANNER_ROWS.max);
}

/**
 * A weekday heading, short where the column is too narrow for the word.
 *
 * Declared rather than measured, off the face's own mean advance (§4). A
 * calendar at 12pt on Letter has an inch to a column and prints "Wednesday";
 * one at 24pt on a chore chart with a wide job column has half that and prints
 * "Wed". The alternative is a heading clipped by its own cell, which looks like
 * a rendering fault rather than a decision.
 */
function dayLabel(
  day: { full: string; short: string },
  width: Mil,
  options: SheetOptions,
): string {
  return declaredWidth(day.full, options, HEAD_EM) <= width
    ? day.full
    : day.short;
}

/** The share of the body size a table's heading row is set at. */
const HEAD_EM = 0.82;

/** The columns each style asks for, before they are fitted to the page. */
function columnShares(config: PlannerConfig, box: Box): ColumnShare[] {
  const days = weekDays(config);
  switch (config.style) {
    case "week": {
      const parts = labelsOf(config);
      const named = parts.length > 0 ? parts : PARTS;
      return [
        { label: ROW_HEAD.week, share: 1 },
        ...named.map((label) => ({ label, share: 2 })),
      ];
    }
    case "behaviour":
      return [
        { label: ROW_HEAD.behaviour, share: 3 },
        ...days.map((day) => ({ label: day.short, share: 0.8 })),
        { label: "How many", share: 1 },
      ];
    case "chores":
      return [
        { label: ROW_HEAD.chores, share: 3 },
        ...days.map((day) => ({ label: day.short, share: 1 })),
      ];
    case "verse-week":
      return [
        { label: "", share: 2.4 },
        ...days.map((day) => ({ label: day.short, share: 1 })),
      ];
    case "calendar":
    default: {
      // Equal is not a default here: a calendar whose Saturday is narrower
      // than its Tuesday is a calendar with a week that is not a week.
      const width = Math.floor(box.width / 7);
      return days.map((day) => ({
        label: dayLabel(day, width, {
          paper: config.paper,
          fontPt: config.fontPt,
          fields: [],
          font: config.font,
        }),
        share: 1,
      }));
    }
  }
}

/** What goes in the cells, which on four of the five styles is nothing. */
function tableCells(
  config: PlannerConfig,
  columns: number,
  rows: number,
): TableCell[] {
  const cells = Array.from({ length: columns * rows }, (): TableCell => ({}));

  if (config.style === "calendar") {
    // Set small in the corner of the square, so the rest of it stays empty for
    // whatever is written in it. An undated grid writes no dates at all.
    const grid = monthGrid(config);
    for (let day = 1; day <= grid.days; day++) {
      const at = grid.offset + day - 1;
      if (at < cells.length) cells[at] = { corner: String(day) };
    }
    return cells;
  }

  const labels = rowLabels(config, rows);
  labels.forEach((label, row) => {
    if (label !== "") cells[row * columns] = { text: label };
  });
  return cells;
}

/** What the first column says, row by row. */
function rowLabels(config: PlannerConfig, rows: number): string[] {
  const blank = Array<string>(rows).fill("");
  switch (config.style) {
    case "week":
      return blank.map((_, row) => weekDays(config)[row % 7]?.full ?? "");
    case "verse-week":
      return blank.map((_, row) => VERSE_ROWS[row] ?? "");
    default: {
      const given = labelsOf(config);
      return blank.map((_, row) => given[row] ?? "");
    }
  }
}

/** How many rows a style prints, before the page has its say. */
function wantedRows(config: PlannerConfig): number {
  switch (config.style) {
    case "calendar":
      return monthGrid(config).rows;
    case "week":
      return weekDays(config).length;
    case "verse-week":
      return VERSE_ROWS.length;
    default:
      return Math.max(
        labelsOf(config).length,
        whole(config.rows, PLANNER_ROWS.fallback, 1, PLANNER_ROWS.max),
      );
  }
}

/**
 * And how many it cannot print fewer of.
 *
 * Three of the five have a row count that is arithmetic rather than a request,
 * so they refuse the sheet rather than print part of one (§11). What that buys:
 * `tableShape` caps the rows at what the page holds and the row labels are cut
 * to match, so without it a weekly planner at a large type size prints Sunday
 * to Thursday under a heading that says the week, and a dated May prints up to
 * the twenty-third — both of which look finished on screen and are found on the
 * wall.
 *
 * An *undated* calendar is not in the list: five rows or six is what a parent
 * asked for there, and four is a smaller chart rather than a wrong one.
 */
function fixedRows(config: PlannerConfig): number | undefined {
  switch (config.style) {
    case "calendar":
      return monthOf(config) ? monthGrid(config).rows : undefined;
    case "week":
    case "verse-week":
      return wantedRows(config);
    default:
      return undefined;
  }
}

/* ── The verse ────────────────────────────────────────────────────────── */

/** How big the verse on a wall chart is set, in ems of the body size. */
const VERSE_EMS = 1.9;

/**
 * And the smallest it may be set at, once the page has had its say.
 *
 * A floor rather than a target: it is only reached by a config nobody would
 * choose on purpose, a whole psalm at the largest type the shop allows on the
 * smallest page it allows. What it buys is that the search below always
 * terminates on a number, and the chart under the verse always gets its rows.
 */
const MIN_VERSE_EMS = 0.4;

/** The step the search walks down in — a twentieth of the body size. */
const VERSE_STEP = 0.05;

/**
 * The verse, through the same door copywork uses: `copyworkSource` is the one
 * place a passage id is resolved (§12), so a verse chart and a copywork sheet
 * cannot quote the same reference differently, and the credit travels with the
 * words rather than being remembered separately.
 */
const verseOf = (config: PlannerConfig) =>
  copyworkSource({
    passage: config.passage,
    translation: config.translation,
    text: config.text,
  });

/** How many lines a verse wraps onto, at a given size. Declared, per §4. */
function verseRows(
  config: PlannerConfig,
  box: Box,
  text: string,
  ems: number,
): number {
  const options: SheetOptions = {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: [],
    font: config.font,
  };
  return Math.max(
    1,
    Math.ceil(declaredWidth(text, options, ems) / Math.max(1, box.width)),
  );
}

/** And how tall the block that holds them stands. */
const verseBlockHeight = (
  config: PlannerConfig,
  rows: number,
  ems: number,
): Mil => points(config.fontPt * cardRowEms(ems, rows, true));

export type VerseFit = { ems: number; height: Mil };

/**
 * The largest size the verse fits its share of the page at (§11).
 *
 * A search rather than algebra, and it is worth saying why the algebra is not
 * obvious: the size decides how many lines the verse wraps onto *and* how tall
 * each of those lines is, so the height goes up with the square of it. Walking
 * down in twentieths is a couple of dozen divisions and lands on the same
 * number on every machine — which the closed form, with a square root in it,
 * would not.
 *
 * It is not *exact*: repeated `ems -= 0.05` accumulates the usual binary
 * fraction drift, which is why the loop cannot be trusted to reach
 * `MIN_VERSE_EMS` on its nose and why the fallback below exists. Deterministic
 * is the claim that is load-bearing, and IEEE-754 arithmetic is why it holds:
 * every machine drifts by the same amount in the same direction.
 */
export function verseSize(
  config: PlannerConfig,
  box: Box,
  text: string,
  room: Mil,
): VerseFit {
  for (let ems = VERSE_EMS; ems >= MIN_VERSE_EMS; ems -= VERSE_STEP) {
    const height = verseBlockHeight(
      config,
      verseRows(config, box, text, ems),
      ems,
    );
    if (height <= room) return { ems, height };
  }
  const ems = MIN_VERSE_EMS;
  return {
    ems,
    height: verseBlockHeight(config, verseRows(config, box, text, ems), ems),
  };
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

const TITLE: Record<PlannerStyle, string> = {
  calendar: "Calendar",
  week: "Weekly planner",
  chores: "Chore chart",
  behaviour: "Behaviour chart",
  "verse-week": "Verse of the week",
};

const INSTRUCTION: Record<string, string> = {
  chores: "Write the jobs down the left. Tick a box when one is done.",
  behaviour:
    "One thing to work on a row. Tick the day it went well, and count them up on Sunday.",
  "verse-week": "Tick a box each time it is said.",
};

/** What the sheet is called, which for a dated calendar is the month. */
function titleOf(config: PlannerConfig): string {
  if (config.title) return config.title;
  if (config.style === "calendar") {
    const month = monthOf(config);
    return month ? `${MONTH_NAMES[month.month - 1]} ${month.year}` : "Calendar";
  }
  if (config.style === "verse-week") {
    const verse = verseOf(config);
    return verse.title ?? TITLE["verse-week"];
  }
  return own(TITLE, config.style, TITLE.calendar);
}

const instructionOf = (config: PlannerConfig): string | undefined =>
  (config.instructions ?? own(INSTRUCTION, config.style, "")) || undefined;

/** What the chrome will hold — see the note on `headerOf` in forms.ts. */
function headerOf(config: PlannerConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: titleOf(config),
    instructions: instructionOf(config),
    font: config.font,
  };
}

const plannerBox = (config: PlannerConfig): Box => {
  const verse = config.style === "verse-week" ? verseOf(config) : undefined;
  return sheetBlockBox(headerOf(config), false, {
    note: "Answer key",
    ...(verse?.credit ? { source: verse.credit } : {}),
  });
};

/** Nothing on this shelf withholds anything — see `formKeyed`. */
export const plannerKeyed = (): boolean => false;

export type PlannerFit = {
  columns: TableColumn[];
  shape: TableShape;
  /** The verse and the size it fitted at, on the one style that has one. */
  verse?: { text: string; title?: string; fit: VerseFit };
  /** Whether the page held the rows the style has to have — see `fixedRows`. */
  fits: boolean;
};

/**
 * The table this page can actually hold, and whether that is the table the
 * style needs.
 *
 * One function, because a page that quotes a number is quoting the paper under
 * it (§11): the blocks and the line that names the sheet working it out
 * separately is how a chart with four rows describes itself as six.
 */
export function plannerFit(config: PlannerConfig, box: Box): PlannerFit {
  const source = config.style === "verse-week" ? verseOf(config) : undefined;
  const verseText = source?.text.replaceAll("\n", " ").trim() ?? "";

  // The verse takes its height out of the page before the table is fitted, and
  // the gap between the two blocks is charged for as well — `.sheet__blocks` is
  // a flex column, and a gap the arithmetic did not know about is the last row
  // of the chart below the bottom margin.
  //
  // What is left for the verse is the page less a heading row and one line to
  // write on: a week with no rows on it is not a verse-of-the-week chart,
  // however large the verse is set.
  const fit =
    verseText === ""
      ? undefined
      : verseSize(
          config,
          box,
          verseText,
          Math.max(
            0,
            box.height -
              BLOCK_GAP -
              headRowHeight(config.fontPt) -
              minRowHeight(config.fontPt),
          ),
        );
  const head = fit ? fit.height + BLOCK_GAP : 0;
  const room = { ...box, height: Math.max(0, box.height - head) };

  const shape = tableShape(room, config.fontPt, wantedRows(config), true);
  const need = fixedRows(config);

  return {
    columns: tableColumns(columnShares(config, room), room.width),
    shape,
    ...(fit
      ? {
          verse: {
            text: verseText,
            ...(source?.title ? { title: source.title } : {}),
            fit,
          },
        }
      : {}),
    fits: need === undefined || shape.rows >= need,
  };
}

function plannerBlocks(config: PlannerConfig, box: Box): Block[] {
  const held = plannerFit(config, box);
  // Nothing at all rather than most of a week — see `fixedRows`. The header and
  // the footer still print, as they do on a page of cards too small to cut, so
  // what comes out of the printer is honestly blank.
  if (!held.fits) return [];

  const { columns, shape, verse } = held;

  return [
    ...(verse === undefined
      ? []
      : [
          {
            kind: "cards" as const,
            columns: 1,
            // The verse over its reference: the shape `SoundCard` already is.
            // Unboxed, because a wall chart is not cut up and there is no box
            // to cut round.
            cards: [
              {
                big: [{ text: verse.text }],
                ...(verse.title ? { small: [{ text: verse.title }] } : {}),
              },
            ],
            // The size the page could hold, not the size the family would
            // like: a block whose declared and drawn heights disagree is the
            // failure this shelf is guarding against.
            bigEms: verse.fit.ems,
            boxed: false,
          },
        ]),
    {
      kind: "table",
      columns,
      head: columns.some((column) => column.label !== ""),
      rows: shape.rows,
      row: shape.row,
      cells: tableCells(config, columns.length, shape.rows),
      headRow: headRowHeight(config.fontPt),
    },
  ];
}

function buildPlannerSheet(config: PlannerConfig, seed: number): Sheet {
  const box = plannerBox(config);
  const verse = config.style === "verse-week" ? verseOf(config) : undefined;

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: titleOf(config),
      instructions: instructionOf(config),
      fields: config.fields,
    },
    blocks: plannerBlocks(config, box),
    footer: {
      credit: SHEET_CREDIT,
      url: SHEET_URL,
      seed,
      // The credit the words came with, where the words are somebody else's —
      // a condition of the name rather than a courtesy (§12).
      ...(verse?.credit ? { source: verse.credit } : {}),
    },
    answers: false,
  };
}

/**
 * One line naming the sheet, in the words a parent says out loud.
 *
 * Every number comes off `plannerFit` — the same call that built the blocks —
 * so the line describes the paper rather than the request, and says so where
 * the paper could not hold the style at all.
 */
function describePlanner(config: PlannerConfig): string {
  const held = plannerFit(config, plannerBox(config));
  const name = own(TITLE, config.style, TITLE.calendar);
  const days = weekDays(config).length;

  switch (config.style) {
    case "calendar": {
      const grid = monthGrid(config);
      if (!grid.month)
        return `Blank calendar, ${days} columns and ${held.shape.rows} rows`;
      const month = `${MONTH_NAMES[grid.month.month - 1]} ${grid.month.year}`;
      return held.fits
        ? `${month}, ${grid.days} days over ${held.shape.rows} rows`
        : `${month} — too small to print the whole month on this paper`;
    }
    case "week":
      return held.fits
        ? `${name}, ${days} days and ${held.columns.length - 1} columns a day`
        : `${name} — too small for a week on this paper`;
    case "verse-week": {
      if (!held.fits) return `${name} — too small for a week on this paper`;
      const verse = verseOf(config);
      return verse.title
        ? `Verse of the week: ${verse.title}`
        : "Verse of the week, with the verse you paste in";
    }
    default:
      return `${own(TITLE, config.style, TITLE.chores)}, ${held.shape.rows} rows across the week`;
  }
}

export const PLANNER_SHEET: SheetSpec<PlannerConfig> = {
  world: SHEET_WORLD,
  build: buildPlannerSheet,
  key: (sheet) => ({
    ...sheet,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describePlanner,
};
