/**
 * The penmanship sheets the Print Shop has set, and the words that go round
 * them.
 *
 * The shelf after handwriting. A child who can form every letter and still
 * hands in a page nobody can read has one of a short list of problems, and
 * each sheet here works on one: the strokes, the size of a letter against its
 * neighbors, the space between words, judging their own work, or staying neat
 * at speed (`docs/printables.md` §24).
 *
 * **The slugs are curated; the sheets are generated** (`docs/printables.md`
 * §8). Six styles on any of twelve rulings, in six faces, repeated up to eight
 * times, is thousands of plausible pages, none of them written for. Each slug
 * here is a phrase a parent types, with two paragraphs true of that sheet and
 * of no other, and the rest is the builder's.
 *
 * **Two stocks, two routes, as with handwriting.** The ruling is a
 * measurement, and a measurement shrunk to fit the tray is a different sheet
 * (`docs/printables.md` §8).
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type { PaperSize, PenmanshipConfig } from "@/engine/sheets/types";

import {
  SHEET_FIELDS as FIELDS,
  STOCKS,
  benchHref,
  paperOf,
  shelve,
  stockHref,
  stockPath,
  type Stock,
} from "./_catalog";

/** How the hub groups the shelf: what is being worked on, in the order it goes wrong. */
export type PenmanshipGroup = "control" | "shape" | "page";

export type PenmanshipSheet = {
  /** The route under /printables/penmanship, and the head term it answers. */
  slug: string;
  /** How it is listed on a hub. */
  name: string;
  /** How it is labeled in the row of neighboring sheets. A few words. */
  short: string;
  /** The page's `<h1>`. */
  heading: string;
  /** The query this page exists to answer, in the words a parent types. */
  keyword: string;
  /** One sentence of what is on the sheet. Used in the description and hubs. */
  summary: string;
  /** The lead paragraph: what the sheet asks for, stated plainly. */
  lead: string;
  /** Two things that are true of this sheet and not of the one beside it. */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: PenmanshipGroup;
  /**
   * The sheet itself. Prerendered at build time — this IS the page
   * (`docs/printables.md` §8).
   */
  config: PenmanshipConfig;
};

/**
 * The seed every penmanship sheet is built from, and it never moves.
 *
 * Nothing here is drawn at random — the strokes, the families and the zones
 * are tables — so the seed decides nothing and only prints in the footer. It
 * is still fixed and still carried into the builder link, because the promise
 * in `docs/printables.md` §7 is about the whole shop: the number on the paper
 * gets you the identical sheet back.
 */
export const PENMANSHIP_SEED = 1;

