import type { Card, WordConfig } from "@/engine/types";

import { mulberry32, shuffled } from "@/engine/random";
import { WORD_LISTS_BY_ID } from "./wordlists";
import type { DeckSpec } from "./spec";

/**
 * Spelling and sight words, as a deck family.
 *
 * Nothing in the race loop changes for these. A word is a `Card` like any
 * other — the differences are all in this file and in one input control: the
 * prompt is spoken rather than shown (`Card.speak`), the fact id is the word
 * itself, and marking forgives case, spacing and the apostrophe a phone
 * autocorrects into a curly one.
 */

/** `Session.mode` for a word deck. Prefixed so `deckSpec` can route on it. */
export const WORD_MODE_PREFIX = "words:";

export const wordMode = (listId: string) => `${WORD_MODE_PREFIX}${listId}`;
export const listIdOf = (mode: string) => mode.slice(WORD_MODE_PREFIX.length);

/**
 * The marking rule for a word.
 *
 * Case is not the exercise, so "Because" is right. Neither is which apostrophe
 * character a keyboard produced: iOS substitutes a curly ’ for the straight '
 * that `don't` is stored with, and failing a child for their phone's
 * typography would be indefensible.
 */
export const normaliseWord = (input: string) =>
  input.trim().toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ");

/**
 * Wrong options a reader might plausibly confuse with the answer.
 *
 * Drawn from the same list and biased towards words that look like it —
 * "there" against "their", not against "squirrel". Four random words would
 * make recognition a spotting exercise rather than a reading one.
 *
 * Exported for the print shop's "find the word" sheet, which asks exactly this
 * question on paper: the same list, the same three near misses, so a sheet and a
 * "spot it" round are one exercise in two places rather than two rules about
 * what counts as a plausible confusion.
 */
export function wordDistractors(
  answer: string,
  pool: string[],
  rand: () => number,
): string[] {
  const others = [...new Set(pool)].filter(
    (w) => normaliseWord(w) !== normaliseWord(answer),
  );
  const confusable = others.filter(
    (w) =>
      w[0]?.toLowerCase() === answer[0]?.toLowerCase() ||
      Math.abs(w.length - answer.length) <= 1,
  );
  const picked = shuffled(confusable, rand).slice(0, 3);
  // A short list — a parent's five spellings for the week — may not have three
  // near misses in it. Top up with anything rather than repeat one.
  for (const word of shuffled(others, rand)) {
    if (picked.length >= 3) break;
    if (!picked.includes(word)) picked.push(word);
  }
  return picked;
}

/* ── Lists a parent typed in ─────────────────────────────────────────────
   Mirrored into the engine after the hub loads them, rather than threaded
   through as a parameter. Three unrelated places need to name and build a
   custom deck — the setup screen, the race loop and the record book — and
   only one of them has any business knowing where decks are stored.

   `src/services/decks.ts` is the sole writer and re-mirrors on every change,
   so a view can't forget to. Nothing here is a source of truth: it's a cache
   of IndexedDB, and losing it just means a deck reads as "Words" until the
   next load.                                                                */

let customLists = new Map<string, { name: string; words: string[] }>();

export function setCustomLists(
  decks: Array<{ id: string; name: string; words: string[] }>,
) {
  customLists = new Map(
    decks.map((d) => [d.id, { name: d.name, words: d.words }]),
  );
}

/**
 * A word as the deck sees it.
 *
 * A shipped list gives every word a sentence to be heard in — see the note at
 * the top of wordlists.ts for why that isn't optional on those. A list a
 * parent typed in has no sentences and never will, so `clue` is absent and
 * those cards behave exactly as every word card did before: the word alone,
 * spoken once. Both have to work, so nothing downstream may assume a clue.
 */
export type DeckWord = { word: string; clue?: string };

/** Marks where the word goes in a clue. See `wordlists.ts`. */
export const CLUE_SLOT = "_";

/** The clue with the word dropped into its slot — what gets spoken. */
export const fillClue = (clue: string, word: string) =>
  clue.replace(CLUE_SLOT, word);

/**
 * The clue either side of its slot, so a view can render the gap however it
 * renders gaps. Returns the whole clue and an empty tail if there is no slot,
 * which can only happen for a clue this build didn't ship.
 */
export function clueParts(clue: string): [string, string] {
  const at = clue.indexOf(CLUE_SLOT);
  return at < 0 ? [clue, ""] : [clue.slice(0, at), clue.slice(at + 1)];
}

/**
 * What the voice says for a card: the word, then the word in a sentence.
 *
 * That order is the one a spelling test uses, and it is the order for a
 * reason — the child can start typing off the first word while the context
 * arrives behind them, rather than waiting out a sentence to reach the point.
 * The sentence is what makes homophones answerable at all, and what repairs a
 * word the device's voice enunciates badly.
 */
