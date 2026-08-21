/**
 * The phonics sheets the Print Shop has set, and the words that go round them.
 *
 * **One page per kind of sheet, and that is the whole shelf.** §8 asks for the
 * catalog to be bounded, and phonics is where being greedy would be easiest:
 * "short a worksheets", "sh worksheets" and forty more are all real queries,
 * and every one of them is a sheet on this shelf with one spelling ticked.
 *
 * ── The sounds on these pages are not a course ─────────────────────────────
 *
 * Every sheet has to be built from *some* inventory, and the two below are the
 * smallest honest ones. Neither is a stage, a level or a lesson: shipping one
 * of those would reproduce somebody's copyrighted sequence by reference (§13).
 * They say what *this sheet* uses and nothing more.
 *
 * **One stock, as with maths, spelling and grammar** (§8): nothing on a phonics
 * sheet is a measurement.
 */
import { FIRST_LETTERS } from "@/games/printshop/defaults";
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import { phonicsKeyed } from "@/engine/sheets/phonics/sheets";
import type { Inventory } from "@/engine/sheets/phonics";
import type { PhonicsConfig, PhonicsStyle } from "@/engine/sheets/types";

import { SHEET_FIELDS as FIELDS, benchHref, paperOf, shelve } from "./_catalog";

/** How the hub groups the shelf: the sounds, and then reading with them. */
export type PhonicsGroup = "sounds" | "words";

export type PhonicsSheet = {
  /** The route under /printables/phonics, and the head term it answers. */
  slug: string;
  /** How it is listed on a hub. */
  name: string;
  /** How it is labelled in the row of neighbouring sheets. A few words. */
  short: string;
  /** The page's `<h1>`. */
  heading: string;
  /** The query this page exists to answer, in the words a parent types. */
  keyword: string;
  /** One sentence of what is on the sheet. Used in the description and hubs. */
  summary: string;
  /** The lead paragraph: what the sheet asks for, stated plainly. */
  lead: string;
  /**
   * Two things that are true of this sheet and not of the one beside it.
   *
   * The sheet is prerendered directly under this prose (§8), so a quoted
   * sentence is a claim about the paper rather than an illustration.
   * `_phonics.test.ts` holds anything quoted at five words or more to that; a
   * hypothetical the sheet never prints stays shorter than that.
   */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: PhonicsGroup;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: PhonicsConfig;
};

/**
 * The seed every sheet on this shelf is built from, and it never moves. It
 * decides which words and sentences land on each page and in what order, which
 * is what §7 promises stays put: the sheet a parent printed in March is the
 * sheet they print in June, down to the order of the lines.
 */
export const PHONICS_SEED = 1;

/**
 * `the`, taught whole — on both inventories below, and not a shortcut. Nearly
 * every decodable sentence in English needs it, it cannot be sounded out by a
 * child who has not met `th` and the unstressed `e`, and every programme
 * teaches it by sight in the first weeks. `Inventory.tricky` is the door for
 * that.
 */
const SIGHT = ["the"];

/** One sound for each letter of the alphabet — see the header. */
const LETTERS: Inventory = { sounds: FIRST_LETTERS, tricky: SIGHT };

/**
 * The same, plus the consonant digraphs and the doubled letters.
 *
 * `th` twice, because `thin` and `this` are two sounds behind one spelling and
 * a child who can read one cannot necessarily read the other — which is the
 * distinction the whole model turns on, and the reason a wall chart built from
 * this list has two `th` cards on it.
 */
const WITH_DIGRAPHS: Inventory = {
  sounds: [
    ...FIRST_LETTERS,
    "sh:sh",
    "ch:ch",
    "th:th",
    "th:dh",
    "wh:w",
    "ck:k",
    "ng:ng",
    "ll:l",
    "ss:s",
    "ff:f",
    "zz:z",
    "e:uh",
  ],
  tricky: SIGHT,
};

/** A phonics sheet on Letter, with the name and date line printed blank. */
const phonics = (
  style: PhonicsStyle,
  inventory: Inventory,
  count: number,
  columns = 1,
  extra: Partial<PhonicsConfig> = {},
): PhonicsConfig => ({
  kind: "phonics",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields: FIELDS,
  style,
  inventory,
  marking: {},
  count,
  columns,
  ...extra,
});

