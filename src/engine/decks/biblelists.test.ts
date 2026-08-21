/**
 * The canon, as a failing build.
 *
 * A spelling list that has drifted teaches a child a word wrong once. A books-
 * of-the-Bible list that has drifted teaches them an order they will recite for
 * the rest of their life, and the mistake is invisible in review because one
 * proper noun looks much like another. So the list is pinned from two
 * directions rather than trusted:
 *
 *   - **Against `CANON` below**, which is eBible's own file order for the
 *     release the passage library quotes — name for name, position for
 *     position. Two files would have to be edited identically for a book to
 *     move, which is the same mechanism `scripture.test.ts` gives the verses.
 *   - **Against the passage library itself.** Forty-eight of the sixty-six are
 *     already named in a `ScriptureEntry.ref`, and those verses are checked
 *     character for character against the release. A book spelt one way on a
 *     copywork sheet and another on a memory list is a contradiction inside one
 *     build, and this is where it fails.
 *
 * The rest is the mechanical half of the house rules — the half a machine can
 * see. Whether Amos really kept sheep stays a human's job, and the sources for
 * that are in `biblelists.ts`.
 */
import { describe, expect, it } from "vitest";

import { buildSheet } from "@/engine/sheets";
import { SCRIPTURE } from "@/engine/sheets/passages/scripture";
import type {
  Paper,
  PuzzleConfig,
  PuzzleStyle,
  WordSheetStyle,
  WordsConfig,
} from "@/engine/sheets/types";

import { BIBLE_LISTS } from "./biblelists";
import {
  CLUE_SLOT,
  buildWordDeck,
  fillClue,
  wordDeckSpec,
  wordMode,
} from "./words";
import { SHIPPED_LISTS, WORD_LISTS_BY_ID, listWords } from "./wordlists";

/**
 * The sixty-six, in the order eBible files them.
 *
 * Read off the USFM release — `02-GENengwebu.usfm` through `96-REVengwebu.usfm`,
 * each file's own `\h` running head — with the deuterocanonical books the
 * release also ships (Tobit through 4 Maccabees, filed between Malachi and
 * Matthew) left out, which is the Protestant canon and is stated as a choice in
 * `biblelists.ts` rather than implied here.
 */
const CANON = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

/** Where `CANON` divides. Thirty-nine and twenty-seven is itself memory work. */
const OLD_TESTAMENT = 39;

const listById = (id: string) => {
  const list = BIBLE_LISTS.find((one) => one.id === id);
  if (!list) throw new Error(`No Bible list "${id}"`);
  return list;
};

const BOOKS = [
  ...listWords(listById("bible-books-ot")),
  ...listWords(listById("bible-books-nt")),
];

describe("the books of the Bible", () => {
  it("ships the sixty-six of the Protestant canon", () => {
    expect(listWords(listById("bible-books-ot"))).toHaveLength(OLD_TESTAMENT);
    expect(listWords(listById("bible-books-nt"))).toHaveLength(
      CANON.length - OLD_TESTAMENT,
    );
    expect(BOOKS).toHaveLength(66);
  });

  it("names them the way the release does, in the release's order", () => {
    expect(BOOKS).toEqual(CANON);
  });

  it("keeps a numbered book with the one it is numbered against", () => {
    // Mechanical, and it catches the transposition nobody spots by reading: a
    // "2 Kings" that has drifted above "1 Kings" still looks like a list of
    // kings. Every numbered book is immediately after its predecessor.
    for (const [at, book] of BOOKS.entries()) {
      const number = /^([23]) (.+)$/.exec(book);
      if (!number) continue;
      const before = `${Number(number[1]) - 1} ${number[2]}`;
      expect(BOOKS[at - 1], `${book} follows ${before}`).toBe(before);
    }
  });

  it("spells every book the passage library quotes the same way", () => {
    const spelt = new Set(BOOKS);
    for (const entry of SCRIPTURE) {
      // "Genesis 1:1", "1 Corinthians 13:4-8", "Psalm 23" — the reference off
      // the front, which is the book as a sheet prints it.
      const book = entry.ref.replace(/\s+\d+(:\d+(-\d+)?)?$/, "");
      // One exception, and it is a fact about English rather than a drift: the
      // book is Psalms and a single one of them is cited as "Psalm 23".
      const named = book === "Psalm" ? "Psalms" : book;
      expect(spelt.has(named), `${entry.id} · ${entry.ref}`).toBe(true);
    }
  });

  it("is checked against the passage library on most of the canon", () => {
    // The guard above only guards the books something quotes. This says how
    // many that is, so the day it stops being most of them is a day somebody
    // reads about rather than assumes. Forty-eight today, and a floor rather
    // than an equality because adding a passage from the eighteen unquoted
    // books is a good day and should not be a red suite — but the number in
    // this file's header and in `biblelists.ts` is the count, so raise both
    // when it moves.
    const referenced = new Set(
      SCRIPTURE.map((entry) =>
        entry.ref
          .replace(/\s+\d+(:\d+(-\d+)?)?$/, "")
          .replace(/^Psalm$/, "Psalms"),
      ),
    );
    expect(referenced.size).toBeGreaterThanOrEqual(48);
  });
});

