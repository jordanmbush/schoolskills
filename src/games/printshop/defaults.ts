/**
 * What the bench opens on, for every family it can make.
 *
 * Each is a sheet somebody would print unchanged, which is the rule the rest of
 * the file follows, and each is an editorial judgement rather than a technical
 * one — §14 is where both are argued.
 *
 * Every value here is inside the range its own family clamps to, so nothing
 * below can open on a sheet that fails to fit.
 */
import { WORD_LISTS, listWords } from "@/engine/decks/wordlists";
import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "@/engine/sheets/paper";
import type { SheetConfig, SheetOptions } from "@/engine/sheets/types";

/**
 * The name and date line, printed blank, always. There is nowhere in a config to
 * put a value for either (§1), which is what makes the shared-link half of this
 * screen safe by construction rather than by a rule somebody has to remember.
 */
const BASE: SheetOptions = {
  paper: DEFAULT_PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: ["name", "date"],
};

const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Halves through twelfths, less the ones a primary child never meets. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];

/**
 * The first sight words, off the list the jungle already ships, so the words a
 * child is racing are the words they are writing. Twelve rather than the whole
 * list, because a page of forty words written three times each fits nothing
 * else.
 *
 * Exported so the catalog's own sight-word sheet is built from this same slice
 * (`pages/printables/_handwriting.ts`) — two slices of one list are two lists
 * that can quietly stop matching.
 */
export const STARTER_WORDS = listWords(WORD_LISTS[0]).slice(0, 12);

/**
 * The commonest sound of each of the twenty-six letters — where a phonics sheet
 * opens, because a sheet built from an empty inventory is a blank page.
 *
 * **Not a preset and not a sequence**: a named set of sounds is somebody's
 * copyrighted course (§13). This one has no name at all, and a parent ticks
 * their way to their own in the panel (`services/phonics.ts`).
 *
 * Exported so the catalog's phonics pages start from the same list
 * (`pages/printables/_phonics.ts`) rather than a second copy of it.
 */
export const FIRST_LETTERS: string[] = [
  "b:b",
  "c:k",
  "d:d",
  "f:f",
  "g:g",
  "h:h",
  "j:j",
  "k:k",
  "l:l",
  "m:m",
  "n:n",
  "p:p",
  "qu:k-w",
  "r:r",
  "s:s",
  "t:t",
  "v:v",
  "w:w",
  "x:k-s",
  "y:y",
  "z:z",
  "a:a",
  "e:e",
  "i:i",
  "o:o",
  "u:u",
];

/**
 * What the copywork *paste box* holds, not what the sheet prints: copywork opens
 * on a passage out of the library below, and `copyworkSource` prefers the
 * library wherever both are set. Clearing the passage is what brings this back,
 * so the box a parent lands in is never empty.
 *
 * A pangram, because a sentence set for handwriting is chosen for the letters it
 * uses rather than for what it says. The second line is there so the box arrives
 * holding two: a passage is broken where the paper runs out, and a parent who
 * has never seen that happen would not know a newline of their own is honoured.
 */
const PASSAGE =
  "The quick brown fox jumps over the lazy dog.\nGood handwriting is slow before it is neat.";

/**
 * The passage the two library families open on. Psalm 23 for copywork, long
 * enough that the sheet arrives looking like a page of work rather than a
 * demonstration; John 3:16 for memory work, whose twenty-five words are what
 * four rounds of it fit into.
 *
 * Both are one entry in the same picker as the Gettysburg Address (§12), and
 * either is replaced in two clicks.
 */
const COPYWORK_PASSAGE = "psalm-23";
const MEMORY_PASSAGE = "for-god-so-loved-the-world";

/**
 * What choosing "Your own words" leaves memory work holding. Without it that
 * choice lands a parent in an empty box, `memoryLayout` finds no words to take
 * out, and the preview goes to a header over a blank page.
 *
 * One paragraph rather than `PASSAGE` above: `memory.ts` sets a passage's own
 * line breaks as spaces, so a pangram's second line would arrive looking like a
 * break the sheet then ignored.
 */
const MEMORY_TEXT = "A verse is learnt by saying it, not by reading it again.";

