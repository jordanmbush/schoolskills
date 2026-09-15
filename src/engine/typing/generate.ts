import { between, mulberry32, shuffled } from "@/engine/random";

import { oneHanded } from "./hands";
import { canType, unlockedAt } from "./keys";
import type { Lesson } from "./lessons";
import {
  ALTERNATING,
  HARD_PAIRS,
  LEFT_HAND,
  NAMES,
  PASSAGES,
  RIGHT_HAND,
  SENTENCES,
  WORDS,
} from "./lexicon";

/**
 * A lesson's text, generated from its spec (docs/typing.md §5.1, §5.2, §5.3).
 *
 * `generate(lesson, seed)` is the whole of this module's surface, and it is
 * deterministic in the pair: the same lesson and the same seed produce the
 * same words in the same order, on any device, for ever. A ghost is only a
 * race if both runs saw the same cards, and determinism is also what makes a
 * saved run legible: `Session.mode` says `typing:L07`, and the seed says which
 * lesson 9 it was.
 *
 * **Every character produced satisfies `canType(ch, n)`** (§5.2): a lesson may
 * only use keys the ladder has already taught. Each pool is filtered rather
 * than trusted, which is what lets the ladder be re-ordered by editing one
 * array — and it is the promise an editor adding a pool here would otherwise
 * break in silence, in front of a five-year-old. A held-key lesson adds one
 * more filter of the same shape (§5.8): every character is also
 * `oneHanded(ch, hold)`, so the pinned hand is never asked for anything.
 *
 * Two more `generate.test.ts` holds: each introduced character occurs at least
 * `pass.keyStrikes` times at every seed, and new keys are 15–35% of the
 * characters. The second has one exception, and it is a fact about the ladder
 * rather than a concession by the generator: at lesson 1 the alphabet is `f`,
 * `j` and the space bar, so there is no review to be had and `keyDrill` spends
 * the whole lesson on the new keys. The test states that in derived terms — a
 * lesson with review available is 15–35% new — so a re-ordered ladder that
 * leaves lesson 46 with nothing to review is named by the test rather than
 * quietly excused by it.
 *
 * A strategy per kind rather than one shuffle, because "pick words the child
 * can type" would satisfy reachability and teach almost nothing: what a lesson
 * is *for* is written on it, and each strategy below says what it makes of it.
 *
 * `local/no-corpus-in-decks` bans `lexicon.ts` and this module from every
 * engine file the deck layer can reach, and exempts these two. The way a run
 * gets its words is `TypingConfig.words`: the ladder screen, inside the typing
 * island, calls `generate` and hands the result to the deck (§5.3).
 */

// ── The shape of a drill ─────────────────────────────────────────────────────

/**
 * Characters in a drill group: `ffjj`, `QWER`, `4545`.
 *
 * Four rather than three, so that a group plus the space after it is the five
 * characters `wordCount` is counted in — the same figure `strikesFor` sizes
 * the new-key gate against. At three the two halves of the ladder would
 * disagree about how long a lesson is, and lesson 77 would be over §5.2's
 * ceiling with the generator doing nothing wrong (§5.1).
 */
const GROUP = 4;

/**
 * How much of a drill the new keys should be — the middle of §5.2's 15–35%.
 *
 * A target rather than a limit. Where the gate asks for more than this — a
 * lesson handing over six keys at twelve strikes each — the gate wins and the
 * lesson runs denser: a lesson nobody can pass is the worse failure, and the
 * band test says so out loud if the two ever stop being reconcilable.
 */
const TARGET_NEW_SHARE = 0.25;

/**
 * Up to this many new keys get an opening group of their own: `ffff jjjj`.
 *
 * A run of one key is how a key is met. It stops being useful when a lesson
 * hands over eleven or fifteen at once — block 4's two shift lessons — where
 * fifteen groups of `QQQQ` would be half the lesson and would spend the whole
 * new-key budget before the drill got to using them. Those lessons take four
 * distinct new keys per group instead: `QWER TASD`.
 */
const RUN_KEYS_MAX = 4;

// ── The shape of a word run ──────────────────────────────────────────────────

/**
 * How sharply a draw leans on the front of the corpus.
 *
 * `WORDS` is frequency-ordered, so `index = length × random²` is a frequency
 * weighting and nothing more elaborate is needed: the commonest quarter of a
 * pool takes half the draws, and the tail still turns up often enough that two
 * seeds are not the same lesson.
 */
