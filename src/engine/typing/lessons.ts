import type { KeyboardMode } from "@/engine/types";

/**
 * The hundred lessons of Frost Keys, as data (docs/typing.md §5).
 *
 * A lesson declares what it is *for* — which keys it puts under the fingers,
 * how long it runs, how much of the keyboard is on screen and what passing it
 * means — and the words are generated from that rather than written out. A
 * hundred hand-written pools would be a hundred chances to use a letter the
 * child hasn't met yet; a hundred specs is one array, and re-ordering the
 * ladder is editing it (§5.1).
 *
 * The **unlocked alphabet** at lesson n is the union of `introduces` over
 * lessons 1…n, plus space. It is computed rather than written down — that is
 * `engine/typing/keys.ts`'s job — which is what lets a lesson carry its words
 * with it when it moves.
 *
 * ── Why there is no text in this file ───────────────────────────────────────
 * `engine/decks/typing.ts` imports this module to label a saved run:
 * `deckSpec("typing:L07")` has to name lesson 7 in a record book two years
 * from now, long after the ladder has been re-tuned. And `decks/index.ts` is
 * the front door for every island on the site — flash cards, spelling, the
 * record book, the print shop — so a module in its graph is shipped to all of
 * them, whole.
 *
 * The last time that was got wrong, an import of the passage library from
 * `decks/typing.ts` took the shared chunk from 46 KB to 222 KB, which is why
 * thirty-three verses are written out by hand in that file today. This is the
 * same trap one file over. So: titles, key sets and pass criteria, and not one
 * word a child ever types. The corpus lives in `engine/typing/lexicon.ts` and
 * the generator in `generate.ts`, and neither may ever become reachable from
 * here (§5.3, decision 7).
 */

/**
 * What a lesson asks for, which is what its text is generated to be.
 *
 * The `focus` on `bigrams` is the only payload any of them carries, because it
 * is the only one the title cannot supply: "th · he · er · re" is a lesson
 * name and a spec at the same time, and the generator needs the second half of
 * that as data.
 */
export type LessonKind =
  /** Letter groups: `ffff jjjj fjfj jfjf`. What a new key is met as. */
  | { type: "keys" }
  /** Words drawn from the alphabet unlocked so far. */
  | { type: "words" }
  /** Words chosen because they contain these sequences. */
  | { type: "bigrams"; focus: string[] }
  /** Whole sentences, so capitals and full stops land where they belong. */
  | { type: "sentences" }
  /** Real prose, from the library. */
  | { type: "passage" }
  /** Ages, dates, scores, prices. */
  | { type: "numbers" }
  /** Prose with numbers in it. */
  | { type: "mixed" }
  /** Short and fast — the speed bar moved up and the length cut down. */
  | { type: "sprint" }
  /**
   * A Hailstorm level (§8).
   *
   * §5.1 gives this variant a `wave: WaveSpec` and it will get one. The twenty
   * waves are keyed off each lesson's *unlocked set*, so they can only be
   * written once `keys.ts` exists — which is why §13 builds them last (WEAVE,
   * step 24) rather than here. Adding the field later is additive; until then
   * a storm level is identified by its type alone, which is all the ladder,
   * the record book and the skip rule (§8.8) need from it.
   */
  | { type: "storm" };

/**
 * What passing looks like, in three bars rather than one score (§6.1).
 *
 * Three because a single number tells a seven-year-old that they failed and
 * not what to do. "Fast enough, not accurate enough" and "you have `x` but not
 * `z`" are instructions; a blended net-WPM is not.
 */
export type PassCriteria =
  | {
      kind: "lesson";
      /** Whole-lesson accuracy, 0–1. */
      accuracy: number;
      /** Gross words per minute. */
      wpm: number;
      /**
       * Each newly-introduced key, at least this fraction correct…
       *
       * Inert on a lesson that introduces nothing — the verdict's `keys` array
       * is one bar per introduced character, so on a review or a checkpoint it
       * is empty and these two are never read. They are still filled in, so
       * that a lesson which grows an `introduces` later is gated the moment it
       * does.
       */
      keyAccuracy: number;
      /** …over at least this many strikes. The generator guarantees enough. */
      keyStrikes: number;
    }
  | {
      kind: "storm";
      /** Survive the wave. Always true — it is what a wave is for. */
      survive: true;
      accuracy: number;
    };

