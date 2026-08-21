/**
 * Which families of sheet this build makes, what each is called, and how to
 * fetch the one being printed (§3).
 *
 * The table below is the only place a family's identity is written down.
 * `SheetSpec` says how a family behaves and no longer says what it is called,
 * because the picker has to name all twenty-seven while loading none of them.
 *
 * **The loaders are dynamic deliberately.** A family reached by a static import
 * is a family in the bundle, and several carry a corpus: the passage library is
 * 174 KB of text on its own, so a parent choosing a times-table sheet was
 * downloading the King James Bible to do it. `() => import(...)` puts each
 * family in a chunk of its own, fetched when it is chosen and not before.
 *
 * `index.ts` is the other half of the trade. It awaits every entry here once,
 * so the catalog build and the tests keep an ordinary synchronous `buildSheet`
 * — one table of loaders, two doors onto it, and nothing to keep in step.
 */
import { UNKNOWN_SHEET, type SheetSpec } from "./spec";

export type SheetFamily = {
  /** Matches `SheetConfig.kind`, so a saved sheet finds its way back here. */
  id: string;
  /** How it reads in the picker — the one thing known before it loads. */
  label: string;
  load: () => Promise<SheetSpec>;
};

/**
 * Everything this build can make, in the order the picker offers it: blank
 * paper, then the stationery, then the subjects roughly by age.
 */
export const SHEET_FAMILIES: readonly SheetFamily[] = [
  {
    id: "blank",
    label: "Blank page",
    load: () => import("./blank").then((m) => m.BLANK_SHEET),
  },
  {
    id: "paper",
    label: "Lined and graph paper",
    load: () => import("./templates/paper").then((m) => m.PAPER_SHEET),
  },
  {
    id: "chart",
    label: "Charts, number lines and grids",
    load: () => import("./templates/charts").then((m) => m.CHART_SHEET),
  },
  {
    id: "form",
    label: "Logs, reports and forms",
    load: () => import("./templates/forms").then((m) => m.FORM_SHEET),
  },
  {
    id: "planner",
    label: "Calendars, planners and charts",
    load: () => import("./templates/planner").then((m) => m.PLANNER_SHEET),
  },
  {
    id: "cards",
    label: "Cards, tags and bookmarks",
    load: () => import("./templates/cards").then((m) => m.CARDS_SHEET),
  },
  {
    id: "net",
    label: "Dice and spinners",
    load: () => import("./templates/nets").then((m) => m.NET_SHEET),
  },
  {
    id: "arithmetic",
    label: "Addition and subtraction",
    load: () => import("./maths/arithmetic").then((m) => m.ARITHMETIC_SHEET),
  },
  {
    id: "multiplication",
    label: "Multiplication and division",
    load: () =>
      import("./maths/multiplication").then((m) => m.MULTIPLICATION_SHEET),
  },
  {
    id: "fractions",
    label: "Fractions",
    load: () => import("./maths/fractions").then((m) => m.FRACTIONS_SHEET),
  },
  {
    id: "decimals",
    label: "Decimals and percents",
    load: () => import("./maths/decimals").then((m) => m.DECIMALS_SHEET),
  },
  {
    id: "money",
    label: "Money",
    load: () => import("./maths/money").then((m) => m.MONEY_SHEET),
  },
  {
    id: "time",
    label: "Telling the time",
    load: () => import("./maths/time").then((m) => m.TIME_SHEET),
  },
  {
    id: "measure",
    label: "Measurement",
    load: () => import("./maths/measure").then((m) => m.MEASURE_SHEET),
  },
  {
    id: "geometry",
    label: "Shape and space",
    load: () => import("./maths/geometry").then((m) => m.GEOMETRY_SHEET),
  },
  {
    id: "integers",
    label: "Integers and powers",
    load: () => import("./maths/integers").then((m) => m.INTEGERS_SHEET),
  },
  {
    id: "prealgebra",
    label: "Pre-algebra",
    load: () => import("./maths/prealgebra").then((m) => m.PREALGEBRA_SHEET),
  },
  {
    id: "ratio",
    label: "Ratio and rate",
    load: () => import("./maths/ratio").then((m) => m.RATIO_SHEET),
  },
  {
    id: "statistics",
    label: "Mean, median and mode",
    load: () => import("./maths/statistics").then((m) => m.STATISTICS_SHEET),
  },
  {
    id: "word-problems",
    label: "Word problems",
    load: () =>
      import("./maths/wordproblems").then((m) => m.WORD_PROBLEMS_SHEET),
  },
  {
    id: "words",
    label: "Spelling list",
    load: () => import("./words/spelling").then((m) => m.WORDS_SHEET),
  },
  {
    id: "word-study",
    label: "Word study",
    load: () => import("./words/study").then((m) => m.WORD_STUDY_SHEET),
  },
  {
    id: "puzzle",
    label: "Word puzzle",
    load: () => import("./words/puzzles").then((m) => m.PUZZLE_SHEET),
  },
  {
    id: "grammar",
    label: "Grammar",
    load: () => import("./grammar/grammar").then((m) => m.GRAMMAR_SHEET),
  },
  {
    id: "phonics",
    label: "Phonics",
    load: () => import("./phonics/sheets").then((m) => m.PHONICS_SHEET),
  },
  {
    id: "handwriting",
    label: "Handwriting practice",
    load: () =>
      import("./writing/handwriting").then((m) => m.HANDWRITING_SHEET),
  },
  {
    id: "memory",
    label: "Memory verse",
    load: () => import("./writing/memory").then((m) => m.MEMORY_SHEET),
  },
];

/*
   A `Map` rather than a keyed object, for the reason `sheetSpec` gives at
   length: a kind arrives from a saved sheet or a URL somebody typed, and
   `.get("toString")` is nothing where an index would find a function.        */

const BY_ID = new Map(SHEET_FAMILIES.map((family) => [family.id, family]));

/** The family a kind names, or nothing if this build doesn't make one. */
export const sheetFamily = (kind: string): SheetFamily | undefined =>
  BY_ID.get(kind);

const FETCHING = new Map<string, Promise<SheetSpec>>();
const HERE = new Map<string, SheetSpec>();

/**
 * A family's module, fetched once and then kept.
 *
 * Never rejects, for the reason `sheetSpec` never throws: a kind out of a saved
 * sheet or a shared link may name a family this build has retired, and that has
 * to print `UNKNOWN_SHEET` rather than fail.
 *
 * A module that fails to arrive lands there too. It is the wrong sentence for a
 * dropped connection — nothing is retired — but the alternative is a promise
 * nobody settles and a bench that never draws, and a page that says something is
 * better than a page that says nothing. A reload starts the fetch over.
 */
export function loadSheet(kind: string): Promise<SheetSpec> {
  const already = FETCHING.get(kind);
  if (already) return already;

  const family = BY_ID.get(kind);
  const fetching = (family ? family.load() : Promise.resolve(UNKNOWN_SHEET))
    .catch(() => UNKNOWN_SHEET)
    .then((spec) => {
      HERE.set(kind, spec);
      return spec;
    });
  FETCHING.set(kind, fetching);
  return fetching;
}

/**
 * The same, for a caller that cannot wait: the family if its module is already
 * here, and nothing if it isn't.
 *
 * What lets the builder render from a plain value rather than a promise — and
 * what makes "the wrong family's spec" unrepresentable, because the answer is
 * looked up by the kind being asked about rather than remembered from the last
 * one that arrived.
 */
export const loadedSheet = (kind: string): SheetSpec | undefined =>
  HERE.get(kind);
