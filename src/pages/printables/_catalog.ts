/**
 * The paper the Print Shop has set, and the words that go round it.
 *
 * **The slugs are curated; the sheets are generated** (§8). The engine can rule
 * paper any way §5 describes; this file names the ones a parent searches for,
 * and the rest arrive with the builder.
 *
 * The line that sorts a page from a permutation is whether it is *different
 * paper*. A quarter-inch square and a centimetre square are two different
 * things to count on, and both are searched for by name; five millimetres and a
 * fifth of an inch are the same square to within three thousandths of an inch,
 * so one of them is a page and the other is a sentence on it.
 *
 * Every entry is printed on both stocks, and each stock is a route of its own,
 * because a ruling *is* a measurement (§8).
 */
import { DEFAULT_FONT_PT, GRID_PITCHES } from "@/engine/sheets/paper";
import { encodeSharedSheet } from "@/engine/sheets/share";
import type {
  HeaderField,
  Paper,
  PaperConfig,
  PaperSize,
  Rule,
  SheetConfig,
} from "@/engine/sheets/types";

/** How the hub groups the shelf. Three shapes of paper, not three subjects. */
export type PaperGroup = "notebook" | "handwriting" | "grid";

export type PaperSheet = {
  /** The route under /printables, and the head term it is written to answer. */
  slug: string;
  /** How it is listed on the hub. */
  name: string;
  /** How it is labelled in the row of every ruling. A few characters. */
  short: string;
  /** The page's `<h1>`. */
  heading: string;
  /** The query this page exists to answer, in the words a parent types. */
  keyword: string;
  /** One sentence of what the paper is. Used in the description and the hub. */
  summary: string;
  /** The lead paragraph: the geometry, stated plainly. */
  lead: string;
  /** Two things that are true of this ruling and not of the one beside it. */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: PaperGroup;
  rule: Rule;
};

export type Stock = {
  id: PaperSize;
  label: string;
  /** The dimensions, said the way that stock's users say them. */
  size: string;
  /** The path segment under the slug. Empty for the default. */
  path: string;
};

/**
 * Letter first because most of the audience is American, and A4 second because
 * the rest of it is not — a sheet whose last rule falls off the bottom of the
 * page is worse than no sheet at all (§4).
 */
export const STOCKS: Stock[] = [
  { id: "letter", label: "US Letter", size: "8.5 × 11 inches", path: "" },
  { id: "a4", label: "A4", size: "210 × 297 mm", path: "a4" },
];

