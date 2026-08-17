/**
 * The blank maths references: the paper a lesson is done *against*.
 *
 * A hundred chart, a number line, a coordinate grid and a place-value chart —
 * the second family in the "templates" tier of §11, beside the ruled paper, and
 * the second one that is geometry rather than generation. Nothing on any of
 * these four sheets is drawn from the seed, which is not an oversight: a
 * hundred chart is the same hundred numbers in the same order every time it is
 * printed, and a parent who prints one twice should get the same wall chart.
 * The seed still rides in the footer, because the sheet is still reproducible
 * from it.
 *
 * **This is the family the counting has to be right in.** Everything here is
 * something a child measures against or counts on, so an off-by-one is not a
 * cosmetic bug — it is a sheet that teaches something false and does it in ink:
 *
 * - a hundred chart that starts at nought and is still called 1–100,
 * - a 0–100 number line with a hundred intervals and a hundred ticks,
 * - a grid one square short at the margin,
 * - a place-value heading half a column left of the column it names.
 *
 * Each of the four is counted rather than assumed below, and `charts.test.ts`
 * counts them again from the finished blocks rather than from the arithmetic
 * that made them — the same bargain the word search's key is held to. A
 * generator asserting its own output would agree with itself whatever it did.
 *
 * One sheet here has an answer: a blank hundred chart is filled in, and the
 * filled chart is its key. The other three withhold nothing — a number line, a
 * coordinate grid and a place-value chart are supposed to be empty — so
 * `chartKeyed` is what a page asks before printing a second copy of the same
 * paper under the word "key".
 */
import { sheetBlockBox } from "../chrome";
import { BLOCK_GAP, answerLine, fitAcross, type Box } from "../layout";
import { NUMBER_LINE_HEIGHT, labelEvery, ticks } from "../numberline";
import { inches, own } from "../paper";
import { planeOf } from "../plane";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  ChartConfig,
  ChartStyle,
  GridSpec,
  Mil,
  NumberLine,
  Sheet,
  SheetOptions,
} from "../types";

/* ── What a square may measure ─────────────────────────────────────────────
   Two bounds rather than one size. The largest is what stops a three-column
   chart printing squares the size of a fist; the smallest is what stops a
   thousand-row one printing squares nothing can be written in, and it is what
   the row and strip counts below are capped against. Between them, a chart is
   as large as the paper allows — which is the right default for something that
   goes on a wall.                                                           */

/** The largest square on a chart, and the smallest one worth writing in. */
const MAX_CELL: Mil = inches(0.8);
const MIN_CELL: Mil = inches(0.2);

/** And on a coordinate grid, which has no numerals inside its squares. */
const MAX_PLANE_CELL: Mil = inches(0.75);

/**
 * A hundred chart is ten to a row, and that is not a setting.
 *
 * The whole of what the chart teaches is in the shape: every column is one
 * digit repeating, every row is a count of ten, and moving down is adding ten.
 * A chart nine or eleven wide is a rectangle of numbers with none of that in
 * it, so the range is the option and the width is the chart.
 */
const HUNDRED_COLUMNS = 10;

/**
 * The air left round a number-line strip, so there is room to cut it out.
 *
 * An inch and a quarter is scissors and a hand, and it is also the room to draw
 * the hops a child counts in above the line. Capped rather than simply divided,
 * because a page of two strips with the page's whole spare height between them
 * is one strip at the top of the paper and one at the bottom.
 */
const MAX_STRIP_GAP: Mil = inches(1.25);

/**
 * How tall a row of a place-value chart is, at the least and at the most.
 *
 * Between them the rows stretch to fill the page, which is what makes the same
 * block a *mat* at four rows and a chart at twelve: the columns are already as
 * wide as the paper allows, and a chart three inches down an eleven-inch page
 * with nothing under it is a mat nobody would put counters on.
 */
const MIN_PLACE_ROW: Mil = inches(0.4);
const MAX_PLACE_ROW: Mil = inches(1.2);

/**
 * The places a chart can hold, as powers of ten, largest first.
 *
 * Millions down to thousandths: the range a school chart is printed over,
 * either end of which is past what the columns of one page can name. The name
 * is looked up from the exponent rather than stored beside it, so a chart
 * cannot be configured with tens next to thousandths.
 */
