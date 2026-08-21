/**
 * Ratio, proportion and unit rate.
 *
 * Three names for one idea — two numbers whose *relationship* is the answer —
 * and one hazard, which `exact.ts` has already met: `12 : 18` and `2 : 3` are
 * the same ratio and only one of them gets a tick. So a ratio is a pair of whole
 * numbers reduced by their greatest common divisor, exactly as a fraction is,
 * and there is no division anywhere in this file that is not exact by
 * construction.
 *
 * **A proportion is built by scaling, not by solving.** The pair on the left is
 * drawn and the pair on the right is that pair multiplied up, so the missing
 * number was known before the question existed. Which of the four places is
 * blank is drawn separately — a sheet whose gap is always at the end is a sheet
 * a child answers by pattern rather than by proportion.
 *
 * **A rate is built from the amount for one.** `240 words in 4 minutes` is 60
 * words a minute multiplied back out, so the answer is a whole number without
 * anything being rounded — the same move `measure.ts` makes by building a
 * conversion from the larger unit.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  Mil,
  Problem,
  RatioConfig,
  RatioStyle,
  Sheet,
  SheetOptions,
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
import { gcd } from "./exact";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/** Two lines of the body type and the air a wrap puts between them. */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work an answer out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/**
 * Three columns of ratios, and two of rates.
 *
 * `240 words in 4 minutes = _ words per minute` is a sentence rather than a
 * sum, and a column narrower than the sentence is a page of problems each
 * wrapped onto three lines.
 */
const MAX_COLUMNS = 3;
const MAX_RATE_COLUMNS = 2;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/**
 * How far a proportion is scaled up: `3 : 4` becomes `9 : 12`, not `93 : 124`.
 *
 * Small on purpose. What is being practised is that the two pairs are the same
 * relationship, and a factor a child cannot spot turns that into a long
 * multiplication with a proportion painted on the front.
 */
const MOST_SCALE = 9;

/* ── Drawing ───────────────────────────────────────────────────────────── */

type Drawn = { key: string; prompt: string; answer: string };

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(1, Math.floor(range?.min ?? 1));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 1)) };
}

const pick = <T>(items: readonly T[], rand: () => number): T =>
  items[Math.floor(rand() * items.length)];

/** A ratio as it is written on a sheet: two numbers with a colon between. */
const ratioText = (left: number, right: number): string => `${left} : ${right}`;

/**
 * A ratio to be written the smallest way.
 *
 * Drawn as a multiple of a smaller pair rather than drawn and tested, so the
 * question always has something to do: `7 : 12` is already in its simplest form
 * and asking for it teaches a child only that the sheet sometimes asks for
 * nothing.
 */
function drawSimplify(config: RatioConfig, rand: () => number): Drawn | null {
  const { min, max } = bounds(config.range);
  const left = between(min, max, rand);
  const right = between(min, max, rand);
  const by = between(2, Math.max(2, Math.min(MOST_SCALE, max)), rand);
  // Already sharing a factor means the pair the child writes is smaller than
  // the pair that was drawn, and the key would be the wrong one of the two.
  const factor = gcd(left, right);
  if (factor !== 1) return null;
  if (left === right) return null;
  return {
    key: `simplify:${left}:${right}:${by}`,
    prompt: `${ratioText(left * by, right * by)} =`,
    answer: ratioText(left, right),
  };
}

/**
 * Two pairs that scale together, with one of the four numbers missing.
 *
 * Which one is missing is drawn, because the skill is reading the pair that is
 * whole and applying it to the pair that is not — and a gap that is always in
 * the same corner is a gap a child fills in without ever doing that.
 */
function drawProportion(config: RatioConfig, rand: () => number): Drawn | null {
  const { min, max } = bounds(config.range);
  const left = between(min, max, rand);
  const right = between(min, max, rand);
  // The pair has to be in its simplest form for the scaled one to be a
  // question about scaling — and `1 : 1` is the pair that survives that and is
  // still nothing to work out.
  if (gcd(left, right) !== 1 || left === right) return null;
  const by = between(2, Math.max(2, Math.min(MOST_SCALE, max)), rand);

  const numbers = [left, right, left * by, right * by];
  const gap = Math.floor(rand() * numbers.length);
  const written = numbers.map((value, at) =>
    at === gap ? "_" : String(value),
  );
  return {
    key: `proportion:${left}:${right}:${by}:${gap}`,
    prompt: `${written[0]} : ${written[1]} = ${written[2]} : ${written[3]}`,
    answer: String(numbers[gap]),
  };
}

