import type { Card, InputMode, RaceConfig } from "@/engine/types";

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
import { UNKNOWN_DECK, type DeckSpec } from "./spec";

/**
 * The deck layer's front door.
 *
 * Everything above the engine asks for a deck here rather than from a family
 * module, so the race loop, the record book and the setup screen never learn
 * whether they're dealing with sums or spellings. The union is narrowed in
 * exactly these functions and nowhere else.
 */

/** Which deck a config will file its run under — the value of `Session.mode`. */
export const modeOf = (config: RaceConfig): string =>
  config.kind === "words" ? wordMode(config.listId) : config.operation;

/**
 * Resolves a saved run's deck. Never throws.
 *
 * Word modes route on their prefix rather than through a table, because from
 * the parent-authored decks story onwards most list ids won't exist at build
 * time — and a run played on a list since deleted must still read correctly.
 * See `UNKNOWN_DECK` for what happens to a mode from neither family.
 */
export function deckSpec(mode: string): DeckSpec {
  if (mode.startsWith(WORD_MODE_PREFIX)) return wordDeckSpec(mode);
  return OPERATIONS[mode as keyof typeof OPERATIONS] ?? UNKNOWN_DECK;
}

export function buildDeck(config: RaceConfig, seed: number): Card[] {
  return config.kind === "words"
    ? buildWordDeck(config, seed)
    : buildFlashDeck(config, seed);
}

/** Two runs may only race each other as ghosts if they share this. */
export function configKey(config: RaceConfig): string {
  return config.kind === "words"
    ? wordConfigKey(config)
    : flashConfigKey(config);
}

export function describeConfig(config: RaceConfig): string {
  return config.kind === "words"
    ? describeWordConfig(config)
    : describeFlashConfig(config);
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
  return buildFlashDrill(factIds, {
    operation: mode as keyof typeof OPERATIONS,
    ...options,
  });
}

export type { DeckSpec };
