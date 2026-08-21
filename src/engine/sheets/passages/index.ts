/**
 * The passage library's front door.
 *
 * Everything above the engine asks for a passage here rather than from a data
 * module, so that nothing above learns whether it is holding Psalm 23 or the
 * Gettysburg Address — which is what §12's "woven through" means in code.
 * Scripture is listed first and is otherwise ordinary.
 *
 * Two things this door owns that the data modules can't:
 *
 *   - **The translation.** A Scripture entry stores the WEBu text and `kjv.ts`
 *     stores the other; which one a reader gets is decided here, once, so a
 *     sheet never holds verses whose credit line came from somewhere else.
 *   - **Never throwing.** `passage()` answers `undefined` for an id it has
 *     never heard of, the way `sheetSpec` answers `UNKNOWN_SHEET`. Saved sheets
 *     outlive the library they were made on, and a bookmarked copywork URL
 *     naming a retired passage must not fail a build that would have shipped.
 */
import { DOCUMENTS, DOCUMENT_COLLECTIONS } from "./documents";
import { KJV_CREDIT, KJV_VERSES } from "./kjv";
import { LITERATURE, LITERATURE_COLLECTIONS } from "./literature";
import { POETRY, POETRY_COLLECTIONS } from "./poetry";
import {
  SCRIPTURE,
  SCRIPTURE_COLLECTIONS,
  SCRIPTURE_CREDIT,
  type ScriptureEntry,
} from "./scripture";
import type {
  Passage,
  PassageCollection,
  PassageSource,
  PassageSummary,
  TranslationId,
} from "./types";

export { SCRIPTURE_CREDIT };
export type {
  Passage,
  PassageCollection,
  PassageSource,
  PassageSummary,
  TranslationId,
};

/** The words as one block, for the places that want a paragraph. */
export const passageText = (passage: Passage): string =>
  passage.lines.join("\n");

const summarise = ({ lines, ...rest }: Passage): PassageSummary => ({
  ...rest,
  characters: lines.reduce((total, line) => total + line.length, 0),
});

/* ── Translations ─────────────────────────────────────────────────────────
   Two, and the reasoning for both is in §12. Never ESV, NIV, NASB or CSB —
   those are licensed, and bundling one would be a genuine problem rather than
   an oversight.                                                             */

export type Translation = {
  id: TranslationId;
  /** How it is named in a picker. */
  name: string;
  /** Printed under the verse, where an author's name goes on a poem. */
  short: string;
  /** Printed small at the foot of any sheet that uses it. */
  credit: string;
  source: PassageSource;
  /** This translation's text for an entry, or nothing if it has none. */
  verses(entry: ScriptureEntry): readonly string[] | undefined;
};

export const DEFAULT_TRANSLATION: TranslationId = "webu";

const TRANSLATIONS: Record<TranslationId, Translation> = {
  webu: {
    id: "webu",
    name: "World English Bible Updated",
    short: "World English Bible Updated",
    credit: SCRIPTURE_CREDIT,
    source: {
      work: "The Holy Bible",
      author: "World English Bible Updated (WEBu)",
      year: "2026 release",
      edition: "eBible.org engwebu, verse-per-line release of 15 August 2026",
      licence: "Public domain — see scripture.ts for the trademark condition",
    },
    verses: (entry) => entry.verses,
  },
  kjv: {
    id: "kjv",
    name: "King James Version",
    short: "King James Version",
    credit: KJV_CREDIT,
    source: {
      work: "The Holy Bible",
      author: "King James (Authorized) Version",
      year: "1769 text",
      edition: "eBible.org eng-kjv2006, verse-per-line release of 16 May 2026",
      licence: "Public domain — see kjv.ts for the two marks removed",
    },
    // `hasOwn` rather than a plain index: an id can arrive from a saved sheet,
    // and `KJV_VERSES["toString"]` would otherwise answer with a function that
    // is truthy and is not a verse.
    verses: (entry) =>
      Object.hasOwn(KJV_VERSES, entry.id) ? KJV_VERSES[entry.id] : undefined,
  },
};

