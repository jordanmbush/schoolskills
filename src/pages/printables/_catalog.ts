/**
 * The paper the Print Shop has set, and the words that go round it.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two
 * pages share — `[...slug].astro`, which prerenders one sheet per entry, and
 * `index.astro`, which lists them — rather than a route of its own.
 *
 * **The slugs are curated; the sheets are generated.** §8 is explicit about
 * why: twelve times-table pages work because there are twelve of them and each
 * has something true on it, and five thousand permutations of a config is a
 * doorway-page farm. So the engine can rule paper any way §5 describes, and
 * this file names the eleven a parent actually searches for, each with a note
 * that is true of that ruling and no other. The rest arrive with the builder,
 * which is where choosing belongs.
 *
 * Every entry is printed on both stocks. A sheet is only correct on the paper
 * it was measured for — a Letter sheet sent to an A4 printer is scaled to fit,
 * and a scaled ⅝ rule is not a ⅝ rule — and `@page` is a document rule, so the
 * two cannot share a page. Hence a route each.
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type { PaperConfig, PaperSize, Rule } from "@/engine/sheets/types";

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
    lead: "The narrower of the two notebook rules — nine thirty-seconds of an inch — with the same margin line as wide ruled and about four more lines on the page.",
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

/** The route a sheet prints at, on a given stock. */
export function pathFor(sheet: PaperSheet, stock: Stock): string {
  return stock.path ? `${sheet.slug}/${stock.path}` : sheet.slug;
}

/**
 * The shelf, grouped — the shape both the hub and a sheet page list it in.
 *
 * Written once because the two would otherwise have to be kept in step by
 * hand, and the failure would be silent: a ruling added here and shown on one
 * page but not the other still builds, still deploys, and still looks right.
 */
export function shelf(): Array<{
  id: PaperGroup;
  label: string;
  blurb: string;
  sheets: PaperSheet[];
}> {
  return GROUPS.map((group) => ({
    ...group,
    sheets: PAPER_SHEETS.filter((sheet) => sheet.group === group.id),
  }));
}

/**
 * The config the page builds its sheet from.
 *
 * No title on the paper: a page of lined paper with the word "Lined paper"
 * printed at the top of it is a worse sheet of lined paper. What it does carry
 * is the name and date line — printed blank, always, because that is the one
 * field this site refuses to hold (§1).
 */
export function paperConfig(sheet: PaperSheet, size: PaperSize): PaperConfig {
  return {
    kind: "paper",
    paper: { size, orientation: "portrait", margin: "normal" },
    fontPt: DEFAULT_FONT_PT,
    fields: ["name", "date"],
    rule: sheet.rule,
  };
}
