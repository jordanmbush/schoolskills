/**
 * The handwriting sheets the Print Shop has set, and the words that go round
 * them.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two pages
 * share — `handwriting/[...slug].astro`, which prerenders one sheet per entry,
 * and `handwriting/index.astro`, which is the subject hub — rather than a route
 * of its own. `_catalog.ts` does the same job for paper and `_maths.ts` for
 * maths, and the three are deliberately separate: a ruling, a set of problems
 * and a letter to trace have almost nothing to say about each other.
 *
 * **The slugs are curated; the sheets are generated.** §8 is explicit about why.
 * The family can rule any of twelve papers, write four kinds of content on it in
 * six letterforms and repeat each of them up to eight times — tens of thousands
 * of plausible pages, none of them written for. So: seven slugs, each one a
 * phrase a parent types, each with two paragraphs true of that sheet and of no
 * other, and everything else reached through the builder, which is where
 * *choosing* belongs.
 *
 * **Two stocks, as with paper and unlike maths.** A handwriting sheet is the one
 * kind of worksheet whose whole content is a measurement: a ⅝ rule sent to a
 * printer loaded with A4 is scaled to fit, and a scaled ⅝ rule is not a ⅝ rule.
 * `@page` is a document rule, so the two cannot share a page — hence a route
 * each, exactly as `_catalog.ts` argues.
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type { HandwritingConfig, PaperSize } from "@/engine/sheets/types";
// The same twelve words the bench opens its own sight-word sheet on. Sliced in
// one place so the catalog page and the builder default cannot drift apart.
import { STARTER_WORDS } from "@/games/printshop/defaults";

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

/** How the hub groups the shelf: what is being written, in the order it is learnt. */
export type HandwritingGroup = "letters" | "words" | "passages";

export type HandwritingSheet = {
  /** The route under /printables/handwriting, and the head term it answers. */
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
  /** The lead paragraph: what the sheet asks for, stated plainly. */
  lead: string;
  /** Two things that are true of this sheet and not of the one beside it. */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: HandwritingGroup;
  /** Where the words on it came from, printed under the sheet where it matters. */
  credit?: string;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: HandwritingConfig;
};

/**
 * The seed every handwriting sheet is built from, and it never moves.
 *
 * Nothing in this family is drawn at random — an alphabet is an alphabet — so
 * the seed decides nothing about the page and only prints in the footer. It is
 * still fixed and still carried into the builder link, because §7's promise is
 * about the whole shop: the number on the paper is what gets you the identical
 * sheet back, whichever family printed it.
 */
export const HANDWRITING_SEED = 1;

/**
 * The first verse of "The Star", Jane Taylor, 1806 — the poem everyone knows
 * these four lines of, and public domain twice over by age.
 *
 * Copywork wants text somebody wrote rather than text a generator assembled: a
 * child copying a real poem is reading it too. The line breaks are the poet's,
 * and the family keeps them — anything longer than the paper is broken where
 * the paper runs out and nowhere else.
 *
 * One verse rather than two because four lines written four times each is
 * sixteen rows, which is what a ⅜ page holds with room to spare. Two verses at
 * the same repeats would not fit, and the family would print seven of the eight
 * lines — a poem with its last line missing.
 */
const STAR = [
  "Twinkle, twinkle, little star,",
  "How I wonder what you are!",
  "Up above the world so high,",
  "Like a diamond in the sky.",
].join("\n");

/**
 * The four short sentences a first sentence sheet is set on.
 *
 * Short enough that none of them wraps on either stock — a sentence broken over
 * two lines is still correct, but the point of this sheet is a whole sentence
 * on one line — and between them they carry a capital, a full stop, and the
 * word spacing that is the actual lesson.
 */
const SENTENCES = [
  "The cat sat on the warm mat.",
  "We went to the park on Friday.",
  "My little dog can run very fast.",
  "I can write my name by myself.",
].join("\n");

