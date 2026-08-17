/**
 * The spelling and word-study sheets the Print Shop has set, and the words that
 * go round them.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two pages
 * share — `spelling/[slug].astro`, which prerenders one sheet per entry, and
 * `spelling/index.astro`, which is the subject hub — rather than a route of its
 * own. `_catalog.ts` does that job for paper, `_maths.ts` for maths and
 * `_handwriting.ts`, `_cursive.ts` and `_bible.ts` for the writing shelves.
 *
 * **The slugs are curated; the sheets are generated.** §8 is explicit about why.
 * Seven styles over any list a parent can type, times ten word-study topics in
 * three shapes of question, is a set with no bottom to it — so eighteen slugs,
 * each one a phrase somebody types into a search box, each with prose that is
 * true of that sheet and of no other, and everything else reached through the
 * builder, which is where *choosing* belongs.
 *
 * **Where the words come from.** Every spelling sheet here is set on one of the
 * six shipped Dolch lists, which is the point rather than a convenience: the
 * words a child races in the jungle are the words they write on paper, and the
 * age band on the list is what decides which page a parent lands on. A list of
 * their own is the same sheet with the box refilled — the builder's second
 * bootstrap, one press from every page on this shelf.
 *
 * **One stock, as with maths and unlike paper.** Nothing on a spelling sheet is
 * a measurement: there is no ⅝ rule to be scaled into a ⅗ rule by a printer
 * loaded with A4, so the sheet is correct on either stock and the A4 switch lives
 * in the builder with the other options. The one page here that *is* ruled — the
 * tracing sheet — says so and links to the handwriting shelf, which comes on
 * both.
 */
import { WORD_LISTS, listWords, type WordList } from "@/engine/decks/wordlists";
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type {
  SheetConfig,
  WordSheetStyle,
  WordStudyConfig,
  WordStudyStyle,
  WordStudyTopic,
  WordsConfig,
} from "@/engine/sheets/types";

import { SHEET_FIELDS as FIELDS, benchHref, paperOf, shelve } from "./_catalog";

/** How the hub groups the shelf: what the sheet is really about. */
export type SpellingGroup = "spelling" | "sight" | "study";

export type SpellingSheet = {
  /** The route under /printables/spelling, and the head term it answers. */
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
  /** Two things that are true of this sheet and not of the one beside it. */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: SpellingGroup;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: SheetConfig;
};

/**
 * The seed every sheet on this shelf is built from, and it never moves.
 *
 * On half of these it decides nothing — a list written out three times is the
 * list — and on the other half it decides which letters come out, which near
 * misses a word is printed against, and which twelve of the bank's questions
 * land. Which is exactly what §7 promises stays put: the sheet a parent printed
 * in March is the sheet they print in June, down to the gaps.
 */
export const SPELLING_SEED = 1;

/**
 * A shipped list, by id.
 *
 * Throws rather than falling back, and this is the one place in the shop where
 * that is right: it runs at build time over data in this repository, so a slug
 * naming a list that has been renamed is a broken page — and the honest moment
 * to find that out is the build rather than the morning a parent prints it.
 */
function listOf(id: string): WordList {
  const found = WORD_LISTS.find((list) => list.id === id);
  if (!found) throw new Error(`No shipped word list "${id}"`);
  return found;
}

/** The first `count` words of a shipped list, in the order it teaches them. */
const dolch = (id: string, count: number): string[] =>
  listWords(listOf(id)).slice(0, count);

/**
 * A spelling sheet on Letter, with the name and date line printed blank.
 *
 * The count follows the list rather than being set beside it: a catalog page
 * prints every word it names, and `_spelling.test.ts` is what holds it to that —
 * a list one word longer than the page holds is a sheet that silently teaches
 * nineteen of twenty words.
 */
const spelling = (
  style: WordSheetStyle,
  words: string[],
  over: Partial<WordsConfig> = {},
): WordsConfig => ({
  kind: "words",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields: FIELDS,
  style,
  words,
  times: 3,
  gaps: 2,
  columns: 2,
  count: words.length,
  ...over,
});

/** A word-study sheet: a topic, a shape of question, and how many. */
const study = (
  topic: WordStudyTopic,
  style: WordStudyStyle,
  count: number,
  columns = 1,
): WordStudyConfig => ({
  kind: "word-study",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields: FIELDS,
  topic,
  style,
  count,
  columns,
});