export const PAPER_SHEETS: PaperSheet[] = [
  {
    slug: "lined-paper",
    name: "Lined paper — wide ruled",
    short: "Wide ruled",
    heading: "Lined paper, wide ruled",
    keyword: "Free printable lined paper, wide ruled",
    summary:
      "Wide ruled lined paper: rules 11/32 of an inch apart, with a margin line an inch and a quarter from the edge.",
    lead: "The paper a school notebook is printed on. Rules eleven thirty-seconds of an inch apart, and a margin line an inch and a quarter in from the left, exactly where the pad has it.",
    notes: [
      "Wide ruled is the default in American classrooms up to about eleven, and it is the one to print if you are not sure which you were asked for. The sixteenth of an inch it has over college ruled is the difference between handwriting that fits between the lines and handwriting that is squeezed into them.",
      "The margin line is not decoration — it is where the date, the question number and a teacher's tick go. Keeping it at the same 1¼ inches as a notebook means a page printed here and a page torn out of the pad sit in the same folder without looking like two different things.",
    ],
    teaches: "Handwriting and note taking",
    ages: "Ages 6–11",
    group: "notebook",
    rule: { style: "wide" },
  },
  {
    slug: "college-ruled-paper",
    name: "College ruled paper",
    short: "College ruled",
    heading: "College ruled paper",
    keyword: "Free printable college ruled paper",
    summary:
      "College ruled paper: rules 9/32 of an inch apart, with the same 1¼-inch margin line.",
    lead: "The narrower of the two notebook rules — nine thirty-seconds of an inch — with the same margin line as wide ruled and about six more lines on the page.",
    notes: [
      "College ruled is what secondary-school and university notebooks are printed at, and what a teacher usually means by “lined paper” from around Year 6 upwards. More words to a page is the whole of the difference.",
      "If handwriting is still growing into the line, print the wide ruled sheet instead. Narrow rules do not make writing neater; they make a child write smaller than they can control, which is the opposite of the thing being practised.",
    ],
    teaches: "Note taking",
    ages: "Ages 11+",
    group: "notebook",
    rule: { style: "college" },
  },
  {
    slug: "narrow-ruled-paper",
    name: "Narrow ruled paper",
    short: "Narrow ruled",
    heading: "Narrow ruled paper",
    keyword: "Free printable narrow ruled paper",
    summary:
      "Narrow ruled paper: quarter-inch rules, and no margin line at all.",
    lead: "A quarter of an inch between the rules and no margin line — the tightest of the notebook rules, and the most words on a page.",
    notes: [
      "Narrow ruled is a fair-copy paper rather than a practice one: lists, indexes, a page of notes meant to be kept. Very little classroom writing is set at this size.",
      "No margin line, deliberately. At a quarter of an inch there is not much page left to give away, and this is the ruling people print when they want all of it.",
    ],
    teaches: "Note taking",
    ages: "Ages 12+",
    group: "notebook",
    rule: { style: "narrow" },
  },
  {
    slug: "handwriting-paper",
    name: "Handwriting paper — ⅝ inch",
    short: "⅝ inch",
    heading: "Handwriting paper, ⅝ inch",
    keyword: "Free printable handwriting paper, ⅝ inch",
    summary:
      "Handwriting paper ruled at ⅝ of an inch: top line, dashed midline, baseline, and room below for descenders.",
    lead: "Three lines to a set — a top line to reach, a dashed midline for the body of a letter, and a baseline to sit on — repeating every ⅝ of an inch, with the space below it that a g, a y and a p need.",
    notes: [
      "⅝ is the commonest primary size and the one a school most often means by “handwriting paper”. It is where most children are by the middle of Year 1 and where they stay for a year or two.",
      "The midline is dashed rather than solid on purpose. A solid line invites a child to write on it; a dashed one tells them how tall an x is and then gets out of the way, which is the step between copying a letter and writing one.",
    ],
    teaches: "Handwriting",
    ages: "Ages 6–8",
    group: "handwriting",
    rule: { style: "hand-5-8", midline: "dashed", descender: true },
  },
  {
    slug: "kindergarten-writing-paper",
    name: "Kindergarten writing paper — 1 inch",
    short: "1 inch",
    heading: "Kindergarten writing paper, 1 inch",
    keyword: "Free printable kindergarten writing paper",
    summary:
      "Inch-high handwriting sets with a solid midline and room for descenders — the largest ruling there is.",
    lead: "The biggest ruling on the shelf: a full inch from one set of lines to the next, with a solid midline through the middle of it and space underneath for the tail of a letter.",
    notes: [
      "A solid midline rather than a dashed one, because a four-year-old is aiming at a line rather than reading a hint. The dashes come later, and every other handwriting sheet here has them.",
      "An inch looks enormous next to a notebook, and that is the point — a child whose fine motor control is still arriving writes large, and paper that asks them to write small teaches them that handwriting is something they are bad at.",
    ],
    teaches: "Letter formation",
    ages: "Ages 4–6",
    group: "handwriting",
    rule: { style: "hand-1", midline: "solid", descender: true },
  },
  {
    slug: "handwriting-paper-3-4-inch",
    name: "Handwriting paper — ¾ inch",
    short: "¾ inch",
    heading: "Handwriting paper, ¾ inch",
    keyword: "Free printable handwriting paper, ¾ inch",
    summary:
      "Handwriting paper ruled at ¾ of an inch: dashed midline, and room for descenders.",
    lead: "Three quarters of an inch to a set, with a dashed midline and descender space — the step between inch-high kindergarten paper and the ⅝ most of Year 1 is written on.",
    notes: [
      "This is the size a lot of schools spend the first term of Year 1 on. It is worth printing a page of it before dropping to ⅝: if letters are still hitting the top line, the paper is not the problem yet.",
      "Everything else about it matches the ⅝ sheet — same three lines, same dashed midline, same tail space — so moving down a size changes one thing at a time.",
    ],
    teaches: "Handwriting",
    ages: "Ages 5–7",
    group: "handwriting",
    rule: { style: "hand-3-4", midline: "dashed", descender: true },
  },
  {
    slug: "handwriting-paper-1-2-inch",
    name: "Handwriting paper — ½ inch",
    short: "½ inch",
    heading: "Handwriting paper, ½ inch",
    keyword: "Free printable handwriting paper, ½ inch",
    summary:
      "Handwriting paper ruled at half an inch: dashed midline, and room for descenders.",
    lead: "Half an inch to a set, dashed midline, descender space — the ruling most of Years 2 and 3 write on once letters are formed and the work is getting longer.",
    notes: [
      "Half an inch is where handwriting paper stops being about forming letters and starts being about writing a paragraph without the page running out. Same three lines; less of a gap between them.",
      "If a child is copying spellings or a short passage, this is usually the right size: small enough that a sentence fits on a line, large enough that the midline still means something.",
    ],
    teaches: "Handwriting",
    ages: "Ages 7–9",
    group: "handwriting",
    rule: { style: "hand-1-2", midline: "dashed", descender: true },
  },
  {
    slug: "handwriting-paper-3-8-inch",
    name: "Handwriting paper — ⅜ inch",
    short: "⅜ inch",
    heading: "Handwriting paper, ⅜ inch",
    keyword: "Free printable handwriting paper, ⅜ inch",
    summary:
      "Transitional handwriting paper at ⅜ of an inch: top line and baseline, no midline.",
    lead: "Three eighths of an inch, with a top line and a baseline and nothing in between — the transitional ruling that gets a child from handwriting paper onto ordinary lined paper.",
    notes: [
      "No midline, deliberately. By this size a child knows how tall a letter is, and the sheet stops telling them; what is left is a pair of lines to keep the writing straight, which is all a notebook gives you.",
      "It is the last ruling before wide ruled, and printing both together is a fair way to see whether someone is ready — the same sentence written on each, side by side.",
    ],
    teaches: "Handwriting",
    ages: "Ages 8–10",
    group: "handwriting",
    rule: { style: "hand-3-8", midline: "none" },
  },
  {
    slug: "graph-paper",
    name: "Graph paper — ¼ inch",
    short: "Graph",
    heading: "Graph paper, ¼ inch",
    keyword: "Free printable graph paper, ¼ inch squares",
    summary: "Quarter-inch squared graph paper, ruled edge to edge.",
    lead: "Quarter-inch squares, ruled in both directions across the whole writing area — the squared paper that maths homework is set on.",
    notes: [
      "Squared paper is worth printing for long multiplication and long division long before anyone plots a graph on it: one digit to a square is what keeps the columns lined up, and a column that drifts is most of what goes wrong in a long sum.",
      "The lines are drawn as hairlines rather than as a printed background, so they come out of the printer as light as they look here and do not compete with a pencil.",
    ],
    teaches: "Arithmetic layout and graphing",
    ages: "Ages 7+",
    group: "grid",
    rule: { style: "graph" },
  },
  {
    slug: "dot-grid-paper",
    name: "Dot grid paper",
    short: "Dots",
    heading: "Dot grid paper, ¼ inch",
    keyword: "Free printable dot grid paper",
    summary: "Quarter-inch dot grid — the squares implied rather than drawn.",
    lead: "A quarter-inch grid with only the corners printed. The structure of squared paper without the lines through the middle of the work.",
    notes: [
      "Dots are the right paper for drawing shapes, arrays and number lines: there is something to measure against, but nothing crossing what has been drawn.",
      "It is also the usual paper for bullet journals and hand-drawn plans, which is why a page of it is worth having in the printer tray whatever age is using it.",
    ],
    teaches: "Shapes, arrays and sketching",
    ages: "Ages 7+",
    group: "grid",
    rule: { style: "dot" },
  },
  {
    slug: "isometric-graph-paper",
    name: "Isometric graph paper",
    short: "Isometric",
    heading: "Isometric graph paper, ¼ inch",
    keyword: "Free printable isometric graph paper",
    summary:
      "Quarter-inch triangular grid at 30° — the paper three-dimensional drawing is done on.",
    lead: "A triangular grid rather than a square one: three families of lines at sixty degrees to each other, a quarter of an inch to a side.",
    notes: [
      "Isometric paper is what cubes, nets and three-dimensional shapes are drawn on. The grid does the perspective, so a child can draw a solid that looks right without being taught to draw.",
      "The rows are spaced by the height of the triangle rather than by its side, which is what makes the grid genuinely thirty degrees instead of a squashed approximation of it.",
    ],
    teaches: "Three-dimensional shapes and nets",
    ages: "Ages 9+",
    group: "grid",
    rule: { style: "isometric" },
  },
  /* The metric squares. Everything above this point is a quarter of an inch,
     which is the paper an American classroom is stocked with and no use at all
     for work in centimetres: a rectangle 7cm by 4cm drawn on quarter-inch
     squares has to be measured with a ruler rather than counted, which is most
     of what squared paper is for.                                            */
  {
    slug: "graph-paper-1-cm",
    name: "Graph paper — 1 cm",
    short: "1 cm",
    heading: "Graph paper, 1 cm",
    keyword: "Free printable 1 cm graph paper",
    summary: "Centimetre squared paper, ruled edge to edge.",
    lead: "One centimetre to a square, in both directions. The squared paper a metric classroom works in, where a length in centimetres is a number of squares rather than something to measure.",
    notes: [
      "A centimetre square is big enough to write a whole two-digit number into, which makes this the right squared paper for column arithmetic as well as for area. A child who puts one digit in each square keeps the columns lined up without being told to, and a column that drifts is most of what goes wrong in a long sum.",
      "It is also the paper for area and perimeter the first time either is taught. A rectangle drawn 7 squares by 4 squares has an area a child can count and a perimeter they can walk round with a finger, and both of those are lost the moment the squares are a quarter of an inch and the label says centimetres.",
    ],
    teaches: "Area, perimeter and metric measurement",
    ages: "Ages 7+",
    group: "grid",
    rule: { style: "graph", pitch: GRID_PITCHES.centimetre },
  },
  {
    slug: "graph-paper-5-mm",
    name: "Graph paper — 5 mm",
    short: "5 mm",
    heading: "Graph paper, 5 mm",
    keyword: "Free printable 5 mm graph paper",
    summary:
      "Five-millimetre squares — the ruling a school exercise book is printed at.",
    lead: "Half a centimetre to a square: the squares in a school maths book, and the finest ruling here that is still comfortable to write a digit into.",
    notes: [
      "This is what “squared paper” means in most of the world, and a page of it sits beside a torn-out exercise book page without looking like a different thing. Two squares to the centimetre also makes halves obvious, which is worth more than it sounds when a child is first asked to draw a line 3.5 cm long.",
      "Five millimetres is a hair under a fifth of an inch — three thousandths of an inch smaller, which is finer than a printer resolves — so a sheet of this does duty as the American quad pad as well. If the work is in inches, though, the quarter-inch sheet is the one to print: the squares there are a unit rather than nearly one.",
    ],
    teaches: "Graphing and metric measurement",
    ages: "Ages 9+",
    group: "grid",
    rule: { style: "graph", pitch: GRID_PITCHES["half-centimetre"] },
  },
  {
    slug: "dot-grid-paper-1-cm",
    name: "Dot grid paper — 1 cm",
    short: "1 cm dots",
    heading: "Dot grid paper, 1 cm",
    keyword: "Free printable 1 cm dot grid paper",
    summary: "Centimetre dot grid — the squares implied rather than drawn.",
    lead: "A centimetre grid with only the corners printed. Everything the squared sheet gives you to measure against, and nothing crossing what has been drawn on top of it.",
    notes: [
      "Dots are the right paper for drawing shapes on. A quadrilateral drawn corner to corner on a centimetre grid has sides a child can count and an area they can work out by cutting it into rectangles — and none of the pencil lines are competing with a printed grid for attention.",
      "It is also the paper for arrays. Six dots by four dots is a picture of 6 × 4 that a child can circle in rows or in columns, which is commutativity drawn rather than asserted, and it is much harder to see when the dots are a quarter of an inch apart.",
    ],
    teaches: "Shapes, arrays and area",
    ages: "Ages 7+",
    group: "grid",
    rule: { style: "dot", pitch: GRID_PITCHES.centimetre },
  },
  {
    slug: "isometric-graph-paper-1-cm",
    name: "Isometric paper — 1 cm",
    short: "1 cm triangles",
    heading: "Isometric graph paper, 1 cm",
    keyword: "Free printable 1 cm isometric graph paper",
    summary:
      "A centimetre triangular grid at 30° — the same paper as the quarter-inch sheet, at a size a whole cube fits on.",
    lead: "Triangles a centimetre to a side rather than a quarter of an inch. The same three families of lines at sixty degrees to each other, drawn large enough that a solid a few units across takes up a usable part of the page.",
    notes: [
      "The larger triangle is the one to print for a first attempt at drawing a cube. Small isometric paper is unforgiving — a line drawn one row out is a corner that does not meet — and a child who has just been shown the trick needs the room before they need the detail.",
      "The rows are spaced by the height of the triangle rather than by its side, here as on the quarter-inch sheet, which is what makes the grid genuinely thirty degrees rather than a squashed approximation of it. A centimetre triangle is therefore about 8.7 mm from one row to the next, and that number is the whole reason the drawing looks right.",
    ],
    teaches: "Three-dimensional shapes and nets",
    ages: "Ages 9+",
    group: "grid",
    rule: { style: "isometric", pitch: GRID_PITCHES.centimetre },
  },
];