const FREQ_BIAS = 2;

/**
 * The window a `words` lesson draws inside, in words per word asked for.
 *
 * The coarse half of the same weighting. A lesson of thirty-five words
 * reaching into two thousand would meet its fifteen-hundredth-commonest word
 * about as often as anything worth practising. The tail is not wasted: it is
 * what the bigram lessons filter, and what keeps the early alphabets from
 * emptying.
 */
const WINDOW_PER_WORD = 6;

/** …and never a window so small that two seeds produce the same lesson. */
const WINDOW_MIN = 120;

/** A sprint word is a short one. Five characters is a "word"; these are less. */
const SPRINT_MAX_LEN = 4;

/** Below this a filtered pool has stopped being a bag and become a loop. */
const MIN_BAG = 12;

// ── Pools that exist for one lesson ──────────────────────────────────────────

/**
 * The lessons whose subject is a particular pool, by number.
 *
 * `LessonKind` carries a payload for exactly one thing — `bigrams.focus` —
 * because a title is otherwise spec enough. The eleven below are the lessons
 * §5.6 names a pool in words: "The twenty-five", "Hands that take turns",
 * "Names, and the word I". The table connecting them lives here, beside the
 * only module that reads it, rather than as a second payload on a type the
 * deck layer imports.
 *
 * Keyed by `n` for the same reason `BIGRAMS` in `lessons.ts` is: a lesson that
 * is genuinely re-numbered has changed which lesson it is.
 */
type Source = (lesson: Lesson, rand: () => number) => readonly string[];

/** Lesson 47, "The twenty-five", and lesson 56, "The hundred". A slice. */
const TOP_TWENTY_FIVE = WORDS.slice(0, 25);
const TOP_HUNDRED = WORDS.slice(0, 100);

/** Lesson 53, "One hand at a time" — both hands' lists, one after the other. */
const ONE_HAND = [...LEFT_HAND, ...RIGHT_HAND];

/** Lesson 39, "Names, and the word I". The one capital English insists on. */
const NAMES_AND_I = ["I", ...NAMES];

/** Lesson 94, "Sprint · The hard pairs" — the same words lesson 50 drills. */
const HARD_PAIR_WORDS = WORDS.filter((word) =>
  HARD_PAIRS.some((pair) => word.includes(pair)),
);

const POOLS = new Map<string, Source>([
  ["L33", () => NAMES_AND_I],
  ["L41", () => TOP_TWENTY_FIVE],
  ["L46", () => ALTERNATING],
  ["L47", () => ONE_HAND],
  ["L48", () => TOP_HUNDRED],
  // "The sight words, again" — which is what the front of a frequency-ordered
  // corpus is. The list is not repeated anywhere; it is the same hundred.
  ["L74", () => TOP_HUNDRED],
  ["L82", () => ALTERNATING],
  ["L84", () => HARD_PAIR_WORDS],
  // "Sprint · Capitals": every name is a capital with a reason to be there.
  ["L85", () => NAMES],
  ["L86", (lesson, rand) => figures(lesson, rand, lesson.wordCount) ?? []],
  ["L87", (lesson) => punctuated(lesson)],
]);

// ── Bags ─────────────────────────────────────────────────────────────────────

/**
 * A bag emptied before it is refilled — the rule the other decks follow, so a
 * short lesson never asks for one word four times while another never comes up
 * at all. Refilling reshuffles, so a pool smaller than the lesson repeats in a
 * different order each time round rather than looping.
 */
function bag<T>(items: readonly T[], rand: () => number): () => T {
  let deck: T[] = [];
  let next = 0;
  return () => {
    if (next >= deck.length) {
      deck = shuffled(items, rand);
      next = 0;
    }
    return deck[next++];
  };
}

/**
 * The same rule, with the draw weighted towards the front of the pool.
 *
 * Frequency weighting and bag exhaustion pull against each other — the first
 * wants `the` often, the second wants it once — so this draws *without
 * replacement* from a biased index: every word is gone until the bag is empty,
 * and which goes first is decided by how common it is.
 */
function frequencyBag(
  pool: readonly string[],
  rand: () => number,
): () => string {
  let rest: string[] = [];
  return () => {
    if (rest.length === 0) rest = pool.slice();
    return rest.splice(Math.floor(rest.length * rand() ** FREQ_BIAS), 1)[0];
  };
}

// ── Filtering a pool onto a lesson's alphabet ────────────────────────────────

