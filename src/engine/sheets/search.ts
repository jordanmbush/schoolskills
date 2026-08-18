/**
 * The catalog, as something a parent can search.
 *
 * A hundred and nineteen sheets is past the point where a shelf is a way of
 * finding anything, and there is no server here to ask (§1). So the index is
 * built with the site — plain data, shipped as one static file — and the
 * searching happens in the browser that downloaded it. Nothing is sent
 * anywhere, which is the same promise every other corner of this site makes and
 * the reason a third-party search box was never an option.
 *
 * This module is the half that has no opinion about the catalog: the shape a
 * row is written in, the fold from a sheet family onto the six kinds of page a
 * parent sorts by, the matcher, and the fragment the state travels in.
 * `src/pages/printables/_search.ts` is the other half — it reads the shelves and
 * the school years and writes the rows. Splitting them that way is what lets the
 * island import the matcher without importing the catalog, and lets the whole of
 * it be tested in plain Node.
 *
 * **Rows are tuples, deliberately.** The file lands on a phone, on the one page
 * of this section a parent opens first, and eight field names repeated a hundred
 * and nineteen times is about a fifth of the payload spent saying "teaches"
 * again. The column order is written down once, immediately below, and `readRow`
 * is the only thing that knows it.
 */
import type { RuleStyle, SheetConfig } from "./types";

/* ── What kind of page it is ───────────────────────────────────────────── */

/**
 * The six shapes of paper the shop prints, as a parent would sort them.
 *
 * Not the same axis as a shelf. A shelf answers "what subject is this"; this
 * answers "what will my child be doing with it" — and the two cross, which is
 * the whole reason both are facets. Three of the shelves happen to line up with
 * one of these exactly, because they were always defined by the kind of page
 * rather than by a subject: charts are references, paper is paper, and the
 * templates shelf is forms right through. The two large ones do not.
 * *Practice* — a model traced, copied, then written alone — is the handwriting
 * shelf, the cursive shelf, the Bible shelf and one sheet off the spelling
 * shelf, and a parent looking for it is not looking for a subject. *Worksheet*
 * spans maths, spelling, grammar and phonics the same way.
 *
 * Six rather than five because the builder can already make a word search, a
 * crossword and a scramble; no page in the curated catalog is one yet, so the
 * chip simply isn't offered until one is (see `searchIndex`).
 */
export type SheetType =
  "worksheet" | "practice" | "puzzle" | "reference" | "paper" | "form";

/**
 * How each is labelled on a chip. A word, because it sits in a row of them.
 *
 * "Practice" rather than "Handwriting", which is what these sheets mostly are:
 * the chips sit directly under a row of subjects that already has a
 * *Handwriting* in it, and two chips a line apart reading the same word would
 * be read as one control that had stopped working.
 */
export const SHEET_TYPES: Array<{ id: SheetType; label: string }> = [
  { id: "worksheet", label: "Worksheets" },
  { id: "practice", label: "Practice" },
  { id: "puzzle", label: "Puzzles" },
  { id: "reference", label: "References" },
  { id: "form", label: "Forms" },
  { id: "paper", label: "Paper" },
];

/**
 * Every sheet family in the press, folded onto the six.
 *
 * A `Record` over `SheetConfig["kind"]` rather than a lookup with a default,
 * and that is the anti-drift mechanism: adding a family to the union without
 * saying what kind of page it makes fails `npm run type-check` rather than
 * quietly filing the new sheets under whatever the fallback happened to be.
 *
 * The fold is by family, which means a family that prints more than one shape
 * of page is filed by what it mostly is — the phonics family prints cards to
 * cut out as well as exercises to work, and it is a worksheet family. The
 * alternative is a type written onto each of the hundred and nineteen entries
 * by hand, which is a second description of the sheet to keep true, and this
 * epic has already shipped copy describing sheets that weren't there.
 */
export const TYPE_OF: Record<SheetConfig["kind"], SheetType> = {
  blank: "paper",
  paper: "paper",
  chart: "reference",
  form: "form",
  planner: "form",
  cards: "form",
  net: "form",
  arithmetic: "worksheet",
  multiplication: "worksheet",
  fractions: "worksheet",
  decimals: "worksheet",
  money: "worksheet",
  time: "worksheet",
  measure: "worksheet",
  geometry: "worksheet",
  integers: "worksheet",
  prealgebra: "worksheet",
  ratio: "worksheet",
  statistics: "worksheet",
  "word-problems": "worksheet",
  words: "worksheet",
  "word-study": "worksheet",
  puzzle: "puzzle",
  grammar: "worksheet",
  handwriting: "practice",
  memory: "practice",
  phonics: "worksheet",
};

