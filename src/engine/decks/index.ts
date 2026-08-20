import type {
  Card,
  FlashConfig,
  InputMode,
  RaceConfig,
  TypingConfig,
  WordConfig,
} from "@/engine/types";

import {
  OPERATIONS,
  buildFlashDeck,
  buildFlashDrill,
  describeFlashConfig,
  flashConfigKey,
} from "./flashcards";
import {
  WORD_MODE_PREFIX,
  buildWordDeck,
  buildWordDrill,
  describeWordConfig,
  listIdOf,
  wordConfigKey,
  wordDeckSpec,
  wordMode,
} from "./words";
import {
  TYPING_MODE_PREFIX,
  buildTypingDeck,
  buildTypingDrill,
  describeTypingConfig,
  levelIdOf,
  typingConfigKey,
  typingDeckSpec,
  typingMode,
} from "./typing";
import { UNKNOWN_DECK, type DeckSpec } from "./spec";

/**
 * The deck layer's front door.
 *
 * Everything above the engine asks for a deck here rather than from a family
 * module, so the race loop, the record book and the setup screens never learn
 * whether they're dealing with sums, spellings or a typing passage. The union
 * is narrowed in exactly these functions and nowhere else.
 */

/** Arithmetic is the shape that predates the union, so it has no tag. */
export const isFlash = (config: RaceConfig): config is FlashConfig =>
  config.kind === undefined;
export const isWords = (config: RaceConfig): config is WordConfig =>
  config.kind === "words";
export const isTyping = (config: RaceConfig): config is TypingConfig =>
  config.kind === "typing";

/** Which deck a config will file its run under — the value of `Session.mode`. */
export function modeOf(config: RaceConfig): string {
  if (isWords(config)) return wordMode(config.listId);
  // A lesson wins over the level it was played at, so a ladder run files
  // itself as `typing:L07` and stays that in the record book (docs/typing.md
  // §5.4). Absent on every run saved before the ladder, which is why the level
  // is still what a config without one is filed under.
  if (isTyping(config)) return typingMode(config.lessonId ?? config.levelId);
  return config.operation;
}

/**
 * Resolves a saved run's deck. Never throws.
 *
 * Word and typing modes route on their prefix rather than through a table,
 * because from the parent-authored decks story onwards most list ids won't
 * exist at build time — and a run played on a list since deleted must still
 * read correctly. See `UNKNOWN_DECK` for a mode from no family at all.
 */
export function deckSpec(mode: string): DeckSpec {
  if (mode.startsWith(WORD_MODE_PREFIX)) return wordDeckSpec(mode);
  if (mode.startsWith(TYPING_MODE_PREFIX)) return typingDeckSpec(mode);
  return OPERATIONS[mode as keyof typeof OPERATIONS] ?? UNKNOWN_DECK;
}

export function buildDeck(config: RaceConfig, seed: number): Card[] {
  if (isWords(config)) return buildWordDeck(config, seed);
  if (isTyping(config)) return buildTypingDeck(config, seed);
  return buildFlashDeck(config, seed);
}

/**
 * Whether this run may hold a record — a personal best, the house best, or a
 * place in a rival list.
 *
 * Every "best" on the site is `compareRuns`, which decides on time. That is
 * safe for a race, where the only way to stop the clock is to answer every
 * card, and wrong for a run that can **end early**: a Hailstorm run stops when
 * the shield does, so a child who died at letter three took less time than one
 * who cleared the wave and would be handed the record for it (docs/typing.md
 * §8.7, decision 50).
 *
 * The judgement is made here, at the front door, and enforced in exactly one
 * place — `bestRun` in `engine/records.ts` — rather than filtered at each
 * screen, so every consumer inherits it: the record book's "your best" and
 * "house best" columns, the `previousBest` a results screen pays the
 * personal-best bonus on, and `ghostsFor`, which is where every rival a setup
 * screen offers comes from. That matters most for the consumers that do not
 * exist yet, and it is not hypothetical for the ones that do: lesson 39 has a
 * `WaveSpec`, so `lessonKey(lesson)` is `typing|L39|28` — the same string
 * `stormConfig` writes — and every "best" that groups by key reads a storm and
 * a run of that lesson as one group.
 *
 * An unranked run is still a run in every other way: the record book lists it,
 * it pays its XP, it earns badges and its cards feed the drill builder. It
 * just never holds a "best". Only a storm answers false today, and this is the
 * only place to widen if a second kind of run ever can end early.
 */
export const isRanked = (config: RaceConfig): boolean =>
  !(isTyping(config) && config.storm === true);

/** Two runs may only race each other as ghosts if they share this. */
export function configKey(config: RaceConfig): string {
  if (isWords(config)) return wordConfigKey(config);
  if (isTyping(config)) return typingConfigKey(config);
  return flashConfigKey(config);
}

export function describeConfig(config: RaceConfig): string {
  if (isWords(config)) return describeWordConfig(config);
  if (isTyping(config)) return describeTypingConfig(config);
  return describeFlashConfig(config);
}

/**
 * A practice deck of the facts a player keeps missing, in whichever shape the
 * deck they came from uses. `mode` decides the family, which is what the
 * record book already holds — it doesn't need to know what a fact id means.
 */
export function buildDrill(
  factIds: string[],
  mode: string,
  options: { inputMode: InputMode; timeLimitMs?: number | null },
): RaceConfig {
  if (mode.startsWith(WORD_MODE_PREFIX)) {
    return buildWordDrill(factIds, { listId: listIdOf(mode), ...options });
  }
  if (mode.startsWith(TYPING_MODE_PREFIX)) {
    // Neither option applies: a typing drill has no input mode to choose and
    // no per-word clock. Dropping them here is why the callers don't branch.
    return buildTypingDrill(factIds, levelIdOf(mode));
  }
  return buildFlashDrill(factIds, {
    operation: mode as keyof typeof OPERATIONS,
    ...options,
  });
}

export type { DeckSpec };
