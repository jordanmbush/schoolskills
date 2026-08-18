/**
 * The tagged sentences a grammar sheet is made of.
 *
 * The second bank in the shop, after `words/bank.ts`, and it is here for a
 * sharper version of the same reason. Spelling could not be generated because
 * **English will not yield to a rule**; grammar cannot be generated because
 * **grammar is a judgement**. Whether a word is a noun or a verb, whether a
 * comma is needed, what a pronoun refers back to — every one of those is
 * decidable in a particular sentence and undecidable in general, and a sheet
 * that marks a defensible answer wrong teaches a child something false. That is
 * a worse outcome than no sheet at all (§11).
 *
 * So a sentence is written down once and **tagged**, and every question on
 * every grammar sheet is a view of a tag rather than a parse. Nothing in
 * `grammar.ts` analyses English; it draws sentences and reads what was written
 * about them. Five topics come out of the one bank — parts of speech, subject
 * and predicate, sentence types, the end mark, and the word that needs a
 * capital — which is what "authored once, reusable" means concretely: a
 * sentence carries as many of the five as it can honestly carry.
 *
 * ── House rules for adding one ──────────────────────────────────────────────
 *   - **One defensible answer, in the sentence as printed.** Not "usually a
 *     noun" — the only question is what it is *here*, and if two readings are
 *     both fair the entry does not go in.
 *   - **Never tag a word whose class is disputed by the schemes.** `the`, `a`,
 *     `my`, `his` are determiners to one scheme and adjectives to another, so
 *     no article or possessive is ever the tagged word. Nor is a noun used as a
 *     modifier (`school bus`), a participle (`the running water`) or a gerund.
 *   - **Verbs are past tense or imperative.** `walk` is a noun and a verb;
 *     `walked` is only ever a verb, and so is the `Put` that opens a command.
 *     The `-ed` form is the cheapest way to make a tag unarguable.
 *   - **Adjectives and adverbs that are nothing else.** Not `fast`, `hard`,
 *     `well` or `light`; not a colour, which is a noun as often as a modifier.
 *     Adverbs are `-ly` adverbs of manner, and never the `-ly` words that are
 *     adjectives (`friendly`, `lonely`, `early`).
 *   - **Pronouns that are only pronouns.** `her` and `his` are pronouns in one
 *     position and determiners in another, so neither is ever tagged; `she`,
 *     `they`, `them`, `us`, `you` are safe wherever they stand.
 *   - **A split is exhaustive or it is absent.** `subject` and `predicate`
 *     together are the whole sentence, which is what stops "complete subject"
 *     and "simple subject" being two right answers to one question: every word
 *     has to go somewhere, so `dog` alone leaves `The big brown` homeless.
 *     Only plain statements get one — a command's subject is not on the page,
 *     and a question's is inside the verb phrase.
 *   - **An exclamation is exclamative in form.** `What a …!` and `How …!`,
 *     never a statement with an exclamation mark on it, because "should this
 *     be a full stop or a bang?" is exactly the judgement a key cannot make.
 *   - **One word to capitalise, and it is never the first.** The capitals sheet
 *     lower-cases `proper` and asks for it back, so a second capital anywhere
 *     in the sentence would be a second thing a child could point at.
 *     `grammar.test.ts` holds the bank to that mechanically, along with the
 *     split rejoining, the tagged word appearing exactly once, and the end mark
 *     agreeing with the kind.
 *   - **British spelling**, as everywhere in this repo — and nothing whose
 *     spelling differs between the two, because a sheet is printed on both
 *     sides of the Atlantic.
 */

/**
 * The five word classes a sheet may ask about.
 *
 * Five rather than the eight or nine a grammar names, and the four that are
 * missing are missing on purpose. Determiners, prepositions and conjunctions
 * are all words a primary scheme teaches, and all three are words the schemes
 * disagree about: `the` is a determiner in one classroom and an adjective in
 * the next, and a sheet cannot mark a child on which classroom they are in.
 */
export type Part = "noun" | "verb" | "adjective" | "adverb" | "pronoun";

/** In the order a scheme meets them, which is the order they are printed in. */
export const PARTS: Part[] = ["noun", "verb", "adjective", "adverb", "pronoun"];