export const PENMANSHIP_SHEETS: PenmanshipSheet[] = [
  /* ── Pencil control ─────────────────────────────────────────────────── */
  {
    slug: "pre-writing-strokes-worksheets",
    name: "Pre-writing strokes — lines, circles and zigzags",
    short: "Pre-writing",
    heading: "Pre-writing strokes worksheets",
    keyword: "Free printable pre-writing strokes worksheets",
    summary:
      "Seven pencil strokes on ¾-inch paper with a solid midline — straight lines, slants, circles, zigzags, waves, humps and cups — each drawn, traced, carried on to the margin, and then drawn again on a line of the child's own.",
    lead: "The strokes a printed letter is made of, before there are any letters, on large ¾-inch paper. Each pattern gets two lines. On the first it is drawn for you, then dotted to trace, then left for you to carry on to the edge of the page; the second line is empty ruling, and all yours.",
    notes: [
      "The order is the order children can manage them. Most can copy a straight line down at about two, a circle at about three, and a line at a slant only after four — so the sheet starts with straight lines, puts slants second, and the row of slants is the one most likely to come out crooked. Zigzags, waves, humps and cups follow, because each of those is two of the earlier strokes joined without the pencil coming off the paper.",
      "The paper is ¾ inch with a solid midline rather than a dashed one, because a child this age is aiming at a line rather than reading a hint, and every stroke is drawn where the letter it belongs to will go: a straight line from the top line to the baseline, a circle between the midline and the baseline. The two loops are left off on purpose — they are the strokes only a joined hand needs. Fourteen rows at this size is two pages, and the sheet is two pages rather than a smaller ruling.",
    ],
    teaches: "Pre-writing pencil control",
    ages: "Ages 3–6",
    group: "control",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "strokes",
      rule: { style: "hand-3-4", midline: "solid", descender: true },
      trace: "dotted",
      repeats: 3,
      lines: 2,
      patterns: [
        "lines",
        "slants",
        "circles",
        "zigzag",
        "waves",
        "humps",
        "cups",
      ],
    },
  },
  {
    slug: "handwriting-warm-up-worksheets",
    name: "Handwriting warm-up — all nine strokes",
    short: "Warm-up",
    heading: "Handwriting warm-up worksheets",
    keyword: "Free printable handwriting warm-up worksheets",
    summary:
      "All nine pencil strokes on half-inch paper, two lines each — a model to trace and carry on, then a line of the child's own — as the two minutes before writing rather than instead of it.",
    lead: "Every stroke a letter is built from, on the half-inch ruling a child of this age already writes on, as a page to do before the writing. Nine patterns, each drawn once, dotted once and then carried on across the line, with a second line under each that is entirely the child's own.",
    notes: [
      "A warm-up is not for a child who cannot form letters. It is for one who can, and whose letters go to pieces halfway down a page: the strokes here are the ones every letter is two or three of, and drawing each one evenly to the end of a line is what a hand has to be able to do before it can write a paragraph. Two lines of each is a few minutes, which is what the copybooks opened every lesson with for a century.",
      "The two loops are on this sheet and not on the pre-writing one because they need somewhere to go. A tail loop drops below the baseline, and half-inch paper with a tail space has room for it where a page for a four-year-old has no use for one. They come last, in the order the strokes are taught: straight before curved, lifted before continuous, and the two a joined hand needs at the end. Eighteen rows at half an inch is two pages on either stock.",
    ],
    teaches: "Pencil control and an even stroke",
    ages: "Ages 6–10",
    group: "control",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "strokes",
      rule: { style: "hand-1-2", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
      lines: 2,
    },
  },
  {
    slug: "cursive-loops-and-ovals-worksheets",
    name: "Cursive loops and ovals",
    short: "Loops and ovals",
    heading: "Cursive loops and ovals worksheets",
    keyword: "Free printable cursive loops and ovals worksheets",
    summary:
      "The five strokes a joined hand runs on — circles, waves, cups, loops and tail loops — on half-inch paper with a tail space, each traced, carried on to the margin and then drawn on a line of its own.",
    lead: "The five strokes cursive is made of and printing is not, on half-inch paper. No straight lines and no zigzags, because a joined hand has no corners in it: what it has is ovals, the wave that runs from one letter into the next, the cup of a u, and the two loops — one up over the top line and one down under the baseline.",
    notes: [
      "The two loops are why this sheet exists apart from the print one. A joined l, h or b begins by climbing to the top line and coming back down through its own stroke, and a joined g, j or y does the same below the baseline; print never draws either, so a child who has printed for three years has never made the shape. The tail loops need room under the lines, which is why this paper has a descender space and the rule is half an inch.",
      "Everything on this page is meant to be drawn without lifting the pencil — the row of circles is one line that goes round and round, and the row of waves is one line that never stops — because that is the thing cursive asks of a hand that printing never did. The strokes are drawn as shapes rather than as letters, so they are the same in every cursive model; what changes with the model is the letters they will be joined into. The first row of each stroke is traced and the second is the child's own.",
    ],
    teaches: "The strokes of a joined hand",
    ages: "Ages 7–11",
    group: "control",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: "cursive",
      style: "strokes",
      rule: { style: "hand-1-2", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
      lines: 2,
      // Five rather than six because ten rows of half-inch paper with a tail
      // is one Letter page and twelve is one page and one orphaned row.
      patterns: ["circles", "waves", "cups", "loops", "tails"],
    },
  },

  /* ── Shape and size ─────────────────────────────────────────────────── */
  {
    slug: "letter-families-handwriting-worksheets",
    name: "Letter families — the four print families",
    short: "Letter families",
    heading: "Letter families handwriting worksheets",
    keyword: "Free printable letter families handwriting worksheets",
    summary:
      "All twenty-six small letters on ⅝-inch paper, grouped by the stroke they start with — round, straight-line, arch and slanted — each one a model, two dotted to trace, and one written alone.",
    lead: "The small letters in the order a hand learns them rather than the order the alphabet keeps them: the nine that start like a c, the six that start with a line down, the seven that go down, back up and over the top, and the four made only of slants. Two letters to a row, each with a solid model, two dotted copies to trace, and an empty place to write it on your own.",
    notes: [
      "Letters are taught in families because a child who can make one stroke well has every letter that starts with it: the curve that begins c, o, a, d, g and q is one movement, learned once. It is also the best answer anyone has to b and d. A letter met beside the ones it is built like is mixed up less with the one it merely looks like — b is an arch letter, made like h and p, and d is a round letter, made like a and g, and on this sheet they are rows apart.",
      "There are no headings between the families; the paper marks the break instead. A family with an odd number of letters ends with a row half empty — f alone at the end of the round letters, k alone at the end of the arch letters — and the next row starts a new stroke. So every letter on a line starts the same way as the one beside it, which is what the instruction at the top says, and it holds on every line. Twenty-six letters written four times each is two pages of ⅝ paper.",
    ],
    teaches: "Forming letters by the stroke they start with",
    ages: "Ages 5–7",
    group: "shape",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "families",
      letters: "lower",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 4,
    },
  },
  {
    slug: "tall-small-and-tail-letters-worksheets",
    name: "Tall, small and tail letters",
    short: "Three heights",
    heading: "Tall, small and tail letters worksheets",
    keyword: "Free printable tall, small and tail letters worksheets",
    summary:
      "The small alphabet sorted by height on ⅝-inch paper — seven tall letters, fourteen small ones, five with tails — and then six words that mix all three, each traced and then written alone.",
    lead: "Every small letter sorted by how tall it stands: the seven that reach the top line, the fourteen that stop at the dashed midline, and the five that hang below the baseline. Then six words — high, play, light, quick, bright, happy — with a tall letter, a small one and a tail in each, because a word is where the heights have to hold together.",
    notes: [
      "A letter can be the right shape and still the wrong size, and size is what a page is read by: tall letters reach the top line, small ones stop at the midline, tails hang below it — and if an a stands as tall as the b next to it, the word is hard to read whatever the a looks like. The three groups come first as rows of single letters, two to a row, so each height is met on its own against a ruling that shows exactly where it stops.",
      "The words are the part that matters, and they are why this is not the small-letter tracing sheet in a different order. A child who sizes every letter correctly in a row of that letter will still write high with the h no taller than the i, because the place sizing goes wrong is inside a word, next to a neighbor of another height. Each word gets a row to itself — a model, two dotted to trace, and an empty stretch to write it — and the whole sheet is three pages of ⅝ paper on either stock.",
    ],
    teaches: "Sizing letters against each other",
    ages: "Ages 5–8",
    group: "shape",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "sizes",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 4,
    },
  },

  /* ── The whole line ─────────────────────────────────────────────────── */
  {
    slug: "finger-spaces-worksheets",
    name: "Finger spaces — five sentences",
    short: "Finger spaces",
    heading: "Finger spaces worksheets",
    keyword: "Free printable finger spaces worksheets",
    summary:
      "Five short sentences on half-inch paper, each printed with a dot where every finger space goes, then dotted to trace with the dots gone, then an empty line to write it with the spaces and nothing else.",
    lead: "Five sentences of short words, so that a line is as many spaces as it can be. Each one is printed three times down the page: a model with a dot in the gap after every word, a dotted copy to trace over with the same gaps and nothing in them, and an empty line to write it on.",
    notes: [
      "The dot is where a finger goes, and the gap it sits in is a finger wide. A child writing a first sentence runs the words together not because they don't know there are spaces but because the pencil is at the end of one word and the next is already coming, and a finger laid on the line after the word is a physical thing to write around. The model carries the dot so the spaces can be seen before they are written; the traced line keeps the gaps and drops the dots, because a mark between every word is not the habit being taught.",
      "Every sentence sits on one line of the page, with no word long enough to make the line about anything else — the, dog, ran, sat, mat — and all five are short enough that the break at the margin never becomes the widest space on the page. Half an inch is the ruling a child of this age writes on, and fifteen rows of it is two pages on either stock. The sentences are the shop's; the builder takes a parent's own, one to a line, and prints the same sheet.",
    ],
    teaches: "Spacing between words",
    ages: "Ages 5–8",
    group: "page",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "spacing",
      rule: { style: "hand-1-2", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },
  {
    slug: "circle-your-best-letter-worksheets",
    name: "Circle your best letter",
    short: "Best letter",
    heading: "Circle your best letter worksheets",
    keyword: "Free printable circle your best letter worksheets",
    summary:
      "Every small letter on half-inch paper with a model and five empty places beside it: write it five times, then circle the one that looks most like the model. Nothing on the page to trace.",
    lead: "The twenty-six small letters, one to a row, each with a printed model and five empty places after it. Write the letter five times, look back at the model, and circle the best one. There is nothing to trace on this sheet, on purpose: the child is judging their own letters, and a traced letter is not their own.",
    notes: [
      "Copying a letter is the weakest way to learn it. Looking at a model and then writing it without looking is stronger, and judging what you wrote against the model is the step that makes practice improve rather than repeat: a child who circles their best a has had to decide what makes an a good, and that decision is what they take to the next page. Five tries is enough to have a best one and few enough that the deciding does not become a chore.",
      "There is no dotted letter on this sheet and the builder will not put one there, whatever trace style it is asked for: a traced letter is the sheet's letter rather than the child's, and there is nothing in it to judge. So each row is a solid model and then empty half-inch ruling. Twenty-six rows is three pages on either stock, and the sheet is easily done a page at a time — the first page today, the rest next week — because every row is complete on its own.",
    ],
    teaches: "Judging your own letters against a model",
    ages: "Ages 6–9",
    group: "page",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "check",
      letters: "lower",
      rule: { style: "hand-1-2", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 6,
    },
  },
  {
    slug: "handwriting-speed-worksheets",
    name: "Handwriting speed — the alphabet against the clock",
    short: "Against the clock",
    heading: "Handwriting speed worksheets",
    keyword: "Free printable handwriting speed worksheets",
    summary:
      "The alphabet printed once on ⅜-inch paper above a page of empty lines and a one-minute timer: write a to z again and again from memory, count the letters, count the neat ones.",
    lead: "One minute, a page of ⅜-inch lines, and the alphabet printed once at the top to be written from memory, in order, as many times as it will go. When the timer rings the child counts the letters and counts the neat ones, and both numbers go in the box at the foot of the page.",
    notes: [
      "Handwriting that is neat but slow is the problem this sheet exists for. While forming a letter still takes attention there is none left over for what is being written, and children who write fluently write more and write better — so speed is not the opposite of neatness but the point at which neatness stops costing anything. Writing the alphabet in order from memory against a clock is the task used to measure that, and it is a fair guide to how well a child will write a paragraph.",
      "Two counts rather than one, because the number that matters is the second: a child who writes ninety letters and thirty neat ones has a different job ahead from one who writes forty and forty. Keep the sheets and the numbers move, which makes this the one page on the shelf meant to be printed again and compared. The ⅜-inch ruling has no midline, since by now the paper is not telling the child how tall a letter is, and the sheet is one page only — as many as you can is measured against the paper in front of you, and a second sheet would be a second go.",
    ],
    teaches: "Handwriting fluency",
    ages: "Ages 7–11",
    group: "page",
    config: {
      kind: "penmanship",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "fluency",
      task: "alphabet",
      minutes: 1,
      rule: { style: "hand-3-8", midline: "none", descender: true },
      trace: "dotted",
      repeats: 1,
    },
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const PENMANSHIP_GROUPS: Array<{
  id: PenmanshipGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "control",
    label: "Pencil control",
    blurb: "The strokes every letter is made of, drawn before any letter is.",
  },
  {
    id: "shape",
    label: "Shape and size",
    blurb: "Letters that start alike, and the three heights they stand at.",
  },
  {
    id: "page",
    label: "The whole line",
    blurb: "Spaces, judging your own work, and staying neat at speed.",
  },
];

/** The same sheet, measured for another stock. */
export function configFor(
  sheet: PenmanshipSheet,
  size: PaperSize,
): PenmanshipConfig {
  return { ...sheet.config, paper: paperOf(size) };
}

/** The route a sheet prints at, on a given stock — see `_catalog.ts`. */
export const pathFor = (sheet: PenmanshipSheet, stock: Stock): string =>
  stockPath(sheet.slug, stock);

/** The whole URL, which is what a hub links to and the canonical says. */
export const hrefFor = (sheet: PenmanshipSheet, stock: Stock): string =>
  stockHref("/printables/penmanship", sheet.slug, stock);

/** The builder, opened on this sheet. */
export const builderHref = (sheet: PenmanshipSheet, stock: Stock): string =>
  benchHref(configFor(sheet, stock.id), PENMANSHIP_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function penmanshipShelf(): Array<{
  id: PenmanshipGroup;
  label: string;
  blurb: string;
  sheets: PenmanshipSheet[];
}> {
  return shelve(PENMANSHIP_GROUPS, PENMANSHIP_SHEETS);
}

/** Letter first, then A4 — the order `_catalog.ts` sets and the reason for it. */
export { STOCKS };
