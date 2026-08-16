import type { Card, TypingConfig } from "@/engine/types";

import { mulberry32, shuffled } from "@/engine/random";
import { WORD_LISTS } from "./wordlists";
import type { DeckSpec } from "./spec";

/**
 * Typing, as a deck family.
 *
 * A passage is a sequence of words, and a word is a `Card` — which is what
 * makes ghost racing work here at all. A rival's run replays as split times
 * per word, so you can watch someone's pace word by word rather than being
 * handed a WPM at the end. Everything else the loop does (XP, badges, the
 * record book, the trouble list) follows for free.
 *
 * Marking is exact. Case and punctuation are the exercise at the top level,
 * not noise to be forgiven — unlike spelling, where "Because" is right.
 */

export const TYPING_MODE_PREFIX = "typing:";
export const typingMode = (levelId: string) =>
  `${TYPING_MODE_PREFIX}${levelId}`;
export const levelIdOf = (mode: string) =>
  mode.slice(TYPING_MODE_PREFIX.length);

export type TypingLevel = {
  id: string;
  name: string;
  group: string;
  blurb: string;
  emoji: string;
  /** What this level puts under the fingers, shown in setup. */
  keys: string;
  /** Whole sentences, or a bag of words to shuffle. */
  kind: "words" | "sentences";
  pool: string[];
};

/** Home row only: a s d f g — h j k l ;. Every word below uses nothing else. */
const HOME_ROW = [
  "as",
  "ask",
  "add",
  "all",
  "sad",
  "lad",
  "dad",
  "had",
  "has",
  "gas",
  "jag",
  "lag",
  "fad",
  "half",
  "hall",
  "fall",
  "flag",
  "flash",
  "flask",
  "glad",
  "glass",
  "salad",
  "sash",
  "dash",
  "lash",
  "slash",
  "shall",
  "gash",
  "alas",
  "gala",
];

/** Home row plus the top row. Nothing here needs z x c v b n m. */
const TOP_ROW = [
  "the",
  "that",
  "they",
  "their",
  "there",
  "where",
  "here",
  "our",
  "your",
  "out",
  "what",
  "with",
  "will",
  "were",
  "water",
  "other",
  "after",
  "three",
  "great",
  "please",
  "little",
  "people",
  "write",
  "right",
  "together",
  "happy",
  "quiet",
  "paper",
  "while",
  "world",
  "should",
  "would",
  "through",
  "pretty",
  "really",
  "father",
  "earth",
  "house",
  "these",
  "those",
];

/**
 * Every letter, from the sight-word lists.
 *
 * The same words the spelling decks drill, deliberately: a child working
 * through "because" as a spelling meets it again as a thing their fingers
 * have to find, and the two reinforce each other.
 */
const COMMON = [...new Set(WORD_LISTS.flatMap((list) => list.words))];

const SENTENCES = [
  "The quick brown fox jumps over the lazy dog.",
  "My sister has a red bike.",
  "We went to the park after school.",
  "Can you help me with this?",
  "It was raining, so we stayed inside.",
  "Dad made pancakes for breakfast.",
  "The cat sat on the warm windowsill.",
  "How many books did you read?",
  "She ran faster than anyone else.",
  "Please put your shoes by the door.",
  "The film starts at seven o'clock.",
  "I like apples, pears and grapes.",
  "We saw a whale from the boat.",
  "Turn left at the traffic lights.",
  "My brother is learning to play the piano.",
];

export const TYPING_LEVELS: TypingLevel[] = [
  {
    id: "home-row",
    name: "Home row",
    group: "Ages 5–7",
    blurb: "Eight fingers, one row. Nothing here needs you to reach.",
    emoji: "🏠",
    keys: "a s d f g h j k l",
    kind: "words",
    pool: HOME_ROW,
  },
  {
    id: "top-row",
    name: "Reaching up",
    group: "Ages 6–8",
    blurb: "Adds the top row. Real words now, but still no stretching down.",
    emoji: "⬆️",
    keys: "q w e r t y u i o p",
    kind: "words",
    pool: TOP_ROW,
  },
  {
    id: "common",
    name: "Every letter",
    group: "Ages 7–10",
    blurb: "The words you write most, drawn from the sight-word lists.",
    emoji: "⌨️",
    keys: "the whole keyboard",
    kind: "words",
    pool: COMMON,
  },
  {
    id: "sentences",
    name: "Real sentences",
    group: "Ages 8+",
    blurb: "Capitals, full stops and commas. The shift key finally matters.",
    emoji: "📝",
    keys: "shift, comma, full stop",
    kind: "sentences",
    pool: SENTENCES,
  },
];

