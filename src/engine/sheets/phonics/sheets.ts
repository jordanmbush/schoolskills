/**
 * Phonics, out of the sounds a parent says their child has been taught.
 *
 * Seven sheets over one inventory, and the inventory is the whole of what makes
 * them different from a word list: **nothing on any of these pages uses a
 * spelling that has not been ticked.** That promise is the reason the model in
 * `inventory.ts` exists, it is what every style here is a view of, and it is
 * what `sheets.test.ts` re-derives from the finished page rather than taking on
 * trust — the same independence the word search buys by reading its own grid
 * (§11).
 *
 * Nothing here is named after a programme and nothing reproduces one. There is
 * no lesson number, no level, and no shipped inventory: a parent's own list is
 * the only one there is (`services/phonics.ts`), and the three typographic
 * marks are independent switches rather than somebody's modified alphabet
 * (`cards.ts`, §13).
 *
 * ── Accent, and what these sheets do not ask ───────────────────────────────
 *
 * `bank.ts` records where General American and RP disagree instead of resolving
 * it, and leaves out the words that have no honest cut in both places. Nothing
 * below filters on `variesByAccent`, and that is a decision rather than an
 * oversight: the one exercise that would need it is asking a child to *hear the
 * difference* between two sounds, and there is no such style here. Every style
 * that prints a word asks about its **spelling** — which spellings it is made
 * of, which spelling is in it, how it is written down when it is read out — and
 * a spelling is the same on both sides of the Atlantic. A sheet that asked
 * whether `cot` and `caught` sound alike would mark half the children who saw
 * it wrong, so it is not one of the seven.
 *
 * Everything the other families promise holds: the page comes out of
 * `(config, seed)` and nothing else, the answers are decided when the sheet is
 * built and the key only prints them, and no row goes on the page that the
 * capacity arithmetic did not reserve.
 */
import { mulberry32, shuffled } from "@/engine/random";

import type {
  Block,
  Mil,
  PhonicsConfig,
  PhonicsMarking,
  PhonicsStyle,
  Problem,
  Sheet,
  SheetOptions,
  SoundCard,
} from "../types";