const DEFAULTS: Record<string, SheetConfig> = {
  blank: { ...BASE, kind: "blank", title: "Blank sheet" },
  paper: { ...BASE, kind: "paper", rule: { style: "wide" } },
  chart: {
    ...BASE,
    kind: "chart",
    style: "hundred",
    range: { min: 1, max: 100 },
    filled: false,
  },
  form: {
    ...BASE,
    kind: "form",
    style: "reading-log",
    rows: 14,
  },
  planner: {
    ...BASE,
    kind: "planner",
    style: "calendar",
    rows: 5,
    // No name line: a wall chart is not handed in.
    fields: [],
  },
  cards: {
    ...BASE,
    kind: "cards",
    style: "flashcard",
    up: 8,
    fields: [],
  },
  net: {
    ...BASE,
    kind: "net",
    style: "dice",
    fields: [],
  },
  arithmetic: {
    ...BASE,
    kind: "arithmetic",
    operation: "add",
    style: "standard",
    form: "horizontal",
    range: { min: 1, max: 20 },
    count: 24,
    columns: 3,
    regrouping: "either",
  },
  multiplication: {
    ...BASE,
    kind: "multiplication",
    operation: "multiply",
    style: "standard",
    form: "horizontal",
    tables: TABLES,
    factors: { min: 1, max: 12 },
    count: 30,
    columns: 3,
  },
  fractions: {
    ...BASE,
    kind: "fractions",
    style: "identify",
    operation: "add",
    denominators: DENOMINATORS,
    pairing: "like",
    model: "both",
    count: 12,
    columns: 2,
  },
  decimals: {
    ...BASE,
    kind: "decimals",
    style: "standard",
    operation: "add",
    form: "vertical",
    places: 2,
    range: { min: 1, max: 20 },
    count: 16,
    columns: 3,
  },
  money: {
    ...BASE,
    kind: "money",
    currency: "usd",
    operation: "add",
    form: "vertical",
    range: { min: 1, max: 20 },
    count: 16,
    columns: 3,
  },
  time: {
    ...BASE,
    kind: "time",
    style: "read",
    step: 5,
    count: 8,
    columns: 2,
  },
  measure: {
    ...BASE,
    kind: "measure",
    style: "convert",
    system: "metric",
    quantities: ["length"],
    range: { min: 1, max: 50 },
    count: 16,
    columns: 2,
  },
  geometry: {
    ...BASE,
    kind: "geometry",
    style: "area",
    system: "metric",
    range: { min: 2, max: 12 },
    quadrants: 1,
    count: 8,
    columns: 2,
  },
  integers: {
    ...BASE,
    kind: "integers",
    style: "arithmetic",
    operation: "add",
    range: { min: 1, max: 20 },
    negatives: true,
    terms: 3,
    powers: true,
    count: 20,
    columns: 3,
  },
  prealgebra: {
    ...BASE,
    kind: "prealgebra",
    style: "equation",
    steps: 1,
    range: { min: 1, max: 12 },
    negatives: false,
    quadrants: 1,
    count: 16,
    columns: 2,
  },
  ratio: {
    ...BASE,
    kind: "ratio",
    style: "simplify",
    range: { min: 2, max: 24 },
    count: 16,
    columns: 2,
  },
  statistics: {
    ...BASE,
    kind: "statistics",
    style: "all",
    size: 5,
    range: { min: 1, max: 20 },
    count: 6,
    columns: 1,
  },
  words: {
    ...BASE,
    kind: "words",
    style: "copy",
    words: STARTER_WORDS,
    times: 3,
    gaps: 2,
    count: STARTER_WORDS.length,
    columns: 2,
  },
  "word-study": {
    ...BASE,
    kind: "word-study",
    topic: "rhyming",
    style: "choose",
    count: 12,
    // What the written topics get when a parent switches to one — a circle-one
    // sheet is a list down the page whatever this says (`studyLayout`).
    columns: 2,
  },
  puzzle: {
    ...BASE,
    kind: "puzzle",
    // The same starter list as the spelling family, so switching between the two
    // shelves keeps the words a parent is looking at.
    style: "search",
    words: STARTER_WORDS,
    // Twelve squares holds a ten-letter word with room to hide it, and comes
    // out at the full cell size on both stocks.
    size: 12,
    directions: "across-down",
    reverse: false,
    overlap: true,
    count: STARTER_WORDS.length,
    columns: 2,
  },
  grammar: {
    ...BASE,
    kind: "grammar",
    topic: "parts",
    style: "choose",
    count: 12,
    // What the written topics get when a parent switches to one — a circle-one
    // sheet is a list down the page whatever this says (`grammarLayout`).
    columns: 1,
  },
  phonics: {
    ...BASE,
    kind: "phonics",
    style: "blending",
    inventory: { sounds: FIRST_LETTERS, tricky: ["the"] },
    // A marked sheet is a choice a parent makes; most schemes print plain text
    // and mark on the whiteboard.
    marking: {},
    count: 20,
    columns: 2,
  },
  handwriting: {
    ...BASE,
    kind: "handwriting",
    style: "letters",
    // The ⅝ rule with a tail space: what a school means by "handwriting paper".
    rule: { style: "hand-5-8", midline: "dashed", descender: true },
    letters: "both",
    trace: "dotted",
    // Three: a model, a trace, and the place where they are on their own. Also
    // what puts the whole alphabet on one page at this rule size.
    repeats: 3,
    words: STARTER_WORDS,
    passage: COPYWORK_PASSAGE,
    text: PASSAGE,
  },
  memory: {
    ...BASE,
    kind: "memory",
    passage: MEMORY_PASSAGE,
    text: MEMORY_TEXT,
    // The whole verse, two rounds with more of it gone, and one with none of it
    // left — the shortest progression that is still a progression.
    rounds: 4,
  },
  "word-problems": {
    ...BASE,
    kind: "word-problems",
    topics: ["integers", "rate", "average"],
    range: { min: 2, max: 30 },
    count: 6,
    columns: 1,
    workspace: true,
  },
};

/** Where the bench opens when the address bar had nothing to say. */
export const FIRST_SHEET = "arithmetic";

/**
 * A starting config for a family, or the first sheet's if this build has never
 * heard of it. Never throws, for the same reason `sheetSpec` doesn't: a family
 * added to the registry without a default here would otherwise take the whole
 * bench down rather than open on something.
 */
export function defaultConfig(kind: string): SheetConfig {
  return Object.hasOwn(DEFAULTS, kind) ? DEFAULTS[kind] : DEFAULTS[FIRST_SHEET];
}