/** What kind of page a config makes. */
export const typeOf = (config: SheetConfig): SheetType => TYPE_OF[config.kind];

/**
 * The ruling a config prints on, where it has one.
 *
 * Two families carry a `Rule` and the rest carry none — paper, which is a
 * ruling and nothing else, and handwriting, which is rows of one. So the ruling
 * facet is honestly absent on four fifths of the catalog rather than defaulted
 * to something, and a sheet with no ruling is not filtered out by a chip it was
 * never a candidate for. Read off the config rather than restated beside it,
 * which is what keeps "⅝ inch" on the search results and "⅝ inch" on the paper
 * the same fact.
 */
export const ruleOf = (config: SheetConfig): RuleStyle | undefined =>
  "rule" in config ? config.rule.style : undefined;

/* ── The index, as it is written to disk ───────────────────────────────── */

/**
 * One sheet, as one row of the shipped JSON.
 *
 * Column order, and it is the only place it is written down:
 *
 *   0 href     where it prints — on the shelves with two stocks, the default
 *   1 name     what it is called, which is most of what gets typed
 *   2 teaches  the line the `LearningResource` block already states
 *   3 ages     the band the sheet's own page states, verbatim
 *   4 subject  a `ShelfId`
 *   5 type     a `SheetType`
 *   6 rule     a `RuleStyle`, or "" for the sheets that have no ruling
 *   7 grades   which school years it reaches, as a bit per year (see below)
 */
export type IndexRow = [
  href: string,
  name: string,
  teaches: string,
  ages: string,
  subject: string,
  type: SheetType,
  rule: RuleStyle | "",
  grades: number,
];

/** A facet's values, in the order they are offered: `[id, label]`. */
export type Facet = Array<[id: string, label: string]>;

/**
 * The whole file: the vocabularies, then the rows.
 *
 * The facets travel *with* the sheets rather than being compiled into the
 * island, so the search box has no list of shelves or school years of its own
 * to keep in step with the registry. A shelf added to `_shelves.ts` appears as
 * a chip on the next build without this module or the island being edited,
 * which is the same argument `_shelves.ts` makes for existing at all.
 */
export type SheetIndex = {
  facets: {
    subject: Facet;
    grade: Facet;
    type: Facet;
    rule: Facet;
  };
  sheets: IndexRow[];
};

/** A row, read back into something with names on it. */
export type SheetHit = {
  href: string;
  name: string;
  teaches: string;
  ages: string;
  subject: string;
  type: SheetType;
  rule: RuleStyle | "";
  /** Which school years it reaches, as a bit per entry in `facets.grade`. */
  grades: number;
};

export const readRow = ([
  href,
  name,
  teaches,
  ages,
  subject,
  type,
  rule,
  grades,
]: IndexRow): SheetHit => ({
  href,
  name,
  teaches,
  ages,
  subject,
  type,
  rule,
  grades,
});

/** Whether a row reaches the year at this position in `facets.grade`. */
export const reachesGrade = (grades: number, year: number): boolean =>
  year >= 0 && (grades & (1 << year)) !== 0;

/* ── Asking it something ───────────────────────────────────────────────── */

/**
 * What the parent has narrowed to. `""` is "any", on all five.
 *
 * One value per facet rather than a set. A child is in one school year and a
 * sheet is one kind of thing; the multi-select that would let somebody ask for
 * second grade *and* fifth would mostly be a way to get the unfiltered list
 * back, and it doubles the state a chip row has to render.
 */
export type Query = {
  text: string;
  subject: string;
  grade: string;
  type: string;
  rule: string;
};

export const EMPTY_QUERY: Query = {
  text: "",
  subject: "",
  grade: "",
  type: "",
  rule: "",
};

/** Whether anything has been asked for at all. */
export const isIdle = (query: Query): boolean =>
  Object.values(query).every((value) => value === "");

const position = (facet: Facet, id: string): number =>
  facet.findIndex(([value]) => value === id);

const labelOf = (facet: Facet, id: string): string =>
  facet.find(([value]) => value === id)?.[1] ?? "";

/**
 * A school year, in both the ways it gets typed.
 *
 * The catalog writes `3rd-grade` and half the people searching write "third
 * grade". This is a fact about English ordinals rather than about the shop, so
 * it lives here rather than costing ten more strings in the shipped file — and
 * it only ever WIDENS what a row answers to. Normalising the query instead
 * would narrow it, and turn somebody looking for the "First sentences"
 * handwriting sheet into somebody looking for "1st sentences", which is a sheet
 * nobody has.
 */
