/**
 * Telling the time.
 *
 * The first family in the shop whose answer is sometimes a drawing. The shared
 * machinery is unchanged (§7, §11); two things here are genuinely different.
 *
 * **The dial is the question on one sheet and the answer place on the next.** A
 * face with hands on it is read; a face without them is drawn on. So a clock
 * rides on the problem the way a fraction diagram does, and `hands` decides
 * which of the two it is: a drawn answer takes no ruled slot, because a problem
 * has exactly one place to write the answer and on that sheet the place is the
 * dial. Nothing declares this beside the face — it is read off the face, so the
 * two cannot disagree.
 *
 * **The arithmetic is not base ten.** Twenty-five minutes past two to twenty
 * past three is fifty-five minutes, and a child who subtracts 215 from 320 gets
 * a hundred and five. So every time here is one number — minutes past twelve,
 * from `clockface.ts` — the subtraction happens in minutes, and the hours are
 * put back only when the answer is written. There is no other arithmetic in this
 * file.
 *
 * Nothing wraps past twelve. A sheet with no am or pm on it that ran from 11:30
 * to 1:30 would be asking a question with two right answers, two hours and
 * fourteen, and a child cannot know which was meant.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  ClockFace,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
  TimeConfig,
  TimeStyle,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  DIAL,
  MINUTES_AN_HOUR,
  MINUTES_A_TURN,
  clockFace,
  timeText,
} from "../clockface";
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

/* ── How precise the times are ─────────────────────────────────────────────
   The five steps a clock is taught in, and the whole of what makes one of
   these sheets easy or hard.                                                */

export const TIME_STEPS = [60, 30, 15, 5, 1];

/** What each one is called, on the title and in the picker. */
export const STEP_NAME: Record<number, string> = {
  60: "to the hour",
  30: "to the half hour",
  15: "to the quarter hour",
  5: "to five minutes",
  1: "to the minute",
};

/**
 * The step this sheet is set at.
 *
 * Five minutes when the config names one this build has never heard of, which
 * is the commonest of the five and the one a mixed class is set — a step of
 * seven has to resolve to something rather than throw, for the same reason
 * `sheetSpec` never does.
 */
export const stepOf = (config: TimeConfig): number =>
  TIME_STEPS.includes(config.step) ? config.step : 5;

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/**
 * Two lines of the body type and the air a wrap puts between them: `2:15 to
 * 3:40 =` with a ruled blank after it does not fit across a third of a page.
 */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work a duration out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/**
 * Three columns of dials, and three of durations.
 *
 * A dial is an inch and a half across and the time it is answered with sits
 * beside it, which is most of a column already.
 */
const MAX_COLUMNS = 3;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/* ── Drawing a problem ─────────────────────────────────────────────────── */

type Drawn = {
  key: string;
  prompt: string;
  answer: string;
  clock?: ClockFace;
};

/** A time on the dial, landing on one of the minutes the step allows. */
const drawTime = (step: number, rand: () => number): number =>
  between(0, Math.floor(MINUTES_A_TURN / step) - 1, rand) * step;

/**
 * A face to read, and the time written under it — or a time to read, and the
 * face it is drawn on.
 *
 * One draw for both, because they are the same question asked from either end
 * and a sheet of each should hold the same times for the same seed.
 */
function drawFace(style: TimeStyle, step: number, rand: () => number): Drawn {
  const at = drawTime(step, rand);
  const written = timeText(at);
  const reading = style === "read";
  return {
    key: `face:${at}`,
    // Reading a dial asks nothing in words; drawing one asks for a time, and
    // the time has to be on the page for the child to draw it.
    prompt: reading ? "" : written,
    answer: written,
    clock: clockFace(at, reading),
  };
}

/**
 * How long the two times are apart.
 *
 * Both ends land on the step, so the answer does too — a sheet set to the
 * quarter hour whose answer was fifty-three minutes would be a sheet nobody
 * chose. The span is in minutes, and it is clamped so that the finish is still
 * before twelve: see the note at the top on why nothing here wraps.
 */
function drawElapsed(
  config: TimeConfig,
  step: number,
  rand: () => number,
): Drawn | null {
  const { min, max } = spanOf(config, step);
  // Drawn in whole steps between the two ends rather than drawn and rejected:
  // a span of an hour to three at a step of five minutes would throw away four
  // draws in five, and a thin pool would then run out before the page was full.
  // Both ends are whole steps already (`spanOf` snapped them), so this counts
  // steps exactly and the range it counts over is never empty.
  const lasted = between(min / step, max / step, rand) * step;

  const start = drawTime(step, rand);
  if (start + lasted >= MINUTES_A_TURN) return null;
  return {
    key: `elapsed:${start}:${lasted}`,
    prompt: `${timeText(start)} to ${timeText(start + lasted)} =`,
    answer: durationText(lasted),
  };
}

