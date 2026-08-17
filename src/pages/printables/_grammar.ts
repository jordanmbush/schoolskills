/**
 * The grammar sheets the Print Shop has set, and the words that go round them.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two pages
 * share — `grammar/[slug].astro`, which prerenders one sheet per topic, and
 * `grammar/index.astro`, which is the subject hub — rather than a route of its
 * own. `_catalog.ts` does that job for paper, `_maths.ts` for maths,
 * `_spelling.ts` for words, and `_handwriting.ts`, `_cursive.ts` and
 * `_bible.ts` for the writing shelves.
 *
 * **One page per topic, and that is the whole shelf.** §8 asks for the catalog
 * to be bounded, and grammar is the shelf where being greedy would cost the
 * most: "noun worksheets", "verb worksheets", "adjective worksheets" and the
 * rest are all real queries, and all of them would be this same sheet with a
 * filter on it. Five pages, five lessons, each one a thing somebody teaches in
 * a week — and everything else through the builder, which is where choosing
 * belongs.
 *
 * **Why the sheets are short.** A grammar answer can be *defensibly* wrong,
 * which is not true of a column of sums: whether a word is an adverb, whether a
 * comma is needed, which half of a sentence is the subject. So the sentences
 * are authored and tagged in `engine/sheets/grammar/bank.ts` under house rules
 * written down there, the questions are views of those tags, and the shelf is
 * deliberately smaller than it could be. A sheet that marks a defensible answer
 * wrong teaches a child something false, and that is worse than no sheet.
 *
 * **One stock, as with maths and spelling.** Nothing on a grammar sheet is a
 * measurement — there is no ⅝ rule to be scaled into a ⅗ rule by a printer
 * loaded with A4 — so the sheet is correct on either stock and the A4 switch
 * lives in the builder with the other options.
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type {
  GrammarConfig,
  GrammarStyle,
  GrammarTopic,
} from "@/engine/sheets/types";

import { SHEET_FIELDS as FIELDS, benchHref, paperOf, shelve } from "./_catalog";

/** How the hub groups the shelf: what the sheet is really about. */
export type GrammarGroup = "words" | "marks";

export type GrammarSheet = {
  /** The route under /printables/grammar, and the head term it answers. */
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
   * The sheet is prerendered directly under this prose (§8), which makes a
   * quoted sentence a claim about the paper rather than an illustration — a
   * reader can look down the page and check it. So anything quoted here at five
   * words or more has to be a sentence this page really draws, and
   * `_grammar.test.ts` holds it there; a hypothetical the sheet never prints
   * (“Close the gate”) stays shorter than that.
   */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: GrammarGroup;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: GrammarConfig;
};

/**
 * The seed every sheet on this shelf is built from, and it never moves.
 *
 * It decides which of the bank's sentences land on each page and in what order,
 * and nothing else — the answers travel with the sentences. Which is what §7
 * promises stays put: the sheet a parent printed in March is the sheet they
 * print in June, down to the order of the questions.
 */
export const GRAMMAR_SEED = 1;

/** A grammar sheet on Letter, with the name and date line printed blank. */
const grammar = (
  topic: GrammarTopic,
  style: GrammarStyle,
  count: number,
  columns = 1,
): GrammarConfig => ({
  kind: "grammar",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields: FIELDS,
  topic,
  style,
  count,
  columns,
});

