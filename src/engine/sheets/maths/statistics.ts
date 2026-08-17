/**
 * Mean, median, mode and range.
 *
 * The one maths family whose question is a *set* rather than a sum, and the one
 * where the usual generator bug is invisible on the page. Three of them:
 *
 * **A set with two modes has two right answers.** `3, 3, 7, 7, 9` has no mode
 * worth asking for, and a key naming either of them marks half the class wrong.
 * So a sheet that asks for the mode builds one: a value is placed two or three
 * times and every other value in the set is different from it and from each
 * other, which makes the answer unique by construction rather than by luck.
 *
 * **An even-sized set has its median between two numbers.** Four numbers have
 * no middle one, and the answer is halfway between the second and the third —
 * which is a half as often as not. `medianText` writes that half out rather
 * than rounding it away, and it does it in whole numbers: the sum of the two
 * middles is either even, and halves exactly, or odd, and ends in `.5`.
 *
 * **A mean that isn't whole is a decimals sheet in disguise.** So a set whose
 * mean is asked for is drawn until its total divides by its size, and the sheet
 * a parent gets is the one they chose.
 *
 * Everything else the maths families established holds: the answers are
 * computed when the problem is built, the key only decides to print them, and
 * the page comes out of `(config, seed)`.
 */
import { between, mulberry32, shuffled } from "@/engine/random";

import type {
  Mil,
  Problem,
  Sheet,
  SheetOptions,
  StatisticStyle,
  StatisticsConfig,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/** Two lines of the body type and the air a wrap puts between them. */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work an answer out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/** The four answers an "all four" problem asks for, one ruled line each. */
const ALL_LINES = 4;

/** The room those four lines take, which is what the row reserves for them. */
const allSpace = (fontPt: number): Mil => ALL_LINES * answerLine(fontPt);

/**
 * Two columns of sets, and one when all four statistics are asked at once.
 *
 * A set of eight numbers is a long line before its answer slot, and the four
 * answers underneath are sentences rather than numbers.
 */
const MAX_COLUMNS = 2;
const MAX_ALL_COLUMNS = 1;

/** How many numbers a set may hold, whatever a saved config asks for. */
const SIZES = { min: 3, max: 9 };

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/* ── The four statistics ───────────────────────────────────────────────────
   Worked out once, from the set, and read from there by everything below. A
   second computation of a median is a second answer to the same question.   */

type Summary = {
  /** The mean, when it comes out whole — and `null` when it does not. */
  mean: number | null;
  /** The median, written out, halves and all. */
  median: string;
  /** The one value that appears most often, or `null` when several tie. */
  mode: number | null;
  range: number;
};

/** Smallest first, without disturbing the order the set is printed in. */
const sorted = (values: number[]): number[] =>
  [...values].sort((a, b) => a - b);

/**
 * The middle of a set, written the way a child writes it.
 *
 * An odd-sized set has a middle number. An even-sized one has two, and the
 * answer is halfway between them — which is a whole number when they add to an
 * even total and a half when they do not. Both are worked out from the *sum* of
 * the two, so nothing is ever divided into a float.
 */
function medianText(values: number[]): string {
  const order = sorted(values);
  const middle = Math.floor(order.length / 2);
  if (order.length % 2 === 1) return String(order[middle]);
  const total = order[middle - 1] + order[middle];
  const half = Math.floor(total / 2);
  return total % 2 === 0 ? String(half) : `${half}.5`;
}

/**
 * The value that appears most often, when exactly one value does.
 *
 * Exported because it is the one judgement in this file that a set can fail, and
 * because the draw below builds sets that pass it on purpose — so the rule
 * itself is only reachable from a test that hands it a tie directly. A family
 * that lost this would print a question with two right answers on it, which is
 * the failure the header names first.
 */
export function modeOf(values: number[]): number | null {
  const tally = new Map<number, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
  const most = Math.max(...tally.values());
  const top = [...tally].filter(([, count]) => count === most);
  // A set where every value appears once has no mode, and one where two values
  // tie has two: both are honest answers to a question this sheet is not
  // asking, so neither is drawn.
  return top.length === 1 && most > 1 ? top[0][0] : null;
}

function summaryOf(values: number[]): Summary {
  const total = values.reduce((sum, value) => sum + value, 0);
  const order = sorted(values);
  return {
    mean: total % values.length === 0 ? total / values.length : null,
    median: medianText(values),
    mode: modeOf(values),
    range: order[order.length - 1] - order[0],
  };
}

/* ── Drawing a set ─────────────────────────────────────────────────────── */

type Drawn = {
  key: string;
  prompt: string;
  answer: string;
  answers?: string[];
};

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(0, Math.floor(range?.min ?? 0));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 1)) };
}

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** Whether this sheet's answer needs one value to appear more than the rest. */
const needsMode = (style: StatisticStyle): boolean =>
  style === "mode" || style === "all";

