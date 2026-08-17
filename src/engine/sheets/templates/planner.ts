/**
 * The week, on a wall.
 *
 * A calendar, a weekly planner, a chore chart, a behaviour chart and a verse of
 * the week — five sheets that are one table with different headings, which is
 * why they are one family rather than five. The blank ones are blank on
 * purpose (§11): a chore chart with our idea of a child's jobs printed down the
 * left is a chart most families would have to cross out, and the left column is
 * where a household's own words go.
 *
 * ── The one thing here that can be wrong ───────────────────────────────────
 *
 * **A calendar's weekdays.** Everything else on this shelf is a box, and a box
 * cannot be incorrect; a dated month grid is arithmetic with a right answer,
 * and getting it wrong produces a sheet somebody plans a term around. So the
 * grid is computed rather than laid out by eye, and it is computed twice over:
 * `weekday` below is Sakamoto's algorithm — integer arithmetic with no ambient
 * state, so it is the same answer in a unit test, in a build of the catalog and
 * in a browser in another timezone — and the suite checks it against the
 * platform's own `Date`, which is a genuinely independent path to the same
 * claim. A generator agreeing with itself would agree whatever it did.
 *
 * That is also why an *undated* calendar is a first-class option rather than a
 * degenerate one. "Printable blank calendar" is the commoner query by some way,
 * a chart with no year on it does not go out of date on the wall, and a family
 * that wants January writes January in the box.
 */
import { declaredWidth, sheetBlockBox } from "../chrome";
import { BLOCK_GAP, type Box } from "../layout";
import { own, points, whole } from "../paper";
import { cardRowEms } from "../phonics/cards";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  Mil,
  PlannerConfig,
  PlannerStyle,
  Sheet,
  SheetOptions,
  TableCell,
} from "../types";

import { copyworkSource } from "../writing/copywork";
import {
  headRowHeight,
  minRowHeight,
  tableColumns,
  tableShape,
  type ColumnShare,
} from "./table";

/* ── The calendar's arithmetic ────────────────────────────────────────────
   Two functions, both pure integer arithmetic over a year, a month and a day.
   Neither reaches for `Date`, and that is deliberate rather than fussy: `new
   Date(y, m, d)` is resolved in whatever timezone the machine happens to be
   in, and a catalog built in one place and read in another must print the same
   calendar. The suite is where `Date` belongs — as the second opinion.      */

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
 * modulo seven with January and February shifted into the previous year, which
 * is the trick that makes the leap-day correction a single subtraction rather
 * than a special case in the middle of the sum.
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

/**
 * The months, exported because the control that picks one has to name them and
 * a second list would be a second spelling of "February".
 */
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
 * The week, rotated to start where the config says.
 *
 * A real difference rather than a preference: an American calendar starts on
 * Sunday and most of the rest of the world starts on Monday, and a family
 * handed the wrong one counts the weekend on the wrong end of the row.
 */
const weekDays = (config: PlannerConfig) =>
  config.weekStart === "monday" ? [...DAYS.slice(1), DAYS[0]] : DAYS;

/** A dated month, or nothing where the config asked for a blank chart. */
export type Month = { year: number; month: number };

/**
 * Which month this is, or `undefined` for the undated grid.
 *
 * Both fields or neither, per `PlannerConfig.year`: a year with no month is not
 * half a calendar, it is a config that has arrived incomplete from somewhere,
 * and printing January of it would be inventing the missing half.
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
 * The row count is `ceil((offset + days) / 7)` and is five or six — never five
 * always, which is the classic bug: a 31-day month beginning on a Friday needs
 * six rows, and a calendar that printed five would leave the last two days off
 * the paper. An undated grid takes whatever it was asked for, because there is
 * nothing to fit.
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
 * then quietly move somebody off — the same reason `layoutsFor` is exported on
 * the cards shelf.
 */
export const PLANNER_ROWS = { fallback: 10, max: 24 } as const;

/**
 * The labels a parent gave, cleaned up.
 *
 * Trimmed and emptied of blanks, because the box they come from is a textarea
 * and a trailing newline is not a row. Left short rather than padded: a chart
 * with four jobs written in and six blank rows underneath is exactly what a
 * family with four jobs and a growing list wants.
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
 * Measured rather than guessed, off the face's own declared mean advance — the
 * same bargain `chrome.ts` strikes for every other run of text on a sheet (§4).
 * A calendar at 12pt on Letter has an inch to a column and prints "Wednesday";
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
      // Seven equal columns, and the heading is the day. Equal is not a
      // default here — a calendar whose Saturday is narrower than its Tuesday
      // is a calendar with a week that is not a week.
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
    // The dates, set small in the corner of their own square so the rest of it
    // stays empty for whatever is written in it. An undated grid writes none,
    // which is what "blank calendar" means.
    const grid = monthGrid(config);
    for (let day = 1; day <= grid.days; day++) {
      const at = grid.offset + day - 1;
      if (at < cells.length) cells[at] = { corner: String(day) };
    }
    return cells;
  }

  // Every other style labels its rows down the first column: the seven days on
  // a planner, the parent's own words on the two charts, and what is being
  // counted on the verse chart.
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
      return 7;
    case "verse-week":
      return VERSE_ROWS.length;
    default:
      return Math.max(
        labelsOf(config).length,
        whole(config.rows, PLANNER_ROWS.fallback, 1, PLANNER_ROWS.max),
      );
  }
}

/* ── The verse ────────────────────────────────────────────────────────── */