const PLACE_NAMES = [
  "Millions",
  "Hundred thousands",
  "Ten thousands",
  "Thousands",
  "Hundreds",
  "Tens",
  "Ones",
  "Tenths",
  "Hundredths",
  "Thousandths",
];
const LARGEST_PLACE = 6;
const SMALLEST_PLACE = LARGEST_PLACE - (PLACE_NAMES.length - 1);

/** What the column for 10^power is called at the head of a place-value chart. */
export const placeName = (power: number): string =>
  PLACE_NAMES[LARGEST_PLACE - power] ?? "";

/**
 * A number a config asked for, as a whole number inside the bounds.
 *
 * Every `ChartConfig` field resolved in this module goes through it, because
 * every one of them can arrive from outside the build — a bookmarked link, a
 * sheet saved last term — and a range of `NaN` to `"lots"` has to produce a
 * chart rather than an exception four modules downstream. The two that are not
 * resolved here, `span` and `quadrants`, are guarded the same way by `planeOf`.
 */
function whole(value: unknown, fallback: number, low: number, high: number) {
  const asked = typeof value === "number" ? Math.round(value) : NaN;
  const chosen = Number.isFinite(asked) ? asked : fallback;
  return Math.max(low, Math.min(high, chosen));
}

/* ── The hundred chart ─────────────────────────────────────────────────── */

/** A hundred chart: where it starts, the shape it runs in, and its square. */
export type HundredChart = {
  from: number;
  /** The last number *printed*, which is the end of a complete row. */
  to: number;
  columns: number;
  rows: number;
  cell: Mil;
};

/**
 * The chart a config asks for, completed to whole rows.
 *
 * The range is what a parent sets and the rows are what it rounds to: a chart
 * asked for 1–105 prints 1–110, because a last row with five squares in it and
 * five squares missing is a chart a child fills in wrongly — the shape *is* the
 * lesson, and a ragged one teaches the opposite of it. Rounding up rather than
 * down, so every number asked for is on the paper.
 */
export function hundredChart(config: ChartConfig, box: Box): HundredChart {
  const from = whole(config.range?.min, 1, 0, 9000);
  const last = whole(config.range?.max, from + 99, from, from + 999);

  // As many whole rows as the range needs, and never more than the page can
  // print a legible square for. Capacity is arithmetic here exactly as it is
  // for problems (§4): the count is a request, and what fits is the answer.
  const wanted = Math.ceil((last - from + 1) / HUNDRED_COLUMNS);
  const rows = Math.max(1, Math.min(wanted, Math.floor(box.height / MIN_CELL)));
  const cell = Math.max(
    1,
    Math.min(
      MAX_CELL,
      Math.floor(box.width / HUNDRED_COLUMNS),
      Math.floor(box.height / rows),
    ),
  );

  return {
    from,
    to: from + rows * HUNDRED_COLUMNS - 1,
    columns: HUNDRED_COLUMNS,
    rows,
    cell,
  };
}

/**
 * The chart as a grid, printed or blank.
 *
 * One list of numbers, filed under `cells` when they are printed and under
 * `answers` when they are not — the same mechanism as the multiplication
 * square, and the reason the wall chart and the exercise are one build with
 * `answers` flipped rather than two families that could disagree about what
 * goes in square forty-seven.
 */
function hundredGrid(chart: HundredChart, filled: boolean): GridSpec {
  const numbers = Array.from({ length: chart.rows * chart.columns }, (_, i) =>
    String(chart.from + i),
  );
  return {
    kind: "chart",
    columns: chart.columns,
    rows: chart.rows,
    cell: chart.cell,
    cells: filled ? numbers : numbers.map(() => ""),
    ...(filled ? {} : { answers: numbers }),
  };
}

/* ── The number line ───────────────────────────────────────────────────── */

/**
 * The line a config asks for, and how many of it fit down the page.
 *
 * The range runs to a whole number of steps rather than to whatever was typed:
 * a line from 0 to 25 marked every 10 would draw its last tick two thirds of
 * the way along and leave the end of the axis unmarked, which is a line a child
 * counts wrongly. So the end moves *out* to the next tick — every number asked
 * for stays on the line — exactly as the hundred chart completes its last row.
 */