export type Lesson = {
  /** 1–100. */
  n: number;
  /** "L07". Stable forever — it is in `Session.mode`. */
  id: string;
  block: number;
  title: string;
  /** Characters this lesson introduces. Empty on review, game, checkpoint. */
  introduces: string[];
  kind: LessonKind;
  wordCount: number;
  keyboard: KeyboardMode | null;
  keyboardLocked?: boolean;
  pass: PassCriteria;
  checkpoint?: true;
};

// ── The numbers behind the pass criteria ─────────────────────────────────────

/** §6.4's defaults: each new key struck right 90% of the time, over 12 tries. */
const NEW_KEY_ACCURACY = 0.9;
const NEW_KEY_STRIKES = 12;

/**
 * Five characters is a "word", the convention `wordsPerMinute` already counts
 * in, so a lesson's length in characters is its word count times five.
 */
const CHARS_PER_WORD = 5;

/**
 * The most of a lesson its new keys may be — the top of §5.2's 15–35% band.
 *
 * A ceiling on what the gate may demand, not a target for the generator. Above
 * it a lesson stops being about the new keys and becomes a memory test.
 */
const MAX_NEW_KEY_SHARE = 0.35;

/**
 * The accuracy bar on a Hailstorm level.
 *
 * §5.6 prints — in that column because the column belongs to a passage and a
 * storm is not one: what it measures is single-key reaction, so its bar is the
 * new-key gate's figure rather than a passage's 95%. It is also the one bar on
 * the ladder that opens no door — a storm level can never gate a lesson (§8.8,
 * decision 24) — so this is a line on a results screen and nothing more.
 */
const STORM_ACCURACY = NEW_KEY_ACCURACY;

/**
 * How many strikes of each new character the gate waits for.
 *
 * Twelve (§6.4) wherever twelve fits, which is every lesson that arrives two
 * keys at a time: 24 strikes in a 24-word lesson is a fifth of the characters,
 * comfortably inside §5.2's band. Four lessons hand over more than a pair at
 * once — 31, 32, 67 and 68 — and three of them cannot also ask twelve of each:
 * lesson 31 introduces fifteen capitals, and 15 × 12 is 180 strikes in 150
 * characters, so there the demand is divided between them instead of being made
 * unreachable. Lesson 68's four keys still fit twelve apiece inside its 175,
 * which is why the ceiling is a `min` against the room rather than a rule about
 * how many keys arrived. Two is the floor: below it the gate cannot tell a
 * typist from a lucky guess.
 */
function strikesFor(introduces: string[], wordCount: number): number {
  if (introduces.length === 0) return NEW_KEY_STRIKES;
  const room = wordCount * CHARS_PER_WORD * MAX_NEW_KEY_SHARE;
  return Math.max(
    2,
    Math.min(NEW_KEY_STRIKES, Math.floor(room / introduces.length)),
  );
}

/**
 * What each `bigrams` lesson drills.
 *
 * Four of the six are named by their own title in §5.6 and are transcribed
 * from it. The other two are named by description, and are written down here
 * because a spec that says "the hard pairs" is not a spec:
 *
 *   - **8 · Pairs that repeat** is the doubled letters, and at lesson 8 the
 *     alphabet is still `a s d f g h j k l ;` — so `ll`, `ss` and `dd` are all
 *     of them there are (all, hall, glass, add).
 *   - **44 · The hard pairs** is the *same-finger* bigrams, which is what makes
 *     a pair hard rather than which letters it uses: `ed` is both the left
 *     middle finger, `ju` both the right index. They are the sequences a fast
 *     typist still slows down on, which is exactly what a fluency block is for.
 */
const BIGRAMS: Record<number, string[]> = {
  8: ["ll", "ss", "dd"],
  18: ["th", "he", "er", "re"],
  28: ["an", "in", "on", "nd", "nt"],
  42: ["th", "he", "in", "er"],
  43: ["an", "re", "on", "at", "en"],
  44: ["ed", "ce", "un", "ny", "ju", "ki", "lo", "gr"],
};

// ── The table ────────────────────────────────────────────────────────────────

/** The `Kind` column of §5.6. */
type RowKind = LessonKind["type"];