/* ── Rates ─────────────────────────────────────────────────────────────────
   The one style with words in it, so the words are a small closed list rather
   than a sentence built out of parts: a rate is only a real question if the
   thing being counted and the thing it is counted against go together, and
   "240 apples in 4 hours" is a sum with a story stapled to it.               */

type Rate = {
  /** What is counted: "words", "miles". */
  what: string;
  /** What it is counted against, in the plural: "minutes". */
  per: string;
  /** And in the singular, which is what "per" takes: "minute". */
  one: string;
};

const RATES: Rate[] = [
  { what: "words", per: "minutes", one: "minute" },
  { what: "miles", per: "hours", one: "hour" },
  { what: "pages", per: "days", one: "day" },
  { what: "litres", per: "minutes", one: "minute" },
  { what: "beats", per: "minutes", one: "minute" },
  { what: "seats", per: "rows", one: "row" },
  { what: "sweets", per: "bags", one: "bag" },
  { what: "photos", per: "albums", one: "album" },
];

/**
 * How much for one, worked back out of how much for several.
 *
 * The rate is drawn first and the total is the multiplication, so the division
 * the child does is exact and the key never rounds anything.
 */
function drawRate(config: RatioConfig, rand: () => number): Drawn | null {
  const { min, max } = bounds(config.range);
  const rate = pick(RATES, rand);
  const each = between(Math.max(2, min), Math.max(2, max), rand);
  // Two of something is a rate; one of it is the answer written into the
  // question, and a child who spotted that would be right to stop reading.
  const many = between(2, Math.max(2, Math.min(MOST_SCALE, max)), rand);
  return {
    key: `rate:${rate.what}:${each}:${many}`,
    prompt: `${each * many} ${rate.what} in ${many} ${rate.per} = _ ${rate.what} per ${rate.one}`,
    answer: String(each),
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** How many problems the paper holds, and how wide a column of them is (§4). */
export function ratioLayout(config: RatioConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const most = config.style === "rate" ? MAX_RATE_COLUMNS : MAX_COLUMNS;
  const columns = clamp(config.columns, 1, most);
  const row = writtenRow(config.fontPt) + (config.workspace ? WORKSPACE : 0);
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
 * Exported because it is the whole of what a test has to check.
 */
export function ratioProblems(config: RatioConfig, seed: number): Problem[] {
  const { perPage } = ratioLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn = drawOne(config, rand);
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    problems.push({ prompt: drawn.prompt, answer: drawn.answer, ...extras });
    misses = 0;
  }
  return problems;
}

function drawOne(config: RatioConfig, rand: () => number): Drawn | null {
  switch (config.style) {
    case "proportion":
      return drawProportion(config, rand);
    case "rate":
      return drawRate(config, rand);
    default:
      return drawSimplify(config, rand);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<RatioStyle, string> = {
  simplify: "Simplifying ratios",
  proportion: "Solving proportions",
  rate: "Unit rate",
};

const INSTRUCTION: Record<RatioStyle, string> = {
  simplify: "Write each ratio in its simplest form.",
  proportion: "Write the missing number in each blank.",
  rate: "Work out the amount for one.",
};

const titleOf = (config: RatioConfig): string =>
  TITLE[config.style] ?? TITLE.simplify;

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`.
 */
function headerOf(config: RatioConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions:
      config.instructions ?? INSTRUCTION[config.style] ?? INSTRUCTION.simplify,
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * What the title leaves off is the size of the numbers, which on this family is
 * the difference between a sheet done in the head and one done on paper.
 */
export function describeRatio(config: RatioConfig): string {
  return `${titleOf(config)} — numbers to ${bounds(config.range).max}`;
}

export function buildRatioSheet(config: RatioConfig, seed: number): Sheet {
  const items = ratioProblems(config, seed);
  const { columns } = ratioLayout(config);
  const head = headerOf(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      score: { outOf: items.length },
    },
    blocks: [{ kind: "problems", columns, items }],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const RATIO_SHEET: SheetSpec<RatioConfig> = {
  id: "ratio",
  label: "Ratio and rate",
  world: SHEET_WORLD,
  build: buildRatioSheet,
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeRatio,
};
