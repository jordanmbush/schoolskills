/**
 * The reference sheets the Print Shop has set, and the words that go round them.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two pages
 * share — `charts/[slug].astro`, which prerenders one reference per entry, and
 * `charts/index.astro`, which is the hub — rather than a route of its own.
 * `_catalog.ts` does that job for paper, `_maths.ts` for the worksheets,
 * `_phonics.ts` for the sounds, and so on down the shelf.
 *
 * **Eight pages, and eight is the point rather than a start.** §8 asks the
 * catalog to be bounded, and this is a shelf where being greedy would be easy:
 * "number line to 30", "number line to 50", "hundred chart to 120" and forty
 * more are all real queries, and every one of them is a sheet on this shelf
 * with one number changed. What is here is the eight a parent actually asks
 * for; everything else is a stepper in the builder, which is where choosing
 * belongs.
 *
 * **Two of them are already next door.** A multiplication grid, blank and
 * filled, is `/printables/multiplication-chart` — the multiplication family
 * with `style: "grid"` on it — and graph, dot and isometric paper are the grid
 * end of the paper shelf. Neither is rebuilt here. A second family that drew a
 * times-table square would be a second answer to what goes in square forty-two,
 * and the hub links to both rather than pretending they are missing.
 *
 * **One stock, as with maths, spelling and grammar.** Nothing on these sheets
 * is a *stated* measurement — there is no ⅝ rule to be scaled into a ⅗ rule by
 * a printer loaded with A4, and a hundred chart four per cent smaller is still
 * a hundred chart with a hundred squares in it. The squares on graph paper are
 * the case where that is not true, and graph paper is on the shelf that prints
 * both stocks for exactly that reason.
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import { chartKeyed } from "@/engine/sheets/templates/charts";
import type { ChartConfig, HeaderField } from "@/engine/sheets/types";

import { benchHref, paperOf, shelve } from "./_catalog";

/** How the hub groups the shelf: what a child is counting, and where. */
export type ChartGroup = "counting" | "places" | "plotting";

export type ChartSheet = {
  /** The route under /printables/charts, and the head term it answers. */
  slug: string;
  /** How it is listed on a hub. */
  name: string;
  /** How it is labelled in the row of neighbouring sheets. A few words. */
  short: string;
  /** The page's `<h1>`. */
  heading: string;
  /** The query this page exists to answer, in the words a parent types. */
  keyword: string;
  /** One sentence of what is on the sheet. Used in the description and hubs. */
  summary: string;
  /** The lead paragraph: what the sheet is, stated plainly. */
  lead: string;
  /**
   * Two things that are true of this sheet and not of the one beside it.
   *
   * The sheet is prerendered directly under this prose (§8), which makes a
   * number quoted in it a claim about the paper rather than a description of
   * it — a reader can look down the page and count. `_charts.test.ts` holds
   * every number written in words to what the sheet under it actually draws.
   */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: ChartGroup;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: ChartConfig;
};

/**
 * The seed every sheet on this shelf is built from, and it never moves.
 *
 * It decides nothing at all here, which is the honest thing to say about it:
 * not one of these four sheets draws from it, because a hundred chart is the
 * same hundred numbers in the same order every time anybody prints one. It is
 * still printed in the footer, because a sheet is reproducible from its seed
 * and a reader has no way of knowing which sheets ignore theirs (§7).
 */
export const CHART_SEED = 1;

/**
 * Printed blank, always — on the sheets that carry one at all.
 *
 * A worksheet asks for a name because a teacher has thirty of them to hand
 * back. Nothing here holds one (§1): these are two ruled lines on paper and
 * there is nowhere in a config to put a value for either. What varies is
 * whether they are drawn: a chart a child works on has them, and a wall chart
 * and a strip of paper about to be cut into six do not.
 */
const WORKED: HeaderField[] = ["name", "date"];
const PINNED: HeaderField[] = [];

