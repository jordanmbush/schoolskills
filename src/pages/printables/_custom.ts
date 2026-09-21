/**
 * The builder's front door, and the three pages behind it (§8).
 *
 * The bench at `/printables/make` is a `client:only` island and carries
 * `noindex`, so a search for a custom worksheet had no page on this site to
 * land on: every indexable page is about one sheet, and the one screen that
 * makes a sheet to order was invisible. These four pages are that front door.
 * Each is a real page in the catalog's own shape — prose that answers the
 * query, a finished sheet as HTML under it, and links into the builder that
 * open on exactly the sheet named — rather than a page about a feature.
 *
 * Four rather than a permutation: the front door for "custom worksheets" and
 * "build your own", and one page for each of the three jobs the builder does
 * that no fixed sheet can — a spelling list of your own, a name or word to
 * trace, and math to your own numbers. Every door on them is a config the
 * bench would open on anyway, encoded into the link the way a catalog page's
 * own builder link is, so nothing here can describe a sheet the bench cannot
 * make.
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import { encodeSharedSheet } from "@/engine/sheets/share";
import type {
  HandwritingConfig,
  HeaderField,
  Paper,
  SheetConfig,
  SheetFont,
  WordsConfig,
} from "@/engine/sheets/types";
import { STARTER_WORDS, defaultConfig } from "@/games/printshop/defaults";
import { SHELVES, labelOf } from "@/games/printshop/shelves";

/** One link into the builder, opened on a finished sheet. */
export type Door = { label: string; config: SheetConfig };

/** A row of doors, under a heading where the page has more than one row. */
export type DoorGroup = { label?: string; doors: Door[] };

export type CustomPage = {
  /** The path under `/printables/custom`; `undefined` is the front door. */
  slug?: string;
  /** How the other pages link to it. */
  name: string;
  title: string;
  description: string;
  heading: string;
  lead: string;
  /** What the sheet on the page is, in a line under it. */
  caption: string;
  /** The paragraphs, under `notesHeading`. */
  notesHeading: string;
  notes: string[];
  /** The sheet the page prints, and whether its answer key follows it. */
  example: { config: SheetConfig; keyed: boolean };
  doorsHeading: string;
  doorsLead: string;
  groups: DoorGroup[];
};

/**
 * Every example is built from the same seed, for the reason `MATHS_SEED`
 * gives: the same problems on every build, so a crawler that comes back reads
 * the page it indexed.
 */
export const CUSTOM_SEED = 1;

export const CUSTOM_ROOT = "/printables/custom";

export const hrefFor = (page: CustomPage): string =>
  page.slug ? `${CUSTOM_ROOT}/${page.slug}` : CUSTOM_ROOT;

/** The builder, opened on this sheet: the config and the seed go in the link. */
export function builderHref(config: SheetConfig, seed = CUSTOM_SEED): string {
  return `/printables/make#s=${encodeSharedSheet({ config, seed })}`;
}

const PAPER: Paper = {
  size: "letter",
  orientation: "portrait",
  margin: "normal",
};

/** Name, date and class: the Class line is the one a classroom asks for. */
const CLASS_FIELDS: HeaderField[] = ["name", "date", "class"];

const SHEET = { paper: PAPER, fontPt: DEFAULT_FONT_PT, fields: CLASS_FIELDS };

/** A week's list as a school sends one home, and in the order it was sent. */
const WEEK_LIST = [
  "because",
  "friend",
  "again",
  "people",
  "school",
  "thought",
  "where",
  "which",
  "write",
  "would",
];

const SPELLING: WordsConfig = {
  ...SHEET,
  kind: "words",
  style: "copy",
  title: "This week's spelling",
  words: WEEK_LIST,
  times: 3,
  gaps: 2,
  count: WEEK_LIST.length,
  columns: 2,
};

/**
 * A name traced down the page: the same word once per line, a solid model
 * on the first, the last left empty, which is what a name sheet is. Written
 * as a passage rather than a word list, because a list holds each word once
 * and a name is wanted on every line. A first name a great many children
 * have rather than anybody's.
 */
const NAME: HandwritingConfig = {
  ...SHEET,
  kind: "handwriting",
  style: "passage",
  title: "My name",
  text: "Ava",
  guides: "all",
  rule: { style: "hand-3-4", midline: "dashed", descender: true },
  trace: "dotted",
  repeats: 6,
};