export const HANDWRITING_SHEETS: HandwritingSheet[] = [
  /* ── Letters and numbers ────────────────────────────────────────────── */
  {
    slug: "letter-tracing-worksheets",
    name: "Letter tracing — the whole alphabet",
    short: "A to Z",
    heading: "Letter tracing worksheets",
    keyword: "Free printable letter tracing worksheets",
    summary:
      "Every letter of the alphabet as a capital and a small letter, on ⅝-inch ruled paper: a solid model, two dotted letters to trace, and an empty space to write it alone.",
    lead: "All twenty-six letters on one page, each one written as the pair a child is taught — A then a, B then b. Every letter gets a solid model to look at, two dotted ones to trace over, and an empty space at the end where nobody is helping.",
    notes: [
      "The three steps on each line are the whole point of the sheet, and they are meant to be done in order. A child who traces a letter twenty times has practised following a line; a child who traces it once and then writes it from nothing has practised writing the letter. The empty space at the end of every group is where the actual learning happens, and it is why this page is worth more than a page of dotted letters twice the length.",
      "Capitals and small letters sit together rather than on separate pages, because they are one letter with two shapes and a child meets them that way in every book they open. It also makes the difference visible: b and d are a genuine problem at this age, and having Bb and Dd on the same sheet is a better answer than practising each of them alone a week apart.",
    ],
    teaches: "Printing the letters of the alphabet",
    ages: "Ages 4–7",
    group: "letters",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "letters",
      letters: "both",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 4,
    },
  },
  {
    slug: "uppercase-letter-tracing-worksheets",
    name: "Capital letter tracing",
    short: "Capitals",
    heading: "Uppercase letter tracing worksheets",
    keyword: "Free printable uppercase letter tracing worksheets",
    summary:
      "The twenty-six capitals on ¾-inch handwriting paper, each traced and then written alone — the larger ruling for a hand that is still arriving.",
    lead: "Capital letters only, on the ¾-inch ruling a lot of schools spend the first term on. Every capital starts at the top line and sits on the baseline, which is the one rule that makes a capital a capital.",
    notes: [
      "Capitals are usually the first letters a child writes, and not because they come first in the alphabet: every one of them is made of straight lines and simple curves that start at the top and finish at the bottom, with nothing that has to be joined and nothing that drops below the line. If handwriting is going badly, this is the page to go back to.",
      "The ruling is a size larger than the ⅝ paper most of Year 1 works on. That is deliberate rather than a concession — a child whose fine motor control is still arriving writes large, and paper that asks them to write smaller than they can control teaches them that handwriting is something they are bad at. Drop to ⅝ when the letters stop touching the top line by accident.",
    ],
    teaches: "Forming capital letters",
    ages: "Ages 4–6",
    group: "letters",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "letters",
      letters: "upper",
      rule: { style: "hand-3-4", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },
  {
    slug: "lowercase-letter-tracing-worksheets",
    name: "Small letter tracing",
    short: "Small letters",
    heading: "Lowercase letter tracing worksheets",
    keyword: "Free printable lowercase letter tracing worksheets",
    summary:
      "The twenty-six small letters on ⅝-inch paper with a dashed midline and room for descenders, traced twice and then written alone.",
    lead: "Small letters on their own, on the ⅝ paper a school usually means by “handwriting paper”. The dashed midline is where the body of a letter stops, and the space below the baseline is where the tail of a g, a y or a p goes.",
    notes: [
      "Small letters are harder than capitals and this sheet is where that shows. Three things are happening at once: some letters reach the top line, some stop at the dashed midline, and five of them drop below the baseline — so the paper is doing as much teaching as the letters are. That is why the descender space is on rather than off, and why the midline is dashed rather than solid.",
      "There are two more repeats of each letter here than on the capitals sheet, because small letters need them. b and d, p and q, n and h are pairs a child mixes up for a year or more, and the fix is not explanation but enough repetitions of each that the hand stops having to decide. The empty space at the end of every line is still where it is checked.",
    ],
    teaches: "Forming lowercase letters",
    ages: "Ages 5–7",
    group: "letters",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "letters",
      letters: "lower",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 5,
    },
  },
  {
    slug: "number-tracing-worksheets",
    name: "Number formation, 0 to 9",
    short: "Numbers",
    heading: "Number tracing worksheets",
    keyword: "Free printable number tracing worksheets",
    summary:
      "Every numeral from 0 to 9 on ¾-inch paper with a solid midline, one to a line: a model, four dotted numbers to trace, and one written alone.",
    lead: "The ten numerals every other number is built out of, one to a line on large ¾-inch paper. Each gets a solid model, four dotted numbers to trace, and an empty space at the end where nobody is helping.",
    notes: [
      "Ten symbols is the whole of it, and they are worth more practice than they usually get. Every number a child will ever write is made of these ten shapes, and a 5 started at the wrong end or a 2 drawn as a loop is a habit that survives into secondary school and slows down every sum on the page. Six goes at each is roughly what it takes for the direction to stick, which is why they get a line each rather than sharing one.",
      "A solid midline rather than a dashed one, because a four- or five-year-old is aiming at a line rather than reading a hint. Numbers help here: unlike letters, almost all of them are the full height of the writing space, so the top line and the baseline are the two that matter and the middle one is a landmark rather than a limit on how tall a body may be.",
    ],
    teaches: "Writing the numerals 0 to 9",
    ages: "Ages 4–6",
    group: "letters",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "numbers",
      rule: { style: "hand-3-4", midline: "solid", descender: true },
      trace: "dotted",
      repeats: 6,
    },
  },

  /* ── Words ──────────────────────────────────────────────────────────── */
  {
    slug: "sight-word-handwriting-worksheets",
    name: "Sight words to trace and write",
    short: "Sight words",
    heading: "Sight word handwriting worksheets",
    keyword: "Free printable sight word handwriting worksheets",
    summary:
      "Twelve first sight words on ⅝-inch paper, each one traced once and then written from nothing — spelling and handwriting in the same three minutes.",
    lead: "The first twelve sight words, one to a line, each with a model to read, a dotted word to trace and an empty stretch of line to write it on. The same words the jungle deals as flash cards, on paper.",
    notes: [
      "Writing a word out is a different exercise from writing its letters, and this is the sheet where that gap gets closed. A child who can form every letter of the alphabet can still stall at “because”, because a word needs the letters in an order, joined by spaces that are the right size, on a line that has to keep going. One word to a line is what gives them room to get all three right.",
      "These are sight words rather than phonetic ones on purpose: they are the words that turn up most often and are least worth sounding out, so writing them is memory work as much as handwriting. If a different list is wanted — this week's spellings off a school letter, or the words a child kept missing on screen — the builder takes a typed or pasted list and prints the same sheet.",
    ],
    teaches: "Writing sight words by hand",
    ages: "Ages 5–7",
    group: "words",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "words",
      words: STARTER_WORDS,
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },

  /* ── Sentences and passages ─────────────────────────────────────────── */
  {
    slug: "sentence-handwriting-worksheets",
    name: "Sentences to trace and copy",
    short: "Sentences",
    heading: "Sentence handwriting worksheets",
    keyword: "Free printable sentence handwriting worksheets",
    summary:
      "Four short sentences on half-inch paper, each printed as a model, traced twice on the lines below, and then written on a line of its own.",
    lead: "Four sentences a five-year-old can read, on the half-inch ruling that fits a whole sentence on a line. Each one appears four times down the page: printed to read, dotted twice to trace, and empty to write.",
    notes: [
      "A sentence brings in everything a letter sheet leaves out — a capital at the start, spaces between the words, and a full stop at the end — and those are the three things a child forgets first when they stop thinking about them. The model line at the top of each group is there to be looked at rather than skipped: the spacing is as much the lesson as the letters are.",
      "Half an inch is the ruling where handwriting stops being about forming letters and starts being about writing a line without the page running out. If the sentences are being squeezed or the writing is drifting off the baseline, print the ⅝ or ¾ version from the builder instead — the sheet is identical apart from the size, which is the one thing worth changing at a time.",
    ],
    teaches: "Writing whole sentences by hand",
    ages: "Ages 5–8",
    group: "passages",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      text: SENTENCES,
      rule: { style: "hand-1-2", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 4,
    },
  },
  {
    slug: "copywork-worksheets",
    name: "Copywork — a poem to copy out",
    short: "Copywork",
    heading: "Copywork worksheets",
    keyword: "Free printable copywork worksheets",
    summary:
      "A verse of “The Star” on ⅜-inch transitional paper: the line printed, two grey copies to write over, and an empty line to write it from nothing.",
    lead: "A verse of a real poem, one line at a time. Each line is printed to read, then printed faintly twice to write over, then left as an empty ruled line. Copywork is the oldest handwriting exercise there is and still the best one once letters are formed.",
    notes: [
      "The faint lines are grey rather than dotted, which is the change that marks this sheet as the one after tracing. A dotted letter is a path to follow; a grey one is a shape to write over, and the pencil has to do the deciding. The empty line under each group is where it stops being a copy at all — and by then the eye has held the words long enough that the spelling has gone in as well.",
      "The ⅜ ruling has a top line and a baseline and no midline at all. By this stage a child knows how tall a letter is and the paper stops telling them; what is left is a pair of lines to keep the writing straight, which is all an exercise book gives you. It is the last ruling before ordinary lined paper, and copying a poem onto it is a fair test of whether someone is ready for that.",
    ],
    teaches: "Copywork and sustained handwriting",
    ages: "Ages 7–10",
    group: "passages",
    credit: "“The Star”, Jane Taylor, 1806. Public domain.",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      text: STAR,
      rule: { style: "hand-3-8", midline: "none", descender: true },
      trace: "dim",
      repeats: 4,
    },
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const HANDWRITING_GROUPS: Array<{
  id: HandwritingGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "letters",
    label: "Letters and numbers",
    blurb: "The shapes everything else is built out of, one page each.",
  },
  {
    id: "words",
    label: "Words",
    blurb: "Letters in an order, with spaces the right size between them.",
  },
  {
    id: "passages",
    label: "Sentences and copywork",
    blurb: "A whole line at a time, once the letters are no longer the work.",
  },
];

/** The same sheet, measured for another stock. */
export function configFor(
  sheet: HandwritingSheet,
  size: PaperSize,
): HandwritingConfig {
  return { ...sheet.config, paper: paperOf(size) };
}

/** The route a sheet prints at, on a given stock — see `_catalog.ts`. */
export const pathFor = (sheet: HandwritingSheet, stock: Stock): string =>
  stockPath(sheet.slug, stock);

/** The whole URL, which is what a hub links to and the canonical says. */
export const hrefFor = (sheet: HandwritingSheet, stock: Stock): string =>
  stockHref("/printables/handwriting", sheet.slug, stock);

/** The builder, opened on this sheet. */
export const builderHref = (sheet: HandwritingSheet, stock: Stock): string =>
  benchHref(configFor(sheet, stock.id), HANDWRITING_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function handwritingShelf(): Array<{
  id: HandwritingGroup;
  label: string;
  blurb: string;
  sheets: HandwritingSheet[];
}> {
  return shelve(HANDWRITING_GROUPS, HANDWRITING_SHEETS);
}

/** Letter first, then A4 — the order `_catalog.ts` sets and the reason for it. */
export { STOCKS };