/** A reference sheet on Letter, portrait. */
const reference = (
  fields: HeaderField[],
  extra: Partial<ChartConfig>,
): ChartConfig => ({
  kind: "chart",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields,
  style: "hundred",
  ...extra,
});

export const CHART_SHEETS: ChartSheet[] = [
  /* ── Counting ───────────────────────────────────────────────────────── */
  {
    slug: "hundred-chart",
    name: "Hundred chart",
    short: "Hundred chart",
    heading: "Printable hundred chart",
    keyword: "Free printable hundred chart",
    summary:
      "The numbers 1 to 100 in ten rows of ten, printed at three quarters of an inch to a square — the wall chart, filled in.",
    lead: "One hundred squares, ten to a row, numbered 1 to 100. Every column is one digit repeating, every row is a count of ten, and moving down the chart is adding ten — which is the whole of what it teaches and the reason it is never nine or eleven squares wide.",
    notes: [
      "The chart is worth having on a wall before it is worth being a worksheet. A child who is asked “what is 34 and 10?” and can put a finger on 34 and move it straight down has been shown something a right answer would not have given them: that the tens digit is the row and the units digit is the column, and that adding ten is a move rather than a sum.",
      "Print the blank one beside it and the pair does most of Year 1. Counting in twos, fives and tens are three patterns a child can colour in; the multiples of nine come out as a diagonal; and the numbers that will not make a rectangle of counters — the primes — are the ones with nothing shaded around them.",
    ],
    teaches: "Counting, place value and number patterns to 100",
    ages: "Ages 5–8",
    group: "counting",
    config: reference(PINNED, {
      style: "hundred",
      range: { min: 1, max: 100 },
      filled: true,
    }),
  },
  {
    slug: "blank-hundred-chart",
    name: "Blank hundred chart",
    short: "Blank chart",
    heading: "Printable blank hundred chart",
    keyword: "Free printable blank hundred chart",
    summary:
      "The same hundred squares with the numbers left out, to be filled in — and the completed chart on the page behind it.",
    lead: "A hundred empty squares in ten rows of ten. Filling one in is a lesson rather than a copying exercise: a child who has to write 39 and then 40 finds out where the tens turn over, and finds it out in the one place on the chart where the pattern of the row breaks.",
    notes: [
      "The completed chart is the second page, so one print gives both. Mark it by looking down the columns rather than along the rows — every column should be the same digit all the way down, and a column that goes 7, 17, 27, 38 has a mistake in it that is visible from across the room.",
      "It is also the fastest diagnostic there is for where counting has actually got to. A child fills the first two rows quickly, slows at 29, and stops somewhere in the forties; where they stop is the number the week is about, and no worksheet of sums would have told you which one it was.",
    ],
    teaches: "Writing the numbers to 100 in order",
    ages: "Ages 5–7",
    group: "counting",
    config: reference(WORKED, {
      style: "hundred",
      range: { min: 1, max: 100 },
      filled: false,
    }),
  },
  {
    slug: "number-line",
    name: "Number line, 0 to 20",
    short: "0 to 20",
    heading: "Printable number line, 0 to 20",
    keyword: "Free printable number line 0 to 20",
    summary:
      "Six identical strips numbered 0 to 20, a tick every 1, spaced to cut apart with scissors.",
    lead: "The line a child adds on before they add: six and three is six hops and then three more. Six copies of it down the page, every one the same scale, so a strip can be cut out for a desk and another for a pencil case without the two disagreeing about how far apart the numbers are.",
    notes: [
      "Twenty-one ticks, not twenty. It sounds like pedantry and it is the difference between a line a child can count on and one they cannot: the numbers are on the ticks, the spaces between them are the hops, and a line to 20 has twenty hops and twenty-one places to stand. Every strip on this page is drawn from that arithmetic rather than from a spacing that looked right.",
      "There is room above each strip to draw the hops in. That is what turns the line from a lookup table into a piece of working: a child who draws two arcs of five for 5 + 5 and lands on 10 has recorded how they got there, and the arcs are what you look at when the answer is wrong.",
    ],
    teaches: "Counting on and back within 20",
    ages: "Ages 4–7",
    group: "counting",
    config: reference(PINNED, {
      style: "number-line",
      range: { min: 0, max: 20 },
      step: 1,
      strips: 6,
    }),
  },
  {
    slug: "number-line-to-100",
    name: "Number line to 100",
    short: "To 100",
    heading: "Printable number line to 100",
    keyword: "Free printable number line to 100",
    summary:
      "Three strips running 0 to 100 with a tick at every number and a printed numeral every five.",
    lead: "A hundred and one ticks across seven and a half inches, numbered every five. Every whole number keeps its tick — the counting is what the line is for — and only the numerals thin out, because a hundred and one of them across a sheet of Letter is a smudge rather than a scale.",
    notes: [
      "The unnumbered ticks are drawn shorter, exactly as they are on a ruler, so counting between two printed numbers is possible rather than guesswork. That is the skill this line is actually for: finding 68 on a line marked at 65 and 70 is reading a scale, and it is the same thing a child will later do with a measuring jug and a thermometer.",
      "Three strips rather than six, because a line to 100 is a reference to keep rather than something to cut up for a table of children. If a different interval is wanted — every 2 for even numbers, every 10 for rounding — the sheet is one control away in the builder, and the ticks move with it.",
    ],
    teaches: "Reading a scale, and counting to 100",
    ages: "Ages 6–9",
    group: "counting",
    config: reference(PINNED, {
      style: "number-line",
      range: { min: 0, max: 100 },
      step: 1,
      strips: 3,
    }),
  },

  /* ── Place value ────────────────────────────────────────────────────── */
  {
    slug: "place-value-chart",
    name: "Place value chart",
    short: "Place value",
    heading: "Printable place value chart",
    keyword: "Free printable place value chart",
    summary:
      "Four columns — thousands, hundreds, tens and ones — with eight rows to write numbers into, one digit to a box.",
    lead: "Thousands, hundreds, tens and ones, headed and ruled, with eight rows underneath. One digit to a box is the whole rule, and it is the rule that makes a number readable: 407 written into the columns has an empty tens box, which is what the nought in it is for.",
    notes: [
      "The headings are printed inside the grid rather than above it, which is not a design decision so much as a correctness one. A row of words laid out beside the drawing is two things that have to stay lined up, and a chart with “Tens” sitting half a column left of the tens is a mistake a child copies into their arithmetic rather than one anybody notices.",
      "It does the work of base-ten blocks on paper. Write 342 into one row and 138 into the next, add each column, and the moment ten ones have to become one ten is a thing that happens in a box rather than a rule to be remembered — which is the same exchange the blocks make, without there being any blocks.",
    ],
    teaches: "Place value to thousands",
    ages: "Ages 6–10",
    group: "places",
    config: reference(WORKED, {
      style: "place-value",
      places: { largest: 3, smallest: 0 },
      rows: 8,
    }),
  },
  {
    slug: "decimal-place-value-chart",
    name: "Decimal place value chart",
    short: "Decimals",
    heading: "Printable decimal place value chart",
    keyword: "Free printable decimal place value chart",
    summary:
      "Six columns from hundreds down to thousandths, with the decimal point ruled where it belongs and eight rows to write in.",
    lead: "Hundreds, tens, ones, tenths, hundredths and thousandths, with a heavier rule between the ones and the tenths. That rule is the decimal point, drawn where the point is actually written, and it is the thing the whole chart exists to make obvious.",
    notes: [
      "The symmetry is the lesson and it is easy to state wrongly. Tenths sit beside ones, not beside tens — the mirror is about the point rather than about the ones column — and a chart that lines the columns up under their headings is a chart on which that can be seen rather than asserted.",
      "It is the sheet to reach for the first time a child writes 0.7 and 0.70 and is told they are the same number. Written into the columns, the second one has a nought in the hundredths box and nothing else changes, which is a more convincing argument than any sentence about trailing zeros.",
    ],
    teaches: "Decimal place value to thousandths",
    ages: "Ages 8–12",
    group: "places",
    config: reference(WORKED, {
      style: "place-value",
      places: { largest: 2, smallest: -3 },
      rows: 8,
    }),
  },

  /* ── Plotting ───────────────────────────────────────────────────────── */
  {
    slug: "coordinate-grid",
    name: "Coordinate grid, first quadrant",
    short: "First quadrant",
    heading: "Printable coordinate grid",
    keyword: "Free printable coordinate grid",
    summary:
      "A first-quadrant grid with both axes numbered 1 to 10, and nothing negative anywhere on it.",
    lead: "Two axes running from nought to ten, numbered along both, with the numerals printed in a margin square outside the grid rather than on top of the ruling. Every point on it has two positive whole numbers for coordinates, which is the whole of what makes it the first grid to hand a child.",
    notes: [
      "Nothing on this sheet is negative, and that is a choice rather than a limitation. A plane with four quadrants is not a harder version of this one — it is the week negative numbers arrive — and giving it to a child who has not met them is setting an impossible question rather than a stretching one.",
      "The numbers count the lines, not the squares. A point is a crossing of two rules and not the middle of a box, which is the single commonest thing to get wrong when this is taught at home, and it is why the numerals here sit against the gridlines they name.",
    ],
    teaches: "Plotting and reading coordinates",
    ages: "Ages 7–11",
    group: "plotting",
    config: reference(WORKED, {
      style: "coordinate",
      quadrants: 1,
      span: 10,
    }),
  },
  {
    slug: "four-quadrant-graph-paper",
    name: "Four quadrant grid",
    short: "Four quadrants",
    heading: "Printable four quadrant graph paper",
    keyword: "Free printable four quadrant graph paper",
    summary:
      "Both axes running −10 to 10, crossing in the middle of the page, with every gridline numbered.",
    lead: "The full plane: two axes crossing at the origin with ten squares out in each of the four directions, and the numbers running −10 to 10 along both. Nought is left unwritten, because the place where the two heavy rules cross is not something anybody needs telling.",
    notes: [
      "This is the paper for reflecting and translating shapes as much as for plotting points. A triangle drawn in the first quadrant and reflected in the y axis is a thing a child can check by counting squares, and counting squares is exactly what the grid is there to make possible.",
      "It is also where a straight-line graph starts to be worth drawing. Plot y = 2x − 3 on this and the line leaves the first quadrant at the bottom, which is the fact that makes the negative half of the paper feel necessary rather than decorative.",
    ],
    teaches: "The coordinate plane, and negative coordinates",
    ages: "Ages 9–13",
    group: "plotting",
    config: reference(WORKED, {
      style: "coordinate",
      quadrants: 4,
      span: 10,
    }),
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const CHART_GROUPS: Array<{
  id: ChartGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "counting",
    label: "Counting",
    blurb: "The two references a child counts on: a chart, and a line.",
  },
  {
    id: "places",
    label: "Place value",
    blurb: "Columns to write a number into, one digit to a box.",
  },
  {
    id: "plotting",
    label: "Plotting",
    blurb: "Axes to find a point on, with and without negative numbers.",
  },
];

/** Whether this sheet's answer key says anything its sheet doesn't. */
export const keyed = (sheet: ChartSheet): boolean => chartKeyed(sheet.config);

/** The route a sheet prints at. One stock, so one route — see the note above. */
export const pathFor = (sheet: ChartSheet): string =>
  `/printables/charts/${sheet.slug}`;

/** The builder, opened on this sheet. */
export const builderHref = (sheet: ChartSheet): string =>
  benchHref(sheet.config, CHART_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function chartShelf(): Array<{
  id: ChartGroup;
  label: string;
  blurb: string;
  sheets: ChartSheet[];
}> {
  return shelve(CHART_GROUPS, CHART_SHEETS);
}
