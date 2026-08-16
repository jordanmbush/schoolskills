/**
 * What every family of decks has to be able to say about its own cards.
 *
 * The race loop, XP, ghosts, badges and the record book work off `Card` and
 * `CardResult` and know nothing about arithmetic. The three things they can't
 * do generically are here: fold two cards onto one fact, name a fact on
 * screen, and decide whether what a player typed matches the answer. Each is
 * a judgement only the deck family can make — 7×8 and 8×7 are one fact while
 * 21÷3 and 21÷7 are two, and "Cat" is a correct spelling of "cat" while "07"
 * is only a correct sum because leading zeros don't count.
 */
import type { World } from "@/engine/worlds";

export type DeckSpec = {
  /** Matches `Session.mode`, so a saved run can find its way back here. */
  id: string;
  label: string;

  /**
   * Which world this deck is played in — see src/engine/worlds.ts.
   *
   * A fourth judgement of the same kind as the three below: only the deck
   * family knows that spellings happen in the jungle and sums happen in
   * space. It's keyed off `mode`, which is what a saved run already carries,
   * so opening a race from three months ago lands in the right scenery.
   *
   * The engine never reads it. To everything below the view it is an opaque
   * string that a stylesheet happens to key off, and it must stay that way —
   * the moment a world means something to the model, adding one stops being
   * a CSS change.
   */
  world: World;

  /**
   * The cell this fact occupies in the mastery view. Folds facts that are
   * really the same question asked two ways.
   */
  masteryKey(factId: string): string;

  /**
   * The identity a practice deck rebuilds the card from. Usually the same as
   * `masteryKey`, but not always: the mastery grid is deliberately lossy for
   * division (21÷3 and 21÷7 share a square) where a drill must not be.
   */
  drillKey(factId: string): string;

  /** How the fact reads on screen — "7 × 8", or just the word. */
  factLabel(factId: string): string;

  /**
   * Both sides of an answer comparison pass through this before `===`. It is
   * the whole of the marking rule, so widening it forgives more answers
   * everywhere at once.
   */
  normalise(input: string): string;
};

/**
 * Stands in for a deck that isn't in the registry.
 *
 * Sessions outlive the decks they were played on: a parent deletes the
 * spelling list from three months ago and every race on it is still in the
 * record book. Returning this instead of throwing means those runs keep their
 * times, their XP and their place in the history — they just stop
 * contributing to a mastery view that no longer has anything to show.
 */
export const UNKNOWN_DECK: DeckSpec = {
  id: "unknown",
  label: "Retired deck",
  // The default world, same as an unthemed page. A deck from no family has no
  // scenery of its own, and a record-book row is not the place to find that out.
  world: "grid",
  masteryKey: (factId) => factId,
  drillKey: (factId) => factId,
  factLabel: (factId) => factId,
  normalise: (input) => input.trim(),
};