/**
 * How far apart the two times may be, in whole steps.
 *
 * Bounded above by eleven hours rather than by twelve, because a duration that
 * long leaves no time of day for it to start at.
 *
 * **Snapped to the step, not merely clamped.** Both ends of an elapsed problem
 * land on the step, so the duration does too — and a span of forty to fifty
 * minutes at the half hour holds no such duration at all. Rounding the ask
 * inward would leave an empty range and a draw with nothing to pick, so the
 * floor rises to the next whole step and the ceiling drops to the last one,
 * then opens back up to the floor if that overshot it. The result is what
 * `describeTime` prints at the top of the page, which is the point: a sheet
 * headed "up to 50 min" whose every problem lasts an hour is a sheet lying to
 * the parent who chose it (§20).
 */
export function spanOf(
  config: TimeConfig,
  step: number,
): { min: number; max: number } {
  const most = MINUTES_A_TURN - MINUTES_AN_HOUR;
  const asked = config.span;
  const floor = Math.max(step, Math.min(most, Math.floor(asked?.min ?? step)));
  const ceiling = Math.max(step, Math.min(most, Math.floor(asked?.max ?? 180)));
  // `most` is eleven hours, which is a whole number of every step there is, so
  // rounding up cannot climb past it.
  const min = Math.ceil(floor / step) * step;
  return { min, max: Math.max(min, Math.floor(ceiling / step) * step) };
}

/**
 * A length of time as it is written: "45 min", "2 h", "1 h 25 min".
 *
 * Hours and minutes rather than minutes alone, because that is how a child is
 * asked to answer and how anybody says it out loud — "eighty-five minutes" is
 * an arithmetic answer, and "1 h 25 min" is a time.
 */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_AN_HOUR);
  const left = minutes - hours * MINUTES_AN_HOUR;
  if (hours === 0) return `${left} min`;
  return left === 0 ? `${hours} h` : `${hours} h ${left} min`;
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** Whether the sheet's problems carry a dial. */
const hasDial = (config: TimeConfig): boolean => config.style !== "elapsed";

/** How tall one problem stands, dial and working space and all. */
function rowHeight(config: TimeConfig): Mil {
  // A dial and the blank it is answered in do not fit across a third of a page,
  // so the row is the drawing, the wrap, and the line beside it — the same
  // shape a fraction naming problem takes.
  const body = hasDial(config)
    ? DIAL + WRAP_GAP + answerLine(config.fontPt)
    : writtenRow(config.fontPt);
  return body + (config.workspace ? WORKSPACE : 0);
}

/** How many problems the paper holds, and how wide a column of them is (§4). */
export function timeLayout(config: TimeConfig): {
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
  const row = rowHeight(config);
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
export function timeProblems(config: TimeConfig, seed: number): Problem[] {
  const { perPage } = timeLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const step = stepOf(config);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn =
      config.style === "elapsed"
        ? drawElapsed(config, step, rand)
        : drawFace(config.style, step, rand);
    // A pool that has run out ends the draw rather than repeating itself:
    // a sheet set to the hour is twelve questions, and twelve is the honest
    // answer to a request for twenty.
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    problems.push({
      prompt: drawn.prompt,
      answer: drawn.answer,
      ...(drawn.clock ? { clock: drawn.clock } : {}),
      ...extras,
    });
    misses = 0;
  }
  return problems;
}

/* ── What it is called ─────────────────────────────────────────────────── */

function titleOf(config: TimeConfig): string {
  const step = STEP_NAME[stepOf(config)];
  switch (config.style) {
    case "draw":
      return `Drawing the hands ${step}`;
    case "elapsed":
      return "Elapsed time";
    default:
      return `Telling the time ${step}`;
  }
}

const INSTRUCTION: Record<TimeStyle, string> = {
  read: "Write the time each clock shows.",
  draw: "Draw the hands on each clock to show the time.",
  elapsed: "Write how long each one lasts, in hours and minutes.",
};

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`.
 */
function headerOf(config: TimeConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions:
      config.instructions ?? INSTRUCTION[config.style] ?? INSTRUCTION.read,
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * What the title leaves off is how far apart an elapsed sheet's times are, which
 * is the difference between a sheet a child counts on their fingers and one they
 * work out.
 */
export function describeTime(config: TimeConfig): string {
  if (config.style !== "elapsed") return titleOf(config);
  const { max } = spanOf(config, stepOf(config));
  return `${titleOf(config)} — up to ${durationText(max)}`;
}

export function buildTimeSheet(config: TimeConfig, seed: number): Sheet {
  const items = timeProblems(config, seed);
  const { columns } = timeLayout(config);
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

export const TIME_SHEET: SheetSpec<TimeConfig> = {
  id: "time",
  label: "Telling the time",
  world: SHEET_WORLD,
  build: buildTimeSheet,
  // On a drawing sheet the key is the same faces with their hands put on, which
  // the renderer does from `sheet.answers` — so even there the key is the sheet
  // rather than a second build that could disagree with it.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeTime,
};
