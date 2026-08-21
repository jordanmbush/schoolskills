/**
 * The blank maths references: the paper a lesson is done *against*.
 *
 * A hundred chart, a number line, a coordinate grid and a place-value chart —
 * the "templates" tier of §11, where an off-by-one is a sheet that teaches
 * something false and does it in ink, so every count here is verified off the
 * finished blocks rather than off the arithmetic that made them.
 *
 * Nothing on these four sheets is drawn from the seed, which is not an
 * oversight: a hundred chart is the same hundred numbers in the same order
 * every time it is printed. The seed still rides in the footer, because the
 * sheet is still reproducible from it.
 */
import { sheetBlockBox } from "../chrome";
import { BLOCK_GAP, answerLine, fitAcross, type Box } from "../layout";
import { NUMBER_LINE_HEIGHT, labelEvery, ticks } from "../numberline";
import { inches, own, whole } from "../paper";
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
   Two bounds rather than one size: the largest stops a three-column chart
   printing squares the size of a fist, and the smallest — which the row and
   strip counts below are capped against — stops a thousand-row one printing
   squares nothing can be written in. Between them a chart is as large as the
   paper allows, which is the right default for something that goes on a wall. */

const MAX_CELL: Mil = inches(0.8);
const MIN_CELL: Mil = inches(0.2);

/** And on a coordinate grid, which has no numerals inside its squares. */
const MAX_PLANE_CELL: Mil = inches(0.75);

/**
 * A hundred chart is ten to a row, and that is not a setting: every column is
 * one digit repeating and moving down is adding ten, which is the whole of what
 * the chart teaches. A chart nine or eleven wide has none of that in it, so the
 * range is the option and the width is the chart.
 */
const HUNDRED_COLUMNS = 10;

/**
 * The air left round a number-line strip: scissors and a hand, and the room to
 * draw the hops a child counts in above the line. Capped rather than simply
 * divided, or two strips are one at each end of the paper.
 */
const MAX_STRIP_GAP: Mil = inches(1.25);

/**
 * How tall a row of a place-value chart is, at the least and at the most.
 *
 * Between them the rows stretch to fill the page, which is what makes the same
 * block a *mat* at four rows and a chart at twelve.
 */
const MIN_PLACE_ROW: Mil = inches(0.4);
const MAX_PLACE_ROW: Mil = inches(1.2);

/**
 * The places a chart can hold, as powers of ten, largest first.
 *
 * The name is looked up from the exponent rather than stored beside it, so a
 * chart cannot be configured with tens next to thousandths.
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

/* Every `ChartConfig` field resolved in this module goes through `whole`,
   because every one of them can arrive from outside the build — a bookmarked
   link, a sheet saved last term — and a range of `NaN` to `"lots"` has to
   produce a chart rather than an exception four modules downstream. The two
   that are not resolved here, `span` and `quadrants`, are guarded the same way
   by `planeOf`.                                                             */

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
 * A chart asked for 1–105 prints 1–110: the shape *is* the lesson, and a last
 * row with five squares missing out of it is a chart a child fills in wrongly.
 * Rounding up rather than down, so every number asked for is on the paper.
 */