const REGROUPING: SheetConfig = {
  ...SHEET,
  kind: "arithmetic",
  operation: "subtract",
  style: "standard",
  form: "vertical",
  title: "Two-digit subtraction with regrouping",
  range: { min: 10, max: 99 },
  count: 20,
  columns: 4,
  regrouping: "always",
  workspace: true,
};

const MIXED: SheetConfig = {
  ...SHEET,
  kind: "arithmetic",
  operation: "both",
  style: "standard",
  form: "vertical",
  title: "Mixed practice to 100",
  instructions: "Show your working under each problem.",
  range: { min: 10, max: 99 },
  count: 16,
  columns: 4,
  regrouping: "either",
  workspace: true,
};

const hand = (font: SheetFont, label: string): Door => ({
  label,
  config: { ...NAME, font },
});

const spelling = (style: WordsConfig["style"], label: string): Door => ({
  label,
  config: { ...SPELLING, style },
});

/**
 * Every family the bench can make, on the chooser's own shelves and opened on
 * the sheet it opens on there. Read from the chooser rather than written out,
 * so a family added to the bench appears here without this file knowing.
 */
const EVERY_FAMILY: DoorGroup[] = SHELVES.map((shelf) => ({
  label: shelf.label,
  doors: shelf.families.map((family) => ({
    label: labelOf(family.id),
    config: defaultConfig(family.id),
  })),
}));