/**
 * The ⌨ column. A mode, with `!` where the doc prints 🔒 — the lesson insists,
 * and the player's toggle is shown disabled with a reason (§4.2).
 */
type Keyboard = KeyboardMode | `${KeyboardMode}!`;

/**
 * One row of §5.6, in the doc's own column order: number, title, new keys,
 * kind, keyboard, words, wpm, accuracy.
 *
 * A tuple rather than an object because this is read as a table. A hundred
 * rows of `{ n: 7, title: "…", wordCount: 25 }` is the same data with ten
 * times the punctuation, and a column that has drifted out of line is
 * invisible in it. Keeping the shape of the doc is what lets the two be
 * checked against each other by eye.
 *
 * `n` is data rather than the array index on purpose: it is half of the id
 * that goes into `Session.mode` and outlives any re-ordering, so "1–100 with
 * no gaps" has to be a thing the tests can actually catch us getting wrong.
 */
type LessonRow = readonly [
  n: number,
  title: string,
  /** The new keys as their own characters. "" where the doc prints —. */
  introduces: string,
  kind: Exclude<RowKind, "storm">,
  keyboard: Keyboard,
  wordCount: number,
  wpm: number,
  /** Whole percent, exactly as the doc's column. Divided down on the way in. */
  accuracy: number,
];

/** A Hailstorm row. §5.6 prints — for its words, its wpm and its accuracy. */
type StormRow = readonly [
  n: number,
  title: string,
  introduces: "",
  kind: "storm",
  keyboard: Keyboard,
];

type Row = LessonRow | StormRow;

/**
 * The hundred, transcribed from docs/typing.md §5.6.
 *
 * Three things to know before editing it:
 *
 *   - **The wpm column drops every time keys arrive** and climbs back over the
 *     review lessons after it. Lesson 50 asks 25 and lesson 51 asks 16. That is
 *     §6.3 and decision 11 written into the data: you have just got slower and
 *     you should have, and a ladder that pretended otherwise would punish the
 *     exact moment it should encourage. Do not smooth it out.
 *   - **Keys arrive in mirrored pairs, one per hand** through the three letter
 *     blocks — `f`/`j` are the index home keys and `d`/`k`, `s`/`l`, `a`/`;`
 *     walk outward together, which is what makes the bottom row guessable by
 *     the time you reach it (§5.5). The number row is the deliberate exception:
 *     it walks outward from the centre of the *board* instead, so `4 5` are
 *     both the left index's and `9 0` are the right ring and pinky. That is
 *     the standard finger assignment, not a slip.
 *   - **The tenth of every block is a checkpoint**, always `off` and always
 *     locked: a checkpoint that can be passed while reading the answer off the
 *     screen measures nothing (§4.2). Lesson 1 is locked the other way, to
 *     `guide`, because a child who has never seen a keyboard cannot be asked
 *     to guess.
 */
