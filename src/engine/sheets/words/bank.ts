/**
 * The words a word-study sheet is made of.
 *
 * The one family in the shop whose content is neither generated nor handed over
 * by a parent, and it has to be authored for a reason that is worth stating
 * plainly: **English will not yield to a rule here.** A plural is `-s` until it
 * is `-es`, `-ies`, `-ves`, `children` or `sheep`; `happy + ness` is
 * `happiness`; `hop + ing` doubles the `p` and `hope + ing` drops the `e`. A
 * generator reaching for the rule would print `mouses` in an answer key, and an
 * answer key that is wrong is worse than no sheet at all (§11).
 *
 * So every answer below is one somebody wrote down on purpose. That is what
 * makes this family's key trustworthy, and it is the same bargain
 * `passages/*.ts` strikes for copywork: the engine owns the words, and the only
 * thing it computes is which of them land on the page.
 *
 * ── House rules for adding one ──────────────────────────────────────────────
 *   - **One right answer.** Every entry has to be an item a parent can mark
 *     without judgement. "Write a word that rhymes with cat" is a fine thing to
 *     ask a child and cannot be printed with a key, so it isn't here; "which of
 *     these rhymes with cat" is.
 *   - **No second right answer among the near misses.** A distractor is drawn
 *     from another entry of the same topic (`study.ts`), so two entries that
 *     could answer each other are a question with two answers on it. `light` is
 *     the one to watch: its opposite is `dark` and also `heavy`. `soft` is the
 *     other, and it is why `hard` is answered `easy` below rather than `soft`:
 *     `soft` is the opposite of `hard` and equally of `loud`, so a bank holding
 *     both pairs would eventually print `soft` as a near miss for `loud` and
 *     mark a child wrong for a right answer. Neither word appears in `ANTONYMS`
 *     at all, and no test can hold that line for you: a clash of meanings is
 *     invisible to something comparing strings.
 *   - **British spelling**, as everywhere in this repo — and nothing whose
 *     spelling differs between the two, because a sheet is printed on both sides
 *     of the Atlantic and a child marked wrong for `colour` is a bad sheet.
 *   - **Words a child of the age can picture.** These are read without a
 *     teacher standing beside them.
 *   - `study.test.ts` enforces the mechanical half, under its "the word bank"
 *     describe: no duplicate prompts, no duplicate answers inside a topic, no
 *     empty strings, and — for the two topics built out of parts — that the
 *     parts really do make the word.
 */

/* ── Rimes, and what goes in front of them ─────────────────────────────────
   One list serving two topics, because they are two views of the same fact:
   the words in a family rhyme, which is what makes a family worth teaching.
   Every onset here has been checked to make a real word with its rime — a
   word-family sheet whose answer key contains `jat` teaches a child that the
   sheet is wrong.                                                           */

export type Family = {
  /** The ending the family is named after: `at`, `ing`. */
  rime: string;
  /** Every beginning that makes a word with it, easiest first. */
  onsets: string[];
};

export const FAMILIES: Family[] = [
  { rime: "at", onsets: ["c", "h", "m", "s", "b", "r", "fl", "ch"] },
  { rime: "an", onsets: ["c", "f", "m", "p", "r", "v", "br", "pl"] },
  { rime: "ap", onsets: ["c", "g", "l", "m", "n", "t", "cl", "sn"] },
  { rime: "ed", onsets: ["b", "f", "l", "r", "w", "sh", "sl", "fl"] },
  { rime: "en", onsets: ["d", "h", "m", "p", "t", "wh", "th"] },
  { rime: "ig", onsets: ["b", "d", "f", "j", "p", "w", "tw"] },
  { rime: "in", onsets: ["b", "f", "p", "t", "w", "ch", "sh", "sk"] },
  { rime: "ip", onsets: ["d", "l", "r", "s", "t", "z", "dr", "sk"] },
  { rime: "op", onsets: ["h", "m", "p", "t", "dr", "st", "sh", "fl"] },
  { rime: "ot", onsets: ["d", "g", "h", "l", "n", "p", "sp", "sl"] },
  { rime: "ug", onsets: ["b", "d", "h", "j", "m", "r", "t", "pl"] },
  { rime: "un", onsets: ["b", "f", "r", "s", "st", "sp"] },
  { rime: "ake", onsets: ["b", "c", "l", "m", "r", "t", "w", "sh"] },
  { rime: "ing", onsets: ["k", "r", "s", "w", "br", "st", "th", "sw"] },
];