export const GRAMMAR_SHEETS: GrammarSheet[] = [
  /* ── Words in a sentence ────────────────────────────────────────────── */
  {
    slug: "parts-of-speech-worksheets",
    name: "Parts of speech",
    short: "Parts of speech",
    heading: "Parts of speech worksheets",
    keyword: "Free printable parts of speech worksheets",
    summary:
      "Twelve sentences, each with one word marked, and five names to circle: noun, verb, adjective, adverb or pronoun. The answer key is the page behind.",
    lead: "One sentence to a question, with a single word quoted after it, and the five word classes underneath to circle between. The question is never what a word usually is — it is what that word is doing in that sentence.",
    notes: [
      "The word being asked about is chosen so that it cannot honestly be called anything else, and that took more discarding than choosing. “Play”, “run”, “walk” and “watch” are nouns as often as verbs; “fast”, “hard” and “well” are adjectives and adverbs both; “light” is three things. None of them is on this sheet. The verbs here are past tense or the opening word of a command, which is the cheapest way in English to make a word class unarguable.",
      "Articles and possessives are not asked about either, and that is a deliberate gap rather than an oversight. Whether “the” is an adjective or a determiner depends entirely on which scheme a child is being taught, and a sheet cannot mark a child on which classroom they happen to be sitting in. Five classes, all of them agreed on, is worth more than nine with two arguments buried in them.",
    ],
    teaches: "Naming parts of speech in a sentence",
    ages: "Ages 7–11",
    group: "words",
    config: grammar("parts", "choose", 12),
  },
  {
    slug: "subject-and-predicate-worksheets",
    name: "Subject and predicate",
    short: "Subject & predicate",
    heading: "Subject and predicate worksheets",
    keyword: "Free printable subject and predicate worksheets",
    summary:
      "Eight sentences to divide in two, with a ruled line for the subject and a ruled line for the predicate, and the key on the page behind.",
    lead: "Each sentence has two ruled lines under it: the subject on the first, the predicate on the second. Every word in the sentence goes on one line or the other, which is what makes the division a question with a single right answer.",
    notes: [
      "Asking for both halves rather than one is the whole design of this page. “Write the subject” is a question with two defensible answers — the complete subject and the simple subject — and a child taught one of them would be marked wrong for giving it. Asking a child to place every word closes that door: “dog” on its own cannot be right, because “The big brown” would then have nowhere to go.",
      "The sentences are all plain statements, which is also deliberate. A command has no subject on the page at all — “Close the gate” is addressed to somebody who is never named — and a question keeps its subject inside the verb phrase, where a nine-year-old cannot fairly be asked to find it. Those are good things to talk about and bad things to mark, so they are on the sentence-types page instead.",
    ],
    teaches: "Dividing a sentence into subject and predicate",
    ages: "Ages 8–11",
    group: "words",
    config: grammar("subject", "write", 8),
  },

  /* ── Sentences and their marks ──────────────────────────────────────── */
  {
    slug: "types-of-sentences-worksheets",
    name: "Kinds of sentence",
    short: "Kinds of sentence",
    heading: "Types of sentences worksheets",
    keyword: "Free printable types of sentences worksheets",
    summary:
      "Twelve sentences to sort into statements, questions, commands and exclamations, with four names to circle on every line and the key behind.",
    lead: "A sentence on each line and four things it could be underneath: a statement, a question, a command or an exclamation. Two of the four announce themselves with the mark on the end; the other two do not, and that is where the work is.",
    notes: [
      "Statements and commands both end in a full stop, and telling them apart is the whole exercise. “The old tractor belonged to Jack” and “Put the muddy boots outside the door” look identical at the end of the line, and the only way through is to ask what the sentence is for — one of them says how the world is, and the other tells somebody to change it. Questions and exclamations are the easy half, and they are there so a six-year-old can start.",
      "Every exclamation on this sheet is an exclamation by its grammar rather than by its tone: “What a tremendous splash that was!” and “How brightly the lights of Oslo shone!” cannot be written any other way. That rules out a whole class of sentence a worksheet usually smuggles in — the plain statement with a bang on the end, where whether it should have been a full stop is a matter of how loudly you were imagining it. There is no right answer to that, so it is not asked.",
    ],
    teaches: "Statements, questions, commands and exclamations",
    ages: "Ages 6–10",
    group: "marks",
    config: grammar("types", "choose", 12),
  },
  {
    slug: "punctuation-worksheets",
    name: "The mark at the end",
    short: "End marks",
    heading: "Punctuation worksheets",
    keyword: "Free printable punctuation worksheets",
    summary:
      "Twenty sentences printed with nothing on the end and a ruled space for the mark that belongs there — a full stop or a question mark, and the key behind.",
    lead: "Each sentence stops where its punctuation should be, and there is a ruled space for the mark. A full stop or a question mark: which one is decided by the way the sentence is built, not by how it is read aloud.",
    notes: [
      "Only two marks are asked for, and the reason is the same one that shapes the rest of this shelf. Whether a sentence deserves an exclamation mark is a judgement about tone — “What a mess” is right with a bang and not wrong with a full stop — so an answer key cannot honestly claim either. A full stop against a question mark is decided by grammar instead: a sentence that inverts its verb or opens on a question word is a question, and nothing else is.",
      "Commands are on this sheet on purpose, and they are the reason it is worth doing at all. “Put the muddy boots outside the door” takes a full stop although it is not a statement, which is exactly the case a child gets wrong after being taught that questions get question marks and everything else is a statement. Twenty short sentences in two columns is about five minutes, which is the right length for a thing that is mostly about noticing.",
    ],
    teaches: "Choosing the mark at the end of a sentence",
    ages: "Ages 5–9",
    group: "marks",
    config: grammar("punctuation", "write", 20, 2),
  },
  {
    slug: "capitalization-worksheets",
    name: "Capital letters",
    short: "Capital letters",
    heading: "Capitalization worksheets",
    keyword: "Free printable capitalization worksheets",
    summary:
      "Twelve sentences with one word printed in lower case that should not be — a name, a place or a day — and a ruled line to write it correctly on.",
    lead: "Every sentence has exactly one word that has lost its capital letter: a person, a place, or a day of the week. Find it, and write it properly on the line beside the sentence.",
    notes: [
      "One word to a sentence, and never the first, which is what makes this markable rather than a hunt. A sheet that lower-cases everything and asks a child to “rewrite it correctly” has as many right answers as it has readers — one child fixes four words, another fixes six, and the parent marking it has to adjudicate. Here the first letter of the sentence is already a capital, one word inside it is not, and there is one thing to point at.",
      "Names, places and days are the three that carry nearly all the work in a primary classroom, and they are the three on this page. What is not here is the harder half — titles, the first word of speech, the “I” that is capital wherever it stands — not because they do not matter but because each of them brings a second word into the sentence that also wants a capital, and this sheet's whole promise is that there is exactly one.",
    ],
    teaches: "Capital letters for names, places and days",
    ages: "Ages 5–9",
    group: "marks",
    config: grammar("capitals", "write", 12),
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const GRAMMAR_GROUPS: Array<{
  id: GrammarGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "words",
    label: "Words in a sentence",
    blurb: "What each word is doing, and where the sentence divides in two.",
  },
  {
    id: "marks",
    label: "Sentences and their marks",
    blurb:
      "What a sentence is for, the mark it ends on, and the letters that have to be capital.",
  },
];

/** The route a sheet prints at. One stock, so one route — see the note above. */
export const pathFor = (sheet: GrammarSheet): string =>
  `/printables/grammar/${sheet.slug}`;

/** The builder, opened on this sheet. */
export const builderHref = (sheet: GrammarSheet): string =>
  benchHref(sheet.config, GRAMMAR_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function grammarShelf(): Array<{
  id: GrammarGroup;
  label: string;
  blurb: string;
  sheets: GrammarSheet[];
}> {
  return shelve(GRAMMAR_GROUPS, GRAMMAR_SHEETS);
}