const ROWS: readonly Row[] = [
  // ── Block 1 · Home row ─────────────────────────────────────────────────────
  // No English word can be spelled in `f j d k s l`, so words cannot start
  // until lesson 7 — and that is why lesson 4 is a storm level. The first
  // thing that is *fun* arrives before the first thing that is a word (§5.5).
  [1, "Two keys", "fj", "keys", "guide!", 20, 8, 95],
  [2, "Four keys", "dk", "keys", "guide!", 20, 8, 95],
  [3, "Six keys", "sl", "keys", "guide!", 24, 9, 95],
  [4, "Hailstorm · First ice", "", "storm", "guide!"],
  [5, "Both pinkies", "a;", "keys", "guide!", 24, 9, 95],
  [6, "The inside reach", "gh", "keys", "guide!", 24, 10, 95],
  [7, "Home-row words", "", "words", "guide", 25, 11, 95],
  [8, "Pairs that repeat", "", "bigrams", "guide", 25, 11, 95],
  [9, "Hailstorm · Home row", "", "storm", "guide"],
  [10, "Checkpoint · Home row", "", "words", "off!", 30, 12, 97],

  // ── Block 2 · Reaching up ──────────────────────────────────────────────────
  [11, "Up to e and i", "ei", "keys", "guide!", 24, 9, 95],
  [12, "Up to r and u", "ru", "keys", "guide!", 24, 9, 95],
  [13, "Hailstorm · Eight lanes", "", "storm", "guide"],
  [14, "The long reach", "ty", "keys", "guide!", 24, 10, 95],
  [15, "Up to w and o", "wo", "keys", "guide!", 26, 10, 95],
  [16, "Real words at last", "", "words", "guide", 30, 12, 95],
  [17, "The corners", "qp", "keys", "guide!", 26, 10, 95],
  [18, "th · he · er · re", "", "bigrams", "guide", 30, 13, 95],
  [19, "Hailstorm · Two rows", "", "storm", "keys"],
  [20, "Checkpoint · Two rows", "", "words", "off!", 35, 15, 97],

  // ── Block 3 · Reaching down ────────────────────────────────────────────────
  // The comma and the full stop come in with the bottom row because that is
  // where they physically are. It costs nothing, and it means real sentences
  // are available at the end of this block rather than needing a lesson of
  // their own (§5.5).
  [21, "Down to v and m", "vm", "keys", "guide!", 26, 11, 95],
  [22, "c, and the comma", "c,", "keys", "guide!", 26, 11, 95],
  [23, "Hailstorm · Down low", "", "storm", "guide"],
  [24, "x, and the full stop", "x.", "keys", "guide!", 26, 12, 95],
  [25, "The last corner", "z/", "keys", "guide!", 26, 12, 95],
  [26, "The last two", "bn", "keys", "guide!", 28, 12, 95],
  [27, "Every letter", "", "words", "guide", 35, 14, 95],
  [28, "an · in · on · nd · nt", "", "bigrams", "keys", 35, 15, 95],
  [29, "Hailstorm · Whole alphabet", "", "storm", "keys"],
  [30, "Checkpoint · Every letter", "", "sentences", "off!", 40, 18, 97],

  // ── Block 4 · Capitals ─────────────────────────────────────────────────────
  // A shift is not a character, so what these two lessons introduce is the set
  // of capitals each one *reaches*: the right shift is held by the right pinky
  // and capitalises the left hand's letters, and the left shift the right
  // hand's. Two lessons, twenty-six characters, and the opposite-hand rule
  // taught as the only way either of them works.
  [31, "The right shift", "QWERTASDFGZXCVB", "keys", "guide!", 30, 13, 95],
  [32, "The left shift", "YUIOPHJKLNM", "keys", "guide!", 30, 13, 95],
  [33, "Names, and the word I", "", "words", "guide", 35, 15, 95],
  [34, "Hailstorm · Capitals", "", "storm", "keys"],
  [35, "The apostrophe", "'", "keys", "guide!", 30, 14, 95],
  [36, "First sentences", "", "sentences", "keys", 35, 16, 95],
  [37, "Where the comma goes", "", "sentences", "keys", 40, 17, 95],
  [38, "Places and people", "", "sentences", "keys", 40, 18, 95],
  [39, "Hailstorm · Shift under fire", "", "storm", "off"],
  [40, "Checkpoint · Real sentences", "", "sentences", "off!", 45, 20, 97],

  // ── Block 5 · Fluency ──────────────────────────────────────────────────────
  // Nothing new arrives here, so speed is the lesson and the bar climbs
  // fastest (§6.3). It does not climb *monotonically*: 44 and 47 ask for less
  // than the lesson before them because harder material is the point of them,
  // not because the column slipped.
  [41, "The twenty-five", "", "words", "keys", 40, 18, 95],
  [42, "th · he · in · er", "", "bigrams", "keys", 40, 19, 95],
  [43, "an · re · on · at · en", "", "bigrams", "keys", 40, 20, 95],
  [44, "The hard pairs", "", "bigrams", "keys", 40, 19, 95],
  [45, "Hailstorm · Pairs", "", "storm", "keys"],
  [46, "Hands that take turns", "", "words", "off", 45, 22, 95],
  [47, "One hand at a time", "", "words", "keys", 40, 20, 95],
  [48, "The hundred", "", "words", "off", 50, 24, 95],
  [49, "Hailstorm · Whole words", "", "storm", "off"],
  [50, "Checkpoint · Fluent", "", "passage", "off!", 60, 25, 97],

  // ── Block 6 · Numbers ──────────────────────────────────────────────────────
  // 50 asks 25 wpm and 51 asks 16. The number row is a fresh reach for every
  // finger and the bar drops to meet it, all the way back to block 3's pace.
  [51, "Four and five", "45", "keys", "guide!", 30, 16, 95],
  [52, "Three and six", "36", "keys", "guide!", 30, 16, 95],
  [53, "Hailstorm · Digits", "", "storm", "guide"],
  [54, "Two and seven", "27", "keys", "guide!", 30, 17, 95],
  [55, "One and eight", "18", "keys", "guide!", 30, 17, 95],
  [56, "Nine and nought", "90", "keys", "guide!", 30, 18, 95],
  [57, "Ages, dates and scores", "", "numbers", "keys", 40, 19, 95],
  [58, "Words and numbers together", "", "mixed", "keys", 45, 20, 95],
  [59, "Hailstorm · Numbers falling", "", "storm", "keys"],
  [60, "Checkpoint · Numbers", "", "mixed", "off!", 50, 22, 97],

  // ── Block 7 · Punctuation ──────────────────────────────────────────────────
  // Two rows re-introduce a character the ladder already unlocked: `;` arrived
  // at lesson 5 as a home key and `/` at lesson 25 as a bottom-row reach, and
  // both come back here in their punctuation role. The unlocked alphabet is a
  // union, so saying it twice changes nothing about what a child may type; what
  // it does is put the character back under the new-key gate, which is the
  // point — knowing where `;` is and knowing what it is for are two lessons.
  [61, "Asking and shouting", "?!", "keys", "guide!", 35, 18, 95],
  [62, "Speech marks", '"', "keys", "guide!", 35, 18, 95],
  [63, "Hyphen and underscore", "-_", "keys", "guide!", 35, 19, 95],
  [64, "Colon and semicolon", ":;", "keys", "guide!", 35, 19, 95],
  [65, "Hailstorm · Punctuation", "", "storm", "keys"],
  [66, "Brackets", "()", "keys", "guide!", 35, 19, 95],
  [67, "Above the numbers", "@#$%&*", "keys", "guide!", 35, 18, 95],
  [68, "Slash, plus, equals", "/\\+=", "keys", "guide!", 35, 19, 95],
  [69, "Hailstorm · Symbols", "", "storm", "off"],
  [70, "Checkpoint · Punctuated", "", "passage", "off!", 55, 24, 97],

  // ── Block 8 · Endurance ────────────────────────────────────────────────────
  // Length is the variable. The accuracy bar moves to 96% for the block — the
  // first of several places §6.2's flat 95/97 line bends: holding a rate over
  // a hundred words is a different thing from holding it over thirty. Block
  // 9's checkpoint (90) bends the same way, so does block 10's prose (91–96),
  // and lesson 97 bends the other way at 99%. An accuracy column "corrected"
  // back to a flat 95/97 would be wrong from here to the end of the ladder.
  [71, "Sixty words", "", "passage", "off", 60, 22, 96],
  [72, "A whole paragraph", "", "passage", "off", 70, 23, 96],
  [73, "Hailstorm · The long wave", "", "storm", "off"],
  [74, "The sight words, again", "", "words", "off", 60, 24, 96],
  [75, "Verses", "", "passage", "off", 70, 24, 96],
  [76, "Someone speaking", "", "passage", "off", 70, 25, 96],
  [77, "Eighty words", "", "passage", "off", 80, 26, 96],
  [78, "Numbers in prose", "", "passage", "off", 80, 26, 96],
  [79, "Hailstorm · No repairs", "", "storm", "off"],
  [80, "Checkpoint · A hundred words", "", "passage", "off!", 100, 28, 97],

  // ── Block 9 · Speed ────────────────────────────────────────────────────────
  // Its checkpoint asks 96% rather than 97%: thirty-five words a minute is the
  // whole subject of the block, and the point it trades away is the price of
  // asking for it.
  [81, "Sprint · Common words", "", "sprint", "off", 30, 28, 95],
  [82, "Sprint · Alternating hands", "", "sprint", "off", 30, 30, 95],
  [83, "Hailstorm · Hard rain", "", "storm", "off"],
  [84, "Sprint · The hard pairs", "", "sprint", "off", 30, 28, 95],
  [85, "Sprint · Capitals", "", "sprint", "off", 30, 29, 95],
  [86, "Sprint · Numbers", "", "sprint", "off", 30, 26, 95],
  [87, "Sprint · Punctuation", "", "sprint", "off", 30, 28, 95],
  [88, "A solid minute", "", "passage", "off", 90, 32, 95],
  [89, "Hailstorm · Whiteout", "", "storm", "off"],
  [90, "Checkpoint · Thirty-five", "", "passage", "off!", 80, 35, 96],

  // ── Block 10 · Everything ──────────────────────────────────────────────────
  // Lesson 97 is the one lesson that asks for 99%, at a deliberately modest
  // pace, so that "slow down and get it right" is something the ladder has
  // said out loud at least once (§6.2).
  [91, "Mixed prose", "", "passage", "off", 90, 30, 96],
  [92, "Prose with numbers", "", "mixed", "off", 90, 30, 96],
  [93, "Hailstorm · Everything falls", "", "storm", "off"],
  [94, "A long verse", "", "passage", "off", 100, 31, 96],
  [95, "An address, a price, a date", "", "mixed", "off", 80, 30, 96],
  [96, "A hundred and twenty", "", "passage", "off", 120, 32, 96],
  [97, "The accuracy run", "", "passage", "off", 80, 28, 99],
  [98, "Sprint · Everything", "", "sprint", "off", 40, 36, 95],
  [99, "Hailstorm · The last storm", "", "storm", "off"],
  [100, "The Ice Exam", "", "passage", "off!", 150, 38, 97],
];

