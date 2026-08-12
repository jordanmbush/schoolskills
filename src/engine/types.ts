export type Profile = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  age: number;
  soundOn: boolean;
  xp: number;
  badges: string[];
  createdAt: string;
};

export type Operation = "multiply" | "divide" | "add" | "subtract";

export type InputMode = "type" | "choose";

export type FlashConfig = {
  operation: Operation;
  /** The focus numbers — for multiplication these are the times tables. */
  tables: number[];
  /**
   * What the focus numbers get paired with. Kept as an explicit list rather
   * than a range so that unchecking a number anywhere removes it from every
   * card, which is what people expect the grid to mean.
   */
  others: number[];
  cardCount: number;
  inputMode: InputMode;
  /**
   * Seconds-per-card clock, in milliseconds. `null` (or absent, on runs saved
   * before this existed) means there's no per-card limit and the race is
   * decided on total time alone.
   */
  timeLimitMs?: number | null;
  /**
   * An explicit list of facts to drill, built from the ones a player keeps
   * missing. When set it replaces the tables × others cross product, so a
   * practice deck asks only about those facts.
   */
  facts?: Array<[number, number]>;
};

/** Shape of configs written before `others` replaced the min/max range. */
export type LegacyFlashConfig = Omit<FlashConfig, "others"> & {
  others?: number[];
  otherMin?: number;
  otherMax?: number;
};

/* ── Cards ───────────────────────────────────────────────────────────────
   A card is text in and text out, deliberately. Answers were numbers until
   spelling arrived, and every alternative to widening them was worse: a
   `number | string` union puts a branch at every comparison, and a generic
   `Card<T>` leaks type parameters into components that only ever render the
   thing. What a deck family *does* know about its own answers — how to
   compare "07" with "7", or "Cat" with "cat" — lives on its `DeckSpec`.     */

export type Card = {
  /** Rendered prompt, e.g. "7 × 8". */
  prompt: string;
  /** Text even when it's a number: "56", not 56. Compared via the spec. */
  answer: string;
  /** Shuffled options, present only in multiple-choice mode. */
  choices?: string[];
  /**
   * Which fact this card exercises, as the deck built it — "7:8" for
   * arithmetic, the word itself for spelling. Stable across runs, because
   * mastery and trouble spots accumulate against it for years.
   *
   * Ordered as built. Folding 7×8 and 8×7 into one cell is the deck spec's
   * job, not this field's: 21÷3 and 21÷7 must not fold, and only the spec
   * knows which of the two it is.
   */
  factId: string;
};

export type CardResult = {
  prompt: string;
  answer: string;
  given: string | null;
  ok: boolean;
  ms: number;
  factId: string;
  /**
   * The per-card clock ran out before an answer arrived. Distinct from a wrong
   * answer: it's what "didn't solve it in time" means, and it's what the
   * practice list is built from.
   */
  timedOut?: boolean;
};

/**
 * Cards as they were written before answers became text — numeric answers and
 * an ordered pair instead of a fact id. Every run saved up to 2026-08-13 is
 * this shape, so `readSession` widens them on the way out of storage.
 */
export type LegacyCardResult = Omit<
  CardResult,
  "answer" | "given" | "factId"
> & {
  answer: number | string;
  given: number | string | null;
  factId?: string;
  facts?: [number, number];
};

export type Session = {
  id: string;
  profileId: string;
  game: "flashcards";
  /**
   * Which deck within the game — an `Operation` today, a word-list id once
   * spelling lands. A plain string rather than a union because custom decks
   * are user-named, and because a session must still load after the deck it
   * was played on has been deleted. `deckSpec()` resolves it, and answers for
   * anything it doesn't recognise.
   */
  mode: string;
  configKey: string;
  config: FlashConfig;
  seed: number;
  finishedAt: string;
  durationMs: number;
  correct: number;
  incorrect: number;
  bestStreak: number;
  xpEarned: number;
  ghostSessionId: string | null;
  beatGhost: boolean | null;
  cards: CardResult[];
};

/** A session as it may sit in storage, with cards from before the widening. */
export type LegacySession = Omit<Session, "cards"> & {
  cards: LegacyCardResult[];
};

export type HubState = {
  profiles: Profile[];
  sessions: Session[];
};

/** A past run you can race against, resolved to the player who set it. */
export type Ghost = {
  session: Session;
  profile: Profile;
  isSelf: boolean;
};