export const TYPING_LEVELS_BY_ID = new Map(TYPING_LEVELS.map((l) => [l.id, l]));

/** Where a child of this age is likely to be starting. */
export function typingLevelForAge(age: number): TypingLevel {
  if (age <= 7) return TYPING_LEVELS[0];
  if (age <= 8) return TYPING_LEVELS[1];
  if (age <= 10) return TYPING_LEVELS[2];
  return TYPING_LEVELS[3];
}

/**
 * The words of a passage, in the order they'll be typed.
 *
 * A sentence level takes whole sentences and splits them, so the punctuation
 * stays where it belongs and the passage reads as English. A word level
 * shuffles its bag, exhausting it before repeating — the same rule the other
 * decks follow, so a short run never asks for one word four times.
 */
export function passageFor(config: TypingConfig, seed: number): string[] {
  if (config.words?.length) {
    const rand = mulberry32(seed);
    const out: string[] = [];
    while (out.length < config.wordCount)
      out.push(...shuffled(config.words, rand));
    return out.slice(0, config.wordCount);
  }

  const level = TYPING_LEVELS_BY_ID.get(config.levelId);
  if (!level) return [];
  const rand = mulberry32(seed);

  if (level.kind === "sentences") {
    // Whole sentences, then cut to length — a passage that stops mid-sentence
    // is better than one that starts mid-sentence.
    const words: string[] = [];
    while (words.length < config.wordCount) {
      for (const sentence of shuffled(level.pool, rand)) {
        words.push(...sentence.split(" "));
        if (words.length >= config.wordCount) break;
      }
    }
    return words.slice(0, config.wordCount);
  }

  const words: string[] = [];
  while (words.length < config.wordCount)
    words.push(...shuffled(level.pool, rand));
  return words.slice(0, config.wordCount);
}

export function buildTypingDeck(config: TypingConfig, seed: number): Card[] {
  return passageFor(config, seed).map((word) => ({
    prompt: word,
    answer: word,
    factId: word,
  }));
}

export function typingConfigKey(config: TypingConfig) {
  const parts: Array<string | number> = [
    "typing",
    config.levelId,
    config.wordCount,
  ];
  if (config.words?.length)
    parts.push(`w${[...config.words].sort().join(",")}`);
  return parts.join("|");
}

export function describeTypingConfig(config: TypingConfig) {
  const level = TYPING_LEVELS_BY_ID.get(config.levelId);
  const what = config.words?.length
    ? `${config.words.length} tricky words`
    : (level?.name ?? "Typing");
  return `⌨️ ${what} · ${config.wordCount} words`;
}

/** A short passage of just the words a player keeps fumbling. */
export function buildTypingDrill(
  words: string[],
  levelId: string,
): TypingConfig {
  const unique = [...new Set(words)];
  return {
    kind: "typing",
    levelId,
    words: unique,
    wordCount: Math.min(40, Math.max(10, unique.length * 3)),
  };
}

/**
 * Words per minute, the standard way: five characters is a "word" however long
 * the real ones were, so a passage of "as" and "add" can't inflate the number
 * against one of "together" and "through".
 *
 * Gross WPM — every keystroke counts, right or wrong — with accuracy reported
 * beside it rather than folded in. A child who types fast and misses half of
 * it should see both numbers, not one blended one that hides which is which.
 */
export function wordsPerMinute(cards: Array<{ answer: string }>, ms: number) {
  if (ms <= 0 || cards.length === 0) return 0;
  // +1 per word for the space that committed it.
  const characters = cards.reduce((sum, c) => sum + c.answer.length + 1, 0);
  return Math.round(characters / 5 / (ms / 60000));
}

export function typingDeckSpec(mode: string): DeckSpec {
  const level = TYPING_LEVELS_BY_ID.get(levelIdOf(mode));
  return {
    id: mode,
    label: level?.name ?? "Typing",
    world: "ice",
    // Exact, including case: at the sentence level the shift key IS the
    // exercise, so "the" and "The" are two different things to get right.
    masteryKey: (factId) => factId,
    drillKey: (factId) => factId,
    factLabel: (factId) => factId,
    normalise: (input) => input.trim(),
  };
}