import { declaredWidth, sheetBlockBox } from "../chrome";
import {
  LIST_GAP,
  MATCH_ROW_EMS,
  PROBLEM_GAP,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { points } from "../paper";
import { SHEET_CREDIT, SHEET_WORLD, gameUrl, type SheetSpec } from "../spec";

import { WORDS, WORD_BY_SPELLING, type Word } from "./bank";
import {
  CARD_BIG_EMS,
  STRIP_BIG_EMS,
  cardRowEms,
  markGrapheme,
  markSentence,
  markWord,
  sentenceLength,
} from "./cards";
import {
  pickWords,
  readInventory,
  taughtSounds,
  type Inventory,
} from "./inventory";
import { SENTENCES, pickSentences, type Sentence } from "./sentences";
import {
  CORRESPONDENCE_BY_ID,
  PHONEME_BY_ID,
  type Correspondence,
} from "./sounds";

/* ── What a row takes on the page ─────────────────────────────────────────
   Declared, not measured (§4). A line of words is a line of body type; a card
   is the arithmetic in `cards.ts`, which the renderer draws against.        */

/** A prompt and its ruled slot, on one line of body type. */
const ROW_EMS = 1.7;

/** More than this many columns of cards is a page nobody can cut up. */
const MAX_COLUMNS = 6;

/** And more than this many columns of words is a page nobody can write on. */
const MAX_WORD_COLUMNS = 4;

/**
 * As many pairs as a matching sheet may ask for.
 *
 * A cap of its own because the supply is the *spellings* rather than the words,
 * and thirty lines joined across one page is a tangle rather than an exercise.
 */
const MAX_MATCHES = 12;

/**
 * How many words a family needs before it is a family.
 *
 * Two, because a rime with one word behind it is not a pattern — it is a word.
 * A sheet printing "b + ecause = because" under the heading "word families"
 * would be teaching the opposite of what the exercise is for.
 */
const MIN_FAMILY = 2;

/** What goes between the sounds of a word that is being said slowly. */
const BLEND_JOIN = " · ";

/**
 * A split vowel as it is printed: `a-e`, not `a_e`.
 *
 * The underscore is the table's own notation for "the consonant goes here", and
 * it cannot survive onto a sheet for two separate reasons. It reads as a blank
 * to fill in, which is the opposite of what it means; and `Problem.prompt` uses
 * a single `_` to mark where the answer goes, so a prompt carrying one would
 * have a ruled slot drawn through the middle of a spelling.
 */
export const graphemeText = (grapheme: string): string =>
  grapheme.replace("_", "-");

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/* ── The inventory ─────────────────────────────────────────────────────── */

/**
 * The sounds this sheet may use, made safe first.
 *
 * Through `readInventory` on every build rather than once at a door, because
 * there is no door: a config arrives from a saved sheet, from a link, or from
 * the builder, and only one of those has been anywhere near a validator. It
 * drops what this build no longer teaches instead of refusing, so a sheet made
 * before a spelling was retired prints a narrower page rather than none.
 */
export const inventoryOf = (config: PhonicsConfig): Inventory =>
  readInventory(config.inventory);

/** The marks a config asks for, and nothing a saved one may have invented. */
const markingOf = (config: PhonicsConfig): PhonicsMarking => {
  const asked = config.marking ?? {};
  return {
    macron: asked.macron === true,
    silent: asked.silent === true,
    joined: asked.joined === true,
  };
};

/* ── Word families ────────────────────────────────────────────────────────
   Derived from the bank rather than authored, and that is safe here in a way
   it would not be in `words/bank.ts`: a rime is a fact about the cut, and the
   cuts were made by hand. `cat` is `c` + `at` because somebody wrote down that
   `cat` is `c a t`, not because anything here decided where a word divides.  */

type Family = {
  /** The letters a child adds. */
  onset: string;
  /** The letters they are added to. */
  rime: string;
  /** What the two make. */
  word: string;
  /** The rime as spellings rather than as letters — see `familiesOf`. */
  key: string;
};

const isVowel = (part: string): boolean => {
  const sound = CORRESPONDENCE_BY_ID.get(part)?.phonemes[0];
  return sound !== undefined && PHONEME_BY_ID.get(sound)?.kind === "vowel";
};

/**
 * A word split where its rime begins: every consonant spelling at the front,
 * and everything from the first vowel onwards.
 *
 * Nothing at all for the words that cannot be split that way, and there are
 * three kinds. A word starting on its vowel (`at`, `up`) has no onset to add.
 * A word with no vowel spelling in it is not a word this can reason about. And
 * a word whose rime holds a split vowel (`cake`) has a rime whose letters are
 * not next to each other, so `a_e` + `k` is not "ake" — printing it as though
 * it were would be a spelling sum that does not add up.
 */
function splitWord(entry: Word): Family | undefined {
  const at = entry.parts.findIndex(isVowel);
  if (at < 1) return undefined;

  const letters = (parts: string[]): string | undefined => {
    const out: string[] = [];
    for (const part of parts) {
      const grapheme = CORRESPONDENCE_BY_ID.get(part)?.grapheme;
      if (grapheme === undefined || grapheme.includes("_")) return undefined;
      out.push(grapheme);
    }
    return out.join("");
  };

  const onset = letters(entry.parts.slice(0, at));
  const rime = letters(entry.parts.slice(at));
  if (onset === undefined || rime === undefined) return undefined;
  // The two halves have to spell the word back. They do for everything the
  // guards above let through; checking it anyway is what stops a future cut
  // from quietly printing a sum whose answer is a different word.
  if (`${onset}${rime}` !== entry.word) return undefined;
  return {
    onset,
    rime,
    word: entry.word,
    key: entry.parts.slice(at).join("|"),
  };
}

/**
 * The families a child can read, each one a rime with the words behind it.
 *
 * Grouped by the rime's **spellings** and not by its letters, which is the same
 * distinction the whole model turns on: `be` and `the` end in the same letter
 * and not in the same sound, and a family sheet that put them in one group
 * would be teaching a rhyme that isn't one.
 *
 * Sight words never reach here, and that is not the `tricky` list being
 * overruled: a word is in a family because it can be *built* out of an onset
 * and a rime, and `said` is readable by a child who was taught it whole while
 * still not being `s` + `aid`.
 */
export function familiesOf(inventory: Inventory): Map<string, Family[]> {
  const taught = new Set(inventory.sounds);
  const groups = new Map<string, Family[]>();
  for (const entry of WORDS) {
    if (!entry.parts.every((part) => taught.has(part))) continue;
    const split = splitWord(entry);
    if (!split) continue;
    const found = groups.get(split.key);
    if (found) found.push(split);
    else groups.set(split.key, [split]);
  }
  for (const [key, words] of groups)
    if (words.length < MIN_FAMILY) groups.delete(key);
  return groups;
}

/* ── The page ──────────────────────────────────────────────────────────── */

/** The styles that are a list down the page rather than a grid across it. */
const DOWN_THE_PAGE = new Set<PhonicsStyle>(["matching", "sentences"]);

/** The styles that print a card rather than a line of type. */
const CARDED = new Set<PhonicsStyle>(["cards", "chart", "sentences"]);

/** And the ones a sheet is marked out of — the four that withhold an answer. */
const MARKED = new Set<PhonicsStyle>([
  "blending",
  "families",
  "matching",
  "dictation",
]);

/** Whether this style's answer key says anything its sheet doesn't. */
export const phonicsKeyed = (style: PhonicsStyle): boolean => MARKED.has(style);

/**
 * How many lines the longest sentence in the bank wraps onto.
 *
 * Over the whole bank rather than over the sentences that were drawn, because
 * the reservation is made before the draw: a strip height that depended on the
 * seed would be a layout that disagreed with its own arithmetic from one sheet
 * to the next. It over-reserves on a page whose longest sentence stayed in the
 * bank, which is the cheap side to be wrong on (`chrome.ts`).
 */
function stripRows(config: PhonicsConfig, box: Box): number {
  if (box.width <= 0) return 1;
  const longest = SENTENCES.reduce(
    (most, sentence) => Math.max(most, sentenceLength(sentence)),
    0,
  );
  return Math.max(
    1,
    Math.ceil(
      declaredWidth("x".repeat(longest), config, STRIP_BIG_EMS) / box.width,
    ),
  );
}

/**
 * How much of the page one item of this style takes, and how many fit.
 *
 * Arithmetic rather than measurement, so a unit test, a catalog page built at
 * build time and the builder's live preview all get the same answer (§4).
 */
export function phonicsLayout(config: PhonicsConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print rather than the one the config
  // holds, and with the score box where there is one. Reserving for the wrong
  // header is a last row below the bottom margin — invisible on screen, and a
  // second sheet out of the printer.
  const style = styleOf(config);
  const box = sheetBlockBox(headerOf(config), MARKED.has(style));
  const columns = DOWN_THE_PAGE.has(style)
    ? 1
    : clamp(config.columns ?? 1, 1, phonicsColumns(style));
  const em = (rows: number): Mil => points(config.fontPt * rows);

  const row =
    style === "matching"
      ? em(MATCH_ROW_EMS)
      : style === "sentences"
        ? em(cardRowEms(STRIP_BIG_EMS, stripRows(config, box), false))
        : style === "cards" || style === "chart"
          ? em(cardRowEms(CARD_BIG_EMS, 1, true))
          : em(ROW_EMS);

  // A matching block draws its own rows one under another with nothing between
  // them, so there is no gap to pay for; a strip is a list, and everything else
  // is the grid every family lays its problems out in.
  const gap =
    style === "matching" ? 0 : style === "sentences" ? LIST_GAP : PROBLEM_GAP.y;

  return {
    box,
    columns,
    cell: columnWidth(box, columns, PROBLEM_GAP.x),
    row,
    perPage: columns * fitAcross(box.height, row, gap),
  };
}

/**
 * How many items this style has to offer, before the paper is asked.
 *
 * Read at seed zero for the two that draw from a shuffled pool, because the
 * *size* of that pool is what is wanted and a shuffle does not change it. Which
 * means the count in `describe` and the count on the paper are one number: a
 * line promising twenty over a page of fourteen would be wrong in the record
 * book and in the picker at once.
 */
export function phonicsSupply(config: PhonicsConfig): number {
  const inventory = inventoryOf(config);
  switch (styleOf(config)) {
    case "cards":
    case "chart":
      return taughtSounds(inventory).length;
    case "matching":
      // Distinct *letters*, because that is what the left column holds — see
      // `matchingOf`, where `th` is two sounds and one row.
      return Math.min(
        MAX_MATCHES,
        new Set(taughtSounds(inventory).map((entry) => entry.grapheme)).size,
      );
    case "families":
      return [...familiesOf(inventory).values()].reduce(
        (total, words) => total + words.length,
        0,
      );
    case "sentences":
      return pickSentences(inventory, SENTENCES.length, 0).length;
    default:
      return wordPool(config, 0).length;
  }
}

/** How many items this sheet will hold: what was asked for, or what fits. */
const wantedOf = (config: PhonicsConfig): number =>
  clamp(
    config.count ?? Number.MAX_SAFE_INTEGER,
    0,
    Math.min(phonicsLayout(config).perPage, phonicsSupply(config)),
  );

/* ── What goes on it ───────────────────────────────────────────────────── */

/** A spelling over the word it is in — a card, and a line of the wall chart. */
function cardOf(entry: Correspondence, marking: PhonicsMarking): SoundCard {
  // The table's own example, chosen so the sound is unmistakable when it is
  // said aloud. Marked like everything else where the bank has a cut for it,
  // and printed plainly where it hasn't — `measure` and `giant` are examples
  // this build can name and has never cut.
  const example = WORD_BY_SPELLING.get(entry.example);
  return {
    big: markGrapheme(entry, marking),
    small: example ? markWord(example, marking) : [{ text: entry.example }],
  };
}

/**
 * A word cut into its spellings, to be said slowly and then quickly.
 *
 * The prompt is the segmentation, which is why nothing on a blending line is
 * ever *marked*: cutting the word up carries the same information a join would,
 * and a sheet that did both would be telling a child twice.
 */
const blendingOf = (entry: Word): Problem => ({
  prompt: entry.parts
    .map((part) =>
      graphemeText(CORRESPONDENCE_BY_ID.get(part)?.grapheme ?? part),
    )
    .join(BLEND_JOIN),
  answer: entry.word,
});

/** A beginning, an ending, and the word they make. */
const familyOf = (family: Family): Problem => ({
  prompt: `${family.onset} + ${family.rime} =`,
  answer: family.word,
});

/** A ruled line and nothing to read — the word arrives through the ear. */
const dictationOf = (entry: Word): Problem => ({
  prompt: "",
  answer: entry.word,
});

/** A sentence on a strip, big enough to read across a room. */
const stripOf = (sentence: Sentence, marking: PhonicsMarking): SoundCard => ({
  big: markSentence(sentence, marking),
});

/**
 * The words a word sheet draws from, in the order the seed put them.
 *
 * One place rather than two, because `phonicsSupply` asks how many there are
 * and `bodyOf` asks which ones — and a second copy of the options would be a
 * second answer to "does this sheet allow sight words".
 */
function wordPool(config: PhonicsConfig, seed: number): Word[] {
  return pickWords(
    inventoryOf(config),
    {
      count: WORDS.length,
      ...(config.focus ? { focus: config.focus } : {}),
      // A dictation line is the one place a sight word belongs — it is read
      // out rather than sounded out, which is exactly how `said` is taught.
      ...(styleOf(config) === "dictation" ? { tricky: true } : {}),
    },
    seed,
  );
}

/**
 * The spellings on the left and a word each on the right.
 *
 * **Every word on the right contains exactly one of the spellings on the
 * left**, which is what makes the key the only possible answer rather than the
 * one the generator happened to mean. A sheet with `s` and `sh` down one side
 * and `shop` down the other has two lines a child could defensibly draw, and
 * the honest fix is not to print that sheet: a spelling with no word that
 * avoids the others is dropped rather than paired with an ambiguous one.
 *
 * **The left column is letters, not correspondences**, and this is the one
 * place in the family where that is the right unit. `th` is two tick boxes —
 * `thin` and `this` are different sounds — but they are one thing on paper, and
 * a sheet printing `th` twice down the left would be asking a child to tell two
 * identical lines apart. So the column is deduplicated by its letters and a
 * word is excluded when it holds *any* sound those letters make.
 *
 * Nothing here is marked either, and for the reason a blending line isn't — a
 * joined `sh` inside `shop` would print the answer beside the question.
 */
function matchingOf(
  inventory: Inventory,
  count: number,
  seed: number,
): { left: string[]; right: string[]; answer: number[] } {
  const rand = mulberry32(seed);
  // Fully decodable words only. `decodable` would let a sight word through —
  // `said` is readable by a child who was taught it whole — and a word on this
  // sheet is one whose spellings are being pointed at.
  const taught = new Set(inventory.sounds);
  const readable = WORDS.filter((entry) =>
    entry.parts.every((part) => taught.has(part)),
  );

  const graphemeOf = (part: string): string =>
    CORRESPONDENCE_BY_ID.get(part)?.grapheme ?? part;
  const holds = (word: string, letters: string): boolean =>
    (WORD_BY_SPELLING.get(word)?.parts ?? []).some(
      (part) => graphemeOf(part) === letters,
    );

  // Built a row at a time rather than chosen and then filled, because the
  // exclusivity runs both ways: a spelling can only join the sheet if a word
  // exists that avoids everything already on it *and* nothing already on it
  // holds the new spelling. Choosing ten and then looking for words would
  // print seven rows and throw three away, which is a shorter sheet for no
  // reason. Every candidate is tried once, so this terminates.
  const pairs: Array<{ grapheme: string; word: string }> = [];
  const chosen = new Set<string>();
  const used = new Set<string>();
  for (const entry of shuffled(taughtSounds(inventory), rand)) {
    if (pairs.length === count) break;
    const grapheme = entry.grapheme;
    if (chosen.has(grapheme)) continue;
    if (pairs.some((pair) => holds(pair.word, grapheme))) continue;

    const word = shuffled(readable, rand).find(
      (candidate) =>
        !used.has(candidate.word) &&
        candidate.parts.some((part) => graphemeOf(part) === grapheme) &&
        // The exclusivity that makes the key unique: no *other* spelling on
        // this sheet may be in the word as well.
        candidate.parts.every((part) => {
          const letters = graphemeOf(part);
          return letters === grapheme || !chosen.has(letters);
        }),
    );
    if (!word) continue;
    chosen.add(grapheme);
    used.add(word.word);
    pairs.push({ grapheme, word: word.word });
  }

  // The right column is shuffled and the left is not, exactly as `study.ts`
  // does it: a matching sheet whose columns line up is a sheet a child can
  // answer with a ruler.
  const right = shuffled(
    pairs.map((pair) => pair.word),
    rand,
  );
  return {
    left: pairs.map((pair) => graphemeText(pair.grapheme)),
    right,
    answer: pairs.map((pair) => right.indexOf(pair.word)),
  };
}

function bodyOf(
  config: PhonicsConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const inventory = inventoryOf(config);
  const marking = markingOf(config);
  const { columns } = phonicsLayout(config);
  const style = styleOf(config);
  const wanted = wantedOf(config);

  if (CARDED.has(style)) {
    const cards =
      style === "sentences"
        ? pickSentences(inventory, wanted, seed).map((sentence) =>
            stripOf(sentence, marking),
          )
        : // The chart keeps the table's own order, because a chart is read down
          // a wall and that order is what makes it readable — the consonants,
          // then the vowels, each grapheme's sounds together. Cards are
          // shuffled, so a pack of twelve out of forty is a different twelve on
          // the next seed.
          (style === "chart"
            ? taughtSounds(inventory)
            : shuffled(taughtSounds(inventory), mulberry32(seed))
          )
            .slice(0, wanted)
            .map((entry) => cardOf(entry, marking));
    return {
      blocks: [
        {
          kind: "cards",
          columns,
          cards,
          bigEms: style === "sentences" ? STRIP_BIG_EMS : CARD_BIG_EMS,
          boxed: style !== "chart",
        },
      ],
      outOf: 0,
    };
  }

  if (style === "matching") {
    const block = matchingOf(inventory, wanted, seed);
    return {
      blocks: [{ kind: "matching", ...block }],
      outOf: block.left.length,
    };
  }

  if (style === "families") {
    // One word from each family before a second from any, so a page of twelve
    // is twelve rimes rather than four rimes three times over — which is the
    // shape a word-family sheet is set in, and the reason the draw is over the
    // groups rather than over the words.
    const rand = mulberry32(seed);
    const families = familiesOf(inventory);
    const rimes = shuffled([...families.keys()], rand);
    const pool = rimes.flatMap((key) =>
      shuffled(families.get(key) ?? [], rand),
    );
    const items = pool.slice(0, wanted).map(familyOf);
    return {
      blocks: [{ kind: "problems", columns, items }],
      outOf: items.length,
    };
  }

  const items = wordPool(config, seed)
    .slice(0, wanted)
    .map(style === "dictation" ? dictationOf : blendingOf);
  return {
    blocks: [{ kind: "problems", columns, items }],
    outOf: items.length,
  };
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<PhonicsStyle, string> = {
  cards: "Sound cards",
  chart: "Sounds we know",
  blending: "Say it slowly, then say it fast",
  families: "Word families",
  matching: "Sounds and words",
  dictation: "Dictation",
  sentences: "Sentences to read",
};

const INSTRUCTION: Record<PhonicsStyle, string> = {
  cards:
    "Cut out the cards. Say the sound the letters make, then read the word underneath.",
  chart:
    "The sounds we know so far. Say each one, and read the word beside it.",
  blending:
    "Say each sound on its own, then say them together. Write the word on the line.",
  families: "Add the beginning to the ending and write the word they make.",
  matching: "Join each spelling to the word that has it in.",
  dictation: "Write each word as it is read out.",
  sentences: "Read each sentence aloud. Cut them out to keep.",
};

/** What this style is counting, said the way it reads in a sentence. */
const THINGS: Record<PhonicsStyle, [one: string, many: string]> = {
  cards: ["card", "cards"],
  chart: ["sound", "sounds"],
  blending: ["word", "words"],
  families: ["word", "words"],
  matching: ["pair", "pairs"],
  dictation: ["word", "words"],
  sentences: ["sentence", "sentences"],
};

/**
 * The style this config will print in.
 *
 * Never throws, for the reason `sheetSpec` doesn't: the id arrives from a saved
 * sheet or from a link somebody was sent, and a page that prints something is
 * worth more than an exception inside a build.
 */
const styleOf = (config: PhonicsConfig): PhonicsStyle =>
  Object.hasOwn(TITLE, config.style) ? config.style : "blending";

/**
 * The header this sheet will actually print.
 *
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page. `config.title` is an override
 * and is usually absent — a family names its own sheet.
 */
function headerOf(config: PhonicsConfig): SheetOptions {
  const style = styleOf(config);
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? TITLE[style],
    instructions: config.instructions ?? INSTRUCTION[style],
  };
}

/** One line naming what the sheet holds, in the terms it was chosen by. */
export function describePhonics(config: PhonicsConfig): string {
  const style = styleOf(config);
  const [one, many] = THINGS[style];
  const asked = wantedOf(config);
  const sounds = inventoryOf(config).sounds.length;
  return [
    TITLE[style],
    `${asked} ${asked === 1 ? one : many}`,
    `${sounds} ${sounds === 1 ? "sound" : "sounds"} taught`,
  ].join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

export function buildPhonicsSheet(config: PhonicsConfig, seed: number): Sheet {
  const head = headerOf(config);
  const { blocks, outOf } = bodyOf(config, seed);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // Only the four styles that withhold an answer are marked out of
      // anything. A page of cards to cut out has no score, and "___ / 20" over
      // a wall chart would be a box nobody can fill in.
      ...(outOf > 0 ? { score: { outOf } } : {}),
    },
    blocks,
    // The jungle: phonics is the reading half of the word world, and a child
    // who has just blended twenty words on paper is the one likeliest to run
    // the race that reads them aloud (§16).
    footer: { credit: SHEET_CREDIT, url: gameUrl("jungle"), seed },
    answers: false,
  };
}

export const PHONICS_SHEET: SheetSpec<PhonicsConfig> = {
  id: "phonics",
  label: "Phonics",
  world: SHEET_WORLD,
  build: buildPhonicsSheet,
  // Every answer was decided when the sheet was built — which words were drawn,
  // which spelling each was paired with, which column it landed in — so a key
  // cannot disagree with the sheet it belongs to. On the three styles that
  // withhold nothing it is the same page twice, which is why `phonicsKeyed`
  // exists for the pages that have to decide whether to print one.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describePhonics,
};

/** Every style, for a picker and for the catalog. */
export const PHONICS_STYLES = Object.keys(TITLE) as PhonicsStyle[];

/** What a style is called, in the words it is chosen by. */
export const phonicsStyleLabel = (style: PhonicsStyle): string => TITLE[style];

/**
 * How many columns this style can honestly be laid out in.
 *
 * Out of the engine rather than named in the option panel, so a style laid out
 * down the page cannot get a stepper that moves a number the paper ignores.
 */
export const phonicsColumns = (style: PhonicsStyle): number =>
  DOWN_THE_PAGE.has(style)
    ? 1
    : style === "cards" || style === "chart"
      ? MAX_COLUMNS
      : MAX_WORD_COLUMNS;
