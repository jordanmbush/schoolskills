import type { Card, TypingConfig } from "@/engine/types";

import { mulberry32, shuffled } from "@/engine/random";
import { SCRIPTURE_CREDIT } from "@/engine/sheets/passages/credit";
import { lessonById } from "@/engine/typing/lessons";
import { WORD_LISTS, listWords } from "./wordlists";
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
  /**
   * The line this level's source asks to be printed under its words, if it
   * asks for one. The same field `Passage.credit` is, and for the same
   * reason: attribution travels *with* the text rather than beside it, so a
   * screen that shows the passage cannot show it uncredited.
   */
  credit?: string;
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
const COMMON = [...new Set(WORD_LISTS.flatMap(listWords))];

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

/**
 * Scripture, as a typing pool — one source among several, and nothing more
 * than that (docs/printables.md §12).
 *
 * Thirty-three verses from Psalms, Proverbs, the Gospels and the letters, in
 * the World English Bible Updated. Three rules picked them, and all three are
 * about the exercise rather than about the text:
 *
 *   - **No divine name.** `LORD` in small caps is a nuisance to type and
 *     reads as shouting to a seven-year-old, so the psalms and proverbs here
 *     are the ones that don't carry it.
 *   - **Nothing but keys a child can find.** Typing marks exactly — case and
 *     punctuation are the whole exercise at this level — and the release sets
 *     quoted speech in curly quotation marks, which a plain keyboard does not
 *     produce. A verse containing one would be unpassable rather than hard.
 *     That rules out most of the narrative and every quoted saying, which is
 *     why these are sayings and not stories. Only `.`, `,` and `;` survive.
 *   - **Whole sentences.** A capital at the front and a full stop at the end.
 *     The sentence levels split on spaces and never on meaning, so a verse
 *     that trails off mid-list would arrive as a fragment with a comma on it.
 *
 * ── Why the words are written out here ──────────────────────────────────────
 * A module is assigned to a chunk whole, and this file is reachable from
 * `decks/index.ts`, so an import of the passage library here puts the WEBu,
 * the KJV beside it and thirty other passages into every island on the site to
 * type thirty-three verses in one of them (docs/typing.md §5.3, which has the
 * measurement). It is also why the credit comes from `passages/credit.ts` and
 * not from the file the verses are in.
 *
 * So the text is repeated, and `typing.test.ts` pins every line of it to
 * `passage()` character for character. That is the arrangement `scripture.ts`
 * already has with `release/engwebu.vpl.txt`: two files that would have to be
 * edited identically, in one commit, for the text to drift — which is the
 * point at which it stops being an accident. The reference above each line is
 * where it came from, and is what the test reads when one of them fails.
 */
