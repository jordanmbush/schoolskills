/**
 * Measurement, and converting between units.
 *
 * The shared machinery is unchanged (§7, §11). What is different here is that a
 * unit conversion has an exact right answer and *looks* like one
 * that doesn't: three kilometres is three thousand metres, not 2999.9999999996,
 * and a generator that multiplied by a float would print that. So every unit in
 * `units.ts` is a whole number of the smallest unit of its quantity, every
 * conversion is a multiplication of whole numbers, and the one division in this
 * file is by a ratio that was constructed to divide.
 *
 * **The conversion is built from the smaller side.** A sheet that drew "3000 m"
 * and hoped it would divide by a thousand would print `2666 m = _ km` most of
 * the time and would have to throw it away; instead the number of the *larger*
 * unit is what is drawn, and whichever direction the question reads, both sides
 * are exact by construction. That is what `range` counts.
 *
 * **Nothing crosses between the systems** — `units.ts` has the reason.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  MeasureConfig,
  MeasureStyle,
  Mil,
  Problem,
  Quantity,
  Sheet,
  SheetOptions,
  UnitSystem,
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
import { QUANTITIES, amountText, scaleOf, type Unit } from "./units";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/**
 * Two lines of the body type and the air a wrap puts between them: `24 fl oz =
 * _ cup` with a ruled blank after it is a wide sentence.
 */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work a conversion out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/** Three columns. `3000 ml = _ l` is a wider sentence than `7 × 8 =`. */
const MAX_COLUMNS = 3;

/**
 * The furthest apart two units in one question may be.
 *
 * A mile in yards is a conversion somebody teaches; a mile in inches is a number
 * with five zeros on the end of it and no lesson attached. Comparing is held
 * tighter still — two amounts are compared by making one of them into the other,
 * and nobody makes a mile into a yard in their head.
 */
const MAX_RATIO = 1760;
const MAX_COMPARE_RATIO = 1000;

/** The biggest number the sheet will print, whatever range it was given. */
const MAX_SHOWN = 50000;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/* ── The pool ──────────────────────────────────────────────────────────────
   Sanitised once, because it comes from outside this build: a config in a
   bookmarked URL may name a quantity twice, or one this build has never heard
   of.                                                                        */

function quantitiesOf(config: MeasureConfig): Quantity[] {
  const asked = (config.quantities ?? []).filter((name) =>
    QUANTITIES.includes(name),
  );
  return asked.length > 0 ? [...new Set(asked)] : [];
}

const systemOf = (config: MeasureConfig): UnitSystem =>
  config.system === "imperial" ? "imperial" : "metric";

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(1, Math.floor(range?.min ?? 1));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 1)) };
}

const pick = <T>(items: T[], rand: () => number): T =>
  items[Math.floor(rand() * items.length)];

/**
 * The pairs of units a question may be asked across: the smaller one, the
 * larger, and how many of the first make one of the second.
 *
 * `neighbours` is the pairs one step apart in the scale — millimetres and
 * centimetres, feet and yards — which is what a comparison is drawn from.
 */
type Pair = { small: Unit; big: Unit; ratio: number };

function pairsOf(units: Unit[], most: number, neighbours: boolean): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < units.length; i += 1) {
    const last = neighbours ? Math.min(i + 2, units.length) : units.length;
    for (let j = i + 1; j < last; j += 1) {
      const ratio = units[j].base / units[i].base;
      if (ratio <= most) out.push({ small: units[i], big: units[j], ratio });
    }
  }
  return out;
}

/* ── Drawing a problem ─────────────────────────────────────────────────── */

type Drawn = { key: string; prompt: string; answer: string };

/**
 * The same amount written in another unit, in whichever direction the coin says.
 *
 * `count` is how many of the *larger* unit there are, and both sides are built
 * from it: going down the scale it is the number the child reads and the answer
 * is the multiplication; going up it is the answer and the multiplication is on
 * the page. Either way nothing is rounded, because nothing is divided.
 */
function drawConvert(
  config: MeasureConfig,
  quantity: Quantity,
  rand: () => number,
): Drawn | null {
  const { units } = scaleOf(systemOf(config), quantity);
  const pairs = pairsOf(units, MAX_RATIO, false);
  if (pairs.length === 0) return null;

  const { small, big, ratio } = pick(pairs, rand);
  const { min, max } = bounds(config.range);
  const count = between(min, max, rand);
  const smallSide = count * ratio;
  if (smallSide > MAX_SHOWN) return null;

  const down = rand() < 0.5;
  const [from, to] = down
    ? [amountText(count, big), small.symbol]
    : [amountText(smallSide, small), big.symbol];
  return {
    key: `convert:${quantity}:${count}:${big.symbol}:${small.symbol}:${down}`,
    prompt: `${from} = _ ${to}`,
    answer: String(down ? smallSide : count),
  };
}