export function hundredChart(config: ChartConfig, box: Box): HundredChart {
  const from = whole(config.range?.min, 1, 0, 9000);
  const last = whole(config.range?.max, from + 99, from, from + 999);

  // As many whole rows as the range needs, and never more than the page can
  // print a legible square for: the count is a request, and what fits is the
  // answer (§4).
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
 * One list of numbers, filed under `cells` when they are printed and under
 * `answers` when they are not — which is what makes the wall chart and the
 * exercise one build with `answers` flipped, rather than two that could
 * disagree about what goes in square forty-seven.
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
 * 0 to 25 marked every 10 would draw its last tick two thirds of the way along
 * and leave the end of the axis unmarked. The end moves *out* to the next tick,
 * so every number asked for stays on the line.
 */
export function lineStrips(config: ChartConfig, box: Box): NumberLine[] {
  const from = whole(config.range?.min, 0, -999, 999);
  const last = whole(config.range?.max, from + 20, from + 1, from + 1000);
  const step = whole(config.step, 1, 1, last - from);
  const to = from + Math.ceil((last - from) / step) * step;

  // Every strip is the same line, so which ticks keep their number is worked
  // out once: a page of six copies to cut apart, not six scales to read.
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
 * is the sheet's own arithmetic and not the stylesheet's. Capped, so that two
 * strips are two strips near the top of a page rather than one at each end.
 */
function stripBlocks(lines: NumberLine[], box: Box): Block[] {
  // Two flex gaps per spacer, not one: a spacer is a block, so putting one
  // between two strips buys `.sheet__blocks` a second gap to charge for (§11).
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
 * The columns are consecutive powers of ten, so the count is
 * `largest − smallest + 1`: a chart from hundreds to ones has three columns,
 * not two, and that is the off-by-one this sheet would otherwise make.
 *
 * Its rows are the one place in the shop where a grid is not squares — a column
 * is as wide as the word at the head of it and a row is one digit tall (§11).
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
    // The count above was capped against `least`, so this floor can never
    // overflow the page even when the type is as large as a config may ask.
    row: Math.max(
      least,
      Math.min(MAX_PLACE_ROW, Math.floor(box.height / (rows + 1))),
    ),
  };
}

/**
 * The chart as a grid: the headings across the top, and blank rows under them.
 *
 * The headings are *in* the grid rather than above it, which is the whole of
 * how one is guaranteed to sit over the column it names. A row of words laid
 * out beside the drawing would be two things to keep aligned, and the failure —
 * "Tens" over the ones column — is one a child copies into their arithmetic.
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
    // goes immediately right of the ones column, which is where a decimal point
    // is written. On a chart that stops at ones that is the right edge of the
    // grid, which says the same thing — there is nothing smaller on it.
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
 * A chart of twenty numbers is not a hundred chart and must not say it is: ten
 * rows of ten is what the phrase means, whether the chart starts at nought or
 * at one. Anything else is a number chart, and says which numbers.
 */
const hundredName = (chart: HundredChart): string =>
  chart.rows === HUNDRED_COLUMNS ? TITLE.hundred : "Number chart";

function chartTitle(config: ChartConfig, box: Box): string {
  if (config.style !== "hundred") {
    // `own` rather than a plain lookup: a style arrives from a saved sheet, and
    // `"constructor"` is a truthy function rather than a title.
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
 * other three are blank forms, and a second copy of one under the word "Answer
 * key" would be noise on a parent's printer. Stated as a function, like
 * `phonicsKeyed`, so a catalog page and the family cannot disagree.
 */
export const chartKeyed = (config: ChartConfig): boolean =>
  config.style === "hundred" && config.filled !== true;

/**
 * The instruction, which only the sheet that withholds something carries.
 *
 * "One to a square" rather than "fill in the missing numbers", because on this
 * sheet they are all missing. It says nothing about the range — which is what
 * keeps it a string the chrome can be measured against before the chart has
 * been worked out. (The range is on the title.)
 */
const instructionOf = (config: ChartConfig): string | undefined =>
  config.instructions ??
  (chartKeyed(config) ? "Write the numbers in, one to a square." : undefined);

/**
 * What the chrome will hold, so that the page can be reserved for it.
 *
 * A family that printed a title whatever the config said and passed the config
 * straight in would under-reserve by a title row (§11).
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
 * is laid out against the same box as its sheet, so a footer that wraps on one
 * and not the other is a key whose last row is on a second page. Unconditional,
 * because `SheetSpec.key` stamps the note on any sheet it is handed — and a row
 * over-reserved costs a rule line where a row under-reserved costs paper.
 */
const chartBox = (config: ChartConfig): Box =>
  sheetBlockBox(headerOf(config), false, { note: "Answer key" });

function buildChartSheet(config: ChartConfig, seed: number): Sheet {
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
 * One line naming the sheet, in the words a teacher says out loud — with the
 * number that makes it the sheet somebody asked for rather than one like it.
 */
function describeChart(config: ChartConfig): string {
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
      // The same name the sheet prints at the top of itself, so the record book
      // and the paper in a parent's hand never disagree.
      const named = `${hundredName(chart)}, ${chart.from} to ${chart.to}`;
      return config.filled === true
        ? `${named}, filled in`
        : `${named}, blank to fill in`;
    }
  }
}

export const CHART_SHEET: SheetSpec<ChartConfig> = {
  world: SHEET_WORLD,
  build: buildChartSheet,
  // The filled chart, on the one sheet that has an answer at all. On the other
  // three `answers` finds nothing to reveal, so a key is the same page again.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeChart,
};