/** Every word in a family, in the order its onsets are listed. */
export const familyWords = (family: Family): string[] =>
  family.onsets.map((onset) => `${onset}${family.rime}`);

/* ── Syllables ─────────────────────────────────────────────────────────────
   Counted by hand, and only words whose count nobody argues about. `family`,
   `chocolate`, `every` and `camera` are said with two syllables as often as
   three, so they are not here: a sheet is marked by a parent who says the word
   their own way, and an entry that depends on an accent is an entry that gets
   a child marked wrong.                                                     */

export type Syllable = { word: string; syllables: number };

export const SYLLABLES: Syllable[] = [
  { word: "dog", syllables: 1 },
  { word: "hand", syllables: 1 },
  { word: "bridge", syllables: 1 },
  { word: "friend", syllables: 1 },
  { word: "school", syllables: 1 },
  { word: "tree", syllables: 1 },
  { word: "rabbit", syllables: 2 },
  { word: "pencil", syllables: 2 },
  { word: "garden", syllables: 2 },
  { word: "kitchen", syllables: 2 },
  { word: "monkey", syllables: 2 },
  { word: "table", syllables: 2 },
  { word: "window", syllables: 2 },
  { word: "morning", syllables: 2 },
  { word: "birthday", syllables: 2 },
  { word: "elephant", syllables: 3 },
  { word: "butterfly", syllables: 3 },
  { word: "computer", syllables: 3 },
  { word: "banana", syllables: 3 },
  { word: "dinosaur", syllables: 3 },
  { word: "wonderful", syllables: 3 },
  { word: "potato", syllables: 3 },
  { word: "telephone", syllables: 3 },
  { word: "remember", syllables: 3 },
  { word: "caterpillar", syllables: 4 },
  { word: "television", syllables: 4 },
  { word: "watermelon", syllables: 4 },
  { word: "invitation", syllables: 4 },
  { word: "alligator", syllables: 4 },
  { word: "celebration", syllables: 4 },
];

/** How many syllables a sheet may offer as an option. */
export const MAX_SYLLABLES = 4;

/* ── Two words that make one ───────────────────────────────────────────────
   Prefixes and suffixes, written as the sum a child is shown: the part, the
   word, and what the two make. The suffixes are chosen so that the spelling
   changes are on the page rather than avoided — `happy + ness` is the entry
   worth having, and `sad + ness` is the one it is learnt against.           */

export type Sum = { part: string; base: string; word: string };

export const PREFIXES: Sum[] = [
  { part: "un", base: "happy", word: "unhappy" },
  { part: "un", base: "kind", word: "unkind" },
  { part: "un", base: "tidy", word: "untidy" },
  { part: "un", base: "lock", word: "unlock" },
  { part: "un", base: "fair", word: "unfair" },
  { part: "re", base: "read", word: "reread" },
  { part: "re", base: "build", word: "rebuild" },
  { part: "re", base: "fill", word: "refill" },
  { part: "re", base: "play", word: "replay" },
  { part: "dis", base: "agree", word: "disagree" },
  { part: "dis", base: "like", word: "dislike" },
  { part: "dis", base: "appear", word: "disappear" },
  { part: "pre", base: "view", word: "preview" },
  { part: "pre", base: "school", word: "preschool" },
  { part: "pre", base: "heat", word: "preheat" },
  { part: "mis", base: "spell", word: "misspell" },
  { part: "mis", base: "place", word: "misplace" },
  { part: "mis", base: "behave", word: "misbehave" },
  { part: "over", base: "take", word: "overtake" },
  { part: "under", base: "water", word: "underwater" },
  { part: "non", base: "stop", word: "nonstop" },
  { part: "sub", base: "way", word: "subway" },
];

export const SUFFIXES: Sum[] = [
  { part: "ful", base: "care", word: "careful" },
  { part: "ful", base: "hope", word: "hopeful" },
  { part: "ful", base: "use", word: "useful" },
  { part: "less", base: "help", word: "helpless" },
  { part: "less", base: "end", word: "endless" },
  { part: "ness", base: "sad", word: "sadness" },
  { part: "ness", base: "happy", word: "happiness" },
  { part: "ness", base: "kind", word: "kindness" },
  { part: "ly", base: "quick", word: "quickly" },
  { part: "ly", base: "happy", word: "happily" },
  { part: "ly", base: "slow", word: "slowly" },
  { part: "ing", base: "make", word: "making" },
  { part: "ing", base: "hop", word: "hopping" },
  { part: "ing", base: "run", word: "running" },
  { part: "ing", base: "read", word: "reading" },
  { part: "ed", base: "bake", word: "baked" },
  { part: "ed", base: "stop", word: "stopped" },
  { part: "ed", base: "cry", word: "cried" },
  { part: "ed", base: "play", word: "played" },
  { part: "er", base: "teach", word: "teacher" },
  { part: "er", base: "farm", word: "farmer" },
  { part: "er", base: "big", word: "bigger" },
  { part: "ship", base: "friend", word: "friendship" },
  { part: "hood", base: "child", word: "childhood" },
];

