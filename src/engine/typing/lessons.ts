import type { KeyboardMode } from "@/engine/types";
import type { WaveSpec } from "./storm";

/**
 * The hundred lessons of Frost Keys, as data (docs/typing.md §5).
 *
 * A lesson declares what it is *for* and its text is generated from that
 * (§5.1). The unlocked alphabet at lesson n is computed from `introduces`
 * rather than written down here — that is `keys.ts`'s job — which is what lets
 * a lesson carry its words with it when it moves.
 *
 * This is the one module in `engine/typing/` the deck layer may import, so
 * that `deckSpec("typing:L07")` can name lesson 7 in a record book years from
 * now. It therefore holds titles, key sets and pass criteria and not one word
 * a child ever types: neither `lexicon.ts` nor `generate.ts` may ever become
 * reachable from here (§5.3, decision 7).
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
   * A Hailstorm level, and the storm it is (§8, §5.7).
   *
   * The wave is a `WaveSpec` **minus its keys** (`StormShape` below, decision
   * 56): there is nowhere in the table to write a character down, so
   * `storms.ts` can only draw the pool from `unlockedAt(n)` and a storm can
   * never rain a key the ladder has not taught.
   */
  | { type: "storm"; wave: StormShape };

/**
 * Which class of character a storm level is *about*, or absent for one that is
 * about everything.
 *
 * A named class rather than the characters themselves, because the pool is
 * always a filter over what the ladder has taught by then — so a focus can
 * only ever weight keys a child already has. `storms.ts` decides what each
 * name matches, and §5.7 what the weighting comes to.
 */
export type StormFocus = "capitals" | "digits" | "marks";

/**
 * The storm a level is, as the table writes it: everything a `WaveSpec` has
 * except the keys, plus the two things only a level knows.
 *
 * `Omit<WaveSpec, "keys">` rather than a restatement of `count`, `gap`,
 * `fall`, `shield` and `repairAt`, so a field added to the engine's spec is a
 * field the table is asked for rather than one it silently stops carrying.
 * The import is a type and is erased, which is what keeps `storm.ts` — and the
 * keyboard layout behind it — out of the chunk `decks/index.ts` ships to every
 * island (§5.3, decision 7).
 */
export type StormShape = Omit<WaveSpec, "keys"> & {
  /**
   * The seed this level's weather comes from (decision 58): the same storm
   * every time it is opened, not merely the same on a retry.
   */
  seed: number;
  /** The characters this level rains, over the ones it merely includes. */
  focus?: StormFocus;
};

/** What passing looks like, in three bars rather than one score (§6.1). */
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
       * is empty there and these two are never read. Filled in anyway, so a
       * lesson that grows an `introduces` later is gated the moment it does.
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
 * The accuracy bar on a Hailstorm level: the new-key gate's figure rather than
 * a passage's 95%, because what a storm measures is single-key reaction
 * (§5.6). It is also the one bar on the ladder that opens no door (§8.8,
 * decision 24), so it is a line on a results screen and nothing more.
 */
const STORM_ACCURACY = NEW_KEY_ACCURACY;

/**
 * How many strikes of each new character the gate waits for.
 *
 * Twelve (§6.4) wherever twelve fits, which is every lesson that arrives two
 * keys at a time. Four hand over more at once — 31, 32, 67 and 68 — and three
 * of those cannot also ask twelve of each: lesson 31's fifteen capitals would
 * want 180 strikes in 150 characters, so there the demand is divided between
 * them instead of being made unreachable. Lesson 68's four keys still fit
 * twelve apiece inside its 175, which is why the ceiling is a `min` against
 * the room rather than a rule about how many keys arrived. Two is the floor:
 * below it the gate cannot tell a typist from a lucky guess.
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
 * What each `bigrams` lesson drills. Four of the six are their own title in
 * §5.6; the other two are named by description there, and "the hard pairs" is
 * not a spec:
 *
 *   - **8 · Pairs that repeat** — the doubled letters, and at lesson 8 the
 *     alphabet is still `a s d f g h j k l ;`, so `ll`, `ss` and `dd` are all
 *     of them there are.
 *   - **44 · The hard pairs** — the *same-finger* bigrams, which is what makes
 *     a pair hard rather than which letters it uses: `ed` is both the left
 *     middle finger, `ju` both the right index.
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
 * A tuple rather than an object because this is read as a table: a hundred
 * rows of `{ n: 7, title: "…", wordCount: 25 }` is the same data with ten
 * times the punctuation, and a column that has drifted out of line is
 * invisible in it.
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

/**
 * A Hailstorm row. §5.6 prints — for its wpm and its accuracy, and its Words
 * column is the wave's `count`, which `toLesson` reads out of `STORM_WAVES`.
 *
 * The wave is a table of its own rather than six more columns here, exactly as
 * the doc splits it: a storm's numbers are read against *each other* — a `gap`
 * means nothing except beside the `fall` it does or does not clear — where a
 * lesson's columns are read down the page against the same column on the rows
 * above.
 */
