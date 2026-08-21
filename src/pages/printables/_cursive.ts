/**
 * The cursive sheets the Print Shop has set, and the words that go round them.
 *
 * **A catalog of its own rather than a fourth group under handwriting.** What a
 * page is *for* is the query somebody typed, and nobody who wants cursive types
 * "handwriting". They are also two progressions rather than one — a child
 * arrives at cursive already able to print, and starts again at the letter — so
 * an interleaved shelf would be one where the sheet after the alphabet is
 * sometimes the next step and sometimes the same step in another hand. The two
 * hubs link to each other instead.
 *
 * **The engine has no cursive family, and doesn't need one.** A cursive sheet
 * is a handwriting sheet with a joining face on it, which is the whole of the
 * difference for letters, words and passages. The one thing joined writing adds
 * is the `joins` style (§6).
 *
 * **Two stocks, two routes, as with paper and handwriting**: the ruling on
 * these sheets is a measurement (§8).
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type {
  HandwritingConfig,
  PaperSize,
  SheetFont,
} from "@/engine/sheets/types";

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
export type CursiveGroup = "letters" | "joins" | "words" | "passages";

export type CursiveSheet = {
  /** The route under /printables/cursive, and the head term it answers. */
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
  group: CursiveGroup;
  /** Where the words on it came from, printed under the sheet where it matters. */
  credit?: string;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: HandwritingConfig;
};

/**
 * The seed every cursive sheet is built from, and it never moves.
 *
 * Nothing here is drawn at random — an alphabet is an alphabet — so the seed
 * decides nothing and only prints in the footer. It is still fixed and still
 * carried into the builder link, because §7's promise is about the whole shop:
 * the number on the paper gets you the identical sheet back.
 */
export const CURSIVE_SEED = 1;

/**
 * The model every sheet on this shelf is set in: the looped traditional hand.
 *
 * One model on the shelf, three in the builder. A shelf whose pages each used a
 * different model looks inconsistent to the one reader who can tell, and which
 * model a school teaches is a question, which belongs on the bench (§8).
 * Written down once here, because seven chances to say so is seven chances to
 * differ.
 */
const MODEL: SheetFont = "cursive";

/**
 * The seven days, which is what a first cursive word list should be.
 *
 * Not the sight words the print shelf uses: a child meeting cursive can already
 * read, and what they cannot yet do is write a whole word without lifting the
 * pencil. The days are the words they will write most often for the rest of
 * their schooling, and between them they carry a capital, a `d` after an `n`,
 * the `ur` of Thursday and the `ed` of Wednesday — three of the joins the sheet
 * before this one teaches.
 */
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Four sentences chosen for the joins in them rather than for what they say.
 *
 * Short enough that none of them wraps on either stock, because the point of
 * the sheet is a whole line written without stopping. Between them they carry
 * every family on the joins sheet, and a break letter in the middle of a word
 * where it is hardest to remember.
 */
const SENTENCES = [
  "We watched the owl fly over the lake.",
  "Ben and his dog ran home in the rain.",
  "She wrote her name on the top line.",
  "My little brother can write it too.",
].join("\n");

/**
 * The opening of "The Owl and the Pussy-cat", Edward Lear, 1871 — public domain
 * twice over by age, and the nonsense poem most English-speaking children meet
 * before they are eight.
 *
 * A different poem from the print copywork sheet on purpose: the two pages are
 * otherwise the same exercise a year apart, and a child who did that one in
 * Year 2 should not be handed the same four lines back with the letters joined
 * up.
 */
const OWL = [
  "The Owl and the Pussy-cat went to sea",
  "In a beautiful pea-green boat,",
  "They took some honey, and plenty of money,",
  "Wrapped up in a five-pound note.",
].join("\n");