const SPELLED: Record<string, string> = {
  "1st": "first",
  "2nd": "second",
  "3rd": "third",
  "4th": "fourth",
  "5th": "fifth",
  "6th": "sixth",
  "7th": "seventh",
  "8th": "eighth",
};

const yearWords = (slug: string): string => {
  const spaced = slug.replace(/-/g, " ");
  const spelled = SPELLED[spaced.split(" ")[0]];
  return spelled ? `${spaced} ${spelled} grade` : spaced;
};

/**
 * Everything a row can be found by, as one lowercased string.
 *
 * Wider than the name on purpose, and every part of it is already written down
 * somewhere else in this build. A parent typing "maths" is typing the shelf's
 * label and not any word on the sheet; a parent typing "third grade" is typing
 * a school year, which is a fact about the row's bits rather than about its
 * prose. Both are things this page can answer, and a search that returned
 * nothing for either would be read as a catalog that doesn't have it.
 */
const haystack = (index: SheetIndex, row: IndexRow): string => {
  const years = index.facets.grade
    .filter((_, year) => reachesGrade(row[7], year))
    .map(([slug]) => yearWords(slug));

  return [row[1], row[2], labelOf(index.facets.subject, row[4]), ...years]
    .join(" ")
    .toLowerCase();
};

/** The words typed, with the spacing and the case thrown away. */
export const terms = (text: string): string[] =>
  text.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * The sheets that answer the query, in catalog order.
 *
 * Every term has to appear somewhere, rather than any of them: "division
 * worksheets" narrows as you type it, which is what a search box is understood
 * to do, whereas an `or` would widen — the second word would bring back every
 * worksheet in the shop.
 *
 * Order is the order the index was written in, which is the order the shelves
 * are set out on the hub. No relevance ranking: at this size the honest answer
 * is all of them, and a score computed from how many times a word appears in
 * two short strings would sort mostly by accident.
 */
export function findSheets(index: SheetIndex, query: Query): SheetHit[] {
  const wanted = terms(query.text);
  const year = query.grade ? position(index.facets.grade, query.grade) : -1;

  return index.sheets
    .filter((row) => {
      if (query.subject && row[4] !== query.subject) return false;
      if (query.type && row[5] !== query.type) return false;
      if (query.rule && row[6] !== query.rule) return false;
      if (query.grade && !reachesGrade(row[7], year)) return false;
      if (wanted.length === 0) return true;

      const text = haystack(index, row);
      return wanted.every((term) => text.includes(term));
    })
    .map(readRow);
}

/* ── The state, in the fragment ────────────────────────────────────────── */

/**
 * The five keys a search travels under, in the URL fragment.
 *
 * **A fragment rather than a query string, and that is the SEO decision this
 * story turns on.** `?grade=3rd-grade&type=worksheet` is a distinct URL to a
 * crawler, and five facets over a hundred and nineteen sheets is several
 * thousand of them, every one a near-duplicate of a page that is already
 * indexed. That is the doorway-page farm §8 exists to forbid, arrived at from
 * the other direction. A fragment is never sent to a server, never crawled and
 * never indexed, so the search is shareable and bookmarkable — "here is the
 * third-grade maths, filtered" is an ordinary link — while the pages Google
 * sees stay exactly the nineteen that were curated: the nine subject hubs and
 * the ten school years, each of which is prerendered, canonical and written.
 */
const KEYS: Record<keyof Query, string> = {
  text: "find",
  subject: "subject",
  grade: "grade",
  type: "type",
  rule: "rule",
};

/** The fragment for a query — empty when nothing has been asked for. */
export function writeQuery(query: Query): string {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(KEYS)) {
    const value = query[field as keyof Query].trim();
    if (value) params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `#${encoded}` : "";
}

/**
 * A query read back out of a fragment, with anything unrecognised dropped.
 *
 * Untrusted input, the same as a shared sheet's payload: what arrives here came
 * off somebody's clipboard. It cannot throw and it cannot half-apply — a facet
 * id this build has never heard of would filter every sheet out and leave a
 * parent looking at an empty catalog with no way to tell why, so it is checked
 * against the vocabularies the index actually shipped and dropped if it isn't
 * one of them.
 */
export function readQuery(hash: string, index: SheetIndex): Query {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const known = (facet: Facet, key: string): string => {
    const value = params.get(key) ?? "";
    return position(facet, value) === -1 ? "" : value;
  };

  return {
    text: params.get(KEYS.text) ?? "",
    subject: known(index.facets.subject, KEYS.subject),
    grade: known(index.facets.grade, KEYS.grade),
    type: known(index.facets.type, KEYS.type),
    rule: known(index.facets.rule, KEYS.rule),
  };
}