type StormRow = readonly [
  n: number,
  title: string,
  introduces: "",
  kind: "storm",
  keyboard: Keyboard,
];

type Row = LessonRow | StormRow;

/**
 * The hundred, transcribed from docs/typing.md §5.6. Three things an editor
 * needs before touching a column:
 *
 *   - **The wpm column drops every time keys arrive** and climbs back over the
 *     review lessons after it (§6.3, decision 11). Do not smooth it out.
 *   - **Keys arrive in mirrored pairs, one per hand** through the three letter
 *     blocks (§5.5). The number row is the deliberate exception: it walks
 *     outward from the centre of the *board* instead, so `4 5` are both the
 *     left index's and `9 0` are the right ring and pinky. That is the
 *     standard finger assignment, not a slip.
 *   - **The tenth of every block is a checkpoint**, always `off` and always
 *     locked (§4.2). Lesson 1 is locked the other way, to `guide`, because a
 *     child who has never seen a keyboard cannot be asked to guess.
 */
const ROWS: readonly Row[] = [
  // ── Block 1 · Home row ─────────────────────────────────────────────────────
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
  // of capitals each one *reaches* — the right shift capitalises the left
  // hand's letters and the left shift the right hand's. `keys.ts` reads the
  // shifts back out of these two rows; there is nowhere else they are written.
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
  // The bar climbs fastest here (§6.3) but not *monotonically*: 44 and 47 ask
  // for less than the lesson before them because harder material is the point
  // of them, not because the column slipped.
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
  // Two rows re-introduce a character the ladder already unlocked — `;` from
  // lesson 5, `/` from lesson 25 — in their punctuation role. The unlocked
  // alphabet is a union, so saying it twice changes nothing about what a child
  // may type; what it does is put the character back under the new-key gate.
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
  // The accuracy bar moves to 96% here — the first of several places §6.2's
  // flat 95/97 line bends. Block 9's checkpoint (90) bends the same way, so
  // does block 10's prose (91–96), and lesson 97 bends the other way at 99%.
  // An accuracy column "corrected" back to a flat 95/97 would be wrong from
  // here to the end of the ladder.
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

/**
 * One storm, as §5.7's table writes it: the six numbers that make a level, its
 * seed, and the class of character it is about.
 *
 * Positional for the same reason `LessonRow` is. The ranges are flat pairs
 * because that is how they are read: `gap` against `fall` is the whole
 * difficulty shape (§8.3), and the eye compares two columns down the page
 * rather than two brackets across a row.
 */
type StormWaveRow = readonly [
  n: number,
  count: number,
  gapFrom: number,
  gapTo: number,
  fallFrom: number,
  fallTo: number,
  shield: number,
  repairAt: number,
  seed: number,
  focus?: StormFocus,
];

/**
 * The twenty storms (§5.7, §8.3), which is where the shape of every column is
 * argued: where `gap` clears `fall`, where the ladder eases, where the repairs
 * stop, and why no row may ask for a fall under `MIN_FALL_MS`. It does not
 * climb smoothly and must not be smoothed.
 *
 * The doc's table is the one being checked and this is what it is checked
 * against: `storms.test.ts` reads §5.7 off disk and compares it cell by cell,
 * and re-derives every seed rather than trusting the column (decision 58).
 */
const STORM_WAVES: readonly StormWaveRow[] = [
  //  n  len       gap        fall  shield repair seed  focus
  [4, 12, 1500, 1900, 900, 1200, 4, 4, 6],
  [9, 16, 1300, 1600, 900, 1250, 3, 4, 9],
  [13, 18, 1200, 1500, 900, 1150, 3, 4, 13],
  [19, 20, 1000, 1300, 1000, 1500, 3, 4, 19],
  [23, 22, 900, 1200, 1100, 1600, 3, 5, 23],
  [29, 24, 800, 1100, 1200, 1700, 3, 5, 29],
  [34, 26, 750, 1050, 1200, 1800, 3, 5, 34, "capitals"],
  [39, 28, 700, 1000, 1300, 1900, 3, 5, 39, "capitals"],
  [45, 30, 650, 950, 1300, 2000, 3, 6, 45],
  [49, 32, 600, 900, 1400, 2000, 3, 6, 49],
  [53, 30, 700, 1000, 1300, 1800, 3, 6, 55, "digits"],
  [59, 34, 600, 850, 1400, 2000, 3, 6, 59, "digits"],
  [65, 34, 600, 850, 1400, 2100, 3, 6, 66, "marks"],
  [69, 36, 550, 800, 1500, 2100, 3, 6, 69, "marks"],
  [73, 50, 550, 800, 1500, 2200, 3, 8, 74],
  [79, 36, 500, 750, 1400, 2000, 3, 0, 79],
  [83, 40, 450, 650, 1300, 1900, 3, 0, 83],
  [89, 44, 300, 450, 1900, 2600, 3, 0, 95],
  [93, 46, 350, 550, 1300, 1900, 2, 0, 95],
  [99, 50, 300, 500, 1200, 1800, 2, 0, 99],
];

/**
 * The twenty, by the rung that hosts them.
 *
 * `satisfies StormShape` and not only the `Map`'s type argument, because the
 * two are not the same check: excess properties do not survive a `.map` into a
 * `new Map<number, StormShape>`, so a `keys` written here would type-check
 * clean and then be discarded in silence by `waveSpecFor`'s spread.
 * `satisfies` fires excess-property checking on the literal itself, which is
 * what makes "a storm cannot name its own keys" (decision 56) something the
 * compiler refuses rather than something the spread order rescues.
 */
const WAVE_BY_N = new Map<number, StormShape>(
  STORM_WAVES.map(([n, count, gapFrom, gapTo, fallFrom, fallTo, ...rest]) => {
    const [shield, repairAt, seed, focus] = rest;
    return [
      n,
      {
        count,
        gap: [gapFrom, gapTo],
        fall: [fallFrom, fallTo],
        shield,
        repairAt,
        seed,
        ...(focus ? { focus } : {}),
      } satisfies StormShape,
    ];
  }),
);

// ── Table → lessons ──────────────────────────────────────────────────────────

/**
 * "L07", and "L100". Two digits because that is what `Session.mode` has to
 * keep saying forever (§5.1); the hundredth simply runs over.
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

/**
 * The `Kind` cell as a `LessonKind`, for every kind that is only its own name.
 *
 * A storm row is the exception and is built in `toLesson` instead: its variant
 * carries a wave, which lives in `STORM_WAVES` and is looked up by rung.
 * `Exclude<RowKind, "storm">` on the parameter is what makes reaching for it
 * here a type error rather than a `{ type: "storm" }` missing its wave.
 */
const kindFor = (n: number, kind: Exclude<RowKind, "storm">): LessonKind =>
  kind === "bigrams" ? { type: "bigrams", focus: BIGRAMS[n] } : { type: kind };

function toLesson(row: Row): Lesson {
  const [n, title, introduced, , keyboard] = row;
  const locked = keyboard.endsWith("!");
  const introduces = [...introduced];
  const base = {
    n,
    id: idFor(n),
    block: Math.ceil(n / 10),
    title,
    introduces,
    keyboard: MODE_OF[keyboard],
    // Undefined rather than false: `keyboardLocked?: true` is the shape §4.2
    // asks for, and an unlocked row is the ordinary case.
    ...(locked ? { keyboardLocked: true } : {}),
    // Derived rather than written on the row, for the same reason `block` is:
    // a checkpoint is a *position* in the ladder, and a row that could
    // disagree with its own position is a row that will.
    ...(n % 10 === 0 ? { checkpoint: true as const } : {}),
  };

  if (row[3] === "storm") {
    const wave = WAVE_BY_N.get(n);
    // A storm row with no wave is a table that has stopped describing itself,
    // and it can only be reached by editing one of the two above without the
    // other — never by anything a child does and never by anything already
    // saved. So it is loud at module load, where `storms.test.ts` meets it on
    // its first assertion, rather than a stand-in storm nobody chose or an
    // `undefined` that reaches the field as a crash mid-run.
    if (!wave) throw new Error(`lesson ${n} is a storm with no wave`);
    return {
      ...base,
      kind: { type: "storm", wave },
      // **A storm level's length is its wave's `count`** (§8.3), and this is
      // the one place the two are joined. Three things read it back and all
      // three would be wrong against any other number: `survived` in
      // `verdict.ts`, the `unbroken` badge (decision 29), and the key a run is
      // filed under — `typing|L39|28` (§5.4, §8.7).
      wordCount: wave.count,
      pass: { kind: "storm", survive: true, accuracy: STORM_ACCURACY },
    };
  }

  // The last three columns, which only a lesson row carries — and the `Kind`
  // cell again, which is only now narrowed to the eight a `kindFor` can take:
  // the return above is what tells the checker this row is not a storm.
  const [, , , kind, , wordCount, wpm, accuracy] = row;
  return {
    ...base,
    kind: kindFor(n, kind),
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

/**
 * The same hundred by the id a run is filed under.
 *
 * `TypingConfig.lessonId` and the half of `Session.mode` after the `typing:`
 * prefix are the same string, and this is the one place it is resolved.
 */
const BY_ID = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));

/**
 * The lesson with this id, or `null` for anything that is not one.
 *
 * Total on purpose, and in both directions: `undefined` is the ordinary answer
 * for a free-play config, which simply has no `lessonId`, and an id from a
 * build that has since re-cut the ladder is a run that must still open rather
 * than a case to throw on. It is the same promise `deckSpec` makes one layer
 * up — a saved run outlives the ladder it was played on (CLAUDE.md).
 */
export const lessonById = (id?: string | null): Lesson | null =>
  (id ? BY_ID.get(id) : undefined) ?? null;

/** The same hundred by the number a child sees, for walking up the ladder. */
const BY_NUMBER = new Map(LESSONS.map((lesson) => [lesson.n, lesson]));

/**
 * The lesson at this rung, or `null` for a number off either end of the ladder.
 *
 * Total for the same reason `lessonById` is: the callers are screens asking
 * where a child goes next, and `best + 1` at the top of the hundred, or a rung
 * a re-cut ladder no longer has, is an answer to give rather than a case to
 * throw on.
 */
export const lessonNumbered = (n: number): Lesson | null =>
  BY_NUMBER.get(n) ?? null;

/**
 * The mode this lesson insists on, or `null` when the choice is the child's
 * (docs/typing.md §4.2).
 *
 * The one definition of "the lesson forced the board", and it lives here — in
 * the engine, beside the rows it reads — because two layers need the same
 * answer to two different questions. The island asks it to draw the board and
 * to grey out the control (`keyboardFor`, `keyboardLock`); the engine asks it
 * to award `eyes-up` (§6.7, decision 28), and the engine may not import from
 * `src/games/`. That badge is why the distinction is a function at all rather
 * than a line inside the island's resolver.
 *
 * A lock over `keyboard: null` is not a lock, and hands back `null` here: a
 * lesson that names no mode is insisting on nothing.
 */
export const forcedKeyboard = (lesson: Lesson): KeyboardMode | null =>
  lesson.keyboardLocked && lesson.keyboard ? lesson.keyboard : null;