/** What each group is called on the hub, in the order they are listed. */
export const GROUPS: Array<{ id: PaperGroup; label: string; blurb: string }> = [
  {
    id: "notebook",
    label: "Lined paper",
    blurb: "One rule to a line, the way a notebook is printed.",
  },
  {
    id: "handwriting",
    label: "Handwriting paper",
    blurb:
      "Three lines to a set, in the five sizes a primary school works through.",
  },
  {
    id: "grid",
    label: "Squares, dots and triangles",
    blurb: "Paper that repeats across the page as well as down it.",
  },
];

/* ── The plumbing every shelf needs ────────────────────────────────────────
   What a shelf *is* is its slugs, its configs and its prose, so each catalog is
   its own file. What every one of them answers identically is four questions —
   what paper, which route, which URL, and which link opens the bench — and a
   copied route helper is the kind that gets fixed in one file and left wrong in
   the others.

   Generic over `{ slug, config }` rather than over a sheet type, because that is
   all any of them touches: the entry shape stays each catalog's own, and each
   keeps a named wrapper so its pages read in its own vocabulary.           */

/** Portrait, half-inch margins — the stock is the only thing that varies. */
export const paperOf = (size: PaperSize): Paper => ({
  size,
  orientation: "portrait",
  margin: "normal",
});

