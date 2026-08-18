/**
 * Every shelf in the Print Shop, in one list.
 *
 * Underscored so Astro leaves it out of the routing table: it is data the hubs
 * share rather than a route of its own — the same job `_catalog.ts` does for
 * paper and `_maths.ts` for the worksheets, one level up. Each of those ten
 * files knows one shelf completely; this one knows only that there are ten of
 * them, which is all a page listing sheets ACROSS shelves needs.
 *
 * **It exists because of the grade hubs.** A page about what a seven-year-old
 * can print has no shelf of its own — it cuts across all of them — and the
 * alternative to a registry is ten imports and ten maps in every such page,
 * which is ten chances to leave one out and no way to notice. Adding a shelf is
 * an entry here, and the grade pages list it without being edited.
 *
 * **The projection is deliberately thin.** A `ShelfSheet` is the six things a
 * cross-shelf listing actually reads — where it prints, what to call it, what
 * it teaches, the ages the sheet's own page states, what kind of page it is and
 * which ruling it is on — and nothing else. Configs, seeds, leads, blurbs and
 * notes stay in the catalog that owns them, so this file cannot quietly become
 * a second place a sheet is described, and a field nobody reads cannot sit here
 * documenting a contract nothing keeps.
 *
 * The last two arrived with the search index (§18 phase 7), and neither is a
 * new judgement: both are read off the config the catalog already builds the
 * sheet from, so a facet cannot say one thing while the paper under it says
 * another.
 */
import { typeOf, ruleOf, type SheetType } from "@/engine/sheets/search";
import type { RuleStyle, SheetConfig } from "@/engine/sheets/types";

import { BIBLE_SHEETS, hrefFor as bibleHref } from "./_bible";
import { PAPER_SHEETS, STOCKS, paperConfig, stockHref } from "./_catalog";
import { CHART_SHEETS, pathFor as chartPath } from "./_charts";
import { CURSIVE_SHEETS, hrefFor as cursiveHref } from "./_cursive";
import { GRAMMAR_SHEETS, pathFor as grammarPath } from "./_grammar";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import { PHONICS_SHEETS, pathFor as phonicsPath } from "./_phonics";
import { SPELLING_SHEETS, pathFor as spellingPath } from "./_spelling";
import { TEMPLATE_SHEETS, pathFor as templatePath } from "./_templates";

/** The shelves, in the order the front door sets them out. */
export type ShelfId =
  | "math"
  | "handwriting"
  | "cursive"
  | "bible"
  | "spelling"
  | "grammar"
  | "phonics"
  | "charts"
  | "templates"
  | "paper";

/** One sheet, as a page that did not write it lists it. */
export type ShelfSheet = {
  /** Where it prints. On the shelves with two stocks, the default one. */
  href: string;
  /**
   * The sheet's full name, which is what a cross-shelf page links it by.
   *
   * The catalogs also carry a `short` — "Equivalent", "Decimals", "1 inch" —
   * and a shelf's own hub can use it, because everything around it is from the
   * same shelf and often the same strand. A grade page has no such context:
   * one row per shelf, ten shelves deep, where "Chart" is a times-table chart
   * on the maths shelf and "Decimals" is two different sheets on two of them.
   * So the projection carries the name and not the label, deliberately.
   */
  name: string;
  /** For the `LearningResource` block. */
  teaches: string;
  /**
   * The ages the sheet's own page states: "Ages 6–9", or "Ages 4+".
   *
   * The grade hubs are built entirely out of this string, which is why it is
   * carried rather than restated — see `_grades.ts` for how it is read, and
   * why a shape it cannot read fails the build rather than emptying a page.
   */
  ages: string;
  /**
   * What kind of page it is — a worksheet, a reference, a form, and so on.
   *
   * The second axis the search box filters on, crossing the shelf rather than
   * repeating it: tracing and copying a model is the same job on the
   * handwriting, cursive, Bible and spelling shelves, and a parent looking for
   * it is not looking for a subject. Folded from the config's family, so adding
   * a family without saying what kind of page it makes fails type-checking —
   * see `TYPE_OF` in `@/engine/sheets/search`.
   */
  type: SheetType;
  /** The ruling it is printed on, on the two families that have one. */
  rule?: RuleStyle;
};

export type Shelf = {
  id: ShelfId;
  /** What it is called in a heading and in a row of links. */
  label: string;
  /**
   * Where all of it is listed.
   *
   * A hub of its own for nine of the ten. Paper's is the front door itself:
   * `/printables` sets out all fifteen rulings with the sentence that tells
   * one from the next, because a ruling is chosen by reading how it differs
   * from the ruling beside it rather than by recognising a topic. `hub` is
   * what says which of the two this is, so a nav of subject hubs can leave the
   * front door out without hard-coding which shelf is the exception.
   */
  href: string;
  hub: boolean;
  /**
   * What the link to `href` is labelled, in that shelf's own words.
   *
   * Written out rather than composed from `label`, because "All the Scripture
   * sheets" and "All the forms, planners and cards" are what those two shelves
   * call themselves on the front door, and a generated "all the bible sheets"
   * would be a worse sentence in three of the ten cases.
   */
  all: string;
  /** One line: what the shelf is for, in the words a parent would use. */
  blurb: string;
  sheets: ShelfSheet[];
};

/** Listed on the default stock; each sheet page carries the link to its twin. */
const letter = STOCKS[0];

