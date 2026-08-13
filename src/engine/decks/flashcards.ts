import type {
  Card,
  FlashConfig,
  LegacyFlashConfig,
  Operation,
} from "@/engine/types";

import { mulberry32, shuffled } from "@/engine/random";
import type { DeckSpec } from "./spec";

const RANGE_1_TO_12 = Array.from({ length: 12 }, (_, i) => i + 1);

/* ── Fact ids ────────────────────────────────────────────────────────────
   An arithmetic fact is its two numbers, as the deck chose them: the focus
   (the table you picked) then the other operand. Not as the prompt shows
   them — "7 × 8" and "8 × 7" are built from the same pair and must land on
   the same square.                                                         */

export const arithmeticFactId = (focus: number, other: number) =>
  `${focus}:${other}`;

export const factPair = (factId: string): [number, number] => {
  const [a, b] = factId.split(":");
  return [Number(a) || 0, Number(b) || 0];
};

const foldPair = (factId: string) => {
  const [a, b] = factPair(factId);
  return arithmeticFactId(Math.min(a, b), Math.max(a, b));
};

/**
 * "07" is a correct answer to 7 × 1, and so is " 7 ". The keypad lets a kid
 * lead with a zero and the number row lets them fat-finger a space, and
 * neither is a wrong answer to an arithmetic question.
 */
const normaliseNumber = (input: string) => {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  const value = Number(trimmed);
  return Number.isFinite(value) ? String(value) : trimmed;
};

/**
 * A deck is described by an operation spec plus a config. A spelling list or
 * a parent-authored deck is another `DeckSpec` elsewhere — the play loop,
 * ghost racing, XP and stats all work off `Card`, not off arithmetic.
 */
export type OperationSpec = DeckSpec & {
  id: Operation;
  symbol: string;
  /** What the "focus numbers" selector is called for this operation. */
  focusLabel: string;
  /** What the second selector is called — the numbers the focus is paired with. */
  pairLabel: string;
  blurb: string;
  /** Lowest value the second operand may take. Division can't divide by zero. */
  minOther: number;
  build(
    focus: number,
    other: number,
    rand: () => number,
  ): Omit<Card, "choices">;
};

/**
 * Everything about an operation that isn't shared. `ask` is the question a
 * pair poses and its answer, and both the card and the fact label are built
 * from it — so a fact can never be named on screen as something other than
 * the question it was asked as.
 */
type OperationDef = Omit<
  OperationSpec,
  "masteryKey" | "drillKey" | "factLabel" | "normalise" | "build"
> & {
  /**
   * Whether the two numbers can swap without changing the question. Decides
   * both whether the prompt is shown either way round and whether the pair
   * folds — 7 × 8 and 8 × 7 are one fact to practise, 21 ÷ 3 and 21 ÷ 7 are
   * two.
   */
  commutative: boolean;
  ask(focus: number, other: number): { prompt: string; answer: number };
};

const DEFS: Record<Operation, OperationDef> = {
  multiply: {
    id: "multiply",
    label: "Multiplication",
    symbol: "×",
    focusLabel: "Times tables",
    pairLabel: "Multiplied by",
    blurb: "The classic. Pick your tables and go.",
    minOther: 0,
    commutative: true,
    ask: (a, b) => ({ prompt: `${a} × ${b}`, answer: a * b }),
  },
  divide: {
    id: "divide",
    label: "Division",
    symbol: "÷",
    focusLabel: "Divide by",
    pairLabel: "Answers between",
    blurb: "Times tables in reverse.",
    minOther: 1,
    commutative: false,
    ask: (focus, other) => ({
      prompt: `${focus * other} ÷ ${focus}`,
      answer: other,
    }),
  },
  add: {
    id: "add",
    label: "Addition",
    symbol: "+",
    focusLabel: "Add",
    pairLabel: "Added to",
    blurb: "Warm up the engine.",
    minOther: 0,
    commutative: true,
    ask: (a, b) => ({ prompt: `${a} + ${b}`, answer: a + b }),
  },
  subtract: {
    id: "subtract",
    label: "Subtraction",
    symbol: "−",
    focusLabel: "Subtract",
    pairLabel: "Answers between",
    blurb: "Never dips below zero.",
    minOther: 0,
    commutative: false,
    ask: (focus, other) => ({
      prompt: `${focus + other} − ${focus}`,
      answer: other,
    }),
  },
};

const flip = (rand: () => number) => rand() < 0.5;