export const utteranceFor = ({ word, clue }: DeckWord): string =>
  clue ? `${word}. ${fillClue(clue, word)}` : word;

type ResolvedList = { name: string; entries: DeckWord[] };

/** A shipped list or a parent's, flattened to the one shape the deck uses. */
function listFor(listId: string): ResolvedList | undefined {
  const shipped = WORD_LISTS_BY_ID.get(listId);
  if (shipped) return { name: shipped.name, entries: shipped.entries };
  const custom = customLists.get(listId);
  if (custom)
    return {
      name: custom.name,
      entries: custom.words.map((word) => ({ word })),
    };
  return undefined;
}

export function deckWordsOf(config: WordConfig): DeckWord[] {
  const list = listFor(config.listId);
  if (!config.words?.length) return list?.entries ?? [];
  // A drill carries its own words as plain strings, so reunite them with the
  // sentences from the list they came from. Without this the drill — the deck
  // of exactly the words a child keeps getting wrong — would be the one place
  // they lost the context that makes those words answerable.
  const clues = new Map(
    list?.entries.map((e) => [normaliseWord(e.word), e.clue]) ?? [],
  );
  return config.words.map((word) => ({
    word,
    clue: clues.get(normaliseWord(word)),
  }));
}

/** Just the words, for counting them and showing a few as a preview. */
export const wordsOf = (config: WordConfig): string[] =>
  deckWordsOf(config).map((e) => e.word);

export function buildWordDeck(config: WordConfig, seed: number): Card[] {
  const rand = mulberry32(seed);
  const pool = deckWordsOf(config);
  if (pool.length === 0) return [];

  // Exhaust the list before repeating, exactly as the arithmetic deck does, so
  // a 10-card race over 40 words never asks the same one twice.
  const drawn: DeckWord[] = [];
  while (drawn.length < config.cardCount) drawn.push(...shuffled(pool, rand));

  const words = pool.map((e) => e.word);
  return drawn.slice(0, config.cardCount).map((entry) => {
    const card: Card = {
      // Kept for the record, never rendered during play — see `Card.speak`.
      prompt: entry.word,
      answer: entry.word,
      factId: normaliseWord(entry.word),
      speak: utteranceFor(entry),
      clue: entry.clue,
    };
    if (config.inputMode !== "choose") return card;
    return {
      ...card,
      choices: shuffled(
        [entry.word, ...wordDistractors(entry.word, words, rand)],
        rand,
      ),
    };
  });
}

/**
 * Two word races can only be raced against each other if they share this —
 * same list, same length, same way of answering, same clock. A custom set of
 * words is folded in as a sorted list so the same five spellings typed in a
 * different order still match as a ghost.
 */
export function wordConfigKey(config: WordConfig) {
  const parts = [
    "words",
    config.listId,
    config.cardCount,
    config.inputMode,
  ] as Array<string | number>;
  if (config.timeLimitMs) parts.push(`t${config.timeLimitMs}`);
  if (config.words?.length)
    parts.push(`w${[...config.words].map(normaliseWord).sort().join(",")}`);
  return parts.join("|");
}

export function describeWordConfig(config: WordConfig) {
  const list = listFor(config.listId);
  const what = config.words?.length
    ? `${config.words.length} words`
    : (list?.name ?? "Words");
  const how = config.inputMode === "choose" ? "spot it" : "spell it";
  const clock = config.timeLimitMs
    ? ` · ${config.timeLimitMs / 1000}s a card`
    : "";
  return `🔤 ${what} · ${config.cardCount} cards · ${how}${clock}`;
}

/**
 * A short deck of just the words a player keeps missing, under the same clock.
 * Two passes each, like the arithmetic drill.
 */
export function buildWordDrill(
  words: string[],
  base: Pick<WordConfig, "listId" | "inputMode"> & {
    timeLimitMs?: number | null;
  },
): WordConfig {
  const unique = [...new Set(words.map(normaliseWord))];
  return {
    kind: "words",
    listId: base.listId,
    words: unique,
    cardCount: Math.min(30, Math.max(6, unique.length * 2)),
    inputMode: base.inputMode,
    timeLimitMs: base.timeLimitMs ?? null,
  };
}

/**
 * Every word deck marks and folds identically; only the name differs. Built
 * per list so the record book can title a run, and produced on demand for an
 * id it doesn't recognise — a list this build has never heard of is the normal
 * case once a parent can author their own.
 */
export function wordDeckSpec(mode: string): DeckSpec {
  const list = listFor(listIdOf(mode));
  return {
    id: mode,
    label: list?.name ?? "Words",
    world: "jungle",
    // A word is one fact however it's asked, so nothing folds and nothing
    // splits. Normalised so "Because" and "because" are the same square.
    masteryKey: normaliseWord,
    drillKey: normaliseWord,
    factLabel: (factId) => factId,
    normalise: normaliseWord,
  };
}