export const CUSTOM_PAGES: CustomPage[] = [
  {
    name: "Custom worksheets",
    title: "Custom worksheets: build your own, free | School Skills",
    description:
      "Make your own worksheet and print it: math by number range, spelling from your own list, handwriting from any word. Free, no account, nothing uploaded.",
    heading: "Custom worksheets, built to order",
    lead: "The sheet builder makes the worksheet you actually need and redraws the page as you change it. Pick a kind of sheet, set the numbers or type the words, choose the paper and the lettering, and print. Free, no account, and nothing about your child in the file.",
    caption:
      "A sheet made in the builder: mixed addition and subtraction to 100, sixteen problems with room to work, a title and an instruction line typed in, and a Class line beside Name and Date. The answer key is the second page.",
    notesHeading: "How a custom worksheet is made here",
    notes: [
      "Every sheet in The Print Shop is one setting of a family that can print thousands, and the builder is where the settings are. Addition to 20 becomes two-digit subtraction with regrouping by moving two numbers; a sight-word sheet becomes this week's spelling list by pasting the note that came home; a handwriting page traces any word you type, in print or in cursive. The page redraws as you change it, so what is on screen is what comes out of the printer, at the size it says it is.",
      "Where there are answers there is an answer key, worked out when the problems were, so the two cannot disagree. The number at the foot of every sheet is the seed it was built from: print it again next week and it is the same sheet, or ask for another and it is a new one from the same settings.",
      "The settings live in the link. A sheet you have tuned can be bookmarked, saved on this device, or handed to another family or a colleague, and the link carries the settings and nothing else. The name line is printed blank to be filled in with a pencil, and there is nowhere in a sheet to put a child's name.",
      "What the builder will not do is guess. The words on a spelling sheet are the ones you typed, not a rule's attempt at them; decimals are worked in whole hundredths rather than floating point, so a key never shows a rounding error; and nothing on a page is invented by a program and passed off as checked.",
    ],
    example: { config: MIXED, keyed: true },
    doorsHeading: "Every kind of sheet it makes",
    doorsLead:
      "Each link opens the builder on a finished sheet of that kind, ready to print or to change.",
    groups: EVERY_FAMILY,
  },
  {
    slug: "spelling",
    name: "Spelling from your own list",
    title: "Custom spelling worksheets from your own list | School Skills",
    description:
      "Paste this week's spelling words and print them written out, with letters missing, as a test, in ABC order, or hidden in a word search. Free, no account.",
    heading: "Spelling worksheets from your own list",
    lead: "Type or paste the list that came home from school and it becomes a spelling sheet: each word written out three times, or with letters missing, or as a Friday test, or in ABC order, or hidden in a word search. Seven sheets from one list, and the list is yours.",
    caption:
      "Ten words written out three times each, in the order they were given, with the week's title typed in. Swap the list for your own and the sheet is the same sheet.",
    notesHeading: "What one list becomes",
    notes: [
      "A spelling list is taught in order, so the sheet keeps the order it was typed in. Paste the whole note, numbers and commas and all, and the builder reads the words out of it; a list saved on this device from the spelling game works the same way. Ten words or forty, the sheet runs on to a second page rather than dropping any.",
      "The seven styles are the seven jobs a list gets through a week. Write it out is the first night: read the word, write it three times. Missing letters is the middle of the week, each word with letters taken out to be put back. Word shapes and ABC order make a child look at the whole word rather than at its letters. Find the word puts each one among its near misses. In a sentence gives every word a ruled line to be used on. Spelling test is Friday: numbered lines and nothing else on the page.",
      "The word search is a family of its own, drawn from the same list: a grid that hides every word, with the words listed under it, and a key that shows where they were. Where a sheet has answers, the key prints as a second page.",
      "For a class, print one copy per child. A word search or a missing-letters sheet is drawn again for each copy, so the two children sharing a desk are not sharing a page, and each copy's key comes with it.",
    ],
    example: { config: SPELLING, keyed: false },
    doorsHeading: "The same list, seven ways",
    doorsLead:
      "Each link opens the builder on this list in that style. Replace the words with your own once it is open.",
    groups: [
      {
        doors: [
          spelling("copy", "Write it out"),
          spelling("missing", "Missing letters"),
          spelling("shapes", "Word shapes"),
          spelling("abc", "ABC order"),
          spelling("find", "Find the word"),
          spelling("sentence", "In a sentence"),
          spelling("test", "Spelling test"),
          {
            label: "Word search",
            config: {
              ...defaultConfig("puzzle"),
              words: WEEK_LIST,
              count: WEEK_LIST.length,
            } as SheetConfig,
          },
        ],
      },
    ],
  },
  {
    slug: "handwriting",
    name: "Name tracing and handwriting",
    title: "Name tracing worksheets, from any name or word | School Skills",
    description:
      "Type a name, a word or a sentence and print a tracing sheet: dotted models on ruled lines, in print or cursive, on ⅝-inch or ¾-inch paper. Free, no account.",
    heading: "Name tracing and handwriting worksheets, from any word",
    lead: "Type a name and it is traced across the page: a solid model, then dotted copies, then an empty stretch of line to write it alone. The same for a word, a list of words or a whole sentence, in print or in three cursive hands, on paper ruled at the size your child is taught on.",
    caption:
      "A first name on ¾-inch paper, once per line: a solid model with its stroke guides on the first line, dotted copies to trace on the next four, and the last line left empty to write it alone. Type a different name and the sheet is the same sheet.",
    notesHeading: "A sheet no catalog can print",
    notes: [
      "A child's own name is the first word most of them write, and it is the one sheet a catalog cannot hold, because it is different for every child. So this one is made to order. The letters are drawn as strokes rather than set in a font, which is why a capital and the small letters after it sit on the same ruling at the right heights, and why the dotted model is the same shape as the solid one rather than a thinner face.",
      "Trace, copy, write is the order across each row: a solid model first, dotted copies in the middle, and the last cell left empty. That progression is the whole point of a tracing sheet, since the model is taken away one step at a time, and it can be turned off for a child who needs every copy dotted for now.",
      "The ruling matches the paper the school uses: 1-inch, ¾-inch or ⅝-inch with a dashed midline for the youngest, down to wide ruled for a child writing a sentence. The hand can be print, or a looped, an unlooped or a fully joined cursive; and where schools differ on a letter's shape, the single-story or double-story a, the straight or curved t, the shape can be picked.",
      "A list of words works the same way, one to a row: this week's spellings traced rather than copied, or the first sight words. A sentence or a passage is written line by line down the page instead, with the stroke guides on the model if they are wanted.",
    ],
    example: { config: NAME, keyed: false },
    doorsHeading: "The same name, in each hand",
    doorsLead:
      "Each link opens the builder on this sheet. Type the name you want once it is open, and pick the ruling.",
    groups: [
      {
        doors: [
          hand("print", "In print"),
          hand("cursive", "Looped cursive"),
          hand("cursive-modern", "Unlooped cursive"),
          hand("cursive-uk", "Fully joined cursive"),
          {
            label: "Sight words to trace",
            config: {
              ...NAME,
              title: undefined,
              text: undefined,
              guides: undefined,
              style: "words",
              words: STARTER_WORDS,
              repeats: 3,
            },
          },
          {
            label: "The alphabet",
            config: {
              ...NAME,
              title: undefined,
              text: undefined,
              guides: undefined,
              style: "letters",
              repeats: 3,
            },
          },
          {
            label: "A sentence",
            config: {
              ...NAME,
              title: undefined,
              guides: undefined,
              rule: { style: "wide" },
              text: "The quick brown fox jumps over the lazy dog.",
              repeats: 3,
            },
          },
        ],
      },
    ],
  },
  {
    slug: "math",
    name: "Math by number range",
    title: "Custom math worksheets by number range | School Skills",
    description:
      "Pick the operation, the number range and the count, and print with the answer key: sums to 20, regrouping to 100, chosen tables, long division. Free, no account.",
    heading: "Math worksheets to your own numbers",
    lead: "Every math sheet in the shop is one setting of a family that can print thousands, and the numbers are the setting. Move the range from 1–20 to 10–99 and addition facts become two-digit addition with carrying; pick the 6, 7 and 8 times tables and nothing else is on the page; ask for twenty problems in four columns with room to work under each. The answer key prints as the second page.",
    caption:
      "Two-digit subtraction where every problem borrows, twenty of them in four columns with working space, and the answer key on the second page.",
    notesHeading: "What the numbers control",
    notes: [
      "The range is the numbers a child sees, not the answers they reach, because that is how the work is set: “addition to 20” puts two numbers up to twenty on the page and their sum runs past it, which is what carrying is. Regrouping can be asked for on every problem, kept off every problem, or left to fall as it will, and a subtraction sheet keeps its answers above zero unless negatives are asked for.",
      "Times tables are chosen by table, so the sheet holds the ones being learned this week and not the whole square. The facts can be asked forwards, as division, or mixed, or as a missing-number problem where the answer is given and one factor is not. Long multiplication and the division bracket come with the working laid out, and a long division sheet can draw the place-value grid, the take-away rows, or the whole method to be filled in.",
      "Fractions, decimals, money, telling the time, measurement, shape, integers, pre-algebra, ratio and averages are families of their own with the same kind of switches, and word problems can be set on a topic. Every one of them has an answer key worked out with the problems, and decimals are added in whole hundredths so the key never shows a rounding error.",
      "No problem appears twice on a facts sheet and the order is shuffled, so a child cannot get the fourth answer from the third. Each copy in a class set is a new draw of the same settings with its own key, so the two children sharing a desk are not sharing a page.",
    ],
    example: { config: REGROUPING, keyed: true },
    doorsHeading: "Start from one of these",
    doorsLead:
      "Each link opens the builder on a finished sheet. Change the numbers once it is open.",
    groups: [
      {
        doors: [
          {
            label: "Addition facts to 20",
            config: defaultConfig("arithmetic"),
          },
          { label: "Subtraction with regrouping", config: REGROUPING },
          { label: "Mixed to 100", config: MIXED },
          {
            label: "Three-digit columns",
            config: {
              ...MIXED,
              title: undefined,
              instructions: undefined,
              operation: "add",
              range: { min: 100, max: 999 },
              count: 12,
              columns: 3,
            },
          },
          {
            label: "The 6, 7 and 8 times tables",
            config: {
              ...defaultConfig("multiplication"),
              tables: [6, 7, 8],
            } as SheetConfig,
          },
          {
            label: "Division facts",
            config: {
              ...defaultConfig("multiplication"),
              operation: "divide",
            } as SheetConfig,
          },
          {
            label: "Long division",
            config: {
              ...defaultConfig("multiplication"),
              operation: "divide",
              style: "long",
              digits: { into: 3, by: 1 },
              help: "grid",
              count: 6,
              columns: 2,
            } as SheetConfig,
          },
          { label: "Fractions", config: defaultConfig("fractions") },
          { label: "Decimals", config: defaultConfig("decimals") },
          { label: "Word problems", config: defaultConfig("word-problems") },
        ],
      },
    ],
  },
];
