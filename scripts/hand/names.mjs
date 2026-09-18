/**
 * What a glyph's drawing is called on disk, and what the same glyph is called
 * in the UFO it is traced over (`docs/printables.md` §25).
 *
 * A file per glyph named by the character would put `a.svg` and `A.svg` in
 * one directory, which on a Mac is one file. So the drawings take the UFO
 * convention instead — a capital carries a trailing underscore, a numeral is
 * spelt out — and this table is the only place the two spellings meet.
 */

const DIGITS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

const LOWER = "abcdefghijklmnopqrstuvwxyz";

/** Drawing file stem → the character it draws. */
export const CHARACTERS = {
  ...Object.fromEntries([...LOWER].map((c) => [c, c])),
  ...Object.fromEntries(
    [...LOWER].map((c) => [`${c.toUpperCase()}_`, c.toUpperCase()]),
  ),
  ...Object.fromEntries(DIGITS.map((name, digit) => [name, String(digit)])),
  period: ".",
  comma: ",",
  question: "?",
  exclam: "!",
  quotesingle: "'",
  hyphen: "-",
};

/** The character → its drawing file stem. */
export const STEMS = Object.fromEntries(
  Object.entries(CHARACTERS).map(([stem, character]) => [character, stem]),
);

/**
 * The forms a letter is taught in more than one way, as the suffix each
 * drawing of it carries: `a.single.svg` and `a.double.svg` are the two
 * storeys of an `a`, `t.curved.svg` and `t.straight.svg` the two feet of a
 * `t`. One list for every hand, so a sheet asking for a straight `t` means
 * the same thing in each; `Form` in `src/engine/sheets/hands/hand.ts` is
 * this list again, and the type check holds a generated module to it.
 */
export const FORMS = ["single", "double", "curved", "straight"];

const TITLE = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
];

/**
 * SIL's glyph names, which are their own scheme rather than the AGL's: Latin
 * small `a` is `LtnSmA`, its capital `LtnCapA`, a digit `DigitFive`. The two
 * letters a child is taught single-storey are the alternates, not the
 * defaults, so the map names those.
 */
export const SIL_NAMES = {
  ...Object.fromEntries([...LOWER].map((c) => [c, `LtnSm${c.toUpperCase()}`])),
  a: "LtnSmA.SngStory",
  g: "LtnSmG.SngBowl",
  ...Object.fromEntries(
    [...LOWER].map((c) => [c.toUpperCase(), `LtnCap${c.toUpperCase()}`]),
  ),
  ...Object.fromEntries(
    TITLE.map((name, digit) => [String(digit), `Digit${name}`]),
  ),
  ".": "Period",
  ",": "Comma",
  "?": "Question",
  "!": "Exclam",
  "'": "QuoteSingle",
  "-": "Hyphen",
};

/**
 * The outline a form is traced over, where it is not the character's own:
 * SIL draws the other storey of `a` and `g` and the other foot of `t`, `y`,
 * `l` and `i` as alternates. A form not here — a hooked `q`, which the face
 * lacks — is drawn over the character's outline and given its shape by hand.
 */
export const SIL_FORMS = {
  "a.double": "LtnSmA",
  "g.double": "LtnSmG",
  "t.straight": "LtnSmT.NoTailT",
  "y.straight": "LtnSmY.NoTailY",
  "l.curved": "LtnSmL.TailL",
  "i.curved": "LtnSmI.TailI",
};