export const PHONICS_SHEETS: PhonicsSheet[] = [
  /* ── The sounds themselves ──────────────────────────────────────────── */
  {
    slug: "phonics-sound-cards",
    name: "Sound cards",
    short: "Sound cards",
    heading: "Printable phonics sound cards",
    keyword: "Free printable phonics sound cards",
    summary:
      "One card for each letter of the alphabet, with the sound it makes and a word it is in, laid out to cut apart along the dashed guides.",
    lead: "Twenty-six cards to cut out: the letter large enough to read across a table, and underneath it a word that letter is in. Cut once down the guides and once across, and the pack is done.",
    notes: [
      "The word under each letter is a reminder rather than something to decode, and it is the word the sound table itself keeps — “cat” sits under the “a” and “box” under the “x” — so it is not always a word the letter starts, and one word can turn up under two cards. A child three days into phonics cannot read “fan”, and is not being asked to: it is there so that whoever is holding the card can say the sound rather than the letter name, which is the single commonest thing to get wrong when teaching this at home. The letter says /f/; it is called “eff”; the card is about the first of those.",
      "Cards for the digraphs are one setting away rather than on this page. Tick “sh”, “ch” and “th” in the builder and they join the pack — and “th” arrives as two cards, because the sound at the front of “thin” and the sound at the front of “this” are two different things a child has to learn separately, however identical they look on paper.",
    ],
    teaches: "Letter sounds",
    ages: "Ages 4–6",
    group: "sounds",
    config: phonics("cards", LETTERS, 26, 4, { cutLines: true }),
  },
  {
    slug: "phonics-sounds-chart",
    name: "“Sounds we know” wall chart",
    short: "Sounds chart",
    heading: "Printable phonics sounds chart",
    keyword: "Free printable phonics sounds chart",
    summary:
      "Every sound covered so far on one page for the wall — the alphabet and the consonant digraphs, each with a word it is in.",
    lead: "The card pack plus the consonant digraphs, laid out as one page to pin up: every spelling in the order the sound table teaches them, each with a word it is in beside it. It is a record of where a child has got to rather than a poster of the whole language.",
    notes: [
      "A chart of what has actually been taught is worth more than a chart of everything, and it is the reason this page exists at all. A wall covered in sounds a child has not met is a wall they learn to stop looking at; a chart that grows by one row a week is one they can point at. Reprint it whenever the list changes — the sounds on it are a setting, and the sheet takes a second.",
      "The two “th” rows are not a mistake. One is the sound at the front of “thin” and the other the sound at the front of “this”, and no rule in English tells a child which of them a “th” is going to be. Every other spelling that says more than one thing is on the chart twice for the same reason, which is what makes it a chart of sounds rather than of letters.",
    ],
    teaches: "The letter-sound correspondences taught so far",
    ages: "Ages 4–7",
    group: "sounds",
    // Every sound on the list, which is what a "sounds we know" chart is: the
    // count is the length of `WITH_DIGRAPHS` rather than a number, so adding a
    // spelling to that list cannot leave the last row off the wall.
    config: phonics("chart", WITH_DIGRAPHS, WITH_DIGRAPHS.sounds.length, 6),
  },

  /* ── Reading and writing with them ──────────────────────────────────── */
  {
    slug: "cvc-words-worksheets",
    name: "CVC words — say it slowly",
    short: "CVC words",
    heading: "CVC words worksheets",
    keyword: "Free printable CVC words worksheets",
    summary:
      "Twenty short words printed as the sounds they are made of, with a line to write the whole word on — and the answer key on the page behind.",
    lead: "Each line is one word cut into its sounds, spaced apart. A child says each sound on its own, says them again quickly until they hear the word, and writes it on the line. That is the whole of blending, and it is the step everything else in reading waits for.",
    notes: [
      "Every word here is three sounds at most, and every spelling in it is a single letter of the alphabet — no “sh”, no silent “e”, no vowel team. That is what makes it a CVC sheet rather than a list of short words, and both halves of it matter: a child who is still blending three sounds and meets a fourth has been set up to fail at the thing they were doing correctly. The counting is in sounds and not in letters, which is the only way to count it: “box” is three letters and four sounds and is off this page, while “ship” is four letters and three sounds and would be perfectly at home on a page where “sh” had been taught. A two-sound word turns up now and again — “on”, “up” — and it is the same exercise with one sound fewer.",
      "The sounds are printed rather than said, and the separation is the exercise. Reading “sat” as one shape is a thing a child can do by memory long before they can read “sap”; reading it as /s/ /a/ /t/ is a thing that works on every word they will ever meet. Cover the line with a finger, do the sounds twice, and only then write it.",
    ],
    teaches: "Blending sounds into words",
    ages: "Ages 4–6",
    group: "words",
    // Three sounds at most, which is the whole of what "CVC" names — and the
    // one page on the shelf that says how long a word may be. `maxSounds`
    // counts sounds rather than letters, so `box` is out at four and `ship`
    // would be in at three if the digraph were ever ticked here.
    config: phonics("blending", LETTERS, 20, 2, { maxSounds: 3 }),
  },
  {
    slug: "word-family-worksheets",
    name: "Word families",
    short: "Word families",
    heading: "Word family worksheets",
    keyword: "Free printable word family worksheets",
    summary:
      "Twenty spelling sums — a beginning added to an ending, with the word they make written on the line, and the key on the page behind.",
    lead: "A beginning, a plus sign and an ending, with a line for the word. Changing one sound at the front of a word a child can already read is the cheapest reading practice there is, and it is where a first reader gets their first hundred words.",
    notes: [
      "The endings on this page are not chosen from a list — they are the endings the words a child can read happen to share, which is why a family only appears when there are at least two words behind it. A sheet with one word in a family is not teaching a pattern, it is teaching a word, and there is a better sheet for that.",
      "Beginnings here include the two- and three-letter clusters as well as single letters, and that is where the page earns its second half. Going from “c + at” to “fl + at” means holding two sounds together before the ending arrives, which is the step a child stalls on for months after single letters have become easy.",
    ],
    teaches: "Onset and rime, and building words from a pattern",
    ages: "Ages 5–7",
    group: "words",
    config: phonics("families", WITH_DIGRAPHS, 20, 2),
  },
  {
    slug: "letter-sounds-matching-worksheets",
    name: "Match the sound to the word",
    short: "Sound matching",
    heading: "Letter sounds matching worksheets",
    keyword: "Free printable letter sounds matching worksheets",
    summary:
      "Ten spellings down one side and ten words down the other, to join with a pencil — and the key behind, with the lines drawn in.",
    lead: "A spelling on the left, a word on the right, and a line to draw between them. Every word on the page contains exactly one of the spellings listed, which is what makes it a question with a single right answer rather than a puzzle with two.",
    notes: [
      "That exclusivity took more discarding than choosing. If “s” and “sh” are both on the sheet then “shop” cannot be on it, because a child who joins “s” to “shop” has read the page correctly and would be marked wrong. A spelling with no word that avoids the others is simply left off, which is why some sheets come out with nine lines rather than ten.",
      "The letters on the left are letters rather than sounds, and that is deliberate on this one sheet. “th” says two different things and is two tick boxes everywhere else in the Print Shop; printing it twice down this column would be two identical lines a child could not choose between. So the column is the spellings, once each, and the words behind them do the rest.",
    ],
    teaches: "Finding a taught spelling inside a word",
    ages: "Ages 5–7",
    group: "words",
    config: phonics("matching", WITH_DIGRAPHS, 10),
  },
  {
    slug: "phonics-dictation-worksheets",
    name: "Dictation",
    short: "Dictation",
    heading: "Phonics dictation worksheets",
    keyword: "Free printable phonics dictation worksheets",
    summary:
      "Twenty numbered lines and nothing to read — the words are on the answer key, for whoever is reading them out.",
    lead: "The page a child gets has numbers and rules on it and nothing else. The words are on the sheet behind, in order, for the person reading them aloud. Writing a word you have only heard is the other half of phonics, and it is the half a worksheet usually skips.",
    notes: [
      "Read each word twice, in a normal voice, and then leave it alone. The temptation is to sound it out for them — /c/ /a/ /t/ — and that turns the exercise into copying: the work is the child doing the segmenting themselves, and it is uncomfortable to watch for the first few weeks.",
      "This is the one sheet on the shelf where a word taught by sight belongs. “Said” cannot be sounded out on any day of any course, so it never appears on a blending line — but it is read out and written down like everything else, which is exactly how every programme handles it. Add your own to the sight-word box in the builder.",
    ],
    teaches: "Writing words from the sounds in them",
    ages: "Ages 5–7",
    group: "words",
    config: phonics("dictation", WITH_DIGRAPHS, 20, 2),
  },
  {
    slug: "decodable-sentences-worksheets",
    name: "Decodable sentences",
    short: "Decodable sentences",
    heading: "Decodable sentences worksheets",
    keyword: "Free printable decodable sentences worksheets",
    summary:
      "Eight sentences printed large on strips to cut apart, with nothing in them a child has not been taught to read.",
    lead: "Connected text, at last — and every word in it spellable from the sounds on the chart. Cut the strips apart and a child reads one a day, or the whole page at once when a week has gone well.",
    notes: [
      "These are short and a little plain, and that is the honest cost of the promise. A sentence that reads more naturally is a sentence with a word in it the child has to be told, and being told one word in five is how a child learns that reading means guessing from the picture. Every word here is one they can work out.",
      "“The” is the exception, and it is on the sheet because English will not make a sentence without it. It is on the sight-word list rather than sounded out, which is where every programme puts it in the first fortnight — and it is the only word on this page that is not built from the spellings above.",
    ],
    teaches: "Reading connected text made only of taught spellings",
    ages: "Ages 5–7",
    group: "words",
    config: phonics("sentences", WITH_DIGRAPHS, 8, 1, { cutLines: true }),
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const PHONICS_GROUPS: Array<{
  id: PhonicsGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "sounds",
    label: "The sounds themselves",
    blurb: "Cards to cut out, and a chart of what has been covered so far.",
  },
  {
    id: "words",
    label: "Reading and writing with them",
    blurb:
      "Blending, word families, finding a spelling in a word, dictation, and sentences with nothing untaught in them.",
  },
];

/** Whether this sheet's answer key says anything its sheet doesn't. */
export const keyed = (sheet: PhonicsSheet): boolean =>
  phonicsKeyed(sheet.config.style);

/** The route a sheet prints at. One stock, so one route — see the note above. */
export const pathFor = (sheet: PhonicsSheet): string =>
  `/printables/phonics/${sheet.slug}`;

/** The builder, opened on this sheet. */
export const builderHref = (sheet: PhonicsSheet): string =>
  benchHref(sheet.config, PHONICS_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function phonicsShelf(): Array<{
  id: PhonicsGroup;
  label: string;
  blurb: string;
  sheets: PhonicsSheet[];
}> {
  return shelve(PHONICS_GROUPS, PHONICS_SHEETS);
}
