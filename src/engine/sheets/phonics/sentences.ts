/**
 * Sentences a child can read, made only of words this bank already holds.
 *
 * A decodable sentence is the one thing in the phonics family that could not be
 * derived from `bank.ts` and an inventory: a list of readable words is not a
 * sentence, and there is no rule that turns one into the other. English word
 * order is learnable by a generator only in the sense that a generator can
 * produce grammatical nonsense — "the mat sat on the cat" is decodable, is
 * correct English, and is not a sentence anybody would put in front of a
 * five-year-old who is still deciding whether reading is worth it.
 *
 * So they are written down, the way `grammar/bank.ts` writes its sentences down
 * and for the same reason: the judgement is a person's.
 *
 * ── A sentence is a list of words, not a string ────────────────────────────
 *
 * Each one is authored as the words it is made of, and the capital letter and
 * the mark on the end are put on when it is printed. That is not a storage
 * trick — it is what makes the constraint checkable. Every word here is looked
 * up in the bank, so a sentence is available to a child exactly when *each of
 * its words* is, by the same `canRead` that decides a single word. A sentence
 * authored as `"The cat sat on the mat."` would have to be cut apart again by
 * something that knew about capitals and full stops, and that something would
 * be a second answer to "which words is this made of".
 *
 * `sheets.test.ts` holds every word here to the bank, so a typo is a failing
 * test rather than a sentence that silently never prints.
 *
 * ── What is not here ───────────────────────────────────────────────────────
 *
 * `and`, `is`, `a`, `was` and `his` are not in the bank, so no sentence below
 * uses them, and that shows: these are short and a little clipped. That is the
 * honest cost of the promise, and the alternative — quietly adding words to the
 * bank so the prose reads better — is how a sheet ends up with a word on it
 * that nobody cut by hand. `was` in particular stays out for the reason
 * `bank.ts` gives: the two varieties disagree about its vowel.
 *
 * `the` is in nearly all of them, and it costs a child two spellings — `th` as
 * in `this` and the unstressed `e` of `garden`. Every programme teaches it long
 * before either, which is exactly what `Inventory.tricky` is for: a parent who
 * has taught `the` by sight puts it on that list and these sentences open up.
 */
import { mulberry32, shuffled } from "@/engine/random";

import { WORD_BY_SPELLING, type Word } from "./bank";
import { canRead, type Inventory } from "./inventory";

export type Sentence = {
  /** The words, lower case, in order. Every one of them is in the bank. */
  words: string[];
  /**
   * The mark it ends on.
   *
   * Two of them, for the reason the grammar family's punctuation sheet gives:
   * a full stop and a question mark are decided by how the sentence is built,
   * and an exclamation mark is decided by how loudly you imagined it.
   */
  end: "." | "?";
};

const s = (words: string, end: Sentence["end"] = "."): Sentence => ({
  words: words.split(" "),
  end,
});

/* ── Short vowels, and nothing else ───────────────────────────────────────
   What a first reader is: three-letter words, one function word, and a full
   stop. Every sentence here is readable by a child who has the five short
   vowels, the single-letter consonants and `the`.                          */

const FIRST: Sentence[] = [
  s("the cat sat on the mat"),
  s("the fat pig can dig"),
  s("the hen ran up the hill"),
  s("the bug hid in the mud"),
  s("the pup can jump on the rug"),
  s("the man let the cat in"),
  s("the kid hid in the tent"),
  s("the red hat fell in the mud"),
  s("the fox ran in the fog"),
  s("the cup fell on the rug"),
  s("the pig will not sit"),
  s("the cat will nap on the bed"),
  s("the man must run up the hill"),
  s("can the cat jump", "?"),
  s("will the dog dig", "?"),
];

/* ── Doubled letters, ck, and the blends ──────────────────────────────────
   The same sentences with more than one consonant at an end of a word, which
   is the step a child takes long before any new vowel.                      */

const BLENDED: Sentence[] = [
  s("the duck sat on the rock"),
  s("the frog can hop"),
  s("the dog will dig in the sand"),
  s("the lamp fell off the desk"),
  s("the big black crab went in the sand"),
  s("stand on the step"),
  s("put the gift in the box"),
  s("the best nest fell down"),
];

/* ── The consonant digraphs ─────────────────────────────────────────────── */

