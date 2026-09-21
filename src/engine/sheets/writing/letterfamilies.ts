/**
 * The letters grouped by the stroke they begin with, and by how tall they
 * stand — the two groupings a penmanship sheet is built out of, and the words
 * and sentences the other styles are set on (§24).
 *
 * **A family is the hand's answer, not ours.** In print, c, o, a, d, g and q
 * all begin with the same anticlockwise curve, and a child who can make that
 * one stroke well has six letters; in a joined hand the same six begin with a
 * curve down into the bowl, but l, h and b begin with a loop that print never
 * draws, and there is no straight slant anywhere. So the table is per hand, and
 * the ids name the stroke rather than the letters, which is what lets one
 * config mean the right thing in both.
 *
 * Kept out of `penmanship.ts` so the catalog and the builder can name a
 * family or a zone without pulling in the family that builds sheets.
 */
import { own } from "../paper";
import type { LetterFamily } from "../types";

export type FamilySet = {
  id: LetterFamily;
  /** What it is called in a picker and on a sheet. */
  label: string;
  /** The stroke the family shares, in one line a parent can read. */
  blurb: string;
};

/**
 * The five families, in the order they are taught: the round letters first
 * because the stroke they share is the first curve a child controls; straight
 * lines next; the arches, which are a line and a curve; then the slants, which
 * only print has, and the loops, which only a joined hand has.
 */
export const LETTER_FAMILIES: FamilySet[] = [
  {
    id: "round",
    label: "Round letters",
    blurb:
      "Start like a c — round from the top, anticlockwise, and back to where you began.",
  },
  {
    id: "line",
    label: "Straight-line letters",
    blurb: "Start with a straight line down from the top.",
  },
  {
    id: "arch",
    label: "Arch letters",
    blurb: "Down, back up the same line, and over the top.",
  },
  {
    id: "slant",
    label: "Slanted letters",
    blurb: "Made of straight lines at an angle, and nothing round.",
  },
  {
    id: "loop",
    label: "Loop letters",
    blurb: "Up to the top line in a loop before the stroke comes down.",
  },
];

const BY_ID: Record<string, FamilySet> = Object.fromEntries(
  LETTER_FAMILIES.map((family) => [family.id, family]),
);

/** A family by id, or the first — see `strokePattern` for why never a throw. */
export const letterFamily = (id: string): FamilySet =>
  own(BY_ID, id, LETTER_FAMILIES[0]);

/** The two hands a family is grouped for. */
export type Hand = "print" | "cursive";

/** A family is a set of one case, so `both` has no meaning here. */
export type FamilyCase = "upper" | "lower";

/**
 * Which letters begin with which stroke, in each hand and case.
 *
 * Print small letters are the four groups most primary schemes teach: the
 * letters that start like a c, the ones that start with a line down, the ones
 * that go down, back up and over, and the four made only of slants. Between
 * them they are the whole alphabet, once — a letter in two families would be
 * traced twice on a sheet of all of them.
 *
 * Print capitals go by what they are made of: straight lines only, a slant
 * somewhere, curves only, or a line and then a curve. The joined hand goes by
 * the stroke the pen enters with: the curve down into a round letter, the
 * short undercurve into a stem, the overcurve into a hump, and the undercurve
 * that climbs into a loop. Cursive capitals are each their own shape and no
 * scheme groups them, so they use the print groups — a capital is a capital.
 */
const MEMBERS: Record<
  Hand,
  Record<FamilyCase, Partial<Record<LetterFamily, string>>>
> = {
  print: {
    lower: {
      round: "coadgqesf",
      line: "litujy",
      arch: "rnmhbpk",
      slant: "vwxz",
    },
    upper: {
      round: "CGOQS",
      line: "EFHILT",
      arch: "BDJPRU",
      slant: "AKMNVWXYZ",
    },
  },
  cursive: {
    lower: {
      round: "acdgoq",
      line: "iutwrspj",
      arch: "nmvxyz",
      loop: "elbhkf",
    },
    upper: {
      round: "CGOQS",
      line: "EFHILT",
      arch: "BDJPRU",
      slant: "AKMNVWXYZ",
    },
  },
};

/** The families a hand and case actually have, in teaching order. */
export const familiesOf = (hand: Hand, letters: FamilyCase): FamilySet[] =>
  LETTER_FAMILIES.filter((family) => family.id in MEMBERS[hand][letters]);

/**
 * The letters of one family, or nothing when that hand has no such family —
 * a config that asked for the loop letters in print asked for a set print
 * does not have, and the honest sheet is the one that leaves it out.
 */
export const familyLetters = (
  family: LetterFamily,
  hand: Hand,
  letters: FamilyCase,
): string[] => [...(MEMBERS[hand][letters][family] ?? "")];

/* ── How tall a letter stands ──────────────────────────────────────────── */

export type Zone = "tall" | "small" | "tail";

export type ZoneSet = {
  id: Zone;
  label: string;
  /** Where on the ruling the letter lives, in the words a teacher uses. */
  blurb: string;
  letters: string[];
};

/**
 * The three heights of a small letter against a handwriting rule. Every
 * small letter is in exactly one; f is in the tall group because on a printed
 * sheet it is, and its tail in a joined hand is the one exception a parent
 * can see for themselves.
 */
export const ZONES: ZoneSet[] = [
  {
    id: "tall",
    label: "Tall letters",
    blurb: "Start at the top line and stand on the baseline.",
    letters: [..."bdfhklt"],
  },
  {
    id: "small",
    label: "Small letters",
    blurb: "Start at the midline and stand on the baseline.",
    letters: [..."aceimnorsuvwxz"],
  },
  {
    id: "tail",
    label: "Tail letters",
    blurb: "Start at the midline and hang below the baseline.",
    letters: [..."gjpqy"],
  },
];

/**
 * Words with a tall letter, a small one and a tail in each, so the three
 * heights have to be kept apart inside one word — which is where a child who
 * can size a letter alone stops sizing it.
 */
export const ZONE_WORDS = ["high", "play", "light", "quick", "bright", "happy"];

/* ── What the other styles are set on ──────────────────────────────────── */

/**
 * Five sentences of short words, so there are as many spaces as possible to
 * get right and no word long enough to make the line about anything else.
 * None is over eighteen characters, which is what a ⅝ rule holds on Letter
 * paper: a sentence about spaces has to sit on one line, or the break at the
 * margin becomes the widest space on the page.
 */
export const SPACING_SENTENCES = [
  "The dog ran to me.",
  "We sat on the mat.",
  "My cat had a nap.",
  "It is fun to run.",
  "A bug is on a log.",
];

/**
 * What a timed sentence sheet copies when a parent has not typed one: the
 * pangram, because a sentence written against the clock should have every
 * letter in it, and this one has.
 */
export const FLUENCY_SENTENCE = "The quick brown fox jumps over the lazy dog.";
