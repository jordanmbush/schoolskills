import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "@/engine/sheets/paper";
import type {
  Block,
  MarkedWord,
  PhonicsConfig,
  PhonicsMarking,
  PhonicsStyle,
  Sheet,
} from "@/engine/sheets/types";

import { WORD_BY_SPELLING } from "./bank";
import { markWord, markedText } from "./cards";
import { allSounds, readInventory, type Inventory } from "./inventory";
import { SENTENCES, sentenceText, sentenceWords } from "./sentences";
import {
  PHONICS_STYLES,
  familiesOf,
  graphemeText,
  phonicsColumns,
  phonicsLayout,
  phonicsSupply,
} from "./sheets";
import {
  CORRESPONDENCES,
  CORRESPONDENCE_BY_ID,
  PHONEME_BY_ID,
  isTeachable,
} from "./sounds";

/**
 * The phonics sheets, held to the one promise the family makes.
 *
 * **Nothing on the page uses a spelling that has not been taught.** Every case
 * below is a way of checking that, and the check is deliberately made from the
 * *finished sheet* rather than from the generator: the words are read back off
 * the blocks, looked up in the bank, and their spellings compared with the
 * inventory the config carried. A generator asserting its own output would
 * agree with itself whatever it did — the same reason a word search's key is
 * found by searching its grid (§11).
 *
 * The answer keys are re-derived the same way. A blending prompt is put back
 * together into the word it segments, a family's sum is added up, and a
 * matching pair is checked against the letters in the word rather than against
 * the index the placer remembered writing.
 */

/* ── Inventories to print from ─────────────────────────────────────────────
   Written out as ids rather than derived, because a test whose inventory came
   out of a filter over the same table the family reads would pass on a table
   that had quietly changed underneath both. `keeps` asserts every id below is
   still a spelling this build teaches, so a renamed correspondence fails here
   rather than silently narrowing every case that follows.                    */

const FIRST_SOUNDS = [
  "s:s",
  "a:a",
  "t:t",
  "p:p",
  "i:i",
  "n:n",
  "m:m",
  "d:d",
  "g:g",
  "o:o",
  "c:k",
  "k:k",
  "e:e",
  "u:u",
  "r:r",
  "h:h",
  "b:b",
  "f:f",
  "l:l",
  "j:j",
  "v:v",
  "w:w",
  "y:y",
  "z:z",
  "x:k-s",
];

const DIGRAPH_SOUNDS = [
  "sh:sh",
  "ch:ch",
  "th:th",
  "th:dh",
  "ck:k",
  "ng:ng",
  "ll:l",
  "ss:s",
  "ff:f",
  "zz:z",
  "e:uh",
];

/** The first letters, plus `the` taught by sight the way every scheme does. */
const FIRST: Inventory = { sounds: FIRST_SOUNDS, tricky: ["the"] };

const DIGRAPHS: Inventory = {
  sounds: [...FIRST_SOUNDS, ...DIGRAPH_SOUNDS],
  tricky: ["the", "said"],
};

const EVERYTHING = allSounds();

const INVENTORIES: Array<[name: string, inventory: Inventory]> = [
  ["the first letters", FIRST],
  ["the digraphs as well", DIGRAPHS],
  ["everything the table teaches", EVERYTHING],
];

const config = (
  style: PhonicsStyle,
  inventory: Inventory,
  extra: Partial<PhonicsConfig> = {},
): PhonicsConfig => ({
  kind: "phonics",
  paper: DEFAULT_PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: ["name", "date"],
  style,
  inventory,
  marking: {},
  count: 16,
  columns: 2,
  ...extra,
});

/* ── Reading the page back ─────────────────────────────────────────────── */

const only = (sheet: Sheet): Block => {
  expect(sheet.blocks).toHaveLength(1);
  return sheet.blocks[0];
};

/**
 * A blending prompt put back together into the word it cuts up.
 *
 * The independent path for that style: it reads the letters off the paper and
 * reassembles them by the one rule the notation has — a split vowel is printed
 * `a-e`, its first half sits where the vowel goes and its second half at the
 * end of the word — without consulting the bank entry the prompt came from.
 */
function blended(prompt: string): string {
  const head: string[] = [];
  const tail: string[] = [];
  for (const piece of prompt.split("·").map((part) => part.trim())) {
    const cut = piece.indexOf("-");
    if (cut < 0) head.push(piece);
    else {
      head.push(piece.slice(0, cut));
      tail.push(piece.slice(cut + 1));
    }
  }
  return [...head, ...tail].join("");
}