describe("the Bible lists", () => {
  it("gives every list an id of its own, and a name and a blurb", () => {
    const ids = BIBLE_LISTS.map((list) => list.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of BIBLE_LISTS) {
      // The id is in `Session.mode` and in every saved sheet's link, so it is
      // the one field that cannot be renamed later.
      expect(list.id).toMatch(/^bible-[a-z-]+$/);
      expect(list.name).not.toBe("");
      expect(list.blurb).not.toBe("");
      expect(list.entries.length).toBeGreaterThan(0);
    }
  });

  it("says which canon the books follow, where a parent will read it", () => {
    // Sixty-six against seventy-three is the difference between two families'
    // Bibles, and a list that doesn't say which one it is teaches the wrong
    // one to whichever family it isn't (see the header of biblelists.ts).
    expect(listById("bible-books-ot").blurb).toContain("Protestant");
  });

  it("has no blank, untrimmed or repeated entry", () => {
    for (const list of BIBLE_LISTS) {
      const words = listWords(list);
      expect(new Set(words).size, list.id).toBe(words.length);
      for (const word of words) {
        expect(word.trim(), list.id).toBe(word);
        expect(word).not.toBe("");
      }
    }
  });

  it("puts every word in exactly one shipped list", () => {
    // `shippedClue` indexes every sentence in the build by its word, so a word
    // in two lists would have two clues and a crossword would print whichever
    // was registered last. Which is why Ruth, Daniel, Esther, Jonah, Joshua and
    // Job are books here and not also people.
    const owner = new Map<string, string>();
    for (const list of SHIPPED_LISTS) {
      for (const word of listWords(list)) {
        const key = word.toLowerCase();
        expect(
          owner.get(key),
          `"${word}" is already ${owner.get(key)}'s`,
        ).toBeUndefined();
        owner.set(key, list.id);
      }
    }
  });
});

/**
 * The same rules `words.test.ts` holds the Dolch sentences to, over these. A
 * clue is what makes a word answerable when it is heard rather than seen, and
 * a printed crossword reads the same sentences (`crosswordClue`) — so the
 * mechanical half is checked in both places or in neither.
 */
