/**
 * What the bench opens on, for every family it can make.
 *
 * One config each, and each one a sheet somebody would actually print: the
 * builder's first job is to show a page rather than a form, so switching family
 * has to produce a finished worksheet before a single option is touched. That
 * is the same bargain the catalog pages strike (§8) — a page that *is* the
 * sheet — reached from the other side.
 *
 * It lives in the view rather than in the engine, and that is deliberate. A
 * family's `SheetSpec` says what it can build, not what a parent probably
 * wants; "twenty-four sums with both numbers under twenty" is an editorial
 * judgement about children, of a piece with the copy in `_maths.ts`, and the
 * engine has no business holding one. `deckSpec` draws the same line.
 *
 * Every value here is inside the range its own family clamps to, so nothing
 * below can produce a sheet that fails to fit — the builder never opens on a
 * page it would have to apologise for.
 */
import { WORD_LISTS, listWords } from "@/engine/decks/wordlists";
import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "@/engine/sheets/paper";
import type { SheetConfig, SheetOptions } from "@/engine/sheets/types";

/**
 * The name and date line, printed blank, always.
 *
 * There is nowhere in a config to put a value for either (§1), which is what
 * makes the shared-link half of this screen safe by construction rather than by
 * a rule somebody has to remember: a child's name is written on the paper with
 * a pencil and never travels in a URL.
 */
const BASE: SheetOptions = {
  paper: DEFAULT_PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: ["name", "date"],
};

/** The twelve tables, which is what a fact sheet draws from unless told less. */
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Halves through twelfths, skipping the ones a primary child never meets. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];

/**
 * The first sight words: what a first word list is made of, wherever one is
 * needed.
 *
 * Taken from the list the jungle already ships rather than typed out again, so
 * the words a child is racing on screen are the words they are writing on
 * paper. Twelve rather than the whole list, because a page of forty words
 * written three times each is a page that fits nothing else — and because the
 * sheet is a starting point somebody replaces rather than the sheet they came
 * for.
 *
 * Exported because the catalog's own sight-word sheet is meant to be the sheet
 * the bench opens on (`pages/printables/_handwriting.ts`), and two slices of
 * the same list are two lists that can quietly stop matching.
 */
export const STARTER_WORDS = listWords(WORD_LISTS[0]).slice(0, 12);

/**
 * One sound each for the letters of the alphabet — where a phonics sheet opens.
 *
 * **This is not a preset and not a sequence.** `engine/sheets/phonics/
 * inventory.ts` is explicit that shipping "Lesson 47" would be reproducing
 * somebody's copyrighted course by reference, and shipping "Level 3" would be
 * pretending there is one course when the point of the model is that there
 * isn't. What is below is neither: it is the commonest sound of each of the
 * twenty-six letters, which every scheme on earth teaches and none of them
 * owns, and it is here for exactly the reason `STARTER_WORDS` is — the bench's
 * first job is to show a sheet rather than a form, and a sheet built from an
 * empty inventory is a blank page.
 *
 * A parent ticks their way to their own list in the panel and keeps it under
 * their own name (`services/phonics.ts`). This one has no name at all.
 *
 * Exported because the catalog's phonics pages are meant to be built from the
 * same starting point (`pages/printables/_phonics.ts`), and two lists of the
 * letters would be two lists that could quietly stop matching.
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
 * A passage to open the copywork style on.
 *
 * A pangram first, because a sentence set for handwriting is chosen for the
 * letters it uses rather than for what it says, and this one uses all of them.
 * The second line is there so the box arrives holding two lines: a passage is
 * broken where the paper runs out, and a parent who has never seen that happen
 * would not know a newline of their own is honoured.
 *
 * It is what the *paste* box holds rather than what the sheet prints: copywork
 * opens on a passage out of the library (see below), and `copyworkSource`
 * prefers the library wherever both are set. Clearing the passage is what
 * brings this back, which is the point of it being here at all — the box a
 * parent lands in is never empty.
 */
const PASSAGE =
  "The quick brown fox jumps over the lazy dog.\nGood handwriting is slow before it is neat.";

/**
 * The passage the two library families open on.
 *
 * Psalm 23 for copywork, because it is the piece of English most likely to be
 * the reason somebody came looking for a copywork sheet at all, and it is long
 * enough that the sheet arrives looking like a page of work rather than a
 * demonstration. John 3:16 for memory work, because a memory sheet wants a
 * verse somebody would actually set to be learnt by heart, and twenty-five
 * words is what four rounds of it fit into.
 *
 * Both are one entry in the same picker as the Gettysburg Address and "The
 * Owl and the Pussy-Cat" (§12), and either is replaced in two clicks.
 */
const COPYWORK_PASSAGE = "psalm-23";
const MEMORY_PASSAGE = "for-god-so-loved-the-world";

/**
 * A passage to open memory work's own paste box on.
 *
 * Not `PASSAGE` above, for two reasons. A memory sheet is something somebody
 * means to know by heart, where a handwriting sentence is chosen for the letters
 * it happens to use; and a round is a paragraph — `memory.ts` sets a passage's
 * own line breaks as spaces — so the second line of a pangram would arrive
 * looking like a break the sheet then ignored.
 *
 * Here for the reason `PASSAGE` is: the family opens on the library, and this is
 * what choosing "Your own words" leaves behind. Without it that choice lands a
 * parent in an empty box, `memoryLayout` finds no words to take out, and the
 * preview goes to a header over a blank page — the one thing the bench must
 * never show.
 */