/**
 * Two amounts side by side, and which of them is the bigger.
 *
 * The right-hand amount is the left one converted and then nudged, rather than
 * drawn on its own: two amounts drawn independently are almost never within a
 * hair of each other, so a child would answer the whole page by glancing at the
 * units. Nudged by a tenth of the ratio, so what is being compared is `5 m` and
 * `480 cm` rather than `5 m` and `499 cm` — the second is a trick, and the sheet
 * is not about eyesight.
 */
function drawCompare(
  config: MeasureConfig,
  quantity: Quantity,
  rand: () => number,
): Drawn | null {
  const { units } = scaleOf(systemOf(config), quantity);
  const pairs = pairsOf(units, MAX_COMPARE_RATIO, true);
  if (pairs.length === 0) return null;

  const { small, big, ratio } = pick(pairs, rand);
  const { min, max } = bounds(config.range);
  const count = between(min, max, rand);
  const nudge = Math.max(1, Math.round(ratio / 10));
  const smallSide = count * ratio + between(-4, 4, rand) * nudge;
  if (smallSide <= 0 || smallSide > MAX_SHOWN) return null;

  // Which side the larger unit is on is drawn too, so a child cannot answer the
  // page by noticing that the little unit is always on the right.
  const left = rand() < 0.5;
  const sides = left
    ? [amountText(count, big), amountText(smallSide, small)]
    : [amountText(smallSide, small), amountText(count, big)];
  const order = count * ratio - smallSide;
  return {
    key: `compare:${quantity}:${count}:${smallSide}:${big.symbol}:${left}`,
    prompt: `${sides[0]} _ ${sides[1]}`,
    answer: sign(left ? order : -order),
  };
}

/** Which of the two is the bigger, as the child writes it. */
const sign = (order: number): string =>
  order === 0 ? "=" : order > 0 ? ">" : "<";

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** How many problems the paper holds, and how wide a column of them is (§4). */
export function measureLayout(config: MeasureConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const columns = clamp(config.columns, 1, MAX_COLUMNS);
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
export function measureProblems(
  config: MeasureConfig,
  seed: number,
): Problem[] {
  const { perPage } = measureLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const pool = quantitiesOf(config);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};
  if (pool.length === 0) return problems;

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const quantity = pick(pool, rand);
    const drawn =
      config.style === "compare"
        ? drawCompare(config, quantity, rand)
        : drawConvert(config, quantity, rand);
    // A pool that has run out ends the draw rather than repeating itself:
    // grams and kilograms over one to three is six questions, and six is the
    // honest answer to a request for twenty.
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

/* ── What it is called ─────────────────────────────────────────────────── */

const SYSTEM_NAME: Record<UnitSystem, string> = {
  metric: "metric",
  imperial: "imperial",
};

/**
 * "Converting metric units of length" — the phrase a parent says out loud, and
 * the one they type into a search box.
 *
 * A sheet drawing on more than one quantity is not called after any of them,
 * because it is not about any of them: it is the mixed sheet, and naming it
 * after whichever was listed first would be a title that is wrong two thirds of
 * the time.
 */
function titleOf(config: MeasureConfig): string {
  const system = SYSTEM_NAME[systemOf(config)];
  const pool = quantitiesOf(config);
  const doing = config.style === "compare" ? "Comparing" : "Converting";
  if (pool.length !== 1) return `${doing} ${system} units`;
  return `${doing} ${system} units of ${scaleOf(systemOf(config), pool[0]).name}`;
}

const INSTRUCTION: Record<MeasureStyle, string> = {
  convert: "Write the missing number in each blank.",
  compare: "Write <, > or = in each blank.",
};

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`.
 */
function headerOf(config: MeasureConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions:
      config.instructions ?? INSTRUCTION[config.style] ?? INSTRUCTION.convert,
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * What the title leaves off is which units are actually on the page, which is
 * the whole of whether a sheet matches the lesson: "metric units of length" is
 * millimetres one week and kilometres the next.
 */
export function describeMeasure(config: MeasureConfig): string {
  const system = systemOf(config);
  const pool = quantitiesOf(config);
  if (pool.length === 0) return titleOf(config);
  const said =
    pool.length === 1
      ? scaleOf(system, pool[0])
          .units.map((unit) => unit.symbol)
          .join(", ")
      : pool.map((name) => scaleOf(system, name).name).join(", ");
  return `${titleOf(config)} — ${said}`;
}

export function buildMeasureSheet(config: MeasureConfig, seed: number): Sheet {
  const items = measureProblems(config, seed);
  const { columns } = measureLayout(config);
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

export const MEASURE_SHEET: SheetSpec<MeasureConfig> = {
  id: "measure",
  label: "Measurement",
  world: SHEET_WORLD,
  build: buildMeasureSheet,
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeMeasure,
};