export const TRANSLATION_LIST: Translation[] = Object.values(TRANSLATIONS);

/**
 * The translation a given entry will actually be read in.
 *
 * Falls back whole — text, attribution and credit together — rather than
 * borrowing verses from one translation under another's name. The suite asserts
 * the KJV covers every entry, so this cannot fire today; if it ever does, a
 * reader gets a correctly credited WEBu verse instead of a KJV verse with the
 * wrong licence printed underneath it.
 *
 * `hasOwn` because the argument is typed but not trusted: a translation id
 * arrives from a saved sheet or a shared URL, and `TRANSLATIONS["toString"]`
 * would otherwise answer with a function off the prototype — truthy, not a
 * translation, and a `TypeError` in a door that promised not to throw.
 */
function translationFor(
  entry: ScriptureEntry,
  wanted: TranslationId,
): Translation {
  const fallback = TRANSLATIONS[DEFAULT_TRANSLATION];
  const asked = Object.hasOwn(TRANSLATIONS, wanted)
    ? TRANSLATIONS[wanted]
    : fallback;
  return asked.verses(entry) ? asked : fallback;
}

const fromScripture = (
  entry: ScriptureEntry,
  wanted: TranslationId,
): Passage => {
  const translation = translationFor(entry, wanted);
  return {
    id: entry.id,
    title: entry.ref,
    attribution: translation.short,
    kind: "scripture",
    collection: entry.collection,
    lines: translation.verses(entry) ?? entry.verses,
    source: translation.source,
    credit: translation.credit,
  };
};

/* ── The library ──────────────────────────────────────────────────────────
   Scripture first, then the rest, which is the order §12 asks for and the
   only special treatment it gets.                                           */

export const PASSAGE_COLLECTIONS: PassageCollection[] = [
  ...SCRIPTURE_COLLECTIONS,
  ...DOCUMENT_COLLECTIONS,
  ...LITERATURE_COLLECTIONS,
  ...POETRY_COLLECTIONS,
];

const OTHERS: Passage[] = [...DOCUMENTS, ...LITERATURE, ...POETRY];

/** Everything, resolved. Scripture first, in collection order. */
export function listPassages(
  translation: TranslationId = DEFAULT_TRANSLATION,
): Passage[] {
  return [
    ...SCRIPTURE.map((entry) => fromScripture(entry, translation)),
    ...OTHERS,
  ];
}

/** The same list without the words, for a picker that lists before it loads. */
export const listPassageSummaries = (
  translation: TranslationId = DEFAULT_TRANSLATION,
): PassageSummary[] => listPassages(translation).map(summarise);

/*
   Indexed by id, once. `passage()` is called several times per sheet built —
   the layout, the header, the body and the one-line description each ask — and
   a linear scan of three hundred entries for each is a scan the catalog build
   repeats a few thousand times. A `Map` also takes an untrusted id safely:
   `.get("toString")` is nothing, where an index would find a function.      */

const SCRIPTURE_BY_ID = new Map(SCRIPTURE.map((entry) => [entry.id, entry]));
const OTHERS_BY_ID = new Map(OTHERS.map((entry) => [entry.id, entry]));

/** One passage, or nothing. See the note at the top on why it never throws. */
export function passage(
  id: string,
  translation: TranslationId = DEFAULT_TRANSLATION,
): Passage | undefined {
  const entry = SCRIPTURE_BY_ID.get(id);
  if (entry) return fromScripture(entry, translation);
  return OTHERS_BY_ID.get(id);
}

/** Everything in one collection, for a picker grouped the way §12 groups it. */
export const passagesIn = (
  collection: string,
  translation: TranslationId = DEFAULT_TRANSLATION,
): Passage[] =>
  listPassages(translation).filter(
    (candidate) => candidate.collection === collection,
  );
