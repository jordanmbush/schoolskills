/**
 * What the bench opens on, for every family it can make.
 *
 * One config each, and each one a sheet somebody would actually print: the
 * builder's first job is to show a page rather than a form, so switching family
 * has to produce a finished worksheet before a single option is touched. That
 * is the same bargain the catalog pages strike (§8) — a page that *is* the
 * sheet — reached from the other side.
 *
 * It lives in the view rather than in the engine, and that is deliberate. A
 * family's `SheetSpec` says what it can build, not what a parent probably
 * wants; "twenty-four sums with both numbers under twenty" is an editorial
 * judgement about children, of a piece with the copy in `_maths.ts`, and the
 * engine has no business holding one. `deckSpec` draws the same line.
 *
 * Every value here is inside the range its own family clamps to, so nothing
 * below can produce a sheet that fails to fit — the builder never opens on a
 * page it would have to apologise for.
 */
import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "@/engine/sheets/paper";
import type { SheetConfig, SheetOptions } from "@/engine/sheets/types";

/**
 * The name and date line, printed blank, always.
 *
 * There is nowhere in a config to put a value for either (§1), which is what
 * makes the shared-link half of this screen safe by construction rather than by
 * a rule somebody has to remember: a child's name is written on the paper with
 * a pencil and never travels in a URL.
 */
const BASE: SheetOptions = {
  paper: DEFAULT_PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: ["name", "date"],
};

/** The twelve tables, which is what a fact sheet draws from unless told less. */
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Halves through twelfths, skipping the ones a primary child never meets. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];

const DEFAULTS: Record<string, SheetConfig> = {
  blank: { ...BASE, kind: "blank", title: "Blank sheet" },
  paper: { ...BASE, kind: "paper", rule: { style: "wide" } },
  arithmetic: {
    ...BASE,
    kind: "arithmetic",
    operation: "add",
    style: "standard",
    form: "horizontal",
    range: { min: 1, max: 20 },
    count: 24,
    columns: 3,
    regrouping: "either",
  },
  multiplication: {
    ...BASE,
    kind: "multiplication",
    operation: "multiply",
    style: "standard",
    form: "horizontal",
    tables: TABLES,
    factors: { min: 1, max: 12 },
    count: 30,
    columns: 3,
  },
  fractions: {
    ...BASE,
    kind: "fractions",
    style: "identify",
    operation: "add",
    denominators: DENOMINATORS,
    pairing: "like",
    model: "both",
    count: 12,
    columns: 2,
  },
  decimals: {
    ...BASE,
    kind: "decimals",
    style: "standard",
    operation: "add",
    form: "vertical",
    places: 2,
    range: { min: 1, max: 20 },
    count: 16,
    columns: 3,
  },
  money: {
    ...BASE,
    kind: "money",
    currency: "usd",
    operation: "add",
    form: "vertical",
    range: { min: 1, max: 20 },
    count: 16,
    columns: 3,
  },
  time: {
    ...BASE,
    kind: "time",
    style: "read",
    step: 5,
    count: 8,
    columns: 2,
  },
  measure: {
    ...BASE,
    kind: "measure",
    style: "convert",
    system: "metric",
    quantities: ["length"],
    range: { min: 1, max: 50 },
    count: 16,
    columns: 2,
  },
  geometry: {
    ...BASE,
    kind: "geometry",
    style: "area",
    system: "metric",
    range: { min: 2, max: 12 },
    quadrants: 1,
    count: 8,
    columns: 2,
  },
  integers: {
    ...BASE,
    kind: "integers",
    style: "arithmetic",
    operation: "add",
    range: { min: 1, max: 20 },
    negatives: true,
    terms: 3,
    powers: true,
    count: 20,
    columns: 3,
  },
  prealgebra: {
    ...BASE,
    kind: "prealgebra",
    style: "equation",
    steps: 1,
    range: { min: 1, max: 12 },
    negatives: false,
    quadrants: 1,
    count: 16,
    columns: 2,
  },
  ratio: {
    ...BASE,
    kind: "ratio",
    style: "simplify",
    range: { min: 2, max: 24 },
    count: 16,
    columns: 2,
  },
  statistics: {
    ...BASE,
    kind: "statistics",
    style: "all",
    size: 5,
    range: { min: 1, max: 20 },
    count: 6,
    columns: 1,
  },
  "word-problems": {
    ...BASE,
    kind: "word-problems",
    topics: ["integers", "rate", "average"],
    range: { min: 2, max: 30 },
    count: 6,
    columns: 1,
    workspace: true,
  },
};

/** Where the bench opens when the address bar had nothing to say. */
export const FIRST_SHEET = "arithmetic";

/**
 * A starting config for a family, or the first sheet's if this build has never
 * heard of it.
 *
 * Never throws, for the same reason `sheetSpec` doesn't: the kind can come from
 * a picker built out of `listSheets()`, and a family added to the registry
 * without a default here would otherwise take the whole bench down rather than
 * open on something.
 */
export function defaultConfig(kind: string): SheetConfig {
  return Object.hasOwn(DEFAULTS, kind) ? DEFAULTS[kind] : DEFAULTS[FIRST_SHEET];
}