export const SPELLING_SHEETS: SpellingSheet[] = [
  /* ── Spelling a list ────────────────────────────────────────────────── */
  {
    slug: "spelling-practice-worksheets",
    name: "Spelling practice — write it three times",
    short: "Write it out",
    heading: "Spelling practice worksheets",
    keyword: "Free printable spelling practice worksheets",
    summary:
      "Twelve words to write out three times each on ruled lines — the oldest spelling exercise there is, on the words phonics stops helping with.",
    lead: "One word to a line, printed once to read and then three ruled lines to write it on. The words are the ones that stop yielding to sounding out at about six or seven — “could”, “know”, “once” — which is the point at which writing a word out starts being worth the time.",
    notes: [
      "Writing a word three times is not busywork if the word was chosen properly, and that is the whole difference between this page and a page of lines. A word that can be sounded out does not need to be written out; a word like “because” or “friend” has to be held in the hand until it comes back without thinking, and three goes is roughly where that starts. If a child is copying the model letter by letter rather than looking, cover it after the first line.",
      "The model at the start of the line is printed once and never repeated, which is deliberate. A sheet that prints the word at the head of every line is a tracing exercise wearing a spelling exercise's clothes — the eye never has to hold the word for more than a second. One model, three empty lines, and the last of the three is the one worth marking.",
    ],
    teaches: "Spelling high-frequency words",
    ages: "Ages 6–9",
    group: "spelling",
    config: spelling("copy", dolch("dolch-3", 12)),
  },
  {
    slug: "missing-letters-worksheets",
    name: "Missing letters",
    short: "Missing letters",
    heading: "Missing letters worksheets",
    keyword: "Free printable missing letters worksheets",
    summary:
      "Eighteen words with two letters taken out of each — never the first, and never two in a row — with the answer key on the page behind.",
    lead: "Each word is printed with two of its letters missing and a ruled gap where each one goes. The letters taken out are always inside the word rather than at the start of it, so there is a word to work from rather than a guessing game.",
    notes: [
      "Never the first letter, and never two in a row: those two rules are what make this an exercise rather than a puzzle. A child reading “_at” has a word to work from; a child reading “_ _ t” has a lottery. What is being practised is the middle of a word, which is where nearly every spelling mistake in English actually happens — the vowels a speaker cannot hear the difference between and the doubled consonants nobody sounds out.",
      "The words are the longer sight words, which is where the gaps do the most work. “Because”, “before”, “their” and “would” are all mis-spelt in the middle by the same children who can spell them aloud, and a gap in that exact position is a question they cannot answer by sounding it out. The answer key on the page behind prints the letters back in, so this can be marked by somebody who was not sitting next to them.",
    ],
    teaches: "Spelling patterns inside a word",
    ages: "Ages 6–9",
    group: "spelling",
    config: spelling("missing", dolch("dolch-4", 18), { gaps: 2 }),
  },
  {
    slug: "abc-order-worksheets",
    name: "ABC order",
    short: "ABC order",
    heading: "ABC order worksheets",
    keyword: "Free printable ABC order worksheets",
    summary:
      "Fifteen everyday words to put in alphabetical order, printed as a word bank with a numbered ruled line for each, and the ordered list as the key.",
    lead: "The words down the left are the bank, in no particular order; the ruled lines beside them are where the same words go in alphabetical order. Line one takes the word that comes first in the alphabet, whatever happens to be printed next to it.",
    notes: [
      "Alphabetical order is the first thing a child does with the alphabet that is not reciting it, and it is the skill behind every index, dictionary, register and contact list they will ever use. The words here are concrete nouns on purpose — a child sorting “apple”, “ball” and “bed” is thinking about letters rather than about what the words mean, and the two that share a first letter are where the real work is.",
      "Words sharing an initial are what make a sheet worth doing, so the list is chosen to have several of them. Getting from “ball” to “bed” means going to the second letter, which is the step most children have to be shown once and then never again. The answer key is the same fifteen words in order, so a parent can mark it by reading down one column.",
    ],
    teaches: "Alphabetical order",
    ages: "Ages 5–8",
    group: "spelling",
    config: spelling("abc", dolch("dolch-nouns", 15), { columns: 1 }),
  },
  {
    slug: "word-shapes-worksheets",
    name: "Word shapes",
    short: "Word shapes",
    heading: "Word shapes worksheets",
    keyword: "Free printable word shapes worksheets",
    summary:
      "Sixteen words to write into the outline their letters make — a tall box for a letter that reaches the top line, a small one for a letter that does not, and a dropped box for a tail.",
    lead: "Every word is drawn as a row of boxes, one per letter, and the height of each box is the height of the letter that goes in it. Writing the word into its own shape means deciding, letter by letter, whether it is tall, small, or hangs below the line.",
    notes: [
      "Word shapes are the reading scheme's answer to a child who knows all their sounds and still cannot spell, and they work because a word has a silhouette. “Bed” and “bad” are the same three sounds and a different picture; “light” has two tall letters at the front and a tail nowhere. A child who has drawn the shape a few times has a second way of checking a word that has nothing to do with sounding it out.",
      "The boxes are drawn as hairlines rather than as shaded blocks, which matters more here than it looks: browsers throw away background paint when printing unless somebody has found the “Background graphics” checkbox, and a word-shape sheet whose boxes were a tint comes out of the printer as an empty page. Everything on this sheet is a stroke, so it prints as it looks. The answer key writes each letter into its own box.",
    ],
    teaches: "Recognising the shape of a word",
    ages: "Ages 5–8",
    group: "spelling",
    config: spelling("shapes", dolch("dolch-3", 16)),
  },
  {
    slug: "spelling-sentence-worksheets",
    name: "Use it in a sentence",
    short: "In a sentence",
    heading: "Spelling sentence worksheets",
    keyword: "Free printable spelling sentence worksheets",
    summary:
      "Eight of the hardest sight words, each with two ruled lines to use it in a sentence of the child's own.",
    lead: "One word at the top of each group and two ruled lines under it. Nothing to copy: what goes on the lines is a sentence the child writes, using the word properly, with a capital at the front and a full stop at the end.",
    notes: [
      "A word is not learnt until it has been used, and this is the sheet that asks for that. A child can spell “together” in a test on Friday and still not put it in a sentence, and the gap between those two things is most of what a spelling list is for. It is also the page where handwriting, punctuation and spelling are being practised at once, which is why the lines are ruled rather than blank.",
      "There is no answer key on this one, and there should not be: a sentence a child wrote is not a thing that has a right answer printed somewhere. What a parent marks is whether the word is spelt correctly and used as the word actually means — which is worth a conversation rather than a tick, and is the reason this sheet is eight words long rather than twenty.",
    ],
    teaches: "Using spelling words in writing",
    ages: "Ages 7–10",
    group: "spelling",
    config: spelling("sentence", dolch("dolch-5", 8), { times: 2, columns: 1 }),
  },

  /* ── Sight words ────────────────────────────────────────────────────── */
  {
    slug: "sight-word-worksheets",
    name: "Sight words to write out",
    short: "Sight words",
    heading: "Sight word worksheets",
    keyword: "Free printable sight word worksheets",
    summary:
      "The first twelve sight words, each written out three times on ruled lines — the words that turn up most often and are least worth sounding out.",
    lead: "The first twelve words of the Dolch list, one to a line, each printed once and then written three times. These are the words a beginning reader meets most often and can least afford to stop at.",
    notes: [
      "A sight word is one worth knowing by sight rather than by sounding out, and the reason is arithmetic: a hundred or so words make up about half of everything a child reads, and a good many of them — “said”, “one”, “come”, “because” — do not say what their letters suggest. Time spent on these is worth several times the same time spent on a word a child could have worked out.",
      "Writing them is a different exercise from reading them, and this is the sheet that closes that gap. A child who recognises “away” instantly on a page can still stall when asked to write it, because recognising a word and producing it are two different pieces of memory. Three goes at each, with the model printed once, is what turns the first into the second.",
    ],
    teaches: "Writing first sight words",
    ages: "Ages 4–6",
    group: "sight",
    config: spelling("copy", dolch("dolch-1", 12)),
  },
  {
    slug: "sight-word-tracing-worksheets",
    name: "Sight words to trace",
    short: "Trace them",
    heading: "Sight word tracing worksheets",
    keyword: "Free printable sight word tracing worksheets",
    summary:
      "Twelve sight words on ⅝-inch handwriting paper, each traced once in dots and then written on an empty stretch of line.",
    lead: "One word to a line on ruled handwriting paper: a solid model to read, a dotted word to trace over, and then empty line to write it on. Spelling and handwriting in the same three minutes.",
    notes: [
      "Tracing before writing is the right order at this age and the wrong place to stop. A dotted word practises following a line; the empty stretch after it is where a child practises writing the word, and it is the part that teaches. This sheet is one line of each because that is what fits on ⅝-inch paper with room to write — the ruling is a real ⅝ of an inch, which is what a school means by handwriting paper.",
      "It is a handwriting sheet whose words happen to be a spelling list, which is why it is ruled and the rest of this shelf is not. That also means it comes on A4 as well as on US Letter, over on the handwriting shelf: a ruling shrunk to fit whatever is in the printer is no longer the size it was chosen for, and every ruled sheet here has a twin measured for the other stock.",
    ],
    teaches: "Tracing and writing sight words",
    ages: "Ages 4–6",
    group: "sight",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "words",
      words: dolch("dolch-2", 12),
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },
  {
    slug: "sight-word-find-worksheets",
    name: "Find the sight word",
    short: "Find it",
    heading: "Sight word find worksheets",
    keyword: "Free printable sight word find worksheets",
    summary:
      "Twelve sight words, each printed beside three words it is easily mistaken for, with the matching one to circle and the key behind.",
    lead: "The word is at the start of the line and four words follow it. One of them is the same word; the other three are the words this one gets confused with. Circle the one that matches.",
    notes: [
      "The three wrong answers are chosen rather than random, and that is the whole of the exercise. A word printed against three unrelated words is found by glancing at the first letter; a word printed against the words that start the same way or run to the same length has to actually be read. “There” against “their” and “these” is a question; “there” against “squirrel” is not.",
      "Picking a word out of a row of near misses is what reading a sentence actually asks of a child, which is why this is worth a page of its own. It is also the one sheet on this shelf that needs no writing at all, so it is a fair thing to hand to a child whose hand is tired — or to one who can read a word and is not yet ready to write it.",
    ],
    teaches: "Telling sight words apart",
    ages: "Ages 5–7",
    group: "sight",
    config: spelling("find", dolch("dolch-2", 12)),
  },

  /* ── Word study ─────────────────────────────────────────────────────── */
  {
    slug: "rhyming-words-worksheets",
    name: "Rhyming words",
    short: "Rhyming",
    heading: "Rhyming words worksheets",
    keyword: "Free printable rhyming words worksheets",
    summary:
      "Twelve words, each with four to choose from, and one of the four rhymes with it. The answer key is on the page behind.",
    lead: "A word at the start of each line and four words to choose between. One of them rhymes with it and the other three do not. Circle the one that does.",
    notes: [
      "Hearing that two words rhyme is the first piece of phonological awareness a child gets, and it comes before letters do: it is the skill that lets them notice that “cat” and “hat” differ at the front and are otherwise the same word, which is the whole idea a word family is built on. A child who cannot hear a rhyme yet is not ready for a spelling list, and this page is a fair way to find out.",
      "Every line comes from a different family of words, which is why the sheet is twelve lines rather than twenty. If two lines came from the same family, both of their answers would rhyme with both of their words — and a question with two right answers on it is worse than no question. Say the options aloud with a child who is guessing; a rhyme is a thing you hear rather than a thing you spot.",
    ],
    teaches: "Hearing rhyme",
    ages: "Ages 4–6",
    group: "study",
    config: study("rhyming", "choose", 12),
  },
  {
    slug: "syllable-worksheets",
    name: "Syllables",
    short: "Syllables",
    heading: "Syllable worksheets",
    keyword: "Free printable syllable worksheets",
    summary:
      "Twenty words to break into syllables, from one-beat words up to four, with the count written on a ruled line and the key behind.",
    lead: "Each word has a ruled slot beside it for how many syllables you can hear in it. Say the word, clap the beats, and write the number down — one for “bridge”, four for “caterpillar”.",
    notes: [
      "Counting syllables is what makes a long word writable. A child who tries to spell “caterpillar” in one go gets three letters in and stops; a child who has broken it into four beats has four short words to spell instead, and that is the actual technique behind spelling anything longer than about six letters. It is also how a dictionary breaks a word at the end of a line.",
      "Every word here is one whose count nobody argues about, which took some choosing. “Family”, “chocolate” and “every” are said with two syllables as often as three depending on who is speaking, so they are not on this sheet: a word whose answer depends on an accent is a word a child gets marked wrong for saying properly. Clap them out loud rather than counting the vowels — the ear is right more often than the spelling is.",
    ],
    teaches: "Breaking words into syllables",
    ages: "Ages 6–9",
    group: "study",
    config: study("syllables", "write", 20, 2),
  },
  {
    slug: "word-family-worksheets",
    name: "Word families",
    short: "Word families",
    heading: "Word family worksheets",
    keyword: "Free printable word family worksheets",
    summary:
      "Twenty-four sums to blend into words — a beginning, an ending, and the word the two make — across fourteen of the commonest word families.",
    lead: "Each line is an addition: a beginning sound, an ending, and a ruled slot for the word they make. “c + at” makes “cat”, and once that is seen, so do “h + at”, “m + at” and “fl + at”.",
    notes: [
      "A word family is the most economical thing in early reading: learn one ending and you can read every word that uses it. The child who works out “-op” has hop, mop, pop, top, drop, stop, shop and flop, which is eight words for the price of one — and blending a beginning onto an ending, rather than sounding out a word letter by letter, is the step that makes reading start to move.",
      "The beginnings include blends as well as single letters, and that is where this sheet earns its second half. Going from “c + at” to “fl + at” means holding two sounds together before the ending, which is the thing a child stalls on for months after single letters are easy. Every answer on this page is a real word — checked, because a sheet whose key contains “jat” teaches a child not to trust the sheet.",
    ],
    teaches: "Blending onsets and rimes",
    ages: "Ages 4–7",
    group: "study",
    config: study("families", "write", 24, 3),
  },
  {
    slug: "prefix-worksheets",
    name: "Prefixes",
    short: "Prefixes",
    heading: "Prefix worksheets",
    keyword: "Free printable prefix worksheets",
    summary:
      "Eighteen prefixes to add to the front of a word — un-, re-, dis-, pre-, mis- and more — with the new word written on a ruled line.",
    lead: "A beginning, a word, and a slot for what the two make. “un + happy” is “unhappy”, and once the pattern is visible a child can read and spell a hundred words they have never met.",
    notes: [
      "A prefix is the cheapest vocabulary a child will ever learn. Knowing that “un-” means not, “re-” means again and “dis-” means the opposite turns every root word they already have into two or three more, and it works in reverse too: a reader who meets “unfamiliar” for the first time can take the front off it and be nearly right. Four prefixes cover most of what turns up in primary reading.",
      "Nothing changes at the join, which is the whole reason prefixes come before suffixes. “un” plus “happy” is “unhappy” with both parts intact — no letter dropped, no letter doubled — so a child can trust the addition. That stops being true the moment an ending is added instead, which is what the suffix sheet is for. “mis + spell” is the one to look at twice: both s's stay, which is why “misspell” is the word people most often mis-spell.",
    ],
    teaches: "Prefixes and word building",
    ages: "Ages 7–10",
    group: "study",
    config: study("prefixes", "write", 18, 2),
  },
  {
    slug: "suffix-worksheets",
    name: "Suffixes",
    short: "Suffixes",
    heading: "Suffix worksheets",
    keyword: "Free printable suffix worksheets",
    summary:
      "Eighteen suffixes to add to the end of a word — -ful, -less, -ness, -ly, -ing, -ed and -er — including the words that change before the ending goes on.",
    lead: "A word, an ending, and a slot for what the two make. Some of them simply join — “care + ful” is “careful” — and some change first: “happy + ness” is “happiness”, and “hop + ing” doubles the p.",
    notes: [
      "The words that change are the reason this sheet exists. Adding an ending to a word is straightforward until the word ends in y, in e, or in a single consonant after a short vowel — and those three cases cover most of the spelling mistakes made by children who can already spell every word on their list. Meeting “happiness”, “making” and “hopping” on the same page is what makes the three rules visible as a set rather than as three surprises.",
      "Every answer here was written out by a person rather than worked out by a rule, and that is deliberate. English has too many exceptions for a generator to be trusted with them: a program that added “-ing” by rule would print “hopeing” or “makeing” somewhere on the page, and an answer key that is wrong is worse than no sheet at all. The words on this page are checked, which is what makes the key behind it worth marking against.",
    ],
    teaches: "Suffixes and the spelling changes they cause",
    ages: "Ages 7–10",
    group: "study",
    config: study("suffixes", "write", 18, 2),
  },
  {
    slug: "plural-nouns-worksheets",
    name: "Plurals — one and more than one",
    short: "Plurals",
    heading: "Plural nouns worksheets",
    keyword: "Free printable plural nouns worksheets",
    summary:
      "Twenty words to write as more than one, covering every route English takes to a plural: -s, -es, -ies, -ves, and the ones that change shape entirely.",
    lead: "“One box, two ____.” Each line gives a word as one of something and asks for it as more than one. Most take an s; a good many do not, and those are the ones worth the page.",
    notes: [
      "Plurals look like a single rule and are about six. A word takes -s until it hisses, and then it takes -es; a y after a consonant becomes -ies but a y after a vowel does not; several f words take -ves; and then there are the ones that change in the middle — children, men, feet, teeth, mice, geese — and the two that do not change at all. A child who has met all of those on one page has seen that there is a pattern rather than a rule.",
      "The irregular ones are the sheet's real content, and they are irregular because they are old: the words English has used most often for longest are the ones that never got tidied up. “Sheep” and “fish” are on here for the same reason — they are the answer a child least expects to be allowed to write, and getting to write “two sheep” once is worth more than another twenty -s words.",
    ],
    teaches: "Singular and plural nouns",
    ages: "Ages 6–9",
    group: "study",
    config: study("plurals", "write", 20, 2),
  },
  {
    slug: "contraction-worksheets",
    name: "Contractions",
    short: "Contractions",
    heading: "Contraction worksheets",
    keyword: "Free printable contraction worksheets",
    summary:
      "Twelve pairs of words to join to the short form they make, with the apostrophe where the missing letters were — matched up rather than written out.",
    lead: "Two columns: the long way on the left, the short way on the right, and a pencil line between them. “Do not” joins to “don’t”, and the apostrophe stands exactly where the missing o used to be.",
    notes: [
      "The apostrophe is the whole lesson, and it has one job: it marks where letters were taken out. A child who knows that never has to remember whether it is “dont”, “do’nt” or “don’t” — the o is the letter that went, so the mark goes where the o was. That one idea covers nearly every contraction in English and is worth ten minutes more than it usually gets.",
      "“Won’t” is the one that breaks it, and it is on this sheet on purpose. It comes from “woll not” rather than “will not”, which no child needs to be told — but it is worth knowing that the mark is not always where the letters came out, so that one odd spelling is met as an exception rather than as evidence that the rule was never real. Matching rather than writing keeps the focus on the pairing; the builder prints the same twelve as a write-it-out sheet.",
    ],
    teaches: "Contractions and apostrophes",
    ages: "Ages 6–9",
    group: "study",
    config: study("contractions", "match", 12),
  },
  {
    slug: "homophone-worksheets",
    name: "Homophones",
    short: "Homophones",
    heading: "Homophone worksheets",
    keyword: "Free printable homophone worksheets",
    summary:
      "Twelve sentences with a pair of homophones beside each — their and there, to and two, blue and blew — and a ruled gap for the one that belongs.",
    lead: "Each sentence has a word missing and the two spellings it could be printed beside it. Only one of them fits the sentence, and the sentence is the only thing that can decide it.",
    notes: [
      "A homophone cannot be spelt from its sound, which is what makes this the one word exercise that has to be a sentence. “Their” and “there” are one noise, so a child asked to spell that noise cannot be wrong — there is no answer to the question. Put the noise in “put the box over ___” and there is exactly one right answer, and it is decided by meaning rather than by phonics.",
      "These are the mistakes that survive into adult writing, which is a fair argument for meeting them early and often. Their/there, to/too/two, your/you’re and its/it’s are mis-spelt by people who spell everything else correctly, because the ear cannot help and the eye was never trained. Both spellings are printed beside every sentence so that the choice is on the page — the exercise is choosing, not remembering that a choice exists.",
    ],
    teaches: "Choosing between homophones",
    ages: "Ages 7–11",
    group: "study",
    config: study("homophones", "write", 12),
  },
  {
    slug: "synonym-worksheets",
    name: "Synonyms",
    short: "Synonyms",
    heading: "Synonym worksheets",
    keyword: "Free printable synonym worksheets",
    summary:
      "Twelve words to join to a word that means the same — big and large, begin and start, quiet and silent — in two columns with a pencil line between.",
    lead: "Two columns of words, and each word on the left means the same as one on the right. Draw a line between them. Every pair is a word a child already has beside a word that will make their writing better.",
    notes: [
      "Synonyms are how a piece of writing stops saying “big” four times in a paragraph, and that is worth doing before anybody hands a child a thesaurus. A thesaurus offers twenty words for “big” of which three are usable by a nine-year-old; a page of pairs offers one, and it is one they can actually reach for. Every word on the right of this sheet is one a primary child can use without sounding like a dictionary.",
      "Matching rather than writing is the right shape for this one, because the pairing is the whole content. There is nothing to spell here and no rule to apply — the question is whether two words mean the same, which is a judgement about meaning and the first properly semantic exercise on this shelf. Say the pairs in a sentence if one looks doubtful: two words mean the same when swapping them leaves the sentence true.",
    ],
    teaches: "Words that mean the same",
    ages: "Ages 7–11",
    group: "study",
    config: study("synonyms", "match", 12),
  },
  {
    slug: "antonym-worksheets",
    name: "Antonyms",
    short: "Antonyms",
    heading: "Antonym worksheets",
    keyword: "Free printable antonym worksheets",
    summary:
      "Twelve words, each with four to choose from, and one of the four means the opposite. The answer key prints on the page behind.",
    lead: "A word at the start of each line and four words after it. One of them means the opposite; circle it. Hot and cold, always and never, push and pull.",
    notes: [
      "Opposites are the easiest way into what a word means, which is why they are taught before synonyms and to much younger children. A four-year-old who cannot define “empty” can point at the opposite of “full” without hesitating, and that is the same piece of knowledge arriving by the door it fits through. It is also the pairing that makes early reading comprehension questions answerable.",
      "The three wrong answers come from the same set of opposites rather than from anywhere, which keeps the exercise honest: every option on the line is a word that is somebody's opposite, so the answer cannot be found by looking for the odd one out. One word is missing from this sheet on purpose — “light”, whose opposite is “dark” and equally “heavy”, so either answer would be marked wrong against the other.",
    ],
    teaches: "Words that mean the opposite",
    ages: "Ages 5–9",
    group: "study",
    config: study("antonyms", "choose", 12),
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const SPELLING_GROUPS: Array<{
  id: SpellingGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "spelling",
    label: "This week's spelling list",
    blurb: "Five things to do with a list of words, on paper.",
  },
  {
    id: "sight",
    label: "Sight words",
    blurb:
      "The words that turn up most often and are least worth sounding out — traced, written, and picked out.",
  },
  {
    id: "study",
    label: "How words work",
    blurb:
      "Rhyme, syllables, families, prefixes and suffixes, plurals, contractions, homophones, synonyms and antonyms.",
  },
];

/**
 * Whether this sheet's answer key says anything its sheet doesn't.
 *
 * A copying sheet prints the word at the head of every line, so its key is the
 * same page twice; a sentence sheet has no right answer to print at all. Every
 * other style here has an answer the sheet is withholding — a missing letter, an
 * ordered list, which box a letter goes in, which of four words it was — and on
 * those the key is the most useful thing on the shelf.
 */
export function keyed(sheet: SpellingSheet): boolean {
  const { config } = sheet;
  if (config.kind === "words")
    return config.style !== "copy" && config.style !== "sentence";
  return config.kind === "word-study";
}

/** The route a sheet prints at. One stock, so one route — see the note above. */
export const pathFor = (sheet: SpellingSheet): string =>
  `/printables/spelling/${sheet.slug}`;

/** The builder, opened on this sheet. */
export const builderHref = (sheet: SpellingSheet): string =>
  benchHref(sheet.config, SPELLING_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function spellingShelf(): Array<{
  id: SpellingGroup;
  label: string;
  blurb: string;
  sheets: SpellingSheet[];
}> {
  return shelve(SPELLING_GROUPS, SPELLING_SHEETS);
}
