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

export type Card = {
  /** Rendered prompt, e.g. "7 × 8". */
  prompt: string;
  answer: number;
  /** Shuffled options, present only in multiple-choice mode. */
  choices?: number[];
  /** The two numbers the card exercises, for the mastery grid. */
  facts: [number, number];
};

export type CardResult = {
  prompt: string;
  answer: number;
  given: number | null;
  ok: boolean;
  ms: number;
  facts: [number, number];
  /**
   * The per-card clock ran out before an answer arrived. Distinct from a wrong
   * answer: it's what "didn't solve it in time" means, and it's what the
   * practice list is built from.
   */
  timedOut?: boolean;
};

export type Session = {
  id: string;
  profileId: string;
  game: "flashcards";
  mode: Operation;
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