/* ── One of it, and more than one ──────────────────────────────────────────
   Every route English takes to a plural, in roughly the order a scheme teaches
   them: the plain `-s`, the hissing endings that need `-es`, `-y` to `-ies`,
   `-f` to `-ves`, the words that change shape, and the two that don't change at
   all.                                                                      */

export type Pair = { one: string; many: string };

export const PLURALS: Pair[] = [
  { one: "cat", many: "cats" },
  { one: "book", many: "books" },
  { one: "tree", many: "trees" },
  { one: "box", many: "boxes" },
  { one: "bus", many: "buses" },
  { one: "brush", many: "brushes" },
  { one: "watch", many: "watches" },
  { one: "glass", many: "glasses" },
  { one: "baby", many: "babies" },
  { one: "city", many: "cities" },
  { one: "story", many: "stories" },
  { one: "party", many: "parties" },
  { one: "day", many: "days" },
  { one: "key", many: "keys" },
  { one: "leaf", many: "leaves" },
  { one: "knife", many: "knives" },
  { one: "wolf", many: "wolves" },
  { one: "shelf", many: "shelves" },
  { one: "child", many: "children" },
  { one: "man", many: "men" },
  { one: "woman", many: "women" },
  { one: "foot", many: "feet" },
  { one: "tooth", many: "teeth" },
  { one: "mouse", many: "mice" },
  { one: "goose", many: "geese" },
  { one: "person", many: "people" },
  { one: "sheep", many: "sheep" },
  { one: "fish", many: "fish" },
  { one: "potato", many: "potatoes" },
  { one: "tomato", many: "tomatoes" },
];

/* ── Two words squeezed into one ───────────────────────────────────────────
   Where the apostrophe goes is the whole lesson, and `won't` is the entry that
   makes the point that it is not always where the letters came out.          */

export type Contraction = { words: string; short: string };

export const CONTRACTIONS: Contraction[] = [
  { words: "do not", short: "don't" },
  { words: "did not", short: "didn't" },
  { words: "does not", short: "doesn't" },
  { words: "is not", short: "isn't" },
  { words: "are not", short: "aren't" },
  { words: "was not", short: "wasn't" },
  { words: "have not", short: "haven't" },
  { words: "cannot", short: "can't" },
  { words: "will not", short: "won't" },
  { words: "would not", short: "wouldn't" },
  { words: "could not", short: "couldn't" },
  { words: "should not", short: "shouldn't" },
  { words: "I am", short: "I'm" },
  { words: "I have", short: "I've" },
  { words: "I will", short: "I'll" },
  { words: "I would", short: "I'd" },
  { words: "you are", short: "you're" },
  { words: "we are", short: "we're" },
  { words: "they are", short: "they're" },
  { words: "he is", short: "he's" },
  { words: "she will", short: "she'll" },
  { words: "we have", short: "we've" },
  { words: "they will", short: "they'll" },
  { words: "let us", short: "let's" },
  { words: "that is", short: "that's" },
  { words: "there is", short: "there's" },
];

/* ── One sound, two spellings ──────────────────────────────────────────────
   The sentence is not decoration here, it is the question: a child asked to
   spell a sound they have been read cannot be wrong, because there is no
   answer. Every sentence below settles which word is meant on its own, and the
   rules `decks/wordlists.ts` states for a spoken clue hold for a printed one —
   one gap, the word nowhere else in the sentence, and something a child of the
   age can picture.                                                          */

export type Homophone = {
  /** The pair, printed beside the sentence so the choice is on the page. */
  pair: [string, string];
  /** `_` marks the gap, the same convention `Blank.text` uses. */
  sentence: string;
  /** Which of the pair belongs in it. */
  answer: string;
};