export const CURSIVE_SHEETS: CursiveSheet[] = [
  /* ── Letters ────────────────────────────────────────────────────────── */
  {
    slug: "cursive-alphabet-worksheets",
    name: "The cursive alphabet, capital and small",
    short: "A to Z",
    heading: "Cursive alphabet worksheets",
    keyword: "Free printable cursive alphabet worksheets",
    summary:
      "Every letter of the alphabet in cursive as a capital and a small letter, on ⅝-inch ruled paper: a solid model, a dotted letter to trace, and an empty space to write it alone.",
    lead: "All twenty-six letters in a joined hand, each written as the pair a child is taught — A then a, B then b. Every letter gets a solid model to look at, a dotted one to trace over, and an empty space at the end where nobody is helping.",
    notes: [
      "Cursive starts where printing started, with the letters, and that is not a step to skip because a child can already print. The shapes are different: a cursive a starts with a lead-in from the baseline, a b finishes at the top of its body rather than the bottom, and an f is one stroke rather than two. What carries over is the paper and the progression — the same ⅝ ruling, the same trace, then copy, then write on your own.",
      "The capital and the small letter sit together on the same line, and in cursive that is doing a second job. Some capitals join to the letter after them and some do not, and which is which is a fact about the hand being taught rather than about the letter — the model decides it, and a model taught two counties away decides it differently. That is why this page does not list them: what is printed on the sheet is whatever the hand it is set in actually does, and writing the pair is how a child finds it out without being told.",
    ],
    teaches: "Writing the cursive alphabet",
    ages: "Ages 7–10",
    group: "letters",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: MODEL,
      style: "letters",
      letters: "both",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },
  {
    slug: "cursive-capital-letters-worksheets",
    name: "Cursive capitals",
    short: "Capitals",
    heading: "Cursive capital letter worksheets",
    keyword: "Free printable cursive capital letter worksheets",
    summary:
      "The twenty-six cursive capitals on ¾-inch paper, drawn hollow to trace inside and then written alone — the letters that are least like their printed shapes.",
    lead: "Capital letters only, on the larger ¾-inch ruling, with each model drawn as an outline to write inside rather than a line to follow. Cursive capitals are the letters furthest from the printed ones, and they are worth a page of their own.",
    notes: [
      "A cursive capital is often a different shape rather than a joined-up version of the printed one — the Q that looks like a 2, the F with its crossbar carried through, the G that begins from the top right. A child who has been printing for three years is not adapting a letter they know here; they are learning a new one, which is why the ruling is a size larger and why the models are hollow rather than dotted.",
      "Hollow letters are the right model for a shape this unfamiliar. A dotted line tells the pencil where to go and can be followed without ever looking at the letter; an outline asks the child to keep a stroke inside two edges, which means seeing the whole shape and its width. Once the outlines are being filled confidently, the same sheet on dotted or on nothing at all is one setting away in the builder.",
    ],
    teaches: "Forming cursive capital letters",
    ages: "Ages 7–10",
    group: "letters",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: MODEL,
      style: "letters",
      letters: "upper",
      rule: { style: "hand-3-4", midline: "dashed", descender: true },
      trace: "hollow",
      repeats: 3,
    },
  },
  {
    slug: "cursive-lowercase-worksheets",
    name: "Cursive small letters",
    short: "Small letters",
    heading: "Cursive lowercase worksheets",
    keyword: "Free printable cursive lowercase worksheets",
    summary:
      "The twenty-six small cursive letters on ⅝-inch paper with a dashed midline and room for the loops, traced twice and then written alone.",
    lead: "Small letters on their own, on the ⅝ paper a school means by handwriting paper. Most of them start with a lead-in stroke from the baseline and all of them finish with an exit stroke — the anticlockwise letters a, c, d, g, o and q are the exception, because they are entered at the top — and those strokes are what every join is made of.",
    notes: [
      "The small letters are where joined writing is actually learnt, because they are the ones that join. Each letter here is drawn with the stroke that leads into it and the stroke that leaves it, so a child practising a single letter is already practising both halves of a join — which is why a cursive letter looks unfinished on its own and is supposed to.",
      "The descender space matters more here than it does in print. In the looped hand a g, a j and a y drop below the baseline and come back up to meet the next letter, so the tail is not decoration but the road to the following letter. That is the reason this sheet is ruled with a tail space rather than on plain two-line paper, and the reason the loops are drawn full size rather than clipped at the line.",
    ],
    teaches: "Forming lowercase cursive letters",
    ages: "Ages 7–10",
    group: "letters",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: MODEL,
      style: "letters",
      letters: "lower",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 4,
    },
  },

  /* ── Joins ──────────────────────────────────────────────────────────── */
  {
    slug: "cursive-joins-worksheets",
    name: "The joins, all six families",
    short: "Joins",
    heading: "Cursive joins worksheets",
    keyword: "Free printable cursive joining letters worksheets",
    summary:
      "Thirty letter pairs on ⅝-inch paper, five from each family of join: diagonal and horizontal, into small letters and tall ones, into the round letters, and the pairs where the pencil lifts.",
    lead: "The sheet cursive has and printing does not. A join is a stroke between two letters and it can only be practised with both of them there, so this page is thirty pairs — in, ch, ow, wh, ea, ba — each traced and then written from nothing.",
    notes: [
      "Joins are taught in families rather than as 676 pairs, and the families are named for where the stroke starts and where it has to arrive. A diagonal join climbs from the baseline into the next letter; a horizontal one carries across from the top of an o, an r, a v or a w; and a tall second letter changes where the stroke lands. The round letters — a, c, d, g, o and q — get a family of their own because they are entered at the top, and a child who joins into them the ordinary way writes oi where they meant oa.",
      "The last five pairs on the page are the ones where the pencil may lift, and whether it does is a fact about the hand being taught rather than about the letters. This sheet is set in the looped traditional model, which joins out of every letter including b, g, j, p, q and y. Print the same sheet in the unlooped model from the builder and those five pairs come out separated, because that model lifts the pencil after them — the sheet is right in both, and it is the model that answers, not us.",
    ],
    teaches: "Joining letters in cursive",
    ages: "Ages 7–10",
    group: "joins",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: MODEL,
      style: "joins",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },

  /* ── Words ──────────────────────────────────────────────────────────── */
  {
    slug: "cursive-words-worksheets",
    name: "The days of the week",
    short: "Words",
    heading: "Cursive word worksheets",
    keyword: "Free printable cursive word worksheets",
    summary:
      "The seven days of the week in cursive on ⅝-inch paper, each one written as one unbroken word: a model, a dashed copy to write over, and an empty line.",
    lead: "The seven words a child will write more often than any others, one to a line. A whole word in cursive is written without lifting the pencil, and these are long enough for that to be the exercise rather than an afterthought.",
    notes: [
      "The days of the week are the first words worth joining, and not because they are easy. They are what goes at the top of a page next to the date for the rest of a child's schooling, they each begin with a capital that may or may not join, and between them they carry the ur of Thursday, the ed of Wednesday and the on of Monday — three of the joins on the sheet before this one, met in a real word rather than as a pair.",
      "The models are dashed here rather than dotted, which is the step after tracing dots. A dotted letter is a path with the decisions already made; a dashed one gives the direction and leaves the pencil to carry the stroke between the marks, which is much closer to writing. If a word is coming apart in the middle, go back to the joins sheet for that pair rather than writing the whole word out again.",
    ],
    teaches: "Writing whole words in cursive",
    ages: "Ages 7–10",
    group: "words",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: MODEL,
      style: "words",
      words: DAYS,
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dashed",
      repeats: 3,
    },
  },

  /* ── Sentences and passages ─────────────────────────────────────────── */
  {
    slug: "cursive-sentence-worksheets",
    name: "Sentences to trace and copy",
    short: "Sentences",
    heading: "Cursive sentence worksheets",
    keyword: "Free printable cursive sentence worksheets",
    summary:
      "Four sentences on half-inch paper, chosen for the joins in them: each printed as a model, traced twice on the lines below, and then written on a line of its own.",
    lead: "Four sentences a seven-year-old can read, on the half-inch ruling that fits a whole one on a line. Each appears four times down the page — printed to read, dotted twice to trace, and empty to write — and each was picked for the joins inside it rather than for what it says.",
    notes: [
      "A sentence is where joined writing either holds together or stops. Word spacing is the thing that goes first: letters that join inside a word and a clear gap between words is the whole rule, and a child who is concentrating on the joins will run two words into one within a line or two. The model line at the top of each group is there to be looked at for exactly that, and the half-inch ruling is what fits a sentence on one line so the spacing is visible across the whole of it.",
      "Between them these four sentences carry every family on the joins sheet: wh and ow and ol, ch and th, ea and oa, and a break letter in the middle of a word where it is hardest to remember. That is why they read the way they do — they were chosen for their joins, the way a handwriting sentence has been chosen for its letters since copybooks were printed.",
    ],
    teaches: "Writing whole sentences in cursive",
    ages: "Ages 7–11",
    group: "passages",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: MODEL,
      style: "passage",
      text: SENTENCES,
      rule: { style: "hand-1-2", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 4,
    },
  },
  {
    slug: "cursive-copywork-worksheets",
    name: "Copywork — a poem in cursive",
    short: "Copywork",
    heading: "Cursive copywork worksheets",
    keyword: "Free printable cursive copywork worksheets",
    summary:
      "The opening of “The Owl and the Pussy-cat” on ⅜-inch transitional paper: the line printed, two grey copies to write over, and an empty line to write it from nothing.",
    lead: "Four lines of a real poem, one at a time, in a joined hand on the small transitional ruling. Each line is printed to read, printed faintly twice to write over, and then left as an empty ruled line. This is the sheet where cursive stops being an exercise and becomes handwriting.",
    notes: [
      "The ⅜ ruling has a top line and a baseline and no midline at all, which is as much help as an ordinary exercise book gives. Cursive at this size is a fair test of whether the hand has actually learnt the letters or has been copying large ones: loops close up, the joins get shorter than the letters, and anything a child was drawing rather than writing stops working. If it falls apart here, the ⅝ version of the same sheet is one setting away.",
      "The faint grey lines are the step after dotted and dashed. A grey line is a shape to write over rather than a path to follow, so the pencil is making every decision and the model is only confirming them. By the empty line at the bottom of each group the poem has been read four times, which is the other half of what copywork has always been for — a child copying Lear is reading Lear.",
    ],
    teaches: "Cursive copywork and sustained joined writing",
    ages: "Ages 8–12",
    group: "passages",
    credit: "“The Owl and the Pussy-cat”, Edward Lear, 1871. Public domain.",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      font: MODEL,
      style: "passage",
      text: OWL,
      rule: { style: "hand-3-8", midline: "none", descender: true },
      trace: "dim",
      repeats: 4,
    },
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const CURSIVE_GROUPS: Array<{
  id: CursiveGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "letters",
    label: "Letters",
    blurb: "The shapes, which are not the printed ones, one page each.",
  },
  {
    id: "joins",
    label: "Joins",
    blurb: "The stroke between two letters — the thing printing never needed.",
  },
  {
    id: "words",
    label: "Words",
    blurb: "A whole word without lifting the pencil.",
  },
  {
    id: "passages",
    label: "Sentences and copywork",
    blurb: "A whole line at a time, once the joins are no longer the work.",
  },
];