/** And whether it needs the total to divide by how many numbers there are. */
const needsMean = (style: StatisticStyle): boolean =>
  style === "mean" || style === "all";

/**
 * How often the repeated value appears, in a set of this size.
 *
 * Twice on a small set, and three times on a big one — a value appearing twice
 * in nine numbers is a mode by the letter of the definition and not by anything
 * a child would see.
 */
const repeatsIn = (size: number): number => (size >= 7 ? 3 : 2);

/**
 * How many numbers a set will actually hold — which is not always the ask.
 *
 * A mode set needs every value but the repeated one to be different, so it can
 * only be as wide as the range has distinct numbers to fill it: nine numbers
 * with three of them the same want seven different values, and one to three
 * has three. The size comes *down* to what can be built rather than the draw
 * quietly stopping short of it, because the size is also what the catalog line
 * and the header advertise — and a page of fives under "sets of 9" is the sheet
 * disagreeing with its own heading. Read by the draw and by the description
 * from here, so the two cannot part company.
 */
function sizeOf(config: StatisticsConfig): number {
  const wanted = clamp(config.size, SIZES.min, SIZES.max);
  if (!needsMode(config.style)) return wanted;
  const { min, max } = bounds(config.range);
  const distinct = max - min + 1;
  // The repeated value, and one each of `size − repeats` others that are all
  // different from it and from each other.
  let size = wanted;
  while (size > SIZES.min && distinct < size - repeatsIn(size) + 1) size -= 1;
  return size;
}

/**
 * A set of numbers, built to have the answer the sheet is going to ask for.
 *
 * Where a mode is wanted the set is *constructed* rather than drawn and tested:
 * one value is placed two or three times and the rest are all different from it
 * and from each other. Drawing at random and hoping for a unique mode works
 * about half the time on a set of five, and the half it fails on is a sheet that
 * quietly comes up four problems short.
 */
function drawValues(
  config: StatisticsConfig,
  size: number,
  rand: () => number,
): number[] {
  const { min, max } = bounds(config.range);
  if (!needsMode(config.style)) {
    return Array.from({ length: size }, () => between(min, max, rand));
  }

  const repeated = between(min, max, rand);
  const times = repeatsIn(size);
  const others: number[] = [];
  const seen = new Set([repeated]);
  let misses = 0;
  while (others.length < size - times && misses < MISS_BUDGET) {
    const value = between(min, max, rand);
    if (seen.has(value)) {
      misses += 1;
      continue;
    }
    seen.add(value);
    others.push(value);
    misses = 0;
  }
  return shuffled([...Array(times).fill(repeated), ...others], rand);
}

/**
 * The set as it will be printed, with the answer the style asks for.
 *
 * Every rejection here is a set that cannot answer its own question: no whole
 * mean where the sheet asks for the mean, no single mode where it asks for the
 * mode, and — on a range sheet — no spread at all, because "the range of 7, 7,
 * 7" is a question about nothing.
 */
function drawSet(config: StatisticsConfig, rand: () => number): Drawn | null {
  const size = sizeOf(config);
  const values = drawValues(config, size, rand);
  // Against the size this sheet says it prints, not against the smallest set
  // there is: a mode draw that ran out of distinct values comes back short, and
  // a short set accepted here is a page that contradicts its own heading.
  if (values.length < size) return null;

  const summary = summaryOf(values);
  if (needsMean(config.style) && summary.mean === null) return null;
  if (needsMode(config.style) && summary.mode === null) return null;
  if (config.style === "range" && summary.range === 0) return null;

  const prompt = values.join(", ");
  // Folded on the set sorted, because a set is a set: the same nine numbers in
  // another order is the same question, and a child spots that faster than the
  // adult who printed it does.
  const key = `set:${sorted(values).join(":")}`;

  if (config.style === "all") {
    // One list, printed two ways and built once, so the two cannot disagree:
    // `answers` is what the sheet rules lines for and the key writes on them,
    // `answer` the same four on one line for anything wanting a string.
    const written = [
      `mean = ${summary.mean}`,
      `median = ${summary.median}`,
      `mode = ${summary.mode}`,
      `range = ${summary.range}`,
    ];
    return { key, prompt, answer: written.join(", "), answers: written };
  }
  return { key, prompt, answer: answerOf(summary, config.style) };
}