const SCRIPTURE_PASSAGES = [
  // Psalm 23
  "He makes me lie down in green pastures. He leads me beside still waters.",
  // Psalm 34:13-14
  "Keep your tongue from evil, and your lips from speaking lies.",
  // Psalm 51:10
  "Create in me a clean heart, O God. Renew a right spirit within me.",
  // Psalm 56:3
  "When I am afraid, I will put my trust in you.",
  // Psalm 90:12
  "So teach us to count our days, that we may gain a heart of wisdom.",
  // Psalm 119:9-11
  "I have hidden your word in my heart, that I might not sin against you.",
  // Psalm 119:105
  "Your word is a lamp to my feet, and a light for my path.",
  // Psalm 121
  "Behold, he who keeps Israel will neither slumber nor sleep.",
  // Psalm 147:3
  "He heals the broken in heart, and binds up their wounds.",
  // Proverbs 3:5-6
  "In all your ways acknowledge him, and he will make your paths straight.",
  // Proverbs 4:23
  "Keep your heart with all diligence, for out of it is the wellspring of life.",
  // Proverbs 10:12
  "Hatred stirs up strife, but love covers all wrongs.",
  // Proverbs 11:2
  "When pride comes, then comes shame, but with humility comes wisdom.",
  // Proverbs 13:20
  "One who walks with wise men grows wise, but a companion of fools suffers harm.",
  // Proverbs 15:1
  "A gentle answer turns away wrath, but a harsh word stirs up anger.",
  // Proverbs 16:24
  "Pleasant words are a honeycomb, sweet to the soul, and health to the bones.",
  // Proverbs 17:17
  "A friend loves at all times; and a brother is born for adversity.",
  // Proverbs 17:22
  "A cheerful heart makes good medicine, but a crushed spirit dries up the bones.",
  // Proverbs 21:5
  "The plans of the diligent surely lead to profit; and everyone who is hasty surely rushes to poverty.",
  // Proverbs 25:11
  "A word fitly spoken is like apples of gold in settings of silver.",
  // Matthew 5:3-12
  "Blessed are the peacemakers, for they shall be called children of God.",
  // Matthew 6:9-13
  "Give us today our daily bread.",
  // Luke 2:52
  "And Jesus increased in wisdom and stature, and in favor with God and men.",
  // John 1:1-5
  "In him was life, and the life was the light of men.",
  // Romans 12:9-13
  "Let love be without hypocrisy. Abhor that which is evil. Cling to that which is good.",
  // 1 Corinthians 16:13-14
  "Let all that you do be done in love.",
  // Ephesians 4:32
  "And be kind to one another, tender hearted, forgiving each other, just as God also in Christ forgave you.",
  // Philippians 4:13
  "I can do all things through Christ who strengthens me.",
  // 1 Thessalonians 5:16-18
  "In everything give thanks, for this is the will of God in Christ Jesus toward you.",
  // Hebrews 11:1
  "Now faith is assurance of things hoped for, proof of things not seen.",
  // Hebrews 13:8
  "Jesus Christ is the same yesterday, today, and forever.",
  // James 1:22
  "But be doers of the word, and not only hearers, deluding your own selves.",
  // 1 John 4:19
  "We love him, because he first loved us.",
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
  {
    id: "scripture",
    name: "Verses",
    group: "Ages 9+",
    blurb: "Psalms, Proverbs and the letters, punctuated exactly as written.",
    emoji: "📖",
    keys: "shift, comma, semicolon",
    kind: "sentences",
    pool: SCRIPTURE_PASSAGES,
    credit: SCRIPTURE_CREDIT,
  },
];

export const TYPING_LEVELS_BY_ID = new Map(TYPING_LEVELS.map((l) => [l.id, l]));

/**
 * Where a child of this age is likely to be starting.
 *
 * The four-level progression, and only that. The Scripture level is a *source*
 * rather than a step — it is the sentence level's marking rule over somebody
 * else's words — so nobody is landed on it by an age; it is chosen or it isn't.
 */
export function typingLevelForAge(age: number): TypingLevel {
  if (age <= 7) return TYPING_LEVELS[0];
  if (age <= 8) return TYPING_LEVELS[1];
  if (age <= 10) return TYPING_LEVELS[2];
  return TYPING_LEVELS[3];
}

/**
 * The credit line to print under this level's words, if its source asks for
 * one. Every screen that shows the passage asks — the setup that names the
 * level, the race that shows the words, the results that lists them back —
 * because a credit that appears on one of the three is a credit that a reader
 * can be shown the text without.
 */
export const levelCredit = (levelId: string): string | undefined =>
  TYPING_LEVELS_BY_ID.get(levelId)?.credit;

/** `count` words out of a bag, exhausting it before it repeats. */
const drawn = (pool: readonly string[], count: number, rand: () => number) => {
  const out: string[] = [];
  while (out.length < count) out.push(...shuffled(pool, rand));
  return out.slice(0, count);
};

/**
 * The words of a passage, in the order they'll be typed.
 *
 * A sentence level takes whole sentences and splits them, so the punctuation
 * stays where it belongs and the passage reads as English. A word level
 * shuffles its bag, exhausting it before repeating — the same rule the other
 * decks follow, so a short run never asks for one word four times.
 */
