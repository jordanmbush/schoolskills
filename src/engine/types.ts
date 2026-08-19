/**
 * What the typing game puts on screen under the passage (docs/typing.md §4.1).
 *
 * One field rather than `showKeyboard` + `showHint`, because three of the four
 * boolean combinations are meaningful and the fourth — a hint pointing at a
 * board that isn't drawn — is nonsense. A union cannot express the nonsense,
 * so no reader has to decide what to do when it arrives.
 */
export type KeyboardMode =
  /** Not on screen at all. */
  | "off"
  /** The board, with its finger colours. No hint. */
  | "keys"
  /** The board, plus the next key — and its shift — lit. */
  | "guide";

export type Profile = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  age: number;
  soundOn: boolean;
  /**
   * How much of the keyboard this player wants (§4.2). Absent means "guide",
   * and absent is the ordinary state: every profile made before this shipped
   * lacks the field, and nothing writes it until a child chooses. One default,
   * at one read site, rather than a value copied into `create` as well.
   *
   * Optional precisely so this costs no `DB_VERSION` bump and no migration —
   * profiles are read straight through, unlike sessions, whose widening lives
   * in `engine/migrate.ts`.
   */
  keyboard?: KeyboardMode;
  xp: number;
  badges: string[];
  createdAt: string;
};

export type Operation = "multiply" | "divide" | "add" | "subtract";

export type InputMode = "type" | "choose";

export type FlashConfig = {
  /**
   * Never set. It's the negative half of the `RaceConfig` discriminant: every
   * arithmetic config already in storage predates the union, and giving them a
   * field they'd have to grow would mean rewriting a child's whole history to
   * add a word deck.
   */
  kind?: undefined;
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

/**
 * A race over words rather than numbers — spelling and sight-word recognition.
 *
 * It is a sibling of `FlashConfig`, not a widening of it. Forcing words into
 * the arithmetic shape would make `operation`, `tables` and `others` optional
 * for everyone and put an `if (isWords)` at every reader; a union puts the
 * branch in one place, at `buildDeck` and `configKey`.
 */
export type WordConfig = {
  kind: "words";
  /** The list to draw from. Also what `Session.mode` records, prefixed. */
  listId: string;
  /**
   * An explicit set of words, replacing the list — a drill of the ones a
   * player keeps missing, or a parent's own spellings for the week.
   */
  words?: string[];
  cardCount: number;
  inputMode: InputMode;
  timeLimitMs?: number | null;
};

/**
 * A typing passage.
 *
 * No `inputMode` — there is only one way to answer — and no per-card clock,
 * because a typing test is decided on total time and a word that timed out
 * would be indistinguishable from one you were still typing.
 */
export type TypingConfig = {
  kind: "typing";
  levelId: string;
  /**
   * Set when this run is a lesson from the ladder (docs/typing.md §5.4).
   *
   * The discriminator for a ladder run, and the one field `Session.mode` and
   * the ghost key prefer when it is there — a lesson is the identity, not the
   * passage. Every run of lesson 7 generates its own words, so a key built
   * from them would file each run in a bucket of one and a child would never
   * be shown their own best. Optional, because every run saved before the
   * ladder existed is a level and must key exactly as it always has.
   */
  lessonId?: string;
  /**
   * How much of the board this run puts on screen, when the child chose it
   * (docs/typing.md §4.2).
   *
   * Absent is the ordinary case and means "nobody chose": free play never sets
   * it, and a lesson whose keyboard is locked has nothing to record. It is set
   * by the lesson brief, which seeds its control from `lesson.keyboard` and
   * lets an unlocked lesson be run with the board turned down — the choice
   * belongs to the run it was made for, so it travels with the run's config
   * rather than being written back over the player's own setting.
   *
   * Carried in the config rather than in `PendingRace` because the run outlives
   * the navigation: a lesson passed with the board off is a different thing
   * from one passed reading the answers, and `eyes-up` (§6.7) is a badge for
   * exactly that choice. A mode kept in memory would be gone by the time
   * anything could award it.
   *
   * Inert in `configKey` on purpose (`decks/typing.ts#typingConfigKey`) — a
   * child's best at lesson 7 is their best at lesson 7, and splitting the
   * record book by how much help was on screen would hide their own record
   * from them the first time they turned the guide off.
   */
  keyboard?: KeyboardMode;
  /** An explicit set, for a drill of the words a player keeps fumbling. */
  words?: string[];
  wordCount: number;
  /** Always absent. Declared so the shared readers can ask without narrowing. */
  timeLimitMs?: null;
};

/**
 * What the flash-card loop can be handed. Both are decks of discrete cards
 * with a chosen input mode; typing is neither, and has its own island.
 */
export type CardConfig = FlashConfig | WordConfig;

/** Anything a saved run can hold. Narrow on `kind`. */
export type RaceConfig = CardConfig | TypingConfig;

/**
 * A word list a parent typed in — this week's spellings, a topic's vocabulary.
 *
 * The same shape as a shipped list minus the editorial fields, and it plays
 * through exactly the same deck spec. `id` is prefixed `custom-` so that
 * `Session.mode` (`words:custom-…`) can never collide with a list this build
 * ships, and so a run stays readable after its deck is deleted.
 */
export type CustomDeck = {
  id: string;
  name: string;
  emoji: string;
  words: string[];
  createdAt: string;
  updatedAt: string;
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
   * Say this aloud instead of showing the prompt.
   *
   * A spelling card whose prompt is on screen is a copying exercise, so the
   * word is spoken and `prompt` is kept only for the record — the splits
   * table and the trouble list still need to name it afterwards.
   */
  speak?: string;
  /**
   * The word in a short sentence, with `_` marking where the word goes.
   *
   * Shown on screen with the slot left blank, alongside `speak` saying it
   * filled in. That is what makes a spoken card answerable: "their" and
   * "there" are one sound, so without the sentence there is no right answer
   * to give. Absent on a deck that has no sentences — a list a parent typed
   * in — and on every deck that isn't spoken at all.
   */
  clue?: string;
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
  config: RaceConfig;
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