/**
 * Lowercase the characters this lesson has not been given, and only those.
 *
 * The sentence pool holds English as it is printed, because it has to still be
 * English at lesson 46. Lesson 36 asks for sentences a whole block before
 * either shift is taught, and folding the case for it is this module's job:
 * the unlocked alphabet is in hand here and is not in the corpus.
 *
 * Conditional on the character rather than on the lesson, so the fold is a
 * no-op the moment block 4 has run and a sentence keeps its capitals for the
 * seventy lessons after it. What folding cannot rescue — a digit, a hyphen, a
 * speech mark — is left alone and dropped by the filter below.
 */
function fold(text: string, n: number): string {
  const alphabet = unlockedAt(n);
  let out = "";
  for (const ch of text) out += alphabet.has(ch) ? ch : ch.toLowerCase();
  return out;
}

/**
 * Can this lesson ask for `text`? The reachability invariant (§5.2), and on a
 * held-key lesson the one-hand invariant beside it (§5.8) — every pool below
 * is cut by this and nothing else.
 */
const typable = (text: string, lesson: Lesson) =>
  canType(text, lesson.n) &&
  (lesson.hold === undefined || oneHanded(text, lesson.hold));

/**
 * The characters this lesson may use: the rung's alphabet, less the hand a
 * held key pins (§5.8). A lesson with no held key is handed the shared set
 * `unlockedAt` keeps, untouched.
 */
function alphabetOf(lesson: Lesson): ReadonlySet<string> {
  const unlocked = unlockedAt(lesson.n);
  const { hold } = lesson;
  if (hold === undefined) return unlocked;
  return new Set([...unlocked].filter((ch) => oneHanded(ch, hold)));
}

/**
 * A pool filtered onto a lesson's alphabet, remembered.
 *
 * The reachability test generates every lesson at many seeds, and each
 * generation would otherwise walk two thousand words character by character.
 * The ladder and the corpus are both fixed at module load, so the answer is
 * too; the `WeakMap` is keyed by the pool so a caller can hand over a slice
 * without leaking it for the life of the process. The held key is part of the
 * key because it is part of the filter: the two word lessons of a held-key
 * pair (§5.8) share an alphabet and keep opposite halves of the corpus.
 */
const FILTERED = new WeakMap<
  readonly string[],
  Map<string, readonly string[]>
>();

function filtered(
  pool: readonly string[],
  lesson: Lesson,
  prose: boolean,
): readonly string[] {
  let byLesson = FILTERED.get(pool);
  if (!byLesson) {
    byLesson = new Map();
    FILTERED.set(pool, byLesson);
  }
  const key = `${lesson.n}:${lesson.hold ?? ""}:${prose ? "p" : "w"}`;
  const cached = byLesson.get(key);
  if (cached) return cached;

  const usable = (
    prose ? pool.map((text) => fold(text, lesson.n)) : pool
  ).filter((text) => typable(text, lesson));
  byLesson.set(key, usable);
  return usable;
}

/** Words this lesson can spell, exactly as the corpus writes them. */
const spellable = (pool: readonly string[], lesson: Lesson) =>
  filtered(pool, lesson, false);

/** Prose this lesson can type, once its case has been folded. */
const readable = (pool: readonly string[], lesson: Lesson) =>
  filtered(pool, lesson, true);

// ── keys · letter groups in a drill rhythm ───────────────────────────────────

/**
 * `ffff jjjj fjfj fdfd dkdk` — a new key, met and then used.
 *
 * Three sorts of group, in the proportions §5.2's band asks for: **new** (four
 * of today's keys), **mixed** (two new and two already learnt, which is the
 * actual exercise — the finger has to come back to the new key from
 * somewhere), and **review** (four characters of two older keys).
 *
 * The new characters come off a round-robin over the day's keys, so a lesson
 * introducing fifteen capitals spreads them evenly rather than spending its
 * budget on the first three: every key ends up with `floor(target / keys)` at
 * worst, which is what makes the `keyStrikes` guarantee provable rather than
 * lucky. The groups are then shuffled — after the opening runs, which stay
 * where a child will meet them first.
 */