export function passageFor(config: TypingConfig, seed: number): string[] {
  /**
   * A lesson's words are a PASSAGE; a drill's are a bag.
   *
   * Both arrive in the same field, because both are a config that carries its
   * own words (docs/typing.md §5.3) — but they are not the same kind of thing.
   * The ladder generates a lesson's text in order and at length, sentences and
   * their full stops included (docs/typing.md §5.1), so dealing it out again
   * would shuffle the stops into the middle of it. A parent's five tricky words
   * are the opposite: there is no order to keep and the bag is short, so it is
   * drawn from until the run is long enough. The lesson id is what tells the
   * two apart, exactly as it does in `typingConfigKey` below.
   */
  if (config.lessonId && config.words?.length)
    return config.words.slice(0, config.wordCount);
  if (config.words?.length)
    return drawn(config.words, config.wordCount, mulberry32(seed));

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

  return drawn(level.pool, config.wordCount, rand);
}

/**
 * The character a typist is waiting on, given the live word and what they have
 * typed of it so far.
 *
 * The letter at the cursor, and once every letter of the word is in, the SPACE
 * that commits it. Space is a key like any other here and the most-missed one
 * on the board: a child who can spell "because" and cannot find the space bar
 * without looking types at half speed, and the thumb is the only finger the
 * passage never names.
 *
 * Anything typed PAST the end of the word also asks for space, because space is
 * what gets out of it — the extra letters are already marked wrong in the
 * passage above and the run does not stop to be told twice.
 *
 * Here rather than inline in `TypingTrack` because this is the expectation the
 * keyboard's red is decided against (docs/typing.md §4.3), and it is text in,
 * text out — so the boundary that matters, a full word wanting a space next,
 * can be pinned without a race running around it.
 */
export const nextChar = (word: string, entry: string): string =>
  word[entry.length] ?? " ";

export function buildTypingDeck(config: TypingConfig, seed: number): Card[] {
  return passageFor(config, seed).map((word) => ({
    prompt: word,
    answer: word,
    factId: word,
  }));
}

/**
 * Which runs may race each other as ghosts — the lesson, or the level and its
 * words (docs/typing.md §5.4).
 *
 * A drill's words *are* its identity: a parent's five tricky words at twenty
 * words long is a different exercise from another five, and folding them in is
 * what keeps the two apart. A lesson's words are the opposite — lesson 7
 * generates a fresh passage every time it is run, so the same fold would give
 * every attempt a key of its own and a child would never be shown the best
 * they have already done. So the words are left out exactly when a lesson id
 * is there to stand in for them.
 *
 * Every key written before the ladder existed is unchanged, which is not a
 * nicety: `configKey` is how a saved run finds its ghosts, and the record book
 * is the only copy there is (CLAUDE.md). A config with no `lessonId` takes the
 * same two branches it always has, and no shipped level id can be mistaken for
 * a lesson id — `configkey.test.ts` is where that is held still.
 */
export function typingConfigKey(config: TypingConfig) {
  const parts: Array<string | number> = [
    "typing",
    config.lessonId ?? config.levelId,
    config.wordCount,
  ];
  if (!config.lessonId && config.words?.length)
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

/**
 * The ladder, by the id that goes into `Session.mode`.
 *
 * `lessons.ts` is the one module in `engine/typing/` the deck layer may import
 * (docs/typing.md §5.3), and this is what it is for: a run filed under
 * `typing:L07` has to be able to name itself in a record book two years from
 * now, long after the ladder has been re-tuned. It carries titles and pass
 * criteria and not one word a child types — the corpus and the generator stay
 * on the far side of `local/no-corpus-in-decks`, and the words a lesson was
 * played on arrive in `config.words` from the island that generated them.
 */
export function typingDeckSpec(mode: string): DeckSpec {
  const id = levelIdOf(mode);
  // Two namespaces behind one prefix, and neither can answer for the other: a
  // lesson id is "L07" and a level id is "home-row". A mode from neither is a
  // level this build has retired, which still reads as a typing run.
  const lesson = lessonById(id);
  const level = TYPING_LEVELS_BY_ID.get(id);
  return {
    id: mode,
    label: lesson
      ? `Lesson ${lesson.n} · ${lesson.title}`
      : (level?.name ?? "Typing"),
    world: "ice",
    // Exact, including case: at the sentence level the shift key IS the
    // exercise, so "the" and "The" are two different things to get right.
    masteryKey: (factId) => factId,
    drillKey: (factId) => factId,
    factLabel: (factId) => factId,
    normalise: (input) => input.trim(),
  };
}
