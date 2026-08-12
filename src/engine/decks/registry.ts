import { OPERATIONS } from "./flashcards";
import { UNKNOWN_DECK, type DeckSpec } from "./spec";

/**
 * Every deck family the app knows how to read, keyed by `Session.mode`.
 *
 * A static object rather than a `register()` call at import time: the games
 * are code-split islands, so a self-registering deck would only exist in the
 * bundle that plays it — and the record book, which renders every mode a
 * player has ever raced, is on a different route entirely.
 */
const DECKS: Record<string, DeckSpec> = { ...OPERATIONS };

/** Never throws. See `UNKNOWN_DECK` for why a missing deck is expected. */
export function deckSpec(mode: string): DeckSpec {
  return DECKS[mode] ?? UNKNOWN_DECK;
}

export type { DeckSpec };