/**
 * Printed blank, always, and the reason there is no third field: these are two
 * ruled lines on paper, and there is nowhere in a config to put a value for
 * either (§1).
 */
export const SHEET_FIELDS: HeaderField[] = ["name", "date"];

/** The route a slug prints at, on a given stock. */
export const stockPath = (slug: string, stock: Stock): string =>
  stock.path ? `${slug}/${stock.path}` : slug;

/** The whole URL, which is what a hub links to and the canonical says. */
export const stockHref = (base: string, slug: string, stock: Stock): string =>
  `${base}/${stockPath(slug, stock)}`;

/**
 * The builder, opened on a config.
 *
 * The config lives in the fragment (§14), so "change what is on it" is an
 * ordinary link on a static site. Whichever stock the config carries goes with
 * it, so a parent who came from the A4 page gets the A4 sheet on the bench.
 */
export const benchHref = (config: SheetConfig, seed: number): string =>
  `/printables/make#s=${encodeSharedSheet({ config, seed })}`;

/**
 * The shelf, grouped — the shape every hub and every row of neighbours lists it
 * in. Written once because the failure to keep two copies in step is silent: a
 * sheet shown on one page but not the other still builds and still looks right.
 */
export function shelve<Id extends string, Sheet extends { group: Id }, Meta>(
  groups: Array<Meta & { id: Id }>,
  sheets: Sheet[],
): Array<Meta & { id: Id; sheets: Sheet[] }> {
  return groups.map((group) => ({
    ...group,
    sheets: sheets.filter((sheet) => sheet.group === group.id),
  }));
}

/** The route a sheet prints at, on a given stock. */
export function pathFor(sheet: PaperSheet, stock: Stock): string {
  return stockPath(sheet.slug, stock);
}

/** The shelf, grouped — see `shelve`. */
export function shelf(): Array<{
  id: PaperGroup;
  label: string;
  blurb: string;
  sheets: PaperSheet[];
}> {
  return shelve(GROUPS, PAPER_SHEETS);
}

/**
 * The config the page builds its sheet from.
 *
 * No title on the paper: a page of lined paper with the word "Lined paper"
 * printed at the top of it is a worse sheet of lined paper.
 */
export function paperConfig(sheet: PaperSheet, size: PaperSize): PaperConfig {
  return {
    kind: "paper",
    paper: paperOf(size),
    fontPt: DEFAULT_FONT_PT,
    fields: SHEET_FIELDS,
    rule: sheet.rule,
  };
}