/**
 * What a catalog entry has to state before it can be listed here.
 *
 * Exactly `ShelfSheet` minus the two fields this file works out for itself —
 * where the sheet prints, which is the shelf's own route helper, and the two
 * facets, which are read off the config. Widening `ShelfSheet` therefore
 * widens this, and a field can't be required here that no listing goes on to
 * read.
 */
type Listed = Omit<ShelfSheet, "href" | "type" | "rule"> & {
  config: SheetConfig;
};

/**
 * The projection every shelf makes onto a listing.
 *
 * Generic over the fields it reads rather than over a sheet type: the ten
 * catalogs agree on these four field names and on nothing else, and this file
 * has no business knowing what a `PaperSheet` has that a `MathsSheet` doesn't.
 */
const listing = <Sheet extends Listed>(
  sheets: Sheet[],
  href: (sheet: Sheet) => string,
): ShelfSheet[] =>
  sheets.map((sheet) => ({
    href: href(sheet),
    name: sheet.name,
    teaches: sheet.teaches,
    ages: sheet.ages,
    type: typeOf(sheet.config),
    rule: ruleOf(sheet.config),
  }));

export const SHELVES: Shelf[] = [
  {
    id: "math",
    label: "Maths",
    href: "/printables/math",
    hub: true,
    all: "All the maths sheets",
    blurb:
      "Worksheets from adding to twenty through to word problems, each with its answer key on the page behind it.",
    sheets: listing(MATHS_SHEETS, mathsPath),
  },
  {
    id: "handwriting",
    label: "Handwriting",
    href: "/printables/handwriting",
    hub: true,
    all: "All the handwriting sheets",
    blurb:
      "Letters traced, then copied, then written on an empty line — the same three steps at every size of ruling.",
    sheets: listing(HANDWRITING_SHEETS, (sheet) =>
      handwritingHref(sheet, letter),
    ),
  },
  {
    id: "cursive",
    label: "Cursive",
    href: "/printables/cursive",
    hub: true,
    all: "All the cursive sheets",
    blurb:
      "The same progression again in a joined hand, including the page printing never needed — the joins themselves.",
    sheets: listing(CURSIVE_SHEETS, (sheet) => cursiveHref(sheet, letter)),
  },
  {
    id: "bible",
    label: "Bible",
    href: "/printables/bible",
    hub: true,
    all: "All the Scripture sheets",
    blurb:
      "Scripture copywork, handwriting and memory work: the sheets above with a passage on them, in a public-domain translation.",
    sheets: listing(BIBLE_SHEETS, (sheet) => bibleHref(sheet, letter)),
  },
  {
    id: "spelling",
    label: "Spelling",
    href: "/printables/spelling",
    hub: true,
    all: "All the spelling sheets",
    blurb:
      "This week’s list in five shapes, the first sight words, and the pages on how words are put together.",
    sheets: listing(SPELLING_SHEETS, spellingPath),
  },
  {
    id: "grammar",
    label: "Grammar",
    href: "/printables/grammar",
    hub: true,
    all: "All the grammar sheets",
    blurb:
      "How a sentence is put together — the parts of speech, its two halves, what it is for, and the marks that finish it.",
    sheets: listing(GRAMMAR_SHEETS, grammarPath),
  },
  {
    id: "phonics",
    label: "Phonics",
    href: "/printables/phonics",
    hub: true,
    all: "All the phonics sheets",
    blurb:
      "Built from the sounds you have ticked, so a sheet never contains a spelling that has not been taught yet.",
    sheets: listing(PHONICS_SHEETS, phonicsPath),
  },
  {
    id: "charts",
    label: "Charts and grids",
    href: "/printables/charts",
    hub: true,
    all: "All the charts and grids",
    blurb:
      "References with nothing on them to answer: hundred charts, number lines, coordinate grids and place-value columns.",
    sheets: listing(CHART_SHEETS, chartPath),
  },
  {
    id: "templates",
    label: "Forms and planners",
    href: "/printables/templates",
    hub: true,
    all: "All the forms, planners and cards",
    blurb:
      "The paperwork a week needs — logs, reports, calendars, charts, certificates and cards. Supposed to be empty.",
    sheets: listing(TEMPLATE_SHEETS, templatePath),
  },
  {
    id: "paper",
    label: "Paper",
    href: "/printables",
    hub: false,
    all: "All the paper and rulings",
    blurb:
      "Ruled paper by the sheet: notebook rules, the five handwriting sizes, and squares, dots and triangles.",
    /*
      The one shelf whose entries state a ruling rather than a config, because
      a `PaperConfig` *is* a ruling and nothing else — so the config is made
      here, at the stock the front door lists. Which stock is immaterial to
      both facets: a ⅝ rule is a ⅝ rule on Letter and on A4, which is the whole
      reason each ruling comes on both.
    */
    sheets: listing(
      PAPER_SHEETS.map((sheet) => ({
        ...sheet,
        config: paperConfig(sheet, letter.id),
      })),
      (sheet) => stockHref("/printables", sheet.slug, letter),
    ),
  },
];

/** The nine shelves with a hub of their own — the subject nav, in order. */
export const HUBS: Shelf[] = SHELVES.filter((shelf) => shelf.hub);

/** Every sheet in the shop, whichever shelf it is on. */
export const ALL_SHEETS: ShelfSheet[] = SHELVES.flatMap(
  (shelf) => shelf.sheets,
);