/**
 * The three models, and the sheet each one is best shown on.
 *
 * On the hub rather than in the shelf, because a model is not another
 * worksheet: a parent who needs a different one needs it on every sheet rather
 * than on one. `href` opens the alphabet sheet on the bench already set to that
 * model.
 */
export const CURSIVE_MODELS: Array<{
  font: SheetFont;
  label: string;
  blurb: string;
}> = [
  {
    font: "cursive",
    label: "Looped",
    blurb:
      "The traditional hand, with loops on the ascenders and descenders and a join out of every letter. What most American schools teach, and what every sheet here is set in.",
  },
  {
    font: "cursive-modern",
    label: "Unlooped",
    blurb:
      "The same letters without the loops, and the model that lifts the pencil: b, f, g, j, p, q, s and y do not join to what follows them.",
  },
  {
    font: "cursive-uk",
    label: "Fully joined",
    blurb:
      "The continuous hand a British primary school teaches: a lead-in stroke into every letter, no loops, and a join out of all twenty-six.",
  },
];

/** The same sheet, measured for another stock. */
export function configFor(
  sheet: CursiveSheet,
  size: PaperSize,
): HandwritingConfig {
  return { ...sheet.config, paper: paperOf(size) };
}

/** The route a sheet prints at, on a given stock — see `_catalog.ts`. */
export const pathFor = (sheet: CursiveSheet, stock: Stock): string =>
  stockPath(sheet.slug, stock);

/** The whole URL, which is what a hub links to and the canonical says. */
export const hrefFor = (sheet: CursiveSheet, stock: Stock): string =>
  stockHref("/printables/cursive", sheet.slug, stock);

/**
 * The builder, opened on this sheet — optionally in another model.
 *
 * The one link this shelf needs that the print one doesn't: `font` is how the
 * hub offers the other two models without a second copy of the shelf.
 */
export const builderHref = (
  sheet: CursiveSheet,
  stock: Stock,
  font: SheetFont = MODEL,
): string => benchHref({ ...configFor(sheet, stock.id), font }, CURSIVE_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function cursiveShelf(): Array<{
  id: CursiveGroup;
  label: string;
  blurb: string;
  sheets: CursiveSheet[];
}> {
  return shelve(CURSIVE_GROUPS, CURSIVE_SHEETS);
}

/** Letter first, then A4 — the order `_catalog.ts` sets and the reason for it. */
export { STOCKS };