// ── Table → lessons ──────────────────────────────────────────────────────────

/**
 * "L07", and "L100". Two digits because that is what §5.1 writes down and what
 * `Session.mode` has to keep saying forever; the hundredth simply runs over.
 */
const idFor = (n: number) => `L${String(n).padStart(2, "0")}`;

/**
 * The ⌨ cell with the lock taken off it.
 *
 * A table rather than a `slice`, so that what a cell means is a value the type
 * checker agrees with rather than a string it is handed on trust.
 */
const MODE_OF: Record<Keyboard, KeyboardMode> = {
  off: "off",
  keys: "keys",
  guide: "guide",
  "off!": "off",
  "keys!": "keys",
  "guide!": "guide",
};

const kindFor = (n: number, kind: RowKind): LessonKind =>
  kind === "bigrams" ? { type: "bigrams", focus: BIGRAMS[n] } : { type: kind };

function toLesson(row: Row): Lesson {
  const [n, title, introduced, kind, keyboard] = row;
  const locked = keyboard.endsWith("!");
  const introduces = [...introduced];
  const base = {
    n,
    id: idFor(n),
    block: Math.ceil(n / 10),
    title,
    introduces,
    kind: kindFor(n, kind),
    keyboard: MODE_OF[keyboard],
    // A storm level is `keyboard: "guide"` without the lock as often as not,
    // so this stays undefined rather than false: `keyboardLocked?: true` is
    // the shape §4.2 asks for and an absent flag is the ordinary case.
    ...(locked ? { keyboardLocked: true } : {}),
    // The tenth of every block, by §5.5's definition of a block. Derived
    // rather than written on the row, for the same reason `block` is: a
    // checkpoint is a *position* in the ladder, and a row that could disagree
    // with its own position is a row that will.
    ...(n % 10 === 0 ? { checkpoint: true as const } : {}),
  };

  if (row[3] === "storm")
    return {
      ...base,
      // A storm level's length is its wave's `count` (§8.3), which arrives
      // with the waves themselves. Zero says "not a passage" rather than
      // "empty passage", and nothing reads it until then.
      wordCount: 0,
      pass: { kind: "storm", survive: true, accuracy: STORM_ACCURACY },
    };

  // The last three columns, which only a lesson row carries.
  const [, , , , , wordCount, wpm, accuracy] = row;
  return {
    ...base,
    wordCount,
    pass: {
      kind: "lesson",
      accuracy: accuracy / 100,
      wpm,
      keyAccuracy: NEW_KEY_ACCURACY,
      keyStrikes: strikesFor(introduces, wordCount),
    },
  };
}

/** The ladder, in order. Exactly a hundred, and `LESSONS[i].n === i + 1`. */
export const LESSONS: readonly Lesson[] = ROWS.map(toLesson);