function toSpec(def: OperationDef): OperationSpec {
  return {
    ...def,
    // The map is a symmetric 12×12 for every operation, so it always folds.
    // Division's two questions therefore share a square on purpose; the drill
    // key below is what keeps them apart where it matters.
    masteryKey: foldPair,
    drillKey: def.commutative ? foldPair : (factId) => factId,
    factLabel: (factId) => def.ask(...factPair(factId)).prompt,
    normalise: normaliseNumber,
    build(focus, other, rand) {
      // Which way round the prompt reads. Only a commutative operation both
      // flips and draws from `rand` — and the short-circuit matters as much as
      // the flip: spending a coin here for division would shift every
      // subsequent card and rebuild a saved run's deck as a different one.
      const swap = def.commutative && !flip(rand);
      const { prompt, answer } = swap
        ? def.ask(other, focus)
        : def.ask(focus, other);
      return {
        prompt,
        answer: String(answer),
        factId: arithmeticFactId(focus, other),
      };
    },
  };
}

export const OPERATIONS: Record<Operation, OperationSpec> = {
  multiply: toSpec(DEFS.multiply),
  divide: toSpec(DEFS.divide),
  add: toSpec(DEFS.add),
  subtract: toSpec(DEFS.subtract),
};

export const OPERATION_ORDER: Operation[] = [
  "multiply",
  "divide",
  "add",
  "subtract",
];

/** Wrong answers a kid might plausibly land on — near misses, not noise. */
function distractors(
  answer: number,
  [focus, other]: [number, number],
  rand: () => number,
) {
  const candidates = [
    answer + 1,
    answer - 1,
    answer + 2,
    answer - 2,
    answer + focus,
    answer - focus,
    answer + other,
    answer - other,
    answer + 10,
    answer - 10,
  ].filter((n) => n >= 0 && n !== answer);

  const picked: number[] = [];
  for (const n of shuffled([...new Set(candidates)], rand)) {
    if (picked.length === 3) break;
    picked.push(n);
  }
  let filler = answer + 3;
  while (picked.length < 3) {
    if (filler !== answer && !picked.includes(filler)) picked.push(filler);
    filler += 1;
  }
  return picked.map(String);
}

/**
 * Reads a config that may predate `others`, expanding the old min/max range
 * so saved runs stay playable and comparable.
 */
export function readConfig(config: LegacyFlashConfig): FlashConfig {
  if (config.others) return config as FlashConfig;
  const low = config.otherMin ?? 1;
  const high = Math.max(low, config.otherMax ?? 12);
  const others = Array.from({ length: high - low + 1 }, (_, i) => i + low);
  return { ...config, others };
}

export function buildFlashDeck(
  config: LegacyFlashConfig,
  seed: number,
): Card[] {
  const resolved = readConfig(config);
  const spec = OPERATIONS[resolved.operation];
  const rand = mulberry32(seed);
  const others = resolved.others.filter((n) => n >= spec.minOther);

  // A drill names its facts outright; everything else crosses the two grids.
  const pool: Array<[number, number]> = resolved.facts?.length
    ? resolved.facts.map(([a, b]) => [a, b])
    : [];
  if (pool.length === 0) {
    for (const focus of resolved.tables) {
      for (const other of others) pool.push([focus, other]);
    }
  }
  if (pool.length === 0) pool.push([1, 1]);

  // Exhaust the pool before repeating so a short deck never asks the same
  // fact twice while other facts go untouched.
  const pairs: Array<[number, number]> = [];
  while (pairs.length < resolved.cardCount) {
    pairs.push(...shuffled(pool, rand));
  }

  return pairs.slice(0, resolved.cardCount).map(([focus, other]) => {
    const base = spec.build(focus, other, rand);
    if (resolved.inputMode !== "choose") return base;
    return {
      ...base,
      choices: shuffled(
        [
          base.answer,
          ...distractors(Number(base.answer), [focus, other], rand),
        ],
        rand,
      ),
    };
  });
}

const sortedFacts = (facts: Array<[number, number]>) =>
  [...facts]
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const)
    .sort((x, y) => x[0] - y[0] || x[1] - y[1])
    .map(([a, b]) => `${a}:${b}`)
    .join(",");

/**
 * Two runs can only be raced against each other if they share this key —
 * same operation, same numbers on both sides, same length, same input mode,
 * same clock. The clock and drill segments are only appended when they're in
 * play, so every run saved before they existed keeps the key it was filed
 * under and still lines up as a ghost.
 */
export function flashConfigKey(input: LegacyFlashConfig) {
  const config = readConfig(input);
  const sorted = (list: number[]) => [...list].sort((a, b) => a - b).join(".");
  const parts = [
    config.operation,
    sorted(config.tables),
    sorted(config.others),
    config.cardCount,
    config.inputMode,
  ];
  if (config.timeLimitMs) parts.push(`t${config.timeLimitMs}`);
  if (config.facts?.length) parts.push(`f${sortedFacts(config.facts)}`);
  return parts.join("|");
}