const DIGRAPHED: Sentence[] = [
  s("the fish will swim"),
  s("the chick sat in the shed"),
  s("the king will sing the long song"),
  s("this fish will not swim"),
  s("the shop shut at ten"),
  s("the thin man went in the shop"),
  s("the fish went in the dish"),
  s("the duck will swim in the pond"),
  s("how did the bird get in", "?"),
];

/* ── A vowel that says its own name ─────────────────────────────────────── */

const SPLIT: Sentence[] = [
  s("the snake will hide in the cave"),
  s("the white kite went up"),
  s("make the cake at nine"),
  s("take the note home"),
  s("the mice hid in the hole"),
  s("the stone fell in the lake"),
  s("five white mice came home"),
];

/* ── Vowel teams ────────────────────────────────────────────────────────── */

const TEAMS: Sentence[] = [
  s("the rain fell on the road"),
  s("the goat sat on the boat"),
  s("we can play in the rain"),
  s("she can see the moon"),
  s("the train went down the road"),
  s("keep the food in the room"),
  s("the boy will play by the pool"),
  s("the cow went down the street"),
  s("the green tree grew tall"),
  s("we will eat the sweet fruit"),
];

/* ── The r-coloured vowels ──────────────────────────────────────────────── */

const R_COLOURED: Sentence[] = [
  s("the car went far"),
  s("the bird sat on the chair"),
  s("the girl sat in the dark"),
  s("park the car by the barn"),
  s("the corn grew in the dirt"),
];

/**
 * Every sentence this build may print, roughly in the order a child could
 * first read one.
 *
 * One flat list, exactly as `WORDS` is and for the same reason: what a sentence
 * is available for is decided by the words in it and by nothing else. A sheet
 * drawing from "the digraph group" would hand a child a sentence because of the
 * group it was filed under rather than because they can read it.
 */
export const SENTENCES: Sentence[] = [
  ...FIRST,
  ...BLENDED,
  ...DIGRAPHED,
  ...SPLIT,
  ...TEAMS,
  ...R_COLOURED,
];

/**
 * The bank entries a sentence is made of, or nothing if one of them is missing.
 *
 * All or nothing on purpose. A word the bank has never heard of cannot be
 * checked against an inventory, so a sentence containing one is not "mostly
 * decodable" — it is a sentence this build cannot make a promise about, and the
 * only safe thing to do with it is not print it. The test above is what stops
 * that ever being the answer in a shipped build.
 */
export function sentenceWords(sentence: Sentence): Word[] | undefined {
  const out: Word[] = [];
  for (const word of sentence.words) {
    const found = WORD_BY_SPELLING.get(word);
    if (!found) return undefined;
    out.push(found);
  }
  return out;
}

/** How it reads on the paper: a capital at the front, the mark on the end. */
export function sentenceText(sentence: Sentence): string {
  const line = sentence.words.join(" ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}${sentence.end}`;
}

/**
 * Can this child read this sentence? Every word in it, by the same rule that
 * decides a single word.
 *
 * The sets are the caller's for the reason `canRead`'s are: the question is
 * asked once per sentence per sheet, and rebuilding two sets each time is what
 * turns a live preview into a stutter.
 */
export function canReadSentence(
  sentence: Sentence,
  inventory: Inventory,
  taught: Set<string> = new Set(inventory.sounds),
  sight: Set<string> = new Set(inventory.tricky),
): boolean {
  const words = sentenceWords(sentence);
  if (!words) return false;
  return words.every((word) => canRead(word, inventory, taught, sight));
}

/**
 * Sentences for a sheet: readable, in an order the seed decides.
 *
 * The same bargain `pickWords` makes, and deliberately the same shape — the
 * count is a request, fewer come back when fewer can be read, and the page is
 * deterministic in `(inventory, count, seed)` so that `seed + 1` is "another
 * one like this" here as it is everywhere else in the shop (§7).
 */
export function pickSentences(
  inventory: Inventory,
  count: number,
  seed: number,
): Sentence[] {
  const taught = new Set(inventory.sounds);
  const sight = new Set(inventory.tricky);
  const pool = SENTENCES.filter((sentence) =>
    canReadSentence(sentence, inventory, taught, sight),
  );
  return shuffled(pool, mulberry32(seed)).slice(0, Math.max(0, count));
}