function keyDrill(lesson: Lesson, rand: () => number): string[] {
  const alphabet = alphabetOf(lesson);
  // Through the alphabet rather than straight off the row: a character its own
  // lesson cannot strike — a capital before either shift is taught — must not
  // reach the text, and the `keyStrikes` test is what reports it.
  const fresh = lesson.introduces.filter((ch) => alphabet.has(ch));
  const older = [...alphabet].filter((ch) => ch !== " " && !fresh.includes(ch));

  const slots = lesson.wordCount * GROUP;
  // The lesson's length in characters, spaces between the groups included —
  // the denominator §5.2's band is a share of.
  const chars = slots + lesson.wordCount - 1;
  const strikes = lesson.pass.kind === "lesson" ? lesson.pass.keyStrikes : 0;
  const wanted = Math.max(
    Math.round(chars * TARGET_NEW_SHARE),
    fresh.length * strikes,
  );
  // Nothing to review is not an error, it is lesson 1: the whole drill is the
  // two keys it hands over, because the alphabet is those two keys. The two
  // held-key lessons at rung 6 are the same case with a hand taken away —
  // one hand's half of the home row is exactly the five keys they drill.
  const target =
    fresh.length === 0
      ? 0
      : older.length === 0
        ? slots
        : Math.min(wanted, slots);

  // Half the new characters in groups of their own and half in company, which
  // is `4a + 2b = target` with `a = b`. The odd character left over when the
  // target is odd takes a group with three review characters.
  const pure = older.length === 0 ? lesson.wordCount : Math.floor(target / 6);
  const paired = Math.floor((target - pure * GROUP) / 2);
  const single = (target - pure * GROUP) % 2;
  const runs =
    fresh.length <= RUN_KEYS_MAX && pure >= fresh.length ? fresh.length : 0;

  const order = shuffled(fresh, rand);
  let turn = 0;
  const nextFresh = (count: number) =>
    Array.from({ length: count }, () => order[turn++ % order.length]);

  const draw = bag(older.length > 0 ? older : fresh, rand);
  const nextOlder = (count: number) => Array.from({ length: count }, draw);
  // Two keys, twice each: `dkdk`, `ddkk`, `kddk`. A review group is a rhythm
  // rather than four characters at random, because that is what a drill line
  // in a typing course looks like and it is easier to read back.
  const pair = () => {
    const [x, y] = nextOlder(2);
    return [x, x, y, y];
  };

  const groups: string[] = [];
  for (let i = 0; i < runs; i++) groups.push(order[i].repeat(GROUP));
  for (let i = runs; i < pure; i++)
    groups.push(shuffled(nextFresh(GROUP), rand).join(""));
  for (let i = 0; i < paired; i++)
    groups.push(shuffled([...nextFresh(2), ...nextOlder(2)], rand).join(""));
  if (single === 1)
    groups.push(shuffled([...nextFresh(1), ...nextOlder(3)], rand).join(""));
  while (groups.length < lesson.wordCount)
    groups.push(shuffled(pair(), rand).join(""));

  return [...groups.slice(0, runs), ...shuffled(groups.slice(runs), rand)];
}

// ── words, bigrams and sprints · the corpus, filtered ────────────────────────

/** `count` words drawn out of a pool, or null if the pool is empty. */
function drawWords(
  pool: readonly string[],
  count: number,
  rand: () => number,
): string[] | null {
  if (pool.length === 0) return null;
  const draw = frequencyBag(pool, rand);
  return Array.from({ length: count }, () => draw());
}

/**
 * Real words, commonest first, that this lesson's alphabet can spell.
 *
 * The pool is the lesson's own if §5.6 gave it one and the corpus otherwise,
 * narrowed to a window whose size follows the lesson's length. Both halves are
 * frequency weighting: which words are in the bag, and which is drawn first.
 */
function wordRun(lesson: Lesson, rand: () => number): string[] | null {
  // A held-key lesson draws from the one-hand list and from no pool §5.6
  // gave a rung (§5.8); `spellable` then keeps the free hand's half.
  const source =
    lesson.hold !== undefined ? () => ONE_HAND : POOLS.get(lesson.id);
  const pool = spellable(source ? source(lesson, rand) : WORDS, lesson);
  const window = source
    ? pool
    : pool.slice(0, Math.max(WINDOW_MIN, lesson.wordCount * WINDOW_PER_WORD));
  return drawWords(window, lesson.wordCount, rand);
}

/**
 * Words chosen *because* they contain the focus sequences.
 *
 * Round-robin over the sequences rather than one pooled bag, so each gets an
 * equal share of the lesson however many words the corpus offers for it.
 * Lesson 10 is the case that shapes this: at nine letters unlocked, `ss` has
 * exactly one word in the whole corpus, and a pooled draw would spend the
 * lesson on `ll` and never drill the pair a child is there for.
 */