export const HOMOPHONES: Homophone[] = [
  {
    pair: ["their", "there"],
    sentence: "Put the box over _.",
    answer: "there",
  },
  { pair: ["to", "two"], sentence: "I have _ hands.", answer: "two" },
  { pair: ["hear", "here"], sentence: "Can you _ the bell?", answer: "hear" },
  { pair: ["see", "sea"], sentence: "We swam in the _.", answer: "sea" },
  {
    pair: ["blue", "blew"],
    sentence: "The wind _ my hat off.",
    answer: "blew",
  },
  {
    pair: ["knight", "night"],
    sentence: "The _ rode a grey horse.",
    answer: "knight",
  },
  {
    pair: ["write", "right"],
    sentence: "Please _ your name at the top.",
    answer: "write",
  },
  { pair: ["one", "won"], sentence: "Our team _ the match.", answer: "won" },
  { pair: ["ate", "eight"], sentence: "She _ all her dinner.", answer: "ate" },
  {
    pair: ["flour", "flower"],
    sentence: "Bread is made from _.",
    answer: "flour",
  },
  { pair: ["sun", "son"], sentence: "The _ came out at last.", answer: "sun" },
  {
    pair: ["bear", "bare"],
    sentence: "A big brown _ ate the fish.",
    answer: "bear",
  },
  { pair: ["for", "four"], sentence: "A dog has _ legs.", answer: "four" },
  {
    pair: ["new", "knew"],
    sentence: "I _ the answer already.",
    answer: "knew",
  },
  {
    pair: ["would", "wood"],
    sentence: "The chair is made of _.",
    answer: "wood",
  },
  { pair: ["no", "know"], sentence: "I _ how to swim.", answer: "know" },
  { pair: ["by", "buy"], sentence: "I want to _ a comic.", answer: "buy" },
  {
    pair: ["hour", "our"],
    sentence: "We waited for an _ in the rain.",
    answer: "hour",
  },
  {
    pair: ["made", "maid"],
    sentence: "She _ a birthday cake.",
    answer: "made",
  },
  { pair: ["weigh", "way"], sentence: "Which _ is the park?", answer: "way" },
];

/* ── Words that mean the same, and words that mean the opposite ────────────
   Pairs rather than sets, because a sheet needs one right answer (see the house
   rules): `big` is asked with `large` beside three words that are not its
   synonym, and a set of four synonyms would be a question with four answers.

   `light` is deliberately absent from the opposites. Its opposite is `dark` and
   equally `heavy`, and either would be marked wrong against the other.       */

export type Meaning = { word: string; match: string };

export const SYNONYMS: Meaning[] = [
  { word: "big", match: "large" },
  { word: "small", match: "little" },
  { word: "quick", match: "fast" },
  { word: "begin", match: "start" },
  { word: "end", match: "finish" },
  { word: "shout", match: "yell" },
  { word: "jump", match: "leap" },
  { word: "close", match: "shut" },
  { word: "angry", match: "cross" },
  { word: "tired", match: "sleepy" },
  { word: "brave", match: "bold" },
  { word: "clever", match: "smart" },
  { word: "tidy", match: "neat" },
  { word: "hard", match: "difficult" },
  { word: "easy", match: "simple" },
  { word: "pretty", match: "beautiful" },
  { word: "quiet", match: "silent" },
  { word: "strange", match: "odd" },
  { word: "happy", match: "glad" },
  { word: "sad", match: "gloomy" },
];

export const ANTONYMS: Meaning[] = [
  { word: "hot", match: "cold" },
  { word: "big", match: "small" },
  { word: "up", match: "down" },
  { word: "day", match: "night" },
  { word: "fast", match: "slow" },
  { word: "happy", match: "sad" },
  { word: "old", match: "new" },
  { word: "open", match: "shut" },
  { word: "wet", match: "dry" },
  // Not "soft", which is also the opposite of "loud" further down: a distractor
  // is another entry's answer, so the two pairs together put "soft" on the
  // "loud" line as a wrong option that is right. See the house rules above.
  { word: "hard", match: "easy" },
  { word: "full", match: "empty" },
  { word: "long", match: "short" },
  { word: "high", match: "low" },
  { word: "early", match: "late" },
  { word: "rich", match: "poor" },
  { word: "kind", match: "cruel" },
  { word: "near", match: "far" },
  { word: "loud", match: "quiet" },
  { word: "first", match: "last" },
  { word: "push", match: "pull" },
  { word: "always", match: "never" },
  { word: "true", match: "false" },
];
