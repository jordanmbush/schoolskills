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
 */
function wordDistractors(answer: string, pool: string[], rand: () => number) {
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

const listFor = (listId: string) =>
  WORD_LISTS_BY_ID.get(listId) ?? customLists.get(listId);

export const wordsOf = (config: WordConfig): string[] =>
  config.words?.length ? config.words : (listFor(config.listId)?.words ?? []);

export function buildWordDeck(config: WordConfig, seed: number): Card[] {
  const rand = mulberry32(seed);
  const pool = wordsOf(config);
  if (pool.length === 0) return [];

  // Exhaust the list before repeating, exactly as the arithmetic deck does, so
  // a 10-card race over 40 words never asks the same one twice.
  const drawn: string[] = [];
  while (drawn.length < config.cardCount) drawn.push(...shuffled(pool, rand));

  return drawn.slice(0, config.cardCount).map((word) => {
    const card: Card = {
      // Kept for the record, never rendered during play — see `Card.speak`.
      prompt: word,
      answer: word,
      factId: normaliseWord(word),
      speak: word,
    };
    if (config.inputMode !== "choose") return card;
    return {
      ...card,
      choices: shuffled([word, ...wordDistractors(word, pool, rand)], rand),
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
    // A word is one fact however it's asked, so nothing folds and nothing
    // splits. Normalised so "Because" and "because" are the same square.
    masteryKey: normaliseWord,
    drillKey: normaliseWord,
    factLabel: (factId) => factId,
    normalise: normaliseWord,
  };
}