/** Every whole word this sheet prints, whichever block it printed it in. */
function wordsOn(sheet: Sheet): string[] {
  const block = only(sheet);
  if (block.kind === "problems")
    return block.items.map((item) => item.answer).filter(Boolean);
  if (block.kind === "matching") return block.right;
  if (block.kind === "cards")
    return block.cards.flatMap((card) =>
      markedText(card.big)
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean),
    );
  return [];
}

/**
 * Is this word one the inventory really allows?
 *
 * Re-derived from the spellings rather than asked of `canRead`, which is the
 * point: the family calls `canRead`, so a bug inside it would make the family
 * and its test wrong together. Here the parts are compared with the ticked ids
 * directly, and a sight word is only allowed where the style says it is.
 */
function allowed(word: string, inventory: Inventory, sight: boolean): boolean {
  const entry = WORD_BY_SPELLING.get(word);
  if (!entry) return false;
  if (entry.parts.every((part) => inventory.sounds.includes(part))) return true;
  return sight && inventory.tricky.includes(word);
}

/* ── The table these cases are written against ─────────────────────────── */

describe("the inventories these cases print from", () => {
  it("keeps every spelling they name", () => {
    for (const [name, inventory] of INVENTORIES) {
      const read = readInventory(inventory);
      expect(read.sounds, name).toHaveLength(inventory.sounds.length);
      expect(read.tricky, name).toEqual(inventory.tricky);
    }
  });
});

/* ── The promise ───────────────────────────────────────────────────────── */

/**
 * The styles that print whole words, and whether a sight word may be one.
 *
 * Two of the five say yes, and each for a reason written down where it is
 * built: a dictation line is read out rather than sounded out, which is exactly
 * how `said` is taught, and a sentence needs `the` long before a child could
 * decode it. Everywhere else a sight word on the page would be a word offered
 * as though it followed the rules.
 */
const WORD_STYLES: Array<[style: PhonicsStyle, sight: boolean]> = [
  ["blending", false],
  ["families", false],
  ["matching", false],
  ["dictation", true],
  ["sentences", true],
];