/** How big the verse on a wall chart is set, in ems of the body size. */
const VERSE_EMS = 1.9;

/**
 * And the smallest it may be set at, once the page has had its say.
 *
 * Below the body size a "wall chart" is a footnote, so this is the floor rather
 * than a target — it is only reached by a config nobody would choose on
 * purpose, a whole psalm at the largest type the shop allows on the smallest
 * page it allows. What it buys is that the search below always terminates on a
 * number, and the chart under the verse always gets its rows.
 */
const MIN_VERSE_EMS = 0.4;

/** The step the search walks down in — a twentieth of the body size. */
const VERSE_STEP = 0.05;

/**
 * The verse, through the same door copywork uses.
 *
 * `copyworkSource` is the one place a passage id is resolved (§12), so a verse
 * chart and a copywork sheet cannot end up quoting the same reference
 * differently — and the credit the source asks for travels with the words
 * rather than being remembered separately.
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
 * The largest size the verse fits its share of the page at.
 *
 * A search rather than algebra, and it is worth saying why the algebra is not
 * obvious: the size decides how many lines the verse wraps onto *and* how tall
 * each of those lines is, so the height goes up with the square of it. Walking
 * down in twentieths is a couple of dozen divisions, is exact at every step,
 * and is the same answer on every machine — which the closed form, with a square
 * root in it, would not be.
 *
 * The alternative was a fixed size and a cap on the reservation, and that is
 * what shipped first. It is wrong in the way this whole shelf is wrong when it
 * is wrong: reserving less than the block draws does not make the block
 * smaller, it moves the overflow somewhere nobody looks. A "verse" is whatever
 * a parent pasted — Psalm 23 at nearly twice the body size runs thirteen lines
 * — so the size has to give way, not the reservation.
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

function plannerBlocks(config: PlannerConfig, box: Box): Block[] {
  const verse = config.style === "verse-week" ? verseOf(config) : undefined;
  const verseText = verse?.text.replaceAll("\n", " ").trim() ?? "";

  // The verse takes its height out of the page before the table is fitted, and
  // the gap between the two blocks is charged for as well — `.sheet__blocks` is
  // a flex column, and a gap the arithmetic did not know about is the last row
  // of the chart below the bottom margin.
  //
  // What is left for the verse is the page less a heading row and one line to
  // write on: the chart is the sheet, and a week with no rows on it is not a
  // verse-of-the-week chart however large the verse is set.
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

  const shares = columnShares(config, room);
  const columns = tableColumns(shares, room.width);
  const shape = tableShape(room, config.fontPt, wantedRows(config), true);

  return [
    ...(verseText === ""
      ? []
      : [
          {
            kind: "cards" as const,
            columns: 1,
            // The verse over its reference, unboxed: the shape `SoundCard`
            // already is, and its own note says the family that fills it is the
            // one that knows what it means. A wall chart is not cut up, so
            // there is no box to cut round.
            cards: [
              {
                big: [{ text: verseText }],
                ...(verse?.title ? { small: [{ text: verse.title }] } : {}),
              },
            ],
            // The size the page could actually hold, not the size the family
            // would like. A block whose declared height and drawn height
            // disagree is the whole failure this shelf is guarding against.
            bigEms: fit?.ems ?? VERSE_EMS,
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

export function buildPlannerSheet(config: PlannerConfig, seed: number): Sheet {
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

/** One line naming the sheet, in the words a parent says out loud. */
export function describePlanner(config: PlannerConfig): string {
  const box = plannerBox(config);
  switch (config.style) {
    case "calendar": {
      const grid = monthGrid(config);
      return grid.month
        ? `${MONTH_NAMES[grid.month.month - 1]} ${grid.month.year}, ${grid.days} days over ${grid.rows} rows`
        : `Blank calendar, seven columns and ${grid.rows} rows`;
    }
    case "week":
      return `Weekly planner, seven days and ${columnShares(config, box).length - 1} columns a day`;
    case "verse-week": {
      const verse = verseOf(config);
      return verse.title
        ? `Verse of the week: ${verse.title}`
        : "Verse of the week, with the verse you paste in";
    }
    default: {
      const rows = tableShape(box, config.fontPt, wantedRows(config), true);
      return `${own(TITLE, config.style, TITLE.chores)}, ${rows.rows} rows across the week`;
    }
  }
}

export const PLANNER_SHEET: SheetSpec<PlannerConfig> = {
  id: "planner",
  label: "Calendars, planners and charts",
  world: SHEET_WORLD,
  build: buildPlannerSheet,
  key: (sheet) => ({
    ...sheet,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describePlanner,
};