/** Which of the four the sheet asked for, as it is written in the blank. */
function answerOf(summary: Summary, style: StatisticStyle): string {
  if (style === "median") return summary.median;
  if (style === "mode") return String(summary.mode);
  if (style === "range") return String(summary.range);
  return String(summary.mean);
}

/* ── The page ──────────────────────────────────────────────────────────── */

/**
 * How many problems the paper holds, and how wide a column of them is.
 *
 * Arithmetic, not measurement, so `npm run test:unit` can answer "did it fit?"
 * without a browser — and so the same answer serves the catalog page built at
 * build time and the builder's preview (§4).
 */
export function statisticsLayout(config: StatisticsConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const most = config.style === "all" ? MAX_ALL_COLUMNS : MAX_COLUMNS;
  const columns = clamp(config.columns, 1, most);
  // The four answer lines are the answer place, not extra paper under it —
  // exactly as a fact family's four sentences are in `arithmetic.ts`.
  const under =
    config.style === "all"
      ? allSpace(config.fontPt)
      : config.workspace
        ? WORKSPACE
        : 0;
  const row = writtenRow(config.fontPt) + under;
  return {
    box,
    columns,
    cell: columnWidth(box, columns, PROBLEM_GAP.x),
    row,
    perPage: columns * fitAcross(box.height, row, PROBLEM_GAP.y),
  };
}

/**
 * Every problem on the sheet, in the order they are printed.
 *
 * Exported because it is the whole of what a test has to check, and checking it
 * through the `Sheet` means unwrapping a block union to reach it.
 */
export function statisticsProblems(
  config: StatisticsConfig,
  seed: number,
): Problem[] {
  const { perPage } = statisticsLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const workspace =
    config.style === "all"
      ? { workspace: allSpace(config.fontPt) }
      : config.workspace
        ? { workspace: WORKSPACE }
        : {};

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn = drawSet(config, rand);
    // Not what was asked for, or already on the page. Either way the budget
    // ticks down, and a pool that has run out ends the draw rather than
    // repeating itself: there are ten sets of three numbers from one to three,
    // and ten is the honest answer to a request for twenty.
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    problems.push({
      prompt: drawn.prompt,
      answer: drawn.answer,
      ...(drawn.answers ? { answers: drawn.answers } : {}),
      ...workspace,
    });
    misses = 0;
  }
  return problems;
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<StatisticStyle, string> = {
  mean: "Finding the mean",
  median: "Finding the median",
  mode: "Finding the mode",
  range: "Finding the range",
  all: "Mean, median, mode and range",
};

const INSTRUCTION: Record<StatisticStyle, string> = {
  mean: "Write the mean of each set of numbers.",
  median: "Write the median of each set of numbers.",
  mode: "Write the mode of each set of numbers.",
  range: "Write the range of each set of numbers.",
  all: "Write the mean, median, mode and range of each set.",
};

const titleOf = (config: StatisticsConfig): string =>
  TITLE[config.style] ?? TITLE.all;

/**
 * The header this sheet will actually print.
 *
 * A generated family names its own sheet, so `config.title` is an override and
 * is usually absent — which makes it the wrong thing to reserve space against.
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
 */
function headerOf(config: StatisticsConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions:
      config.instructions ?? INSTRUCTION[config.style] ?? INSTRUCTION.all,
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * How many numbers are in a set is the half of the difficulty the title leaves
 * off — and, on an even-sized set, it is a different question rather than a
 * harder one: the median lands between two numbers rather than on one.
 */
export function describeStatistics(config: StatisticsConfig): string {
  return [
    titleOf(config),
    // What the sets on the page actually hold, which a narrow range can make
    // smaller than the ask (see `sizeOf`).
    `sets of ${sizeOf(config)}`,
    `numbers to ${bounds(config.range).max}`,
  ].join(" — ");
}

export function buildStatisticsSheet(
  config: StatisticsConfig,
  seed: number,
): Sheet {
  const items = statisticsProblems(config, seed);
  const { columns } = statisticsLayout(config);
  const head = headerOf(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // Out of what is actually on the page, not out of what was asked for: a
      // sheet that says "/ 20" over eighteen problems is wrong twice.
      score: { outOf: items.length },
    },
    blocks: [{ kind: "problems", columns, items }],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const STATISTICS_SHEET: SheetSpec<StatisticsConfig> = {
  id: "statistics",
  label: "Mean, median and mode",
  world: SHEET_WORLD,
  build: buildStatisticsSheet,
  // The whole of the answer-key mechanism: all four statistics were worked out
  // from the set when the problem was built, so a key prints what is already
  // there rather than summarising the numbers a second time.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeStatistics,
};