export function describeFlashConfig(input: LegacyFlashConfig) {
  const config = readConfig(input);
  const spec = OPERATIONS[config.operation];
  const tables = [...config.tables].sort((a, b) => a - b);
  const list = config.facts?.length
    ? `${config.facts.length} tricky facts`
    : tables.length >= 12
      ? "all tables"
      : tables.length > 4
        ? `${tables.length} tables`
        : tables.join(", ");
  const clock = config.timeLimitMs
    ? ` · ${config.timeLimitMs / 1000}s a card`
    : "";
  return `${spec.symbol} ${list} · ${config.cardCount} cards${clock}`;
}

/* ── The per-card clock ──────────────────────────────────────────────────
   `null` is "no limit" — the original race, decided on total time. Anything
   else gives every card its own countdown: run out and the answer is shown
   and the deck moves on.                                                   */

export const TIME_LIMITS: Array<{ ms: number | null; label: string }> = [
  { ms: null, label: "Off" },
  { ms: 12000, label: "12s" },
  { ms: 8000, label: "8s" },
  { ms: 6000, label: "6s" },
  { ms: 4000, label: "4s" },
];

/** The clock moves in quarter seconds, between one minute and one second. */
export const TIME_STEP_MS = 250;
export const TIME_MIN_MS = 1000;
export const TIME_MAX_MS = 60000;

/** Puts a typed or stepped clock onto the quarter-second grid, in bounds. */
export function snapTimeLimit(ms: number) {
  const stepped = Math.round(ms / TIME_STEP_MS) * TIME_STEP_MS;
  return Math.min(TIME_MAX_MS, Math.max(TIME_MIN_MS, stepped));
}

/** A generous starting clock, so the first timed race is a stretch not a wall. */
export function timeLimitForAge(age: number) {
  if (age <= 6) return 12000;
  if (age <= 8) return 10000;
  return 8000;
}

/**
 * A deck built from named facts rather than from the grids — the practice
 * loop for problems a player keeps missing. Tables and others are filled in
 * from the facts so the run still describes and files itself normally.
 */
export function buildFlashDrill(
  factIds: string[],
  base: Pick<FlashConfig, "operation" | "inputMode"> & {
    timeLimitMs?: number | null;
  },
): FlashConfig {
  // Back to pairs on the way in: `FlashConfig.facts` is the persisted shape
  // and `configKey` is built from it, so changing it would orphan every drill
  // ghost already saved.
  const unique = [...new Set(factIds)].map(factPair);
  const axis = (pick: 0 | 1) =>
    [...new Set(unique.map((f) => f[pick]))].sort((a, b) => a - b);
  return {
    operation: base.operation,
    tables: axis(0),
    others: axis(1),
    // Two passes at each fact: enough to be practice, short enough to finish.
    cardCount: Math.min(30, Math.max(6, unique.length * 2)),
    inputMode: base.inputMode,
    timeLimitMs: base.timeLimitMs ?? null,
    facts: unique,
  };
}

export type Preset = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  config: FlashConfig;
};

const base = { operation: "multiply" as Operation, others: RANGE_1_TO_12 };
const upTo10 = RANGE_1_TO_12.slice(0, 10);

export const PRESETS: Preset[] = [
  {
    id: "warmup",
    name: "Warm-up",
    tagline: "Tables 1, 2, 5 and 10 · × 1 – 10 · tap to answer",
    emoji: "🌱",
    config: {
      ...base,
      tables: [1, 2, 5, 10],
      others: upTo10,
      cardCount: 10,
      inputMode: "choose",
    },
  },
  {
    id: "cruise",
    name: "Cruise",
    tagline: "Tables 2 – 6 · × 1 – 10 · type your answer",
    emoji: "🚗",
    config: {
      ...base,
      tables: [2, 3, 4, 5, 6],
      others: upTo10,
      cardCount: 15,
      inputMode: "type",
    },
  },
  {
    id: "sprint",
    name: "Sprint",
    tagline: "Tables 3 – 9 · × 1 – 12 · 20 cards",
    emoji: "🏁",
    config: {
      ...base,
      tables: [3, 4, 5, 6, 7, 8, 9],
      cardCount: 20,
      inputMode: "type",
    },
  },
  {
    id: "gauntlet",
    name: "The Gauntlet",
    tagline: "Every table, 1 – 12 · 30 cards",
    emoji: "🔥",
    config: {
      ...base,
      tables: RANGE_1_TO_12,
      cardCount: 30,
      inputMode: "type",
    },
  },
  {
    id: "clock",
    name: "Beat the Clock",
    tagline: "Tables 2 – 9 · 8 seconds a card · 20 cards",
    emoji: "⏳",
    config: {
      ...base,
      tables: [2, 3, 4, 5, 6, 7, 8, 9],
      others: upTo10,
      cardCount: 20,
      inputMode: "type",
      timeLimitMs: 8000,
    },
  },
];

/** Sensible starting point for a player, based on their age. */
export function presetForAge(age: number): Preset {
  if (age <= 6) return PRESETS[0];
  if (age <= 8) return PRESETS[1];
  if (age <= 10) return PRESETS[2];
  return PRESETS[3];
}