export function lineStrips(config: ChartConfig, box: Box): NumberLine[] {
  const from = whole(config.range?.min, 0, -999, 999);
  const last = whole(config.range?.max, from + 20, from + 1, from + 1000);
  const step = whole(config.step, 1, 1, last - from);
  const to = from + Math.ceil((last - from) / step) * step;

  // Every strip is the same line, so which ticks keep their number is worked
  // out once: a page of six copies to cut apart, rather than six scales to read.
  const line = { from, to, step, width: box.width };
  const labelled = { ...line, label: labelEvery(line) };
  const strips = Math.min(
    whole(config.strips, 1, 1, 12),
    Math.max(1, fitAcross(box.height, NUMBER_LINE_HEIGHT, BLOCK_GAP)),
  );
  return Array.from({ length: strips }, () => ({ ...labelled }));
}

/**
 * The strips, spread down the page with room to cut between them.
 *
 * Spacers rather than a margin on the block, because the air between two strips
 * is the sheet's own arithmetic and not the stylesheet's: what is left over
 * after the strips have taken their height is what there is, and dividing it is
 * the last thing this family does with the page. Capped, so that two strips are
 * two strips near the top of a page rather than one at each end of it.
 */
function stripBlocks(lines: NumberLine[], box: Box): Block[] {
  // Two flex gaps per spacer, not one: a spacer is a block, so putting one
  // between two strips buys `.sheet__blocks` a second gap to charge for. The
  // arithmetic that missed that printed a page of six strips an inch and a
  // half below the bottom margin, which looks perfect on screen.
  const spare =
    box.height -
    lines.length * NUMBER_LINE_HEIGHT -
    (2 * lines.length - 2) * BLOCK_GAP;
  const gap =
    lines.length > 1
      ? Math.max(
          0,
          Math.min(MAX_STRIP_GAP, Math.floor(spare / (lines.length - 1))),
        )
      : 0;

  return lines.flatMap((line, index) => [
    ...(index > 0 && gap > 0 ? [{ kind: "spacer" as const, height: gap }] : []),
    { kind: "numberline" as const, line },
  ]);
}

/* ── The place-value chart ─────────────────────────────────────────────── */

/** A place-value chart: which powers of ten it holds, and the box it draws. */
export type PlaceChart = {
  largest: number;
  smallest: number;
  rows: number;
  cell: Mil;
  row: Mil;
};

/**
 * The chart a config asks for.
 *
 * The columns are consecutive powers of ten and the arithmetic says so: the
 * count is `largest − smallest + 1`, which is the off-by-one this sheet would
 * otherwise make — a chart from hundreds to ones has three columns, not two.
 *
 * Its rows are the one place in the shop where a grid is not squares. A column
 * is as wide as the word at the head of it and a row is one digit tall, so a
 * square cell would print either a chart a third of the width of the page or
 * one that ran off the bottom of it. `GridSpec.row` is that, stated.
 */
export function placeChart(config: ChartConfig, box: Box): PlaceChart {
  const largest = whole(
    config.places?.largest,
    2,
    SMALLEST_PLACE + 1,
    LARGEST_PLACE,
  );
  const smallest = whole(config.places?.smallest, 0, SMALLEST_PLACE, largest);

  // A row is a line a child writes a digit on, which is a length the rest of
  // the shop already has a name for — and never less than the type needs.
  const least = Math.max(answerLine(config.fontPt), MIN_PLACE_ROW);
  const rows = Math.max(
    1,
    Math.min(
      whole(config.rows, 8, 1, 40),
      // Less one, because the headings are the grid's first row.
      Math.floor(box.height / least) - 1,
    ),
  );

  return {
    largest,
    smallest,
    rows,
    cell: Math.floor(box.width / (largest - smallest + 1)),
    // The rows stretch to fill what is left, between the two bounds. The count
    // above was capped against `least`, so the floor here can never overflow
    // the page even when the type is set as large as a config may ask for.
    row: Math.max(
      least,
      Math.min(MAX_PLACE_ROW, Math.floor(box.height / (rows + 1))),
    ),
  };
}