describe("the sentence on every Bible word", () => {
  it("gives every word exactly one slot to fill", () => {
    for (const list of BIBLE_LISTS) {
      for (const { word, clue } of list.entries) {
        expect(clue.split(CLUE_SLOT), `${list.id} · ${word}`).toHaveLength(2);
      }
    }
  });

  it("never spells the word out in its own sentence", () => {
    for (const list of BIBLE_LISTS) {
      for (const { word, clue } of list.entries) {
        const rest = clue.replace(CLUE_SLOT, " ").toLowerCase();
        // Every part of the word, not just the whole of it: "Song of Solomon"
        // would be given away by a sentence that mentioned Solomon.
        for (const part of word.toLowerCase().split(" ")) {
          if (!/^\p{L}/u.test(part)) continue;
          const words = rest.split(/[^a-z']+/).filter(Boolean);
          expect(words, `${list.id} · ${word}`).not.toContain(part);
        }
      }
    }
  });

  it("keeps them short enough to read out on a clock", () => {
    for (const list of BIBLE_LISTS) {
      for (const { word, clue } of list.entries) {
        const length = fillClue(clue, word).split(/\s+/).length;
        expect(length, `${list.id} · ${word}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("gives every word a sentence of its own, across the whole shelf", () => {
    const seen = new Map<string, string>();
    for (const list of SHIPPED_LISTS) {
      for (const { word, clue } of list.entries) {
        const key = clue.toLowerCase();
        const owner = seen.get(key);
        expect(owner, `"${clue}" is also ${owner}'s`).toBeUndefined();
        seen.set(key, `${list.id}:${word}`);
      }
    }
  });
});

/* ── One list, every sheet on the words shelf ────────────────────────────────
   The story's actual promise: a Bible list is a word list, so it prints as any
   of the seven spelling styles (PRINT20) and any of the three puzzles
   (PRINT21). Nothing below is a Bible-shaped code path — that is the point, and
   this is what would catch one appearing.                                    */

const paper = (): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
});

const spelling = (style: WordSheetStyle, words: string[]): WordsConfig => ({
  kind: "words",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style,
  words,
  times: 3,
  gaps: 2,
  count: words.length,
  columns: 2,
});

const puzzle = (style: PuzzleStyle, words: string[]): PuzzleConfig => ({
  kind: "puzzle",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style,
  words,
  size: 15,
  directions: "across-down",
  reverse: false,
  overlap: true,
  count: words.length,
  columns: 2,
});

const STYLES: WordSheetStyle[] = [
  "copy",
  "missing",
  "test",
  "abc",
  "shapes",
  "sentence",
  "find",
];

const PUZZLES: PuzzleStyle[] = ["search", "crossword", "scramble"];

describe("every Bible list, on every sheet style", () => {
  for (const list of BIBLE_LISTS) {
    const words = listWords(list);

    for (const style of STYLES) {
      it(`prints ${list.id} as a ${style} sheet`, () => {
        const config = spelling(style, words);
        const sheet = buildSheet(config, 7);
        expect(sheet.blocks.length).toBeGreaterThan(0);
        expect(sheet.header.title).not.toBe("");
        // A page of nothing is the failure mode a long list would hide: a
        // capacity that came out at zero still builds, and still prints.
        expect(sheet.header.score?.outOf).toBeGreaterThan(0);
        // `(config, seed)` and nothing else (docs/printables.md §7).
        expect(buildSheet(config, 7)).toEqual(sheet);
      });
    }

    for (const style of PUZZLES) {
      it(`prints ${list.id} as a ${style}`, () => {
        const config = puzzle(style, words);
        const sheet = buildSheet(config, 7);
        expect(sheet.blocks.length).toBeGreaterThan(0);
        expect(buildSheet(config, 7)).toEqual(sheet);
      });
    }
  }

  it("clues a Bible crossword out of the list's own sentences", () => {
    // The sentences above are what a crossword prints, rather than the jumbled
    // letters `letterHint` falls back to for a word this build has never met.
    const sheet = buildSheet(
      puzzle("crossword", listWords(listById("bible-people"))),
      3,
    );
    const clues = sheet.blocks.find((block) => block.kind === "crossword");
    expect(clues).toBeDefined();
    if (clues?.kind !== "crossword") throw new Error("no crossword block");
    expect(
      clues.across
        .concat(clues.down)
        .some((entry) => entry.clue.startsWith("Jumbled:")),
    ).toBe(false);
  });
});

/**
 * And the other half of "authored once": Word Jungle takes these by id, with
 * the sentences attached, without a line of this data being written twice
 * (PRINT31 is the picker; the deck already resolves).
 */
describe("a Bible list as a deck", () => {
  it("resolves by id, and names itself", () => {
    for (const list of BIBLE_LISTS) {
      expect(WORD_LISTS_BY_ID.get(list.id)).toBe(list);
      expect(wordDeckSpec(wordMode(list.id)).label).toBe(list.name);
      expect(wordDeckSpec(wordMode(list.id)).world).toBe("jungle");
    }
  });

  it("deals cards that carry the sentence they were written with", () => {
    const cards = buildWordDeck(
      {
        kind: "words",
        listId: "bible-books-nt",
        cardCount: 8,
        inputMode: "type",
      },
      5,
    );
    expect(cards).toHaveLength(8);
    for (const card of cards) {
      expect(card.clue).toBeDefined();
      expect(card.speak).toContain(card.answer);
    }
  });
});
