/**
 * The record book, as paper — a deck mode and the fact ids it ranked in, a sheet
 * a parent can print out (§14).
 *
 * Neither side has to learn the other's shape: `troubleFacts` speaks in
 * `DeckSpec.drillKey`, a family turns those ids into problems through
 * `Problem.factId`, and this module is the only place that knows which family
 * answers for which deck. The counterpart is `src/games/printshop/defaults.ts`,
 * which holds what a parent probably wants when they are choosing for
 * themselves; this holds what the record book already decided for them.
 *
 * **Nothing about a child is in what comes out.** A config carries facts, paper
 * and type — never a name, an age or a profile id — which matters more here than
 * anywhere else in the shop, because `practiceHref` puts it in a URL and this is
 * the one sheet built out of a child's own history.
 */
import { WORD_MODE_PREFIX, deckWordsOf, listIdOf } from "@/engine/decks/words";
import { WORLDS } from "@/engine/worlds";

import type { SheetConfig, SheetOptions } from "./types";

import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "./paper";
import { encodeSharedSheet } from "./share";

/**
 * What a sheet made out of the record book opens on: the same paper and the same
 * blank name line every other sheet starts with (§1), which is exactly why this
 * one is safe to hand round as a link.
 */
const BASE: SheetOptions = {
  paper: DEFAULT_PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: ["name", "date"],
};

/** The twelve tables, for the sheet a child with no history gets. */
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * A full page when there is nothing in particular to practise.
 *
 * A named-fact sheet asks for exactly as many problems as it has facts, so
 * this number only decides the length of the other sheet — the mixed one a
 * child who has never raced gets, which had better be worth printing.
 */
const FULL_PAGE = 24;

/**
 * A sheet of exactly these facts, or `null` if this build cannot print them.
 *
 * `null` rather than a blank sheet, because the caller is the one that knows
 * what to do instead: a results screen hides the button, and the bench says so
 * in a line. Typing is the honest case — a passage is not a set of facts to
 * print, and there is no sheet family that pretends otherwise until the
 * copywork one lands.
 *
 * An empty fact list is not a failure and does not return `null`. It is what a
 * child with no history has, and what it produces is the ordinary sheet for
 * that deck: all twelve tables, or the whole word list. A parent who came here
 * to print something should leave with something.
 */
export function practiceSheet(
  mode: string,
  facts: string[],
): SheetConfig | null {
  const named = [...new Set(facts.filter((fact) => fact !== ""))];
  const count = named.length > 0 ? named.length : FULL_PAGE;

  if (mode === "multiply" || mode === "divide") {
    return {
      ...BASE,
      kind: "multiplication",
      operation: mode,
      style: "standard",
      form: "horizontal",
      tables: TABLES,
      factors: { min: 1, max: 12 },
      facts: named,
      count,
      columns: 3,
    };
  }

  if (mode === "add" || mode === "subtract") {
    return {
      ...BASE,
      kind: "arithmetic",
      operation: mode,
      style: "standard",
      form: "horizontal",
      range: { min: 1, max: 20 },
      regrouping: "either",
      facts: named,
      count,
      columns: 3,
    };
  }

  // A word deck's fact id *is* the word — `DeckSpec.drillKey` normalises it and
  // does nothing else — so the missed spellings are the list the sheet prints.
  // Which is also why the two other bootstraps land on the same family: a saved
  // deck and a pasted list are this config with the words from somewhere else.
  if (mode.startsWith(WORD_MODE_PREFIX)) {
    // With nothing missed yet, the whole list. The deck layer is asked for it
    // rather than the words being looked up here, because a list may be one a
    // parent typed in — mirrored into the engine by `services/decks.ts` — and
    // `deckWordsOf` is where both kinds already come out the same shape.
    const words =
      named.length > 0
        ? named
        : deckWordsOf({
            kind: "words",
            listId: listIdOf(mode),
            cardCount: 0,
            inputMode: "type",
          }).map((entry) => entry.word);
    return words.length > 0 ? wordsSheet(words) : null;
  }

  // Typing, and any deck this build has never heard of. A passage is not a set
  // of facts and there is no family that pretends otherwise, so the answer is
  // "not this build" rather than a page with nothing on it. A fifth arithmetic
  // operation would land here too, which is the right failure: it needs a line
  // above rather than a sheet that quietly says the wrong thing.
  return null;
}

/**
 * A spelling sheet from a list, whoever chose it: the record book, a saved deck,
 * or a parent's paste (§14's second and third bootstraps).
 *
 * Copying is the style it opens on because it is the one that works for any list
 * at all — a word too short to take a letter out of is still a word to write
 * three times — and the other two styles are one control away.
 */
export function wordsSheet(words: string[]): SheetConfig {
  return {
    ...BASE,
    kind: "words",
    style: "copy",
    words,
    times: 3,
    gaps: 2,
    count: words.length,
    columns: 2,
  };
}

/**
 * The seed a sheet from the record book is built with.
 *
 * Fixed, so that the same facts always make the same page: a parent who prints
 * from the results screen and then opens the same link on the laptop is
 * looking at the sheet they printed, and the bench's own "another one like
 * this" is still there for when they want a different draw (§7).
 */
export const PRACTICE_SEED = 1;

/** Where the builder lives — the island in the world registry, not a literal. */
const BENCH = WORLDS.find((world) => world.id === "paper")?.island ?? "/";

/**
 * The bench, already loaded with this sheet.
 *
 * A link and not a handover: the config *is* the id (§14), so a game screen can
 * send a parent to the builder with the facts already on the paper without
 * anything being stored, posted or kept between two pages. The fragment never
 * leaves the browser either, which is the part that matters for a sheet built
 * out of a child's own history.
 */
export function practiceHref(
  config: SheetConfig,
  seed = PRACTICE_SEED,
): string {
  return `${BENCH}#s=${encodeSharedSheet({ config, seed })}`;
}
