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
export type DeckSpec = {
  /** Matches `Session.mode`, so a saved run can find its way back here. */
  id: string;
  label: string;

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
  masteryKey: (factId) => factId,
  drillKey: (factId) => factId,
  factLabel: (factId) => factId,
  normalise: (input) => input.trim(),
};