function bigramRun(
  lesson: Lesson,
  focus: readonly string[],
  rand: () => number,
): string[] | null {
  const bags = focus
    .map((pair) =>
      spellable(
        WORDS.filter((word) => word.includes(pair)),
        lesson,
      ),
    )
    .filter((pool) => pool.length > 0)
    .map((pool) => frequencyBag(pool, rand));
  if (bags.length === 0) return null;
  return Array.from({ length: lesson.wordCount }, (_, i) =>
    bags[i % bags.length](),
  );
}

/**
 * Short, common words at pace.
 *
 * The length filter is a preference, not a rule: lesson 95 sprints names and
 * lesson 92 the alternating list, and a pool that the filter cuts below a
 * bagful is used whole rather than turned into a loop of six words.
 */
function sprintRun(lesson: Lesson, rand: () => number): string[] | null {
  const source = POOLS.get(lesson.id);
  const pool = spellable(source ? source(lesson, rand) : WORDS, lesson);
  const short = pool.filter((word) => word.length <= SPRINT_MAX_LEN);
  const window = short.length >= MIN_BAG ? short : pool;
  return drawWords(
    window.slice(0, Math.max(WINDOW_MIN, lesson.wordCount * WINDOW_PER_WORD)),
    lesson.wordCount,
    rand,
  );
}

/**
 * Lesson 97, "Sprint · Punctuation" — short words wearing the marks.
 *
 * The marks are whatever the ladder has taught by then, which is all of them
 * at lesson 97 and would be a comma and a full stop at lesson 36. Nothing is
 * invented: the words are the corpus's and the marks are the alphabet's, so
 * the pool cannot outrun the reachability invariant.
 */
function punctuated(lesson: Lesson): readonly string[] {
  const alphabet = alphabetOf(lesson);
  const marks = [...".,?!;:"].filter((mark) => alphabet.has(mark));
  if (marks.length === 0) return [];
  const short = spellable(WORDS, lesson)
    .filter((word) => word.length <= SPRINT_MAX_LEN)
    .slice(0, WINDOW_MIN);
  return short.map((word, i) => word + marks[i % marks.length]);
}

// ── sentences and passages · English, split on spaces ────────────────────────

/**
 * Whole sentences, or whole passages, split into the words they are made of.
 *
 * Never split on meaning: a sentence goes in entire, so the capital at the
 * front and the stop at the end land where a child expects them. The only cut
 * is the last one, where the lesson reaches its length mid-sentence — the same
 * trade `decks/typing.ts` makes, because a passage that stops mid-sentence is
 * better than one that starts mid-sentence.
 */
function proseRun(
  lesson: Lesson,
  pool: readonly string[],
  rand: () => number,
): string[] | null {
  const usable = readable(pool, lesson);
  if (usable.length === 0) return null;
  const draw = bag(usable, rand);
  const words: string[] = [];
  while (words.length < lesson.wordCount) words.push(...draw().split(" "));
  return words;
}

// ── numbers and mixed · figures that mean something ──────────────────────────

/**
 * The figures a lesson can be built out of, and what each one costs.
 *
 * Ages, dates, scores and prices (§5.6, lesson 67) rather than digits at
 * random: a date has a shape, and `14/6/2019` teaches the number row *and* the
 * reach to the slash. `needs` is the punctuation the shape cannot be written
 * without, checked against the unlocked alphabet before the shape is offered —
 * which is why a score is absent until the hyphen arrives at lesson 73 rather
 * than being quietly rewritten as two separate numbers.
 */
const FIGURES: { needs: string; make: (rand: () => number) => string }[] = [
  /** An age. */
  { needs: "", make: (rand) => `${between(5, 12, rand)}` },
  /** A year — a birthday, a date on a coin. */
  { needs: "", make: (rand) => `${between(1990, 2026, rand)}` },
  /** How many of something. */
  { needs: "", make: (rand) => `${between(11, 99, rand)}` },
  /** A date. */
  {
    needs: "/",
    make: (rand) =>
      `${between(1, 28, rand)}/${between(1, 12, rand)}/${between(1990, 2026, rand)}`,
  },
  /** A price. */
  {
    needs: ".",
    make: (rand) =>
      `${between(1, 30, rand)}.${String(between(0, 99, rand)).padStart(2, "0")}`,
  },
  /** A time. */
  {
    needs: ":",
    make: (rand) =>
      `${between(1, 12, rand)}:${String(between(0, 59, rand)).padStart(2, "0")}`,
  },
  /** A score. */
  {
    needs: "-",
    make: (rand) => `${between(0, 9, rand)}-${between(0, 9, rand)}`,
  },
];