const MEMORY_TEXT = "A verse is learnt by saying it, not by reading it again.";

const DEFAULTS: Record<string, SheetConfig> = {
  blank: { ...BASE, kind: "blank", title: "Blank sheet" },
  paper: { ...BASE, kind: "paper", rule: { style: "wide" } },
  chart: {
    ...BASE,
    kind: "chart",
    // The hundred chart, blank, 1 to 100. The reference a parent recognises
    // from across the room, and the only one of the four that is an exercise as
    // well as a wall chart — so the bench opens on a sheet with something to do
    // on it and a key behind it. The other three are one control away.
    style: "hundred",
    range: { min: 1, max: 100 },
    filled: false,
  },
  form: {
    ...BASE,
    kind: "form",
    // The reading log, because it is the sheet on this shelf a parent
    // recognises from across the room and the one that looks most like a thing
    // to print at a glance. The other eight are one control away, and the
    // control lists them in the order a week uses them.
    style: "reading-log",
    rows: 14,
  },
  planner: {
    ...BASE,
    kind: "planner",
    // A blank month, undated. The dates are a tick box away, and a calendar
    // with no year on it is the one a family pins up and keeps.
    style: "calendar",
    rows: 5,
    // No name line: a wall chart is not handed in.
    fields: [],
  },
  cards: {
    ...BASE,
    kind: "cards",
    // Eight blank flashcards, which is the plainest thing this shelf makes and
    // the thing "blank flashcards" is a query for. Words, verses, tags and
    // certificates are all one control away.
    style: "flashcard",
    up: 8,
    fields: [],
  },
  net: {
    ...BASE,
    kind: "net",
    // The die, because it is an object rather than a page and that is the point
    // of the pair. The spinner is one control away.
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
    // A spelling family with an empty list is a page with nothing on it, and
    // the bench's first job is to show a sheet rather than a form. So it opens
    // on the first shipped sight-word list, which is a worksheet somebody would
    // print unchanged — and the three bootstraps replace it in one press.
    words: STARTER_WORDS,
    times: 3,
    gaps: 2,
    count: STARTER_WORDS.length,
    columns: 2,
  },
  "word-study": {
    ...BASE,
    kind: "word-study",
    // Rhyming, circled: the youngest sheet on this shelf and the one that looks
    // most like a worksheet at a glance, which is what the bench opening on it
    // has to do. Every other topic is one control away, and the control lists
    // them in the order they are taught.
    topic: "rhyming",
    style: "choose",
    count: 12,
    // Only the written topics lay their questions out across the page, and this
    // is what they get when a parent switches to one — a circle-one sheet is a
    // list down the page whatever this says (`studyLayout`).
    columns: 2,
  },
  puzzle: {
    ...BASE,
    kind: "puzzle",
    // A word search, because it is the one of the three a parent recognises
    // from across the room — and the bench's first job is to show a sheet
    // rather than a form. The same starter list as the spelling family, so
    // switching between the two shelves keeps the words a parent is looking at.
    style: "search",
    words: STARTER_WORDS,
    // Twelve squares holds a ten-letter word with room to hide it, and comes
    // out at the full cell size on both stocks.
    size: 12,
    // The usual school puzzle. Diagonals and backwards words are each one
    // control away, and each is a different kind of harder.
    directions: "across-down",
    reverse: false,
    overlap: true,
    count: STARTER_WORDS.length,
    columns: 2,
  },
  grammar: {
    ...BASE,
    kind: "grammar",
    // Parts of speech, circled: the topic a parent recognises the name of, and
    // the one shape of grammar question that looks like a worksheet at a
    // glance. The other four are one control away, and the control lists them
    // in the order they are taught.
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
    // Blending, because it is the one of the seven that looks like a worksheet
    // at a glance and the one a child does most days. Everything else — the
    // cards to cut out, the wall chart, the dictation lines, the sentence
    // strips — is one control away.
    style: "blending",
    inventory: { sounds: FIRST_LETTERS, tricky: ["the"] },
    // All three off. A marked sheet is a choice a parent makes; most schemes
    // print plain text and mark on the whiteboard.
    marking: {},
    count: 20,
    columns: 2,
  },
  handwriting: {
    ...BASE,
    kind: "handwriting",
    style: "letters",
    // The ⅝ rule with a tail space, which is what a school means by
    // "handwriting paper" — and the sheet a parent is likeliest to want first.
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
    // The whole verse, two rounds with more of it gone, and one with none of
    // it left — the shortest progression that is still a progression.
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
 * heard of it.
 *
 * Never throws, for the same reason `sheetSpec` doesn't: the kind can come from
 * a picker built out of `listSheets()`, and a family added to the registry
 * without a default here would otherwise take the whole bench down rather than
 * open on something.
 */
export function defaultConfig(kind: string): SheetConfig {
  return Object.hasOwn(DEFAULTS, kind) ? DEFAULTS[kind] : DEFAULTS[FIRST_SHEET];
}