/**
 * What a sentence is *for*, which is a different question from what it says.
 *
 * A command and a statement both end in a full stop, and telling them apart is
 * the whole of the exercise. The other two carry their mark, which makes them
 * the easy half — and the easy half is what makes the sheet answerable by a
 * six-year-old rather than only by a nine-year-old.
 */
export type SentenceKind = "statement" | "question" | "command" | "exclamation";

/** In the order they are taught, and the order the options are printed in. */
export const KINDS: SentenceKind[] = [
  "statement",
  "question",
  "command",
  "exclamation",
];

/** The mark each kind ends on. One place, so the bank cannot drift from it. */
export const END_MARK: Record<SentenceKind, string> = {
  statement: ".",
  question: "?",
  command: ".",
  exclamation: "!",
};

/**
 * The whole sentence, cut once.
 *
 * `subject` and `predicate` are the *complete* subject and predicate — every
 * word of the sentence is in one or the other — and that exhaustiveness is what
 * makes the question markable at all. See the house rules above.
 */
export type Split = { subject: string; predicate: string };

/** The one word this sentence is asked about, and what it is here. */
export type Focus = { word: string; part: Part };

export type Tagged = {
  /** The sentence, written correctly: capital at the front, mark at the end. */
  text: string;
  kind: SentenceKind;
  /** Absent unless the sentence is a plain statement — see `Split`. */
  split?: Split;
  /** Absent where no word in it can be tagged without argument. */
  focus?: Focus;
  /**
   * A proper noun in it, written as it is spelt correctly.
   *
   * The capitals sheet prints the sentence with this word in lower case and
   * asks for it back, so it is never the first word — a lower-cased opening
   * word is two mistakes wearing one coat.
   *
   * It is also the tag that sizes the smallest topic in the bank, so a
   * sentence that can honestly carry a name, a place or a day should carry
   * one. `grammar.test.ts` holds every topic above a full page of itself for
   * exactly this reason — a capitals supply of thirteen against a page that
   * holds seventeen is the same sheet whatever seed a parent rerolls to.
   */
  proper?: string;
};

/* ── Statements ────────────────────────────────────────────────────────────
   The only kind with a split, and the reason they are the largest group: a
   subject-and-predicate sheet has nothing else to draw from, and a page whose
   twelve sentences are the bank's whole supply is the same page every week. */