describe("what may go on the page", () => {
  it("uses no spelling outside the inventory, on any style or seed", () => {
    for (const [name, inventory] of INVENTORIES) {
      for (const [style, sight] of WORD_STYLES) {
        for (let seed = 0; seed < 8; seed++) {
          const sheet = buildSheet(config(style, inventory), seed);
          for (const word of wordsOn(sheet)) {
            expect(
              allowed(word, inventory, sight),
              `${style} · ${name} · seed ${seed} · ${word}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it("prints nothing at all before anything is taught", () => {
    for (const style of PHONICS_STYLES) {
      const sheet = buildSheet(config(style, { sounds: [], tricky: [] }), 1);
      const block = only(sheet);
      const items =
        block.kind === "problems"
          ? block.items.length
          : block.kind === "cards"
            ? block.cards.length
            : block.kind === "matching"
              ? block.left.length
              : 0;
      expect(items, style).toBe(0);
    }
  });

  it("keeps sight words off every sheet but the dictation one", () => {
    // `said` is on the list and can never be sounded out, so a sheet that
    // asks a child to blend it is the exact failure the `odd` flag exists to
    // prevent. A dictation line is where it belongs, because it is read out.
    const spoken = new Set(
      wordsOn(buildSheet(config("dictation", DIGRAPHS, { count: 60 }), 3)),
    );
    expect(spoken.size).toBeGreaterThan(0);
    for (const style of ["blending", "families", "sentences"] as const) {
      for (let seed = 0; seed < 5; seed++) {
        const words = wordsOn(buildSheet(config(style, DIGRAPHS), seed));
        expect(words).not.toContain("said");
      }
    }
  });
});

/* ── The answer keys ───────────────────────────────────────────────────── */

describe("an answer that can be checked without the generator", () => {
  it("blends each prompt back into the word it is the answer to", () => {
    for (const [name, inventory] of INVENTORIES) {
      const sheet = buildSheet(config("blending", inventory), 5);
      const block = only(sheet);
      expect(block.kind).toBe("problems");
      if (block.kind !== "problems") return;
      expect(block.items.length).toBeGreaterThan(0);
      for (const item of block.items) {
        expect(blended(item.prompt), `${name} · ${item.prompt}`).toBe(
          item.answer,
        );
      }
    }
  });

  it("adds up every word family sum", () => {
    const sheet = buildSheet(config("families", DIGRAPHS), 2);
    const block = only(sheet);
    expect(block.kind).toBe("problems");
    if (block.kind !== "problems") return;
    expect(block.items.length).toBeGreaterThan(0);
    for (const item of block.items) {
      const [onset, rime] = item.prompt.replace(" =", "").split(" + ");
      expect(`${onset}${rime}`).toBe(item.answer);
      expect(WORD_BY_SPELLING.has(item.answer)).toBe(true);
    }
  });

  it("never groups two rimes that only look alike", () => {
    // `be` and `the` end in the same letter and not in the same sound. A
    // family keyed on letters would put them together and teach a rhyme that
    // isn't one, so the key is the spellings — and this re-derives them out of
    // the table rather than reading the key the grouping was made on.
    const rimeOf = (word: string): string[] => {
      const parts = WORD_BY_SPELLING.get(word)?.parts ?? [];
      const at = parts.findIndex((part) => {
        const sound = CORRESPONDENCE_BY_ID.get(part)?.phonemes[0];
        return (
          sound !== undefined && PHONEME_BY_ID.get(sound)?.kind === "vowel"
        );
      });
      return at < 0 ? [] : parts.slice(at);
    };

    const groups = familiesOf(EVERYTHING);
    expect(groups.size).toBeGreaterThan(0);
    for (const words of groups.values()) {
      const rime = rimeOf(words[0].word);
      expect(rime.length).toBeGreaterThan(0);
      // Two words at least, or it is a word rather than a family.
      expect(words.length).toBeGreaterThan(1);
      for (const word of words) expect(rimeOf(word.word)).toEqual(rime);
    }
  });

  it("pairs each spelling with a word that has it and no other on the sheet", () => {
    for (let seed = 0; seed < 6; seed++) {
      const sheet = buildSheet(config("matching", EVERYTHING), seed);
      const block = only(sheet);
      expect(block.kind).toBe("matching");
      if (block.kind !== "matching") return;
      expect(block.left.length).toBeGreaterThan(0);

      // Every spelling on the left, as the ids a word could carry — read off
      // the table rather than off what the generator paired them with.
      const wanted = block.left.map((letters) =>
        CORRESPONDENCES.filter(
          (entry) => graphemeText(entry.grapheme) === letters,
        ).map((entry) => entry.id),
      );

      block.left.forEach((letters, at) => {
        const word = WORD_BY_SPELLING.get(block.right[block.answer[at]]);
        expect(word, letters).toBeDefined();
        const parts = word?.parts ?? [];
        // In the word it is paired with…
        expect(parts.some((part) => wanted[at].includes(part))).toBe(true);
        // …and in none of the others, which is what makes the key unique.
        wanted.forEach((ids, other) => {
          if (other === at) return;
          expect(parts.some((part) => ids.includes(part))).toBe(false);
        });
      });
      expect(new Set(block.right).size).toBe(block.right.length);
      // And the same letters never appear twice down the left, which would be
      // two identical rows a child could not tell apart.
      expect(new Set(block.left).size).toBe(block.left.length);
    }
  });

  it("prints the answers only on the key, from the same build", () => {
    const asked = config("blending", DIGRAPHS);
    const sheet = buildSheet(asked, 7);
    const key = answerKey(asked, 7);
    expect(sheet.answers).toBe(false);
    expect(key.answers).toBe(true);
    expect(key.footer.note).toBe("Answer key");
    // The blocks are the same blocks: the answers were computed when the sheet
    // was built and the key only decides to print them.
    expect(key.blocks).toEqual(sheet.blocks);
  });
});

/* ── Sentences ─────────────────────────────────────────────────────────── */

describe("the sentences", () => {
  it("is made of words the bank has cut", () => {
    for (const sentence of SENTENCES) {
      expect(sentenceWords(sentence), sentence.words.join(" ")).toBeDefined();
    }
  });

  it("prints as a capital, the words, and one mark", () => {
    for (const sentence of SENTENCES) {
      const text = sentenceText(sentence);
      expect(text.endsWith(sentence.end)).toBe(true);
      expect(text.slice(0, -1).toLowerCase()).toBe(sentence.words.join(" "));
    }
  });

  it("puts nothing on a strip a child cannot read", () => {
    for (const [name, inventory] of INVENTORIES) {
      const sheet = buildSheet(config("sentences", inventory), 4);
      const block = only(sheet);
      expect(block.kind).toBe("cards");
      if (block.kind !== "cards") return;
      for (const card of block.cards) {
        const printed = markedText(card.big);
        for (const word of printed
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter(Boolean))
          // Sight words allowed: `the` is what makes a decodable sentence
          // possible at all, and it is on the parent's own list.
          expect(allowed(word, inventory, true), `${name} · ${word}`).toBe(
            true,
          );
      }
    }
  });

  it("opens up as soon as `the` is taught by sight", () => {
    const withoutThe: Inventory = { sounds: FIRST_SOUNDS, tricky: [] };
    expect(phonicsSupply(config("sentences", withoutThe))).toBe(0);
    expect(phonicsSupply(config("sentences", FIRST))).toBeGreaterThan(0);
  });
});

/* ── The marks ─────────────────────────────────────────────────────────── */

const ALL_MARKS: PhonicsMarking = { macron: true, silent: true, joined: true };

const marked = (word: string, marking: PhonicsMarking): MarkedWord =>
  markWord(WORD_BY_SPELLING.get(word)!, marking);

describe("marking a word", () => {
  it("says nothing at all with the switches off", () => {
    for (const entry of WORD_BY_SPELLING.values()) {
      const pieces = markWord(entry, {});
      expect(pieces.every((piece) => piece.mark === undefined)).toBe(true);
      expect(markedText(pieces)).toBe(entry.word);
    }
  });

  it("never changes the letters, whatever is switched on", () => {
    for (const entry of WORD_BY_SPELLING.values()) {
      expect(markedText(markWord(entry, ALL_MARKS))).toBe(entry.word);
    }
  });

  it("marks each of the three where it belongs, and nowhere else", () => {
    // A bar over a vowel that says its own name, and not over the same letter
    // saying its short sound.
    expect(marked("cake", { macron: true })).toContainEqual({
      text: "a",
      mark: "macron",
    });
    expect(marked("cat", { macron: true }).every((p) => !p.mark)).toBe(true);

    // The `e` of `cake` says nothing, and it is the piece that dims.
    expect(marked("cake", { silent: true }).at(-1)).toEqual({
      text: "e",
      mark: "silent",
    });
    expect(marked("cat", { silent: true }).every((p) => !p.mark)).toBe(true);

    // Two letters, one sound, tied underneath.
    expect(marked("ship", { joined: true })).toContainEqual({
      text: "sh",
      mark: "joined",
    });
    expect(marked("sit", { joined: true }).every((p) => !p.mark)).toBe(true);
  });

  it("never puts two marks on one piece", () => {
    for (const entry of WORD_BY_SPELLING.values()) {
      for (const piece of markWord(entry, ALL_MARKS)) {
        // The type allows one, so what this really checks is the argument in
        // `cards.ts`: a silent piece has no sounds, a macron goes on a single
        // letter, and a join needs two — no spelling satisfies two of those.
        const marks = [
          piece.mark === "macron",
          piece.mark === "silent",
          piece.mark === "joined",
        ].filter(Boolean);
        expect(marks.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is switched independently, all eight ways", () => {
    const word = WORD_BY_SPELLING.get("white")!;
    const seen = new Set<string>();
    for (const macron of [false, true])
      for (const silent of [false, true])
        for (const joined of [false, true])
          seen.add(JSON.stringify(markWord(word, { macron, silent, joined })));
    // `white` has all three in it — `wh`, the long `i`, and the silent `e` —
    // so every combination of the switches is a different page.
    expect(seen.size).toBe(8);
  });
});

/* ── The page it lands on ──────────────────────────────────────────────── */

describe("the sheet as a whole", () => {
  it("draws the same page from the same seed, and a different one from the next", () => {
    for (const style of PHONICS_STYLES) {
      const asked = config(style, EVERYTHING);
      expect(buildSheet(asked, 12)).toEqual(buildSheet(asked, 12));
      if (style === "chart") continue; // A chart is the table, in table order.
      expect(buildSheet(asked, 12)).not.toEqual(buildSheet(asked, 13));
    }
  });

  it("never puts on more than the paper was measured for", () => {
    for (const style of PHONICS_STYLES) {
      const asked = config(style, EVERYTHING, { count: 200 });
      const { perPage } = phonicsLayout(asked);
      const block = only(buildSheet(asked, 1));
      const items =
        block.kind === "problems"
          ? block.items.length
          : block.kind === "cards"
            ? block.cards.length
            : block.kind === "matching"
              ? block.left.length
              : 0;
      expect(items, style).toBeGreaterThan(0);
      expect(items, style).toBeLessThanOrEqual(perPage);
    }
  });

  it("marks out of what is on the page, and only where there is an answer", () => {
    for (const style of PHONICS_STYLES) {
      const sheet = buildSheet(config(style, EVERYTHING), 1);
      const block = only(sheet);
      const answers =
        block.kind === "problems"
          ? block.items.length
          : block.kind === "matching"
            ? block.left.length
            : 0;
      expect(sheet.header.score?.outOf ?? 0, style).toBe(answers);
    }
  });

  it("lays a list down the page whatever a saved config asks for", () => {
    for (const style of PHONICS_STYLES) {
      const block = only(
        buildSheet(config(style, EVERYTHING, { columns: 6 }), 1),
      );
      const columns =
        block.kind === "problems" || block.kind === "cards" ? block.columns : 1;
      expect(columns, style).toBeLessThanOrEqual(phonicsColumns(style));
    }
  });

  it("names itself in the words it was chosen by", () => {
    const line = buildSheet(config("cards", FIRST), 1);
    expect(line.header.title).toBe("Sound cards");
    expect(line.footer.url).toContain("schoolskills.app");
  });

  it("prints the table's own example on a card, marked or not", () => {
    // The example under a spelling is a mnemonic rather than a word to decode
    // — "sh as in ship", chosen so the sound is unmistakable said aloud — so it
    // is the table's own and stays put as the inventory grows. That is the one
    // deliberate exception to "everything on the page is decodable", and it is
    // stated here so it cannot become an accident.
    const block = only(buildSheet(config("cards", FIRST, { count: 60 }), 1));
    if (block.kind !== "cards") return;
    const examples = new Set(
      CORRESPONDENCES.filter(isTeachable).map((entry) => entry.example),
    );
    for (const card of block.cards) {
      expect(card.small).toBeDefined();
      expect(examples.has(markedText(card.small ?? []))).toBe(true);
    }
  });

  it("shows a split vowel as `a-e`, never with the table's underscore", () => {
    // The underscore reads as a blank to fill in, and a single `_` in a prompt
    // is where `Problems` draws the ruled slot — so one on a sheet would be a
    // rule drawn through the middle of a spelling.
    for (const entry of CORRESPONDENCES) {
      expect(graphemeText(entry.grapheme)).not.toContain("_");
    }
    const block = only(buildSheet(config("blending", EVERYTHING), 9));
    if (block.kind !== "problems") return;
    for (const item of block.items) expect(item.prompt).not.toContain("_");
  });

  it("cuts every card out of a spelling this build still teaches", () => {
    const block = only(buildSheet(config("chart", EVERYTHING), 1));
    if (block.kind !== "cards") return;
    expect(block.boxed).toBe(false);
    const taught = new Set(
      CORRESPONDENCES.filter(isTeachable).map((entry) =>
        graphemeText(entry.grapheme),
      ),
    );
    for (const card of block.cards)
      expect(taught.has(markedText(card.big))).toBe(true);
    // And nothing untickable reached it, which is what `odd` is for.
    for (const card of block.cards) {
      const letters = markedText(card.big);
      const rows = CORRESPONDENCES.filter(
        (entry) => graphemeText(entry.grapheme) === letters,
      );
      expect(rows.some(isTeachable)).toBe(true);
    }
  });

  it("resolves a style this build has never heard of rather than throwing", () => {
    const saved = config("cards", FIRST);
    const sheet = buildSheet({ ...saved, style: "runes" as PhonicsStyle }, 1);
    expect(sheet.header.title).toBe("Say it slowly, then say it fast");
  });

  it("keeps a spelling the table has retired out of a saved sheet", () => {
    const stale: Inventory = {
      sounds: [...FIRST_SOUNDS, "th:ancient"],
      tricky: [],
    };
    expect(CORRESPONDENCE_BY_ID.has("th:ancient")).toBe(false);
    const words = wordsOn(buildSheet(config("blending", stale), 2));
    expect(words.length).toBeGreaterThan(0);
    for (const word of words) expect(allowed(word, stale, false)).toBe(true);
  });
});