/**
 * The chart as a grid: the headings across the top, and blank rows under them.
 *
 * The headings are *in* the grid rather than above it, and that is the whole of
 * how a heading is guaranteed to sit over the column it names. A row of words
 * laid out beside the drawing would be two things to keep aligned, and the
 * failure — "Tens" printed over the ones column — is one a child copies into
 * their arithmetic rather than one anybody notices on screen.
 */
function placeGrid(chart: PlaceChart): GridSpec {
  const columns = chart.largest - chart.smallest + 1;
  const headings = Array.from({ length: columns }, (_, index) =>
    placeName(chart.largest - index),
  );

  return {
    kind: "chart",
    columns,
    rows: chart.rows + 1,
    cell: chart.cell,
    row: chart.row,
    cells: [...headings, ...Array<string>(columns * chart.rows).fill("")],
    // The rule under the headings, and the decimal point: the heavier upright
    // goes immediately right of the ones column, which is exactly where a
    // decimal point is written. On a chart that stops at ones that is the right
    // edge of the paper's grid, which is the same statement — there is nothing
    // smaller on it.
    origin: {
      column: Math.max(0, Math.min(columns, chart.largest + 1)),
      row: 1,
    },
  };
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

/** What each reference is called at the head of its own page. */
const TITLE: Record<ChartStyle, string> = {
  hundred: "Hundred chart",
  "number-line": "Number line",
  coordinate: "Coordinate grid",
  "place-value": "Place-value chart",
};

/**
 * The title, which for one of the four is a question about the range.
 *
 * A chart of twenty numbers is not a hundred chart and must not say it is —
 * ten rows of ten is what the phrase means, and it means it whether the chart
 * starts at nought or at one. Anything else is a number chart and says which
 * numbers, because that is the whole of what a parent is looking at.
 */
const hundredName = (chart: HundredChart): string =>
  chart.rows === HUNDRED_COLUMNS ? TITLE.hundred : "Number chart";

function chartTitle(config: ChartConfig, box: Box): string {
  if (config.style !== "hundred") {
    // `own` rather than a plain lookup, for the reason `rulingOf` uses it: a
    // style arrives from a saved sheet, and `"constructor"` is a truthy
    // function rather than a title.
    return own(TITLE, config.style, TITLE.hundred);
  }
  const chart = hundredChart(config, box);
  return chart.rows === HUNDRED_COLUMNS
    ? TITLE.hundred
    : `${hundredName(chart)}, ${chart.from} to ${chart.to}`;
}

/**
 * The one sheet here with something withheld.
 *
 * A blank hundred chart is an exercise and its key is the filled chart. The
 * other three are blank forms: there is nothing on them to be right or wrong
 * about, and a page printed a second time under the word "Answer key" would be
 * noise on a parent's printer. `phonicsKeyed` is the same call for the same
 * reason, and both exist so a catalog page and the family cannot disagree.
 */
export const chartKeyed = (config: ChartConfig): boolean =>
  config.style === "hundred" && config.filled !== true;

/**
 * The instruction, which only the sheet that withholds something carries.
 *
 * "One to a square" rather than "fill in the missing numbers", because on this
 * sheet they are all missing — and it says nothing about the range, which is
 * what keeps it a string the chrome can be measured against before the chart
 * has been worked out. (The range is on the title.)
 */
const instructionOf = (config: ChartConfig): string | undefined =>
  config.instructions ??
  (chartKeyed(config) ? "Write the numbers in, one to a square." : undefined);

/**
 * What the chrome will hold, so that the page can be reserved for it.
 *
 * The same move every generating family makes, and it is not optional: a family
 * prints a title whatever the config says, and `chromeHeight` reserves for one
 * only if the *options* it is handed carry one. Passing the config straight in
 * under-reserves by the height of a title row — `.sheet` is `min-height`, so
 * nothing overflows visibly and the page simply grows past eleven inches and
 * prints its last inch on a second sheet of paper.
 *
 * The title here need not be the words that end up on the page: the reservation
 * is one row whatever it says, and the words are chosen once the box is known
 * (`chartTitle` reads how many rows a chart came to). The instruction is the
 * real string, because that one *is* measured — it wraps.
 */
function headerOf(config: ChartConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? TITLE.hundred,
    instructions: instructionOf(config),
  };
}