const STATEMENTS: Tagged[] = [
  {
    text: "The tall giraffe ate the leaves.",
    kind: "statement",
    split: { subject: "The tall giraffe", predicate: "ate the leaves" },
    focus: { word: "tall", part: "adjective" },
  },
  {
    text: "My sister carried the heavy basket for Rosie.",
    kind: "statement",
    split: {
      subject: "My sister",
      predicate: "carried the heavy basket for Rosie",
    },
    focus: { word: "carried", part: "verb" },
    proper: "Rosie",
  },
  {
    text: "The old tractor belonged to Jack.",
    kind: "statement",
    split: { subject: "The old tractor", predicate: "belonged to Jack" },
    focus: { word: "tractor", part: "noun" },
    proper: "Jack",
  },
  {
    text: "She whispered the answer politely.",
    kind: "statement",
    split: { subject: "She", predicate: "whispered the answer politely" },
    focus: { word: "politely", part: "adverb" },
  },
  {
    text: "The hungry kitten slept in the cupboard.",
    kind: "statement",
    split: { subject: "The hungry kitten", predicate: "slept in the cupboard" },
    focus: { word: "hungry", part: "adjective" },
  },
  {
    text: "We climbed the steep hill on Tuesday.",
    kind: "statement",
    split: { subject: "We", predicate: "climbed the steep hill on Tuesday" },
    focus: { word: "climbed", part: "verb" },
    proper: "Tuesday",
  },
  {
    text: "The postman knocked loudly on the door.",
    kind: "statement",
    split: { subject: "The postman", predicate: "knocked loudly on the door" },
    focus: { word: "loudly", part: "adverb" },
  },
  {
    text: "Our new puppy chewed my slipper.",
    kind: "statement",
    split: { subject: "Our new puppy", predicate: "chewed my slipper" },
    focus: { word: "puppy", part: "noun" },
  },
  {
    text: "The enormous whale dived under the boat.",
    kind: "statement",
    split: {
      subject: "The enormous whale",
      predicate: "dived under the boat",
    },
    focus: { word: "enormous", part: "adjective" },
  },
  {
    text: "The farmer told them a funny story.",
    kind: "statement",
    split: { subject: "The farmer", predicate: "told them a funny story" },
    focus: { word: "them", part: "pronoun" },
  },
  {
    text: "They painted the shed on Saturday.",
    kind: "statement",
    split: { subject: "They", predicate: "painted the shed on Saturday" },
    focus: { word: "They", part: "pronoun" },
    proper: "Saturday",
  },
  {
    text: "A wooden bridge crossed the stream at Oxford.",
    kind: "statement",
    split: {
      subject: "A wooden bridge",
      predicate: "crossed the stream at Oxford",
    },
    focus: { word: "stream", part: "noun" },
    proper: "Oxford",
  },
  {
    text: "The children waited quietly for the bus.",
    kind: "statement",
    split: { subject: "The children", predicate: "waited quietly for the bus" },
    focus: { word: "quietly", part: "adverb" },
  },
  {
    text: "Emma visited her cousin in Wales.",
    kind: "statement",
    split: { subject: "Emma", predicate: "visited her cousin in Wales" },
    focus: { word: "visited", part: "verb" },
    proper: "Wales",
  },
  {
    text: "The early train arrived in Cardiff.",
    kind: "statement",
    split: { subject: "The early train", predicate: "arrived in Cardiff" },
    focus: { word: "arrived", part: "verb" },
    proper: "Cardiff",
  },
  {
    text: "My uncle drove us to Scotland.",
    kind: "statement",
    split: { subject: "My uncle", predicate: "drove us to Scotland" },
    focus: { word: "us", part: "pronoun" },
    proper: "Scotland",
  },
  {
    text: "The lesson finished early on Thursday.",
    kind: "statement",
    split: { subject: "The lesson", predicate: "finished early on Thursday" },
    focus: { word: "finished", part: "verb" },
    proper: "Thursday",
  },
  {
    text: "My cousin posted the letter to Ireland.",
    kind: "statement",
    split: { subject: "My cousin", predicate: "posted the letter to Ireland" },
    focus: { word: "posted", part: "verb" },
    proper: "Ireland",
  },
  {
    text: "The gentle donkey carried our bags to Dover.",
    kind: "statement",
    split: {
      subject: "The gentle donkey",
      predicate: "carried our bags to Dover",
    },
    focus: { word: "gentle", part: "adjective" },
    proper: "Dover",
  },
  {
    text: "The noisy seagulls followed us to Bristol.",
    kind: "statement",
    split: {
      subject: "The noisy seagulls",
      predicate: "followed us to Bristol",
    },
    focus: { word: "noisy", part: "adjective" },
    proper: "Bristol",
  },
  {
    text: "The scouts marched proudly through Norway.",
    kind: "statement",
    split: {
      subject: "The scouts",
      predicate: "marched proudly through Norway",
    },
    focus: { word: "proudly", part: "adverb" },
    proper: "Norway",
  },
];

/* ── Questions ─────────────────────────────────────────────────────────────
   Every one of them inverted or opened by a question word, so what makes it a
   question is on the page rather than in the reader's voice. "You are coming"
   is a question or a statement depending on how it is said, which is precisely
   the sentence that cannot be printed with a key.                           */

const QUESTIONS: Tagged[] = [
  {
    text: "Where did you put the tickets for Friday?",
    kind: "question",
    focus: { word: "you", part: "pronoun" },
    proper: "Friday",
  },
  {
    text: "Did she deliver the parcel this morning?",
    kind: "question",
    focus: { word: "she", part: "pronoun" },
  },
  {
    text: "Why is the kitchen so untidy?",
    kind: "question",
    focus: { word: "untidy", part: "adjective" },
  },
  {
    text: "Have you ever visited Egypt?",
    kind: "question",
    focus: { word: "visited", part: "verb" },
    proper: "Egypt",
  },
  {
    text: "Who left the muddy footprints on the carpet?",
    kind: "question",
    focus: { word: "muddy", part: "adjective" },
  },
  {
    text: "When does the library open on Sunday?",
    kind: "question",
    focus: { word: "library", part: "noun" },
    proper: "Sunday",
  },
  {
    text: "How did they carry the ladder safely?",
    kind: "question",
    focus: { word: "safely", part: "adverb" },
  },
  {
    text: "Did they remember the tickets for Wednesday?",
    kind: "question",
    focus: { word: "they", part: "pronoun" },
    proper: "Wednesday",
  },
  {
    text: "Why is the castle in Denmark so famous?",
    kind: "question",
    focus: { word: "famous", part: "adjective" },
    proper: "Denmark",
  },
  {
    text: "Has the parcel arrived in Kenya?",
    kind: "question",
    focus: { word: "arrived", part: "verb" },
    proper: "Kenya",
  },
];

