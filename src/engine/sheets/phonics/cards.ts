/**
 * A word as it is *printed*: cut into its spellings, and marked.
 *
 * The marking pass turns a word into the pieces a sheet sets it in. How tall
 * that lands on the page is the other half of the same idea, and it lives next
 * door in `metrics.ts`: `Cards.tsx` draws against those proportions and has no
 * use for the word bank this module reads, so the numbers are a module of their
 * own and this one imports them like everybody else.
 *
 * The three marks are independent switches, derived from `sounds.ts` rather
 * than authored, so there is nowhere here for a programme's own spelling of a
 * rule to be written down (docs/printables.md §13).
 *
 * **One mark to a piece**, and it is worth seeing why rather than trusting it:
 * a silent piece is one the table gives no sounds at all, a macron goes on a
 * single letter that says one of the five long vowels, and a join needs two
 * letters or more. No spelling can satisfy two of those at once, so a piece
 * carries at most one mark and the renderer has one case to draw.
 */
import type { MarkedPart, MarkedWord, PhonicsMarking } from "../types";

import { WORD_BY_SPELLING, type Word } from "./bank";
import { sentenceText, type Sentence } from "./sentences";
import {
  CORRESPONDENCE_BY_ID,
  graphemeParts,
  graphemeText,
  type Correspondence,
} from "./sounds";

/* ── The marks ──────────────────────────────────────────────────────────── */

/**
 * The sound each single vowel letter makes when it says its own name — the
 * whole of what "long vowel" means for a marking pass.
 *
 * A vowel *team* is not marked: `ea` and `oa` say the same sounds and carry no
 * bar in any tradition, because the second letter is already the signal.
 */
const SAYS_ITS_NAME = new Map<string, string>([
  ["a", "ai"],
  ["e", "ee"],
  ["i", "ie"],
  ["o", "oa"],
  ["u", "oo"],
]);

/**
 * One piece of a spelling, marked — or not, if the switch for it is off.
 *
 * `letters` is what is printed, which is not always the whole grapheme: a split
 * vowel is drawn whole on a sound card (`a-e`) and in two places inside a word
 * (`c a k e`), and both go through here.
 */
function markOf(
  letters: string,
  entry: Correspondence,
  marking: PhonicsMarking,
): MarkedPart {
  if (marking.silent && entry.phonemes.length === 0)
    return { text: letters, mark: "silent" };
  if (
    marking.macron &&
    letters.length === 1 &&
    entry.phonemes.includes(SAYS_ITS_NAME.get(letters) ?? "")
  )
    return { text: letters, mark: "macron" };
  if (marking.joined && letters.length > 1)
    return { text: letters, mark: "joined" };
  return { text: letters };
}

/**
 * A spelling as a card prints it: the letters as the table writes them, with a
 * split vowel written the way a page writes one — `a-e`, never `a_e`.
 *
 * Whole rather than cut in two, because on a card the spelling is the *thing*:
 * `a-e` is what a parent ticked, and a card reading "a" beside a card reading
 * "e" would be two cards that are not the spelling. A macron here does real
 * work — it tells the `a` of `baby` from the `a` of `cat` when the two are next
 * to each other on the wall.
 */
export const markGrapheme = (
  entry: Correspondence,
  marking: PhonicsMarking,
): MarkedWord => [markOf(graphemeText(entry.grapheme), entry, marking)];

/**
 * A word, cut into the spellings it is made of and marked.
 *
 * A split vowel puts its head where the vowel goes and its tail at the end of
 * the word — the same reassembly `phonics.test.ts` checks the bank with — which
 * is what makes `cake` out of `c` + `a_e` + `k`, and what makes the final `e`
 * the piece the silent switch dims. A part naming a spelling this build has
 * never heard of is printed as itself and marked with nothing: refusing to
 * print it would be a blank space where a child is expecting a word.
 */
export function markWord(entry: Word, marking: PhonicsMarking): MarkedWord {
  const head: MarkedWord = [];
  const tail: MarkedWord = [];
  for (const part of entry.parts) {
    const found = CORRESPONDENCE_BY_ID.get(part);
    if (!found) {
      head.push({ text: part });
      continue;
    }
    const [letters, trailing] = graphemeParts(found.grapheme);
    head.push(markOf(letters, found, marking));
    // The trailing half of a split vowel is silent by construction rather than
    // by anything the table says: the sound belongs to the pair, and the `e` on
    // the end of `cake` carries none of it.
    if (trailing)
      tail.push(
        marking.silent
          ? { text: trailing, mark: "silent" }
          : { text: trailing },
      );
  }
  return [...head, ...tail];
}

/** The same, from the word as it is spelled. Plain if the bank has no cut. */
export const markSpelling = (
  word: string,
  marking: PhonicsMarking,
): MarkedWord => {
  const found = WORD_BY_SPELLING.get(word);
  return found ? markWord(found, marking) : [{ text: word }];
};

/**
 * A whole sentence, marked word by word, with its capital and its full stop.
 *
 * The spaces are pieces of their own rather than padding on the words either
 * side, because a marked piece is drawn as a box with a rule under it and a
 * space inside a joined `sh` would draw the join across it. The capital goes on
 * the first piece and the mark on the end is a piece with nothing on it —
 * neither is part of a spelling, and neither is ever marked.
 */
export function markSentence(
  sentence: Sentence,
  marking: PhonicsMarking,
): MarkedWord {
  const out: MarkedWord = [];
  sentence.words.forEach((word, at) => {
    if (at > 0) out.push({ text: " " });
    out.push(...markSpelling(word, marking));
  });
  const first = out[0];
  if (first) {
    out[0] = {
      ...first,
      text: `${first.text.charAt(0).toUpperCase()}${first.text.slice(1)}`,
    };
  }
  out.push({ text: sentence.end });
  return out;
}

/** What a marked word says, with the marks taken off — for a test, and a key. */
export const markedText = (word: MarkedWord): string =>
  word.map((part) => part.text).join("");

/** How long a sentence prints, before anything is marked. */
export const sentenceLength = (sentence: Sentence): number =>
  sentenceText(sentence).length;