/**
 * The page the blocks get, once the header and the footer have taken theirs.
 *
 * The footer is declared with the note a key prints, per `FootLine.note`: a key
 * is laid out against the same box as its sheet, so a footer that wraps to two
 * rows on the key and one on the sheet is a key whose last row is on a second
 * page.
 *
 * Unconditionally, rather than only where `chartKeyed` says there is an answer
 * to reveal, because `SheetSpec.key` stamps the note on any sheet it is handed
 * — a parent may print the key of a coordinate grid, and what they get is the
 * same paper with a word in the footer. It costs one footer row on the seven
 * sheets that have nothing to reveal, and only at type sizes where that row
 * wraps at all; at every size a catalog page prints, it costs nothing. That is
 * the cheap side to be wrong on: a row over-reserved is a rule line, and a row
 * under-reserved is a second sheet of paper.
 */
const chartBox = (config: ChartConfig): Box =>
  sheetBlockBox(headerOf(config), false, { note: "Answer key" });

export function buildChartSheet(config: ChartConfig, seed: number): Sheet {
  const box = chartBox(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: config.title ?? chartTitle(config, box),
      instructions: instructionOf(config),
      fields: config.fields,
    },
    blocks: chartBlocks(config, box),
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

/** Which drawing this is. The one place `ChartStyle` is narrowed. */
function chartBlocks(config: ChartConfig, box: Box): Block[] {
  switch (config.style) {
    case "number-line":
      return stripBlocks(lineStrips(config, box), box);
    case "coordinate":
      return [
        {
          kind: "grid",
          grid: planeOf(config.quadrants ?? 1, box, {
            span: config.span,
            cell: MAX_PLANE_CELL,
            // The whole page: a blank plane is the sheet, where the one under a
            // question is half of it and the questions are the rest.
            share: 1,
          }).grid,
        },
      ];
    case "place-value":
      return [{ kind: "grid", grid: placeGrid(placeChart(config, box)) }];
    case "hundred":
    default:
      return [
        {
          kind: "grid",
          grid: hundredGrid(hundredChart(config, box), config.filled === true),
        },
      ];
  }
}

/**
 * One line naming the sheet, in the words a teacher says out loud.
 *
 * Each says the number that makes it the sheet somebody asked for rather than
 * one like it: which numbers the chart runs through, what the line counts in,
 * how far the axes go, and which places the columns hold.
 */
export function describeChart(config: ChartConfig): string {
  const box = chartBox(config);
  switch (config.style) {
    case "number-line": {
      const [line] = lineStrips(config, box);
      const marks = ticks(line);
      return `Number line from ${line.from} to ${line.to}, a tick every ${line.step} — ${marks.length} of them`;
    }
    case "coordinate": {
      const plane = planeOf(config.quadrants ?? 1, box, { span: config.span });
      return plane.negative
        ? `Coordinate grid, all four quadrants, −${plane.span} to ${plane.span}`
        : `Coordinate grid, the first quadrant, 0 to ${plane.span}`;
    }
    case "place-value": {
      const chart = placeChart(config, box);
      return `Place-value chart, ${placeName(chart.largest).toLowerCase()} to ${placeName(chart.smallest).toLowerCase()}`;
    }
    case "hundred":
    default: {
      const chart = hundredChart(config, box);
      // The same name the sheet prints at the top of itself, so the line in the
      // record book and the paper in a parent's hand say the same thing — and
      // never "hundred chart" over a chart of thirty numbers.
      const named = `${hundredName(chart)}, ${chart.from} to ${chart.to}`;
      return config.filled === true
        ? `${named}, filled in`
        : `${named}, blank to fill in`;
    }
  }
}

export const CHART_SHEET: SheetSpec<ChartConfig> = {
  id: "chart",
  label: "Charts, number lines and grids",
  world: SHEET_WORLD,
  build: buildChartSheet,
  // The filled chart, on the one sheet that has an answer at all. On the other
  // three `answers` finds nothing to reveal, so a key is the same page again —
  // which is what `chartKeyed` exists to let a page decide before printing it.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeChart,
};