/* ── Commands ──────────────────────────────────────────────────────────────
   The kind that shares its mark with a statement, and therefore the whole
   reason a sentence-types sheet is an exercise rather than a look at the last
   character. Every one opens on a verb that is not also a noun: `Put`, not
   `Pass`; `Choose`, not `Close`.                                            */

const COMMANDS: Tagged[] = [
  {
    text: "Put the muddy boots outside the door.",
    kind: "command",
    focus: { word: "Put", part: "verb" },
  },
  {
    text: "Bring the shopping into the kitchen.",
    kind: "command",
    focus: { word: "kitchen", part: "noun" },
  },
  {
    text: "Remember your lunchbox on Monday.",
    kind: "command",
    focus: { word: "Remember", part: "verb" },
    proper: "Monday",
  },
  {
    text: "Choose a book for Amir.",
    kind: "command",
    focus: { word: "book", part: "noun" },
    proper: "Amir",
  },
  {
    text: "Explain your answer clearly to the class.",
    kind: "command",
    focus: { word: "clearly", part: "adverb" },
  },
  {
    text: "Deliver these letters to Harriet.",
    kind: "command",
    focus: { word: "Deliver", part: "verb" },
    proper: "Harriet",
  },
  {
    text: "Describe the journey to Iceland.",
    kind: "command",
    focus: { word: "Describe", part: "verb" },
    proper: "Iceland",
  },
];

/* ── Exclamations ──────────────────────────────────────────────────────────
   All four are exclamative clauses — `What a …!` or `How …!` — which is what
   makes the mark on the end a fact about the grammar rather than a decision
   about tone. It is also why they are the one kind the punctuation sheet never
   draws from: "What a mess" takes a bang, and a child who wrote a full stop
   after it has not made a mistake anybody can point to.                     */

const EXCLAMATIONS: Tagged[] = [
  {
    text: "What a tremendous splash that was!",
    kind: "exclamation",
    focus: { word: "tremendous", part: "adjective" },
  },
  {
    text: "How quickly the storm arrived!",
    kind: "exclamation",
    focus: { word: "quickly", part: "adverb" },
  },
  {
    text: "What a clever idea you had!",
    kind: "exclamation",
    focus: { word: "you", part: "pronoun" },
  },
  {
    text: "How chilly the water felt!",
    kind: "exclamation",
    focus: { word: "chilly", part: "adjective" },
  },
  {
    text: "How brightly the lights of Oslo shone!",
    kind: "exclamation",
    focus: { word: "brightly", part: "adverb" },
    proper: "Oslo",
  },
];

/**
 * The bank, in one list.
 *
 * Grouped above by kind because that is how it is *read* — the constraints on a
 * command are not the constraints on a statement — and flattened here because
 * that is how it is *used*: a topic is a filter over the whole bank, and a
 * topic that had to know which array to look in would be a topic that could
 * look in the wrong one.
 */
export const SENTENCES: Tagged[] = [
  ...STATEMENTS,
  ...QUESTIONS,
  ...COMMANDS,
  ...EXCLAMATIONS,
];

/** The sentence without the mark on the end — what a punctuation sheet asks. */
export const stem = (entry: Tagged): string => entry.text.slice(0, -1);

/**
 * The sentence with its proper noun knocked down to lower case.
 *
 * The one place a sentence is printed as something other than what it says, and
 * it is done by lower-casing the first letter of the word rather than the word
 * itself: `text` is the truth and this is the exercise made out of it, so the
 * two can only ever differ by that one character — which is what makes "exactly
 * one word to put right" a property a test can check rather than a promise.
 */
export function lowered(entry: Tagged): string {
  if (!entry.proper) return entry.text;
  const at = entry.text.indexOf(entry.proper);
  if (at < 0) return entry.text;
  return (
    entry.text.slice(0, at) +
    entry.proper[0].toLowerCase() +
    entry.text.slice(at + 1)
  );
}