/**
 * `count` figures this lesson can type, or null if it can type none.
 *
 * Every token is checked rather than trusted: `needs` clears the punctuation,
 * and `canType` clears the digits, which is what keeps a number lesson honest
 * on a ladder where the number row arrives two keys at a time.
 */
function figures(
  lesson: Lesson,
  rand: () => number,
  count: number,
): string[] | null {
  const alphabet = alphabetOf(lesson);
  const usable = FIGURES.filter((figure) =>
    [...figure.needs].every((ch) => alphabet.has(ch)),
  );
  if (usable.length === 0) return null;

  const out: string[] = [];
  for (let tries = 0; out.length < count && tries < count * 8; tries++) {
    const token = usable[Math.floor(rand() * usable.length)].make(rand);
    if (typable(token, lesson)) out.push(token);
  }
  return out.length >= count ? out : null;
}

/**
 * Prose with numbers in it — a sentence that carries a figure, then one that
 * does not, so the digits are spread through the lesson rather than heaped at
 * one end.
 *
 * The corpus grades its sentences by what they hold and the number-bearing
 * ones are the last band, so they are a filter here rather than a second pool.
 * Where the ladder has digits but the pool has no sentence a child can yet
 * read, a pair of generated figures stands in — the lesson is still words and
 * numbers together, which is what its title promises.
 */
const NUMERIC_SENTENCES = SENTENCES.filter((text) => /[0-9]/.test(text));
const PLAIN_SENTENCES = SENTENCES.filter((text) => !/[0-9]/.test(text));

function mixedRun(lesson: Lesson, rand: () => number): string[] | null {
  const plain = readable(PLAIN_SENTENCES, lesson);
  if (plain.length === 0) return null;
  const numeric = readable(NUMERIC_SENTENCES, lesson);
  const drawPlain = bag(plain, rand);
  const drawNumeric = numeric.length > 0 ? bag(numeric, rand) : null;

  const words: string[] = [];
  while (words.length < lesson.wordCount) {
    words.push(
      ...(drawNumeric
        ? drawNumeric().split(" ")
        : (figures(lesson, rand, 2) ?? [])),
    );
    words.push(...drawPlain().split(" "));
  }
  return words;
}

// ── The front door ───────────────────────────────────────────────────────────

/** The strategy a lesson's kind asks for, or null if its pool came up empty. */
function forKind(lesson: Lesson, rand: () => number): string[] | null {
  switch (lesson.kind.type) {
    case "keys":
      return keyDrill(lesson, rand);
    case "words":
      return wordRun(lesson, rand);
    case "bigrams":
      return bigramRun(lesson, lesson.kind.focus, rand);
    case "sentences":
      return proseRun(lesson, SENTENCES, rand);
    case "passage":
      return proseRun(lesson, PASSAGES, rand);
    case "numbers":
      return figures(lesson, rand, lesson.wordCount);
    case "mixed":
      return mixedRun(lesson, rand);
    case "sprint":
      return sprintRun(lesson, rand);
    case "storm":
      // A storm level has no passage. Its length is its wave's, and `wordCount`
      // is already 0 — this is here so the switch is exhaustive rather than
      // because anything asks.
      return [];
  }
}

/**
 * The words of `lesson`, at `seed`. Deterministic in the pair, and total.
 *
 * Two fallbacks under the strategy, because a lesson that cannot find its own
 * material must still produce text a child can type: prose falls back to
 * words, and words to a drill of the keys unlocked so far. Neither fires on
 * today's ladder — every lesson's own pool is stocked, and `lexicon.test.ts`
 * counts them — and both exist because the alternative to a fallback is an
 * empty passage in front of a seven-year-old, or a loop that never fills.
 */
export function generate(lesson: Lesson, seed: number): string[] {
  if (lesson.wordCount <= 0) return [];
  const rand = mulberry32(seed);
  const text =
    forKind(lesson, rand) ?? wordRun(lesson, rand) ?? keyDrill(lesson, rand);
  return text.slice(0, lesson.wordCount);
}
